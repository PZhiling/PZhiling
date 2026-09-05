import { createHash } from 'node:crypto';

export function splitText(text, maxBytes = 4200) {
  if (!Number.isInteger(maxBytes) || maxBytes < 4) throw new Error('Invalid byte limit');
  const chunks = [];
  let chunk = '', size = 0;
  for (const char of text) {
    const bytes = Buffer.byteLength(char, 'utf8');
    if (size + bytes > maxBytes) { chunks.push(chunk); chunk = ''; size = 0; }
    chunk += char;
    size += bytes;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

export const fingerprint = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
