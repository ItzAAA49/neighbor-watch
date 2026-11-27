'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/play.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/css/style.css'), 'utf8');
const motion = fs.readFileSync(path.join(root, 'public/js/motion.js'), 'utf8');

function readAsset(name, minimumBytes) {
  const file = path.join(root, 'public/assets', name);
  assert.ok(fs.existsSync(file), 'missing original asset: ' + name);
  const bytes = fs.readFileSync(file);
  assert.ok(bytes.length > minimumBytes, 'asset unexpectedly small: ' + name);
  return bytes;
}

const office = readAsset('office-reference.webp', 100000);
assert.equal(office.subarray(0, 4).toString('ascii'), 'RIFF');
assert.equal(office.subarray(8, 12).toString('ascii'), 'WEBP');
assert.equal(office.subarray(12, 16).toString('ascii'), 'VP8 ');
assert.deepEqual(Array.from(office.subarray(23, 26)), [0x9d, 0x01, 0x2a], 'invalid WebP VP8 frame header');
assert.equal(office.readUInt16LE(26) & 0x3fff, 2559, 'office image width changed');
assert.equal(office.readUInt16LE(28) & 0x3fff, 1423, 'office image height changed');

const visitor = readAsset('visitor-arrival.jpg', 20000);
assert.equal(visitor.subarray(0, 2).toString('hex'), 'ffd8');
assert.equal(crypto.createHash('sha256').update(visitor).digest('hex'),
  '9af94bc39e9f09bff481312c6cee132c9cff068da86d950f84bdea121af61d9a',
  'visitor image is not the original uploaded screenshot');

const application = readAsset('albertsky-entry-request.jpg', 20000);
assert.equal(application.subarray(0, 2).toString('hex'), 'ffd8');
assert.equal(crypto.createHash('sha256').update(application).digest('hex'),
  'd50ee4c3843c228213e2f1b6d52cbc6da483f979dca6a3e2352cfd655fe22dc0',
  'application image is not the original uploaded screenshot');

assert.match(html, /class="reference-scene-image" src="\/assets\/office-reference\.webp"/);
assert.match(html, /width="2559" height="1423"/);
assert.match(html, /\/js\/motion\.js/);
assert.match(css, /v1\.8\.1 — coordinate live controls to the exact 2559×1423 user-provided scene/);
assert.match(motion, /visitor-arrival\.jpg/);
assert.match(motion, /albertsky-entry-request\.jpg/);
assert.match(motion, /isTypingLine/);
console.log('Original reference images, dimensions, exact file hashes, and interaction hooks passed.');
