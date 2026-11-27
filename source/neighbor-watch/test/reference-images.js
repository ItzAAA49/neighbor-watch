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

const office = readAsset('office-original.webp', 20000);
assert.equal(office.subarray(0, 4).toString('ascii'), 'RIFF');
assert.equal(office.subarray(8, 12).toString('ascii'), 'WEBP');
assert.equal(office.subarray(12, 16).toString('ascii'), 'VP8 ');
assert.deepEqual(Array.from(office.subarray(23, 26)), [0x9d, 0x01, 0x2a], 'invalid WebP VP8 frame header');
assert.equal(office.readUInt16LE(26) & 0x3fff, 1177, 'office image width changed');
assert.equal(office.readUInt16LE(28) & 0x3fff, 624, 'office image height changed');
assert.equal(crypto.createHash('sha256').update(office).digest('hex'), '7adffc7dd377819b7e95207384991c1bc2b9166c01ef78403516ba719ecaf848', 'office image must be the exact supplied 1177×624 reference');

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
  '75081ddba65e8cbcfbc679a232cc63b2f5f4d265d24ec1776571d6c5bee26214',
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
  const alteredSvg = face.portrait(altered, { night: false, referenceTags: person.tags });
  assert.doesNotMatch(alteredSvg, /data-character-atlas=/, name + ' doppelgänger variation remains visible');
}
assert.equal(new Set(renderedCrops).size, crops.length, 'the seven supplied portraits are all visually distinct');
assert.equal(roster.length, 20, 'the standard roster still contains all 20 residents');
const allNormalPortraits = roster.map(person => face.portrait(person, { night: false, referenceTags: person.tags }));
assert.equal(new Set(allNormalPortraits).size, 20, 'every normal character must have an individually distinct portrait');
const allNightmarePortraits = context.window.NW_DATA.nightmare.map(person =>
  face.portrait(person, { night: true, referenceTags: person.tags }));
assert.equal(new Set(allNightmarePortraits).size, 20, 'every nightmare character must have an individually distinct portrait');
assert.equal(context.window.NW_DATA.nightmare.length, 20, 'the nightmare roster still contains all 20 characters');

assert.match(html, /class="reference-scene-image" src="\/assets\/office-original\.webp"/);
assert.match(html, /width="1177" height="624"/);
assert.match(html, /id="mobile-controls"/);
assert.ok(html.indexOf('id="visitor-dialog"') > html.indexOf('id="booth-scene"'), 'speech UI must be outside the original image');
assert.match(html, /data-game-action="folder"/);
assert.ok(html.indexOf('id="mobile-controls"') > html.indexOf('id="booth-scene"'), 'mobile controls must sit outside the image scene');
assert.ok(html.indexOf('id="decision-panel"') > html.indexOf('id="mobile-controls"'), 'decision panel must sit below the image');
assert.doesNotMatch(html, /office-reference[.]webp/);
assert.match(html, /data-phone-digit="1"/);
assert.match(html, /id="visitor-face" class="visitor-face" role="button" tabindex="0"/);
assert.match(html, /\/js\/motion\.js/);
assert.match(css, /v1\.9\.0 — exact 1177×624 user source screenshot/);
assert.match(css, /pointer-events:none!important/);
assert.match(css, /left:38\.1%!important;top:88\.0%!important/);
assert.match(css, /left:84\.3%!important;top:33\.2%!important/);
assert.match(css, /width:min.*1177px/);
assert.match(css, /source-image-curtain\{display:none!important/);
assert.doesNotMatch(motion, /source-image-curtain|visitor-arrival\.jpg/,
  'the old full-screen visitor screenshot must never cover the interactive scene');
assert.match(motion, /albertsky-entry-request\.jpg/);
assert.match(motion, /visitor-arriving/);
assert.match(motion, /isTypingLine|typingActive/);
assert.match(motion, /syncEmergencyAnimation/);
console.log('Original office, character atlas, character-specific portraits, hitboxes and motion hooks passed.');


// Live scene geometry must preserve the source screenshot's exact aspect ratio.
// Legacy pseudo-elements are disabled because the supplied image already contains
// the grille, warning switch, desk and all wall furniture.
assert.match(css, /v1\.9\.0 — exact 1177×624 user source screenshot/);
assert.match(css, /aspect-ratio:1177 \/ 624!important/);
assert.match(css, /max-height:none!important/);
assert.match(css, /\.booth-scene::before,\.booth-scene::after/);
assert.match(css, /\.booth-scene \.alarm-unit::before/);
assert.match(css, /\.booth-scene \.emergency-button::after/);
assert.match(css, /\.play-header #pause-button/);
console.log('Exact original background, aspect ratio, original control positions and mobile controls checks passed.');


assert.match(css, /\.visitor-empty\[hidden\]\{display:none!important\}/);
assert.match(css, /\.visitor-face\{width:min\(40%,230px\)!important;height:73%!important\}/);

assert.match(css, /aspect-ratio:260 \/ 290!important/);

assert.match(css, /min-height:0!important;max-height:none!important/);
assert.match(css, /width:58%!important;height:auto!important;aspect-ratio:260 \/ 290!important/);
assert.match(css, /nth-child\(n\+7\)\{display:none!important\}/);
assert.match(css, /left:9\.2%!important;top:67\.4%!important;width:6\.6%!important;height:13\.8%!important/);

assert.match(css, /background:rgba\(230,221,205,.97\)!important/);
assert.match(css, /background:#d8d0c3!important/);
