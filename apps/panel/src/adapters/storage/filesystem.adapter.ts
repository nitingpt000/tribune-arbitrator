import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { StorageError } from '../../domain/errors';
import type {
  StorageGetResult,
  StoragePort,
  StoragePutInput,
  StoragePutResult,
} from '../../domain/ports/storage.port';

export class FilesystemStorageAdapter implements StoragePort {
  constructor(private readonly rootDir: string) {}

  async put(input: StoragePutInput): Promise<StoragePutResult> {
    const hash = createHash('sha256').update(input.content).digest('hex');
    await fs.mkdir(this.rootDir, { recursive: true });
    const filePath = path.join(this.rootDir, `${hash}.bin`);
    const metaPath = path.join(this.rootDir, `${hash}.json`);
    try {
      await fs.writeFile(filePath, Buffer.from(input.content));
      await fs.writeFile(
        metaPath,
        JSON.stringify(
          {
            contentType: input.contentType,
            authorizedReaders: input.accessControl.authorizedReaders,
          },
          null,
          2,
        ),
      );
    } catch (err) {
      throw new StorageError('upload_failed', (err as Error).message, { hash });
    }
    return { uri: `file://${path.resolve(filePath)}`, sizeBytes: input.content.byteLength };
  }

  async get(uri: string): Promise<StorageGetResult> {
    if (!uri.startsWith('file://')) {
      throw new StorageError('download_failed', 'Filesystem adapter only handles file:// URIs', {
        uri,
      });
    }
    const filePath = uri.slice('file://'.length);
    const metaPath = `${filePath.replace(/\.bin$/, '')}.json`;
    try {
      const [content, metaRaw] = await Promise.all([
        fs.readFile(filePath),
        fs.readFile(metaPath, 'utf8'),
      ]);
      const meta = JSON.parse(metaRaw) as { contentType: string };
      return { content: new Uint8Array(content), contentType: meta.contentType };
    } catch (err) {
      throw new StorageError('download_failed', (err as Error).message, { uri });
    }
  }
}
