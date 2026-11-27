'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = __dirname;
const sourceDir = path.join(root, 'asset-source');
const parts = ['00', '01', '02', '03'].map((part) =>
  fs.readFileSync(path.join(sourceDir, 'office-original.webp.b64.' + part), 'utf8').trim()
);
if (parts.some((part) => !/^[A-Za-z0-9+/=]+$/.test(part))) {
  throw new Error('Original office image source contains invalid base64 characters.');
}
const bytes = Buffer.from(parts.join(''), 'base64');
const sha = crypto.createHash('sha256').update(bytes).digest('hex');
if (sha !== '7adffc7dd377819b7e95207384991c1bc2b9166c01ef78403516ba719ecaf848') {
  throw new Error('Original office image checksum mismatch: ' + sha);
}
if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF' ||
    bytes.subarray(8, 12).toString('ascii') !== 'WEBP' ||
    bytes.subarray(12, 16).toString('ascii') !== 'VP8 ') {
  throw new Error('Original office image is not a valid lossy WebP image.');
}
const width = bytes.readUInt16LE(26) & 0x3fff;
const height = bytes.readUInt16LE(28) & 0x3fff;
if (width !== 1177 || height !== 624) {
  throw new Error('Original office image dimensions changed: ' + width + 'x' + height);
}
const target = path.join(root, 'public', 'assets', 'office-original.webp');
fs.writeFileSync(target, bytes);
console.log('Restored original office reference image:', width + 'x' + height, sha);
