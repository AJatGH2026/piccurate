// What an uploaded "thumbnail" really is, read from its own bytes.
//
// The analysis route is billed per image by the model provider, and the caps
// that protect the budget count photos. That only holds while one photo is one
// small image — which the browser guarantees (512 px JPEG, utils/image.ts) and
// a hand-built request does not. So the server looks at the header itself
// instead of trusting the field name or the declared MIME type.
//
// Header parsing only: no decoder, no native module, nothing that could fail to
// load in the serverless runtime (sharp did, 2026-08-29).

export interface SniffedImage {
  type: 'jpeg' | 'png';
  width: number;
  height: number;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Format and pixel size of a JPEG or PNG, or null for anything else. */
export function sniffImage(buf: Uint8Array): SniffedImage | null {
  if (buf.length >= 24 && PNG_SIG.every((b, i) => buf[i] === b)) {
    // The first chunk must be IHDR: 4 bytes length, "IHDR", width, height.
    if (buf[12] !== 0x49 || buf[13] !== 0x48 || buf[14] !== 0x44 || buf[15] !== 0x52) return null;
    const width = ((buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19]) >>> 0;
    const height = ((buf[20] << 24) | (buf[21] << 16) | (buf[22] << 8) | buf[23]) >>> 0;
    return width > 0 && height > 0 ? { type: 'png', width, height } : null;
  }

  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;

  // Walk the JPEG segments up to the frame header (SOFn), which carries the size.
  let i = 2;
  while (i + 3 < buf.length) {
    if (buf[i] !== 0xff) return null;
    // Any number of 0xFF fill bytes may precede a marker.
    while (i + 1 < buf.length && buf[i + 1] === 0xff) i++;
    if (i + 3 >= buf.length) return null;
    const marker = buf[i + 1];

    // Markers without a length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    // Start of scan / end of image before any frame header: not a usable JPEG.
    if (marker === 0xda || marker === 0xd9) return null;

    const len = (buf[i + 2] << 8) | buf[i + 3];
    if (len < 2) return null;

    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (i + 8 >= buf.length) return null;
      const height = (buf[i + 5] << 8) | buf[i + 6];
      const width = (buf[i + 7] << 8) | buf[i + 8];
      return width > 0 && height > 0 ? { type: 'jpeg', width, height } : null;
    }
    i += 2 + len;
  }
  return null;
}
