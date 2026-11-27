'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/play.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/css/style.css'), 'utf8');
const motion = fs.readFileSync(path.join(root, 'public/js/motion.js'), 'utf8');

function readAsset(name, minimumBytes) {
  const file = path.join(root, 'public/assets', name);
  assert.ok(fs.existsSync(file), 'missing asset: ' + name);
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

const visitorOriginal = readAsset('visitor-arrival.jpg', 20000);
assert.equal(visitorOriginal.subarray(0, 2).toString('hex'), 'ffd8');
assert.equal(crypto.createHash('sha256').update(visitorOriginal).digest('hex'),
  '9af94bc39e9f09bff481312c6cee132c9cff068da86d950f84bdea121af61d9a',
  'the supplied pink-haired visitor reference must remain unchanged');

const application = readAsset('albertsky-entry-request.jpg', 20000);
assert.equal(application.subarray(0, 2).toString('hex'), 'ffd8');
assert.equal(crypto.createHash('sha256').update(application).digest('hex'),
  'd50ee4c3843c228213e2f1b6d52cbc6da483f979dca6a3e2352cfd655fe22dc0',
  'application image is not the original uploaded screenshot');

const atlas = readAsset('that-s-not-my-neighbor-the-daily-visitor-list-2861905204.jpg', 200000);
assert.equal(crypto.createHash('sha256').update(atlas).digest('hex'),
  '48fecd931ec0bd91e4bd8aedb7c54e7910e4b267',
  'character atlas has changed from the supplied original');

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'public/js/data.js'), 'utf8'), context, { filename: 'data.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'public/js/face.js'), 'utf8'), context, { filename: 'face.js' });
const face = context.window.NW_FACE;
const roster = context.window.NW_DATA.normal;
const crops = [
  ['Izaack Gauss', 414, 164],
  ['Margarette Bubbles', 581, 164],
  ['Arnold Schmicht', 747, 164],
  ['Rafttellyn Cappuccin', 414, 439],
  ['Mia Stone', 581, 439],
  ['Gloria Schmicht', 747, 439],
  ['Francis Mosses', 414, 713]
];
const renderedCrops = [];
for (const [name, x, y] of crops) {
  const person = roster.find(candidate => candidate.name === name);
  assert.ok(person, 'the supplied roster contains ' + name);
  const svg = face.portrait(person, { night: false });
  assert.match(svg, /data-character-atlas=/, name + ' uses the supplied portrait crop');
  assert.ok(svg.includes('x="-'+x+'" y="-'+y+'"'), name + ' uses its own portrait position');
  renderedCrops.push(svg);
  const altered = { ...person, tags: [...person.tags, 'extraEyes'] };
  const alteredSvg = face.portrait(altered, { night: false });
  assert.doesNotMatch(alteredSvg, /data-character-atlas=/, name + ' doppelgänger variation remains visible');
}
assert.equal(new Set(renderedCrops).size, crops.length, 'the seven supplied portraits are all visually distinct');
assert.equal(roster.length, 20, 'the standard roster still contains all 20 residents');
assert.equal(context.window.NW_DATA.nightmare.length, 20, 'the nightmare roster still contains all 20 characters');

assert.match(html, /class="reference-scene-image" src="\/assets\/office-reference\.webp"/);
assert.match(html, /width="2559" height="1423"/);
assert.match(html, /id="visitor-face" class="visitor-face" role="button" tabindex="0"/);
assert.match(html, /\/js\/motion\.js/);
assert.match(css, /v1\.8\.2 — remove duplicate furniture and align every live hitbox/);
assert.match(css, /pointer-events:none!important/);
assert.match(css, /left:42\.0%!important;top:71\.8%!important/);
assert.match(css, /left:58\.8%!important;top:80\.0%!important/);
assert.match(css, /left:70\.1%!important;top:71\.6%!important/);
assert.match(css, /source-image-curtain\{display:none!important/);
assert.doesNotMatch(motion, /source-image-curtain|visitor-arrival\.jpg/,
  'the old full-screen visitor screenshot must never cover the interactive scene');
assert.match(motion, /albertsky-entry-request\.jpg/);
assert.match(motion, /visitor-arriving/);
assert.match(motion, /isTypingLine|typingActive/);
assert.match(motion, /syncEmergencyAnimation/);
console.log('Original office, character atlas, character-specific portraits, hitboxes and motion hooks passed.');
