// Lightweight, dependency-free obfuscation for values that should not appear as
// searchable plaintext in this public repository. This is intentionally NOT
// cryptography: it is a reversible XOR + base64 transform whose only job is to
// keep human-readable strings out of `grep`. Anyone with the source can reverse
// it; that is acceptable, the goal is only to avoid casual discoverability.

const KEY = 'aP8qZ3Lm';
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    out += ALPHABET[b0 >> 2];
    out += ALPHABET[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? ALPHABET[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? ALPHABET[b2 & 63] : '=';
  }
  return out;
}

function fromBase64(str: string): number[] {
  const clean = str.replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const val = ALPHABET.indexOf(ch);
    if (val < 0) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

export function encode(text: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    bytes.push(text.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
  }
  return toBase64(bytes);
}

export function decode(blob: string): string {
  const bytes = fromBase64(blob);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode((bytes[i] ?? 0) ^ KEY.charCodeAt(i % KEY.length));
  }
  return out;
}
