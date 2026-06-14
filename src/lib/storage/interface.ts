/**
 * Storage adapter interface.
 * Implementations: local (dev), r2 (production).
 */
export interface StorageAdapter {
  /** Store a file. Returns the storage key. */
  put(key: string, data: Buffer | Uint8Array, contentType?: string): Promise<string>;

  /** Retrieve a file. Returns null if not found. */
  get(key: string): Promise<Buffer | null>;

  /** Delete a file. */
  delete(key: string): Promise<void>;

  /** Delete all files with a given prefix (e.g. job cleanup). */
  deletePrefix(prefix: string): Promise<void>;

  /** Get a URL to access the file (signed or public). */
  getUrl(key: string): Promise<string>;
}

/**
 * Get the configured storage adapter.
 */
export async function getStorage(): Promise<StorageAdapter> {
  const provider = process.env.STORAGE_PROVIDER || 'local';

  if (provider === 'r2') {
    const { R2Storage } = await import('./r2');
    return new R2Storage();
  }

  const { LocalStorage } = await import('./local');
  return new LocalStorage();
}
