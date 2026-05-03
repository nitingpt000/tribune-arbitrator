import { createHash } from 'node:crypto';

import type {
  StorageGetResult,
  StoragePort,
  StoragePutInput,
  StoragePutResult,
} from '../../domain/ports/storage.port';

export class MemoryStorageAdapter implements StoragePort {
  private readonly blobs = new Map<string, { content: Uint8Array; contentType: string }>();

  async put(input: StoragePutInput): Promise<StoragePutResult> {
    const hash = createHash('sha256').update(input.content).digest('hex');
    const uri = `memory://${hash}`;
    this.blobs.set(uri, {
      content: input.content,
      contentType: input.contentType,
    });
    return { uri, sizeBytes: input.content.byteLength };
  }

  async get(uri: string): Promise<StorageGetResult> {
    const entry = this.blobs.get(uri);
    if (!entry) throw new Error(`memory storage: ${uri} not found`);
    return entry;
  }
}
