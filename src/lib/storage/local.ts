import { StorageAdapter } from './interface';
import { promises as fs } from 'fs';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), '.storage');

/**
 * Local filesystem storage adapter for development.
 * Stores files in the .storage/ directory at the project root.
 */
export class LocalStorage implements StorageAdapter {
  async put(key: string, data: Buffer | Uint8Array, _contentType?: string): Promise<string> {
    const filePath = this.keyToPath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    return key;
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const filePath = this.keyToPath(key);
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.keyToPath(key);
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    const dirPath = this.keyToPath(prefix);
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch {
      // Ignore if directory doesn't exist
    }
  }

  async getUrl(key: string): Promise<string> {
    // In local mode, serve via a Next.js API route
    return `/api/storage/${key}`;
  }

  private keyToPath(key: string): string {
    // Sanitize key to prevent directory traversal
    const sanitized = key.replace(/\.\./g, '').replace(/^\//, '');
    return path.join(STORAGE_DIR, sanitized);
  }
}
