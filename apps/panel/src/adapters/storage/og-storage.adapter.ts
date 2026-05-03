import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { StorageError } from '../../domain/errors';
import type { DomainLogger } from '../../domain/ports/logger.port';
import type {
  StorageGetResult,
  StoragePort,
  StoragePutInput,
  StoragePutResult,
} from '../../domain/ports/storage.port';

/**
 * 0G Storage adapter.
 *
 * Strategy (per SPIKE.md):
 *   1. Encrypt payload locally with AES-256-GCM under a one-time symmetric key.
 *   2. Wrap that key under each authorised reader's secp256k1 pubkey via ECIES.
 *      In Phase 3 we do NOT yet have an ENS-to-pubkey resolver; we record the
 *      symbolic reader list inside the wrapped-key bundle and let apps/api gate
 *      access. Phase 4 wires real ENS public-key resolution.
 *   3. Upload the encrypted blob via the @0gfoundation/0g-storage-ts-sdk Indexer.
 *   4. Upload a small companion blob with the wrapped-key set.
 *   5. Return URI: `0g://storage/<rootHash>?keys=<companionRootHash>`.
 *
 * Live behaviour must be verified against testnet via the spike script.
 */

export interface OgStorageAdapterOptions {
  rpcUrl: string;
  indexerUrl: string;
  privateKey: string;
  logger: DomainLogger;
}

interface IndexerLike {
  upload(blob: unknown, rpcUrl: string, signer: unknown): Promise<[unknown]>;
  downloadToBlob(rootHash: string): Promise<[unknown]>;
}

interface KeyEnvelope {
  algorithm: 'aes-256-gcm';
  iv: string;
  tag: string;
  reader: string;
  // Phase 3: key is recorded plaintext-base64 + the reader's symbolic identifier.
  // Phase 4 wraps the key under the reader's secp256k1 pubkey via ECIES.
  wrappedKeyB64: string;
}

interface CompanionBundle {
  schemaVersion: 1;
  envelopes: KeyEnvelope[];
}

export class OgStorageAdapter implements StoragePort {
  private indexerPromise: Promise<{ indexer: IndexerLike; signer: unknown }> | null = null;

  constructor(private readonly options: OgStorageAdapterOptions) {}

  async put(input: StoragePutInput): Promise<StoragePutResult> {
    const { indexer, signer } = await this.getIndexer();
    const sdk = await loadStorageSdk();

    const symKey = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', symKey, iv);
    const encrypted = Buffer.concat([cipher.update(Buffer.from(input.content)), cipher.final()]);
    const tag = cipher.getAuthTag();
    const sealed = Buffer.concat([encrypted]);

    let payloadRoot: string;
    try {
      const blob = new sdk.MemData(new Uint8Array(sealed));
      const [tx] = await indexer.upload(blob, this.options.rpcUrl, signer);
      const tree = await (blob as { merkleTree(): Promise<[{ rootHash(): string }]> }).merkleTree();
      payloadRoot = tree[0].rootHash();
      this.options.logger.info('og-storage.payload.uploaded', {
        sizeBytes: sealed.byteLength,
        tx: typeof tx === 'object' && tx ? JSON.stringify(tx).slice(0, 120) : String(tx),
      });
    } catch (err) {
      throw new StorageError('upload_failed', (err as Error).message, {
        sizeBytes: sealed.byteLength,
      });
    }

    const envelopes: KeyEnvelope[] = input.accessControl.authorizedReaders.map((reader) => ({
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      reader,
      // Phase 3 placeholder; Phase 4 ECIES-wraps the key under the reader's pubkey.
      wrappedKeyB64: symKey.toString('base64'),
    }));
    const companion: CompanionBundle = { schemaVersion: 1, envelopes };
    const companionBytes = new TextEncoder().encode(JSON.stringify(companion));

    let companionRoot: string;
    try {
      const companionBlob = new sdk.MemData(companionBytes);
      await indexer.upload(companionBlob, this.options.rpcUrl, signer);
      const tree = await (
        companionBlob as { merkleTree(): Promise<[{ rootHash(): string }]> }
      ).merkleTree();
      companionRoot = tree[0].rootHash();
    } catch (err) {
      throw new StorageError('upload_failed', `companion upload failed: ${(err as Error).message}`);
    }

    return {
      uri: `0g://storage/${payloadRoot}?keys=${companionRoot}`,
      sizeBytes: input.content.byteLength,
    };
  }

  async get(uri: string): Promise<StorageGetResult> {
    const parsed = parseOgUri(uri);
    if (!parsed) throw new StorageError('download_failed', `Cannot parse 0G URI: ${uri}`);
    const { indexer } = await this.getIndexer();

    let companionBlob: unknown;
    try {
      const [b] = await indexer.downloadToBlob(parsed.companionRoot);
      companionBlob = b;
    } catch (err) {
      throw new StorageError(
        'download_failed',
        `companion download failed: ${(err as Error).message}`,
        { uri },
      );
    }
    const companionBytes = await blobToBytes(companionBlob);
    const companion = JSON.parse(new TextDecoder().decode(companionBytes)) as CompanionBundle;
    const envelope = companion.envelopes[0];
    if (!envelope) {
      throw new StorageError('download_failed', 'companion bundle has no envelopes', { uri });
    }

    let payloadBlob: unknown;
    try {
      const [b] = await indexer.downloadToBlob(parsed.payloadRoot);
      payloadBlob = b;
    } catch (err) {
      throw new StorageError(
        'download_failed',
        `payload download failed: ${(err as Error).message}`,
        { uri },
      );
    }
    const sealed = Buffer.from(await blobToBytes(payloadBlob));
    const decipher = createDecipheriv(
      envelope.algorithm,
      Buffer.from(envelope.wrappedKeyB64, 'base64'),
      Buffer.from(envelope.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    let plaintext: Buffer;
    try {
      plaintext = Buffer.concat([decipher.update(sealed), decipher.final()]);
    } catch (err) {
      throw new StorageError('encryption_failed', (err as Error).message, { uri });
    }
    return { content: new Uint8Array(plaintext), contentType: 'application/json' };
  }

  private async getIndexer(): Promise<{ indexer: IndexerLike; signer: unknown }> {
    if (this.indexerPromise) return this.indexerPromise;
    this.indexerPromise = (async () => {
      const ethers = await import('ethers').catch((err) => {
        throw new StorageError('upload_failed', `ethers not installed: ${(err as Error).message}`);
      });
      const sdk = await loadStorageSdk();
      const provider = new ethers.JsonRpcProvider(this.options.rpcUrl);
      const signer = new ethers.Wallet(this.options.privateKey, provider);
      const indexer = new sdk.Indexer(this.options.indexerUrl) as unknown as IndexerLike;
      return { indexer, signer };
    })();
    return this.indexerPromise;
  }
}

interface StorageSdkModule {
  MemData: new (bytes: Uint8Array) => unknown;
  Indexer: new (url: string) => unknown;
}

async function loadStorageSdk(): Promise<StorageSdkModule> {
  return (await import('@0gfoundation/0g-storage-ts-sdk').catch((err) => {
    throw new StorageError(
      'upload_failed',
      `@0gfoundation/0g-storage-ts-sdk not installed: ${(err as Error).message}. ` +
        `See apps/panel/SPIKE.md for the install + endpoint config.`,
    );
  })) as unknown as StorageSdkModule;
}

function parseOgUri(uri: string): { payloadRoot: string; companionRoot: string } | null {
  const m = uri.match(/^0g:\/\/storage\/([^?]+)\?keys=(.+)$/);
  if (!m) return null;
  return { payloadRoot: m[1] as string, companionRoot: m[2] as string };
}

async function blobToBytes(blob: unknown): Promise<Uint8Array> {
  if (blob instanceof Uint8Array) return blob;
  if (
    blob &&
    typeof (blob as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === 'function'
  ) {
    return new Uint8Array(await (blob as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer());
  }
  throw new StorageError('download_failed', 'unrecognised blob type returned by indexer');
}
