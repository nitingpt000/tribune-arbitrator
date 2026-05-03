export interface StoragePutInput {
  content: Uint8Array;
  contentType: string;
  accessControl: { authorizedReaders: string[] };
}

export interface StoragePutResult {
  uri: string;
  sizeBytes: number;
}

export interface StorageGetResult {
  content: Uint8Array;
  contentType: string;
}

export interface StoragePort {
  put(input: StoragePutInput): Promise<StoragePutResult>;
  get(uri: string): Promise<StorageGetResult>;
}

export const STORAGE_PORT = Symbol('StoragePort');
