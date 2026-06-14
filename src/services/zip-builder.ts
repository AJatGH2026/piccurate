import { Writable } from 'stream';

/**
 * Build a ZIP file from a list of named buffers.
 * Returns the complete ZIP as a Buffer.
 */
export async function buildZip(
  files: { name: string; data: Buffer }[]
): Promise<Buffer> {
  // Use require for archiver (CJS module, incompatible with Turbopack ESM import)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const archiverLib = require('archiver');

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const writableStream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    const archive = archiverLib.create('zip', { zlib: { level: 5 } });

    archive.on('error', reject);
    writableStream.on('finish', () => resolve(Buffer.concat(chunks)));

    archive.pipe(writableStream);

    for (const file of files) {
      archive.append(file.data, { name: file.name });
    }

    archive.finalize();
  });
}
