// One-time prep for the model-evaluation harness.
// Converts the 249 HEICs in the source folder into cached 512px JPEG thumbnails
// under public/eval/thumbs/, extracts the capture date for chronological sorting,
// and writes public/eval/manifest.json (sorted oldest-first so burst series are adjacent).
//
// Run from the project root:
//   node scripts/eval-prepare.mjs
//
// HEIC decode uses the WASM path (heic-decode + sharp) because the local libvips
// has no HEVC decoder — same fallback the app uses.

import { createRequire } from 'module';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const require = createRequire(import.meta.url);
const decode = require('heic-decode');
const sharp = require('sharp');
const ExifReader = require('exifreader');

const SRC = 'C:\\CLAUDE\\MyProjects\\999_Travel_Photos\\Selection 249';
const THUMB_DIR = join(process.cwd(), 'public', 'eval', 'thumbs');
const MANIFEST = join(process.cwd(), 'public', 'eval', 'manifest.json');
const SIZE = 512;
const QUALITY = 72;

/** Parse "YYYY:MM:DD HH:MM:SS" EXIF date → ISO string, else null. */
function parseExifDate(desc) {
  if (!desc) return null;
  const cleaned = desc.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Fallback: pull a date from iOS-style filenames like 20250101_074135858_iOS.heic */
function parseFilenameDate(name) {
  const m = name.match(/(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const dt = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

async function main() {
  await mkdir(THUMB_DIR, { recursive: true });

  const files = (await readdir(SRC))
    .filter((f) => /\.(heic|heif|jpe?g|png|webp)$/i.test(f))
    .sort();

  console.log(`Found ${files.length} images. Converting…`);

  const entries = [];
  let i = 0;
  for (const file of files) {
    const idx = i++;
    const t0 = Date.now();
    try {
      const buffer = await readFile(join(SRC, file));

      // Capture date for sorting
      let dateTaken = null;
      try {
        const tags = ExifReader.load(buffer, { expanded: true });
        dateTaken = parseExifDate(tags.exif?.DateTimeOriginal?.description);
      } catch {
        /* ignore exif errors */
      }
      if (!dateTaken) dateTaken = parseFilenameDate(file);

      const thumbName = `${idx}.jpg`;
      if (/\.(heic|heif)$/i.test(file)) {
        // Decode HEIC (WASM) → raw RGBA → sharp resize/encode (native)
        const { width, height, data } = await decode({ buffer });
        const raw = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        await sharp(raw, { raw: { width, height, channels: 4 } })
          .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
          .jpeg({ quality: QUALITY })
          .toFile(join(THUMB_DIR, thumbName));
      } else {
        // JPEG/PNG/WebP — sharp reads directly; .rotate() auto-orients via EXIF
        await sharp(buffer)
          .rotate()
          .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
          .jpeg({ quality: QUALITY })
          .toFile(join(THUMB_DIR, thumbName));
      }

      entries.push({
        id: file.replace(/\.[^.]+$/, ''),
        filename: file,
        thumb: `/eval/thumbs/${thumbName}`,
        dateTaken,
      });
      console.log(`[${idx + 1}/${files.length}] ${file} → ${thumbName} (${Date.now() - t0}ms)`);
    } catch (err) {
      console.error(`[${idx + 1}/${files.length}] FAILED ${file}:`, err.message);
    }
  }

  // Sort chronologically (undated last) so burst series sit next to each other
  entries.sort((a, b) => {
    if (!a.dateTaken && !b.dateTaken) return a.filename.localeCompare(b.filename);
    if (!a.dateTaken) return 1;
    if (!b.dateTaken) return -1;
    return a.dateTaken.localeCompare(b.dateTaken);
  });

  await writeFile(MANIFEST, JSON.stringify(entries, null, 2), 'utf-8');
  console.log(`\nDone. ${entries.length} thumbnails + manifest written to public/eval/.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
