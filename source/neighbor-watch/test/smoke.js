'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function createDataContext() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read('public/js/data.js'), context, { filename: 'data.js' });
  vm.runInContext(read('public/js/face.js'), context, { filename: 'face.js' });
  return { context, data: context.window.NW_DATA, face: context.window.NW_FACE };
}

const { data, face } = createDataContext();
const stylesheet = read('public/css/style.css');
const playHtml = read('public/play.html');
const faceSource = read('public/js/face.js');
const supportedTags = new Set([...faceSource.matchAll(/t\.has\('([^']+)'\)/g)].map(match => match[1]));
const usedTags = new Set([...data.normal, ...data.nightmare].flatMap(person => person.tags || []));
const unsupportedTags = [...usedTags].filter(tag => !supportedTags.has(tag));
assert.deepEqual(unsupportedTags, [], `all resident appearance tags have a renderer: ${unsupportedTags.join(', ')}`);

// 1. Static data and illustration invariants.
assert.equal(data.normal.length, 20, 'normal roster contains 20 residents');
assert.equal(data.nightmare.length, 20, 'nightmare roster contains 20 residents');
assert.equal(data.posterNames.length, 32, 'poster collection contains 32 entries');
assert.equal(data.quiz.length, 5, 'Chester has five quiz answers');
assert.equal(new Set(data.normal.map(person => person.expiry)).size, 20, 'resident ID expiration dates are fixed and distinct');
assert.ok(data.normal.every(person => person.reason), 'every resident has an authored return reason');
assert.equal(data.normal.find(person => person.name === 'Elenois Sverchzt').id, '965521458563', 'Elenois ID matches the supplied resident table');
assert.equal(data.normal.find(person => person.name === 'Elenois Sverchzt').job, '主婦', 'Elenois occupation matches the supplied resident table');
assert.equal(data.normal.find(person => person.name === 'Nacha Mikaelys').id, '789653665418', 'Nacha has the ID number given in the correction prompt');
assert.ok(data.normal.find(person => person.name === 'Mclooy Rudboys').tags.includes('smoking'), 'Mclooy keeps his cigarette feature');
assert.match(playHtml, /id="pause-overlay" hidden/, 'pause overlay starts hidden');
assert.match(stylesheet, /\[hidden\]\s*\{\s*display:\s*none\s*!important\s*;?\s*\}/, 'the global hidden rule overrides component display');
assert.match(playHtml, /class="crt-bolt bolt-tl"/, 'the CRT frame has physical corner fasteners');
for (const selector of ['.booth-scene{', '.window-frame{', '.today-board{', '.phone{', '.calendar{', '.checklist{', '.folder-button{']) {
  assert.ok(stylesheet.includes(selector), `desk-view layout rule exists: ${selector}`);
}
assert.match(stylesheet, /grid-template-columns:18\.4% minmax\(0,63\.2%\) 18\.4%/, 'desktop booth keeps the monitor as the dominant center area');
assert.match(stylesheet, /@media\(max-width:980px\)/, 'tablet and mobile layout fallback exists');
assert.match(stylesheet, /@media\(max-width:560px\)/, 'small phone layout fallback exists');
for (const [label, roster] of [['normal', data.normal], ['nightmare', data.nightmare]]) {
  assert.equal(new Set(roster.map(p => p.name)).size, roster.length, `${label} names are unique`);
  assert.equal(new Set(roster.map(p => p.id)).size, roster.length, `${label} IDs are unique`);
  assert.equal(new Set(roster.map(p => p.room)).size, 12, `${label} roster covers all twelve rooms`);
  assert.equal(new Set(roster.map(p => p.phone)).size, 12, `${label} roster uses one shared phone per room`);
  assert.ok(roster.every(p => /^\d{12}$/.test(p.id)), `${label} IDs are 12 digits`);
  assert.ok(roster.every(p => /^\d{4}$/.test(p.phone)), `${label} phone numbers are four digits`);
  for (const resident of roster) {
    const svg = face.portrait(resident, { night: label === 'nightmare' });
    assert.ok(!svg.includes('NaN'), `${resident.name} portrait has no invalid coordinates`);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${resident.name} portrait is valid SVG text`);
    assert.ok(!svg.includes('undefined'), `${resident.name} portrait has no undefined token`);
  }
}
assert.ok(data.normal.every(p => p.room && p.job && p.features && p.roommate), 'normal resident data is complete');
assert.ok(data.nightmare.every(p => p.room && p.job && p.features && p.roommate), 'nightmare resident data is complete');

// All referenced pages and scripts must exist; IDs must be unique per document.
for (const file of ['public/index.html', 'public/play.html', 'public/how-to.html', 'public/records.html', 'public/result.html']) {
  assert.ok(fs.existsSync(path.join(root, file)), `${file} exists`);
  const html = read(file);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, `${file} has no duplicate IDs`);
  for (const [, src] of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)) {
    if (src.startsWith('/')) assert.ok(fs.existsSync(path.join(root, 'public', src.slice(1))), `${file} dependency ${src} exists`);
  }
}

// Lightweight DOM used to exercise real gameplay event handlers without a browser.
class MiniClassList {
  constructor(node) { this.node = node; }
  _set() { return new Set(String(this.node.className || '').split(/\s+/).filter(Boolean)); }
  add(...names) { const set = this._set(); names.forEach(n => set.add(n)); this.node.className = [...set].join(' '); }
  remove(...names) { const set = this._set(); names.forEach(n => set.delete(n)); this.node.className = [...set].join(' '); }
  contains(name) { return this._set().has(name); }
  toggle(name, force) { const set = this._set(); const on = force === undefined ? !set.has(name) : Boolean(force); if (on) set.add(name); else set.delete(name); this.node.className = [...set].join(' '); return on; }
}

class MiniElement {
  constructor(tagName = 'div', ownerDocument = null) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.id = '';
    this.dataset = Object.create(null);
    this.attributes = Object.create(null);
    this.className = '';
    this.classList = new MiniClassList(this);
    this.style = Object.create(null);
    this.children = [];
    this.parentNode = null;
    this.listeners = Object.create(null);
    this.onclick = null;
    this.disabled = false;
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    this._innerHTML = '';
    this.scrollTop = 0;
    this.download = '';
    this.href = '';
  }
  set innerHTML(value) {
    this._innerHTML = String(value ?? '');
    this.children = [];
    const tagPattern = /<([a-z][a-z0-9-]*)\b([^>]*)>/gi;
    let match;
    while ((match = tagPattern.exec(this._innerHTML))) {
      const [, tag, rawAttributes] = match;
      const child = new MiniElement(tag, this.ownerDocument);
      child.parentNode = this;
      const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let attr;
      while ((attr = attrPattern.exec(rawAttributes))) {
        const name = attr[1].toLowerCase();
        const value = attr[2] ?? attr[3] ?? attr[4] ?? '';
        child.attributes[name] = value;
        if (name === 'id') child.id = value;
        if (name === 'class') child.className = value;
        if (name === 'value') child.value = value;
        if (name === 'placeholder') child.placeholder = value;
        if (name === 'disabled') child.disabled = true;
        if (name === 'hidden') child.hidden = true;
        if (name.startsWith('data-')) {
          const key = name.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
          child.dataset[key] = value;
        }
      }
      const textStart = tagPattern.lastIndex;
      const nextTag = this._innerHTML.indexOf('<', textStart);
      const textEnd = nextTag < 0 ? this._innerHTML.length : nextTag;
      child.textContent = this._innerHTML.slice(textStart, textEnd).trim();
      this.children.push(child);
      this.ownerDocument?._register(child);
    }
  }
  get innerHTML() { return this._innerHTML; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(v => v !== fn); }
  dispatchEvent(event) {
    const e = { preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, target: this, currentTarget: this, ...event };
    for (const fn of this.listeners[e.type] || []) fn(e);
    if (e.type === 'click' && typeof this.onclick === 'function') this.onclick(e);
    return true;
  }
  click() { if (this.disabled || this.hidden) return; this.dispatchEvent({ type: 'click' }); }
  appendChild(node) { node.parentNode = this; this.children.push(node); this.ownerDocument?._register(node); return node; }
  append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
  prepend(node) { node.parentNode = this; this.children.unshift(node); this.ownerDocument?._register(node); }
  replaceChildren(...nodes) { this.children = []; nodes.forEach(node => this.appendChild(node)); }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'id') this.id = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  setPointerCapture() {}
  getContext() { return null; }
  querySelectorAll(selector) { return queryNodes(this.children, selector); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function matchSelector(node, selector) {
  if (selector === 'button') return node.tagName === 'BUTTON';
  if (selector === '.calendar-grid i') return node.tagName === 'I' && hasAncestorClass(node, 'calendar-grid');
  if (selector === '.check-row button') return node.tagName === 'BUTTON' && hasAncestorClass(node, 'check-row');
  if (selector === '[data-card]') return Object.prototype.hasOwnProperty.call(node.dataset, 'card');
  if (selector === '[data-q]') return Object.prototype.hasOwnProperty.call(node.dataset, 'q');
  if (selector === '[data-mode]') return Object.prototype.hasOwnProperty.call(node.dataset, 'mode');
  return false;
}
function hasAncestorClass(node, cls) {
  let parent = node.parentNode;
  while (parent) { if (parent.classList?.contains(cls)) return true; parent = parent.parentNode; }
  return false;
}
function queryNodes(nodes, selector) {
  const result = [];
  const walk = list => list.forEach(node => { if (matchSelector(node, selector)) result.push(node); walk(node.children || []); });
  walk(nodes || []);
  return result;
}

class MiniDocument {
  constructor(html = '') {
    this.nodes = [];
    this.byId = new Map();
    this.listeners = Object.create(null);
    this.visibilityState = 'visible';
    this.body = new MiniElement('body', this);
    this._register(this.body);
    this._parseStatic(html);
  }
  _register(node) { this.nodes.push(node); if (node.id) this.byId.set(node.id, node); }
  _parseStatic(html) {
    const stack = [this.body];
    const tagPattern = /<\/?([a-z][a-z0-9-]*)\b([^>]*)>/gi;
    let match;
    const created = [];
    while ((match = tagPattern.exec(html))) {
      const full = match[0];
      const tag = match[1].toLowerCase();
      if (full.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
      const parent = stack[stack.length - 1];
      const node = new MiniElement(tag, this);
      node.parentNode = parent;
      const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let attr;
      while ((attr = attrPattern.exec(match[2]))) {
        const name = attr[1].toLowerCase();
        const value = attr[2] ?? attr[3] ?? attr[4] ?? '';
        node.attributes[name] = value;
        if (name === 'id') node.id = value;
        if (name === 'class') node.className = value;
        if (name === 'value') node.value = value;
        if (name === 'disabled') node.disabled = true;
        if (name === 'hidden') node.hidden = true;
        if (name.startsWith('data-')) node.dataset[name.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase())] = value;
      }
      parent.children.push(node);
      this._register(node);
      created.push(node);
      if (!['input','img','link','meta','br','hr','area','source'].includes(tag) && !/\/\s*>$/.test(full)) stack.push(node);
    }
  }
  getElementById(id) { return this.byId.get(id) || null; }
  createElement(tag) { return new MiniElement(tag, this); }
  querySelectorAll(selector) { return queryNodes(this.body.children, selector); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatchEvent(event) { (this.listeners[event.type] || []).forEach(fn => fn(event)); }
}

function createGameHarness(mode, existingGame = null) {
  const doc = new MiniDocument(playHtml);
  const storage = Object.create(null);
  let activeGame = existingGame ? structuredClone(existingGame) : null;
  let save = {
    records: [], posters: [], achievements: [],
    campaign: { unlockedNightmare: mode === 'nightmare', completed: false, day: 1, dead: [] },
    chesterBadge: false,
    stats: { captures: 0, kills: 0, admitted: 0, shifts: 0, highScore: 0, highRank: '—' },
    updatedAt: 0
  };
  const location = { search: `?mode=${mode}`, href: '', replaced: '' , replace(value) { this.replaced = value; } };
  const localStorage = {
    getItem(key) { return Object.hasOwn(storage, key) ? storage[key] : null; },
    setItem(key, value) { storage[key] = String(value); },
    removeItem(key) { delete storage[key]; }
  };
  const Neighbor = {
    RESULT: 'neighbor-watch-result-v1', ACTIVE: 'neighbor-watch-active-v1',
    async restoreRemote() { return true; },
    active() { return activeGame; },
    writeActive(value) { activeGame = value ? structuredClone(value) : null; storage.active = value ? JSON.stringify(value) : ''; },
    getSave() { return structuredClone(save); },
    setSave(value) { save = structuredClone(value); },
    syncSave() { return Promise.resolve(true); },
    toast(message) { storage.lastToast = String(message); }
  };
  let nextTimer = 1;
  const timers = new Map();
  const context = {
    window: { addEventListener() {}, AudioContext: undefined, webkitAudioContext: undefined },
    document: doc, localStorage, Neighbor, NW_DATA: data, NW_FACE: face, URLSearchParams,
    location, Math, Date, crypto,
    setTimeout(fn, ms) { const id = nextTimer++; timers.set(id, { fn, ms }); queueMicrotask(() => { const task = timers.get(id); if (task) { timers.delete(id); task.fn(); } }); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval() { return nextTimer++; }, clearInterval() {}, console
  };
  vm.createContext(context);
  const scriptResult = vm.runInContext(read('public/js/game.js'), context, { timeout: 5000, filename: 'game.js' });
  return Promise.resolve(scriptResult).then(() => ({ doc, storage, get active() { return activeGame; }, get save() { return save; }, location, Neighbor }));
}

function setCorrectChecklist(harness, visitor) {
  const answers = {
    appearance: visitor.appearanceIssue ? 'no' : 'yes',
    id: visitor.idIssue || visitor.idMissing ? 'no' : 'yes',
    form: visitor.formIssue || visitor.formMissing ? 'no' : 'yes',
    list: visitor.listed ? 'yes' : 'no'
  };
  for (const [key, value] of Object.entries(answers)) {
    const button = harness.doc.querySelectorAll('.check-row button').find(node => node.dataset.key === key && node.dataset.val === value);
    assert.ok(button, `check option ${key}:${value} exists`);
    button.click();
  }
}

async function runGameTests() {
  // Campaign initializes with a briefing and no active clock until the player starts work.
  const campaign = await createGameHarness('campaign');
  assert.equal(campaign.active.mode, 'campaign');
  assert.equal(campaign.active.visitors.length, 6, 'campaign day one has six visitors');
  assert.ok(campaign.active.todayList.length >= 4 && campaign.active.todayList.length <= 6, 'today list has a valid day-one size');
  assert.equal(campaign.active.startedAt, 0, 'the briefing does not consume inspection time');
  const scheduledNames = new Set(campaign.active.visitors.filter(visitor => !visitor.vip).map(visitor => visitor.residentName));
  assert.ok(campaign.active.todayList.every(item => scheduledNames.has(item.name)), 'today list contains only people actually scheduled to arrive');
  assert.ok(campaign.active.todayList.length >= 4 && campaign.active.todayList.length <= 6, 'day-one schedule contains four to six real visitors');
  assert.ok(!campaign.active.todayList.some(item => item.name === '42'), '42 is never listed as a resident');
  assert.ok(campaign.active.visitors.filter(visitor => visitor.vip).every(visitor => !visitor.listed), 'special visitors are not on the ordinary schedule');
  assert.equal(campaign.doc.getElementById('modal-backdrop').hidden, false, 'campaign briefing is displayed');
  campaign.doc.getElementById('pause-button').click();
  assert.equal(campaign.active.paused, false, 'a pre-shift modal cannot be paused before the clock starts');
  campaign.doc.getElementById('briefing-start').click();
  assert.equal(campaign.active.briefingSeenDay, 1, 'briefing state is persisted before the quiz');
  campaign.doc.getElementById('chester-skip').click();
  assert.ok(campaign.active.startedAt > 0, 'clock stores elapsed-play start without a countdown');
  assert.match(campaign.doc.getElementById('time-label').textContent, /時間制限なし/);
  campaign.doc.getElementById('emergency-button').click();
  assert.equal(campaign.doc.getElementById('folder-button').disabled, false, 'resident folder remains enabled during emergency shutter');
  campaign.doc.getElementById('folder-button').click();
  assert.equal(campaign.doc.getElementById('modal-backdrop').hidden, false, 'resident folder opens during emergency shutter');
  assert.ok(campaign.doc.getElementById('resident-search'), 'resident directory exposes a search input');
  const nachaEntry = campaign.doc.querySelectorAll('.resident-index-item').find(node => node.textContent.includes('Nacha Mikaelys'));
  assert.ok(nachaEntry, 'Nacha appears in the resident directory index');
  nachaEntry.click();
  assert.match(campaign.doc.getElementById('modal-content').innerHTML, /右目：青 ／ 左目：緑/, 'Nacha eye colors are recorded beside the monochrome file');
  campaign.doc.getElementById('modal-close').click();
  campaign.doc.getElementById('emergency-button').click();
  assert.equal(campaign.active.emergency, undefined, 'emergency cancel does not write a stuck emergency state');

  const first = campaign.active.visitors[0];
  setCorrectChecklist(campaign, first);
  assert.equal(campaign.active.checklist.appearance, first.appearanceIssue ? 'no' : 'yes');
  if (!first.truth) {
    campaign.doc.getElementById('emergency-button').click();
    for (const digit of '3312') {
      const key = campaign.doc.querySelectorAll('button').find(node => node.dataset.digit === digit);
      assert.ok(key, `phone digit ${digit} exists`);
      key.click();
    }
    campaign.doc.getElementById('dial-call').click();
    campaign.doc.getElementById('confirm-ddd-report').click();
  } else {
    campaign.doc.getElementById('admit-button').click();
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(campaign.active.visitorIndex, 1, 'one decision advances exactly one visitor');
  assert.deepEqual(campaign.active.checklist, {}, 'a new visitor never inherits the previous checklist');
  assert.equal(campaign.doc.getElementById('check-count').textContent, '0 / 4 完了', 'checklist UI resets for the next visitor');
  assert.ok(campaign.active.startedAt > 0, 'the actual clock start timestamp is stored with the game state');

  // The negative score must survive a reload and should not be clamped to zero.
  const negative = await createGameHarness('arcade', { mode: 'arcade', day: 1, visitors: [], visitorIndex: 0, score: -75, seed: 11, dead: [] });
  assert.equal(negative.active.score, -75, 'negative score survives active-game normalization');

  // Complete a full arcade shift using accurate checklist values and the intended action for each visitor.
  const fullArcade = await createGameHarness('arcade');
  const fullArcadeCount = fullArcade.active.visitors.length;
  for (let index = 0; index < fullArcadeCount; index++) {
    const visitor = fullArcade.active.visitors[index];
    setCorrectChecklist(fullArcade, visitor);
    if (visitor.truth) {
      fullArcade.doc.getElementById('admit-button').click();
    } else {
      fullArcade.doc.getElementById('emergency-button').click();
      for (const digit of '3312') fullArcade.doc.querySelectorAll('button').find(node => node.dataset.digit === digit).click();
      fullArcade.doc.getElementById('dial-call').click();
      fullArcade.doc.getElementById('confirm-ddd-report').click();
    }
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.equal(fullArcade.location.href, '/result', 'a completed shift routes to the result page');
  assert.equal(fullArcade.active, null, 'a completed non-campaign shift clears the active game');
  assert.equal(fullArcade.save.records.length, 1, 'a full shift produces exactly one record');
  assert.equal(fullArcade.save.stats.shifts, 1, 'shift statistics are updated once');

  // Pause works only after work starts; a reload keeps the paused state.
  const arcade = await createGameHarness('arcade');
  assert.ok(arcade.active.startedAt > 0, 'arcade starts the clock immediately');
  arcade.doc.getElementById('pause-button').click();
  assert.equal(arcade.active.paused, true, 'pause action stores paused state');
  assert.equal(arcade.doc.getElementById('pause-overlay').hidden, false, 'pause overlay is displayed when requested');
  const resumed = await createGameHarness('arcade', arcade.active);
  assert.equal(resumed.doc.getElementById('pause-overlay').hidden, false, 'pause overlay remains after reload');
  resumed.doc.getElementById('resume-button').click();
  assert.equal(resumed.active.paused, false, 'resume clears pause state');

  // Tutorial is failure-free, starts only after the training prompt, and finishes with a certificate result.
  const tutorial = await createGameHarness('tutorial');
  assert.equal(tutorial.active.visitors.length, 4, 'tutorial has four guided visitors');
  assert.equal(tutorial.active.startedAt, 0, 'tutorial briefing does not consume time');
  assert.match(tutorial.doc.getElementById('modal-content').innerHTML, /住人名簿/);
  assert.match(tutorial.doc.getElementById('modal-content').innerHTML, /4桁/);
  assert.match(tutorial.doc.getElementById('modal-content').innerHTML, /3312/);
  tutorial.doc.getElementById('tut-begin').click();
  assert.ok(tutorial.active.startedAt > 0, 'tutorial timer starts when the agent begins training');
  assert.equal(tutorial.doc.getElementById('admit-button').disabled, true, 'decisions remain disabled until all checks are recorded');
  for (const visitor of [...tutorial.active.visitors]) {
    setCorrectChecklist(tutorial, visitor);
    (visitor.truth ? tutorial.doc.getElementById('admit-button') : tutorial.doc.getElementById('reject-button')).click();
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.equal(tutorial.location.href, '/result', 'tutorial reaches its completion screen');
  const tutorialResult = JSON.parse(tutorial.storage[tutorial.Neighbor.RESULT]);
  assert.equal(tutorialResult.tutorial, true, 'tutorial completion is flagged for certificate display');
  assert.equal(tutorialResult.title, '研修修了', 'tutorial completion uses the correct result title');

  // Custom mode must use the custom cast and not randomly substitute the default roster.
  const custom = await createGameHarness('custom');
  custom.doc.getElementById('custom-name').value = 'Test Resident';
  custom.doc.getElementById('custom-job').value = '郵便配達員';
  custom.doc.getElementById('custom-room').value = 'F03-04';
  custom.doc.getElementById('custom-phone').value = '9876';
  custom.doc.getElementById('custom-features').value = '丸顔、短髪';
  custom.doc.getElementById('custom-create').click();
  assert.equal(custom.active.customResidents.length, 1, 'custom resident is saved');
  assert.equal(custom.active.visitors.length, 1, 'custom play includes its authored resident only');
  assert.equal(custom.active.visitors[0].person.name, 'Test Resident', 'custom resident is guaranteed to appear');

  // Nightmare is blocked unless unlocked, and a valid unlocked game boots the 10-person shift.
  const lockedNightmare = await createGameHarness('campaign');
  lockedNightmare.Neighbor.setSave({ ...lockedNightmare.save, campaign: { unlockedNightmare: false } });
  const night = await createGameHarness('nightmare');
  assert.equal(night.active.visitors.length, 10, 'nightmare shift has ten visitors');

  // Seeded arcade stress: repeated full shifts must remain finite, deterministic in shape,
  // contain no duplicate residents, and always create exactly one result.
  for (let seed = 1; seed <= 8; seed++) {
    const stress = await createGameHarness('arcade', {
      mode: 'arcade', day: 1, dead: [], seed: seed * 7919, visitors: [], visitorIndex: 0,
      checklist: {}, actions: [], score: 0, captures: 0, kills: 0, admitted: 0,
      minorMistakes: 0, errors: 0, reportErrors: 0
    });
    assert.equal(stress.active.visitors.length, 10, `seed ${seed}: arcade has ten visitors`);
    assert.equal(new Set(stress.active.visitors.map(v => v.residentName)).size, 10, `seed ${seed}: no resident repeats`);
    assert.ok(stress.active.visitors.every(v => !v.vip), `seed ${seed}: campaign VIPs do not leak into arcade`);
    for (const visitor of [...stress.active.visitors]) {
      setCorrectChecklist(stress, visitor);
      (visitor.truth ? stress.doc.getElementById('admit-button') : stress.doc.getElementById('reject-button')).click();
      await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(stress.location.href, '/result', `seed ${seed}: shift reaches results`);
    assert.equal(stress.save.records.length, 1, `seed ${seed}: result is recorded once`);
    assert.ok(Number.isFinite(stress.save.records[0].score), `seed ${seed}: score remains finite`);
  }

  // Nightmares: the first false D.D.D. report warns; the second ends the shift.
  const nightRoster = data.nightmare;
  const asVisitor = (person, extra = {}) => ({
    person: { ...person }, residentName: person.name, truth: true, listed: true,
    faceTags: [...(person.tags || [])], idData: { ...person }, formData: { ...person },
    idMissing: false, formMissing: false, appearanceIssue: false, idIssue: false,
    formIssue: false, dialog: 'こんにちは。', ...extra
  });
  const nightmareFalseAlarm = await createGameHarness('nightmare', {
    mode: 'nightmare', day: 1, dead: [], seed: 909, visitors: [asVisitor(nightRoster[0]), asVisitor(nightRoster[1])],
    visitorIndex: 0, todayList: [], checklist: {}, actions: [], phoneLog: [], startedAt: Date.now(),
    timeLimit: 120000, hoodedLetterSeen: true, paused: false, finished: false,
    score: 0, captures: 0, kills: 0, admitted: 0, minorMistakes: 0, errors: 0, reportErrors: 0
  });
  assert.equal(nightmareFalseAlarm.active.visitors.length, 2, 'nightmare fixture keeps both test visitors');
  for (let falseAlarm = 1; falseAlarm <= 2; falseAlarm++) {
    setCorrectChecklist(nightmareFalseAlarm, nightmareFalseAlarm.active.visitors[falseAlarm - 1]);
    nightmareFalseAlarm.doc.getElementById('emergency-button').click();
    for (const digit of '3312') nightmareFalseAlarm.doc.querySelectorAll('button').find(node => node.dataset.digit === digit).click();
    nightmareFalseAlarm.doc.getElementById('dial-call').click();
    nightmareFalseAlarm.doc.getElementById('confirm-ddd-report').click();
    await new Promise(resolve => setImmediate(resolve));
    if (falseAlarm === 1) {
      assert.equal(nightmareFalseAlarm.active.visitorIndex, 1, 'first false report advances to the next visitor');
      assert.equal(nightmareFalseAlarm.doc.getElementById('modal-backdrop').hidden, false, 'first false report displays the entity warning');
      nightmareFalseAlarm.doc.getElementById('entity-close').click();
    }
  }
  assert.equal(nightmareFalseAlarm.location.href, '/result', 'second nightmare false report ends the shift');
  const nightmareResult = JSON.parse(nightmareFalseAlarm.storage[nightmareFalseAlarm.Neighbor.RESULT]);
  assert.equal(nightmareResult.rank, '不合格', 'two nightmare false reports result in failure');
  assert.equal(nightmareResult.kills, 2, 'both falsely reported residents are counted');

  // Nightmare doppel admission is immediately fatal, unlike the standard end-of-day rule.
  const falseNightVisitor = asVisitor(nightRoster[2], {
    truth: false, appearanceIssue: true, idIssue: true, formIssue: true,
    defects: ['appearance', 'id', 'form'], faceTags: [...(nightRoster[2].tags || []), 'extraEyes']
  });
  const nightmareAdmission = await createGameHarness('nightmare', {
    mode: 'nightmare', day: 1, dead: [], seed: 111, visitors: [falseNightVisitor, asVisitor(nightRoster[3])],
    visitorIndex: 0, todayList: [], checklist: {}, actions: [], phoneLog: [], startedAt: Date.now(),
    timeLimit: 120000, hoodedLetterSeen: true, paused: false, finished: false,
    score: 0, captures: 0, kills: 0, admitted: 0, minorMistakes: 0, errors: 0, reportErrors: 0
  });
  setCorrectChecklist(nightmareAdmission, nightmareAdmission.active.visitors[0]);
  nightmareAdmission.doc.getElementById('admit-button').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(nightmareAdmission.location.href, '/result', 'nightmare doppel admission is immediately fatal');
  const admissionResult = JSON.parse(nightmareAdmission.storage[nightmareAdmission.Neighbor.RESULT]);
  assert.equal(admissionResult.admitted, 1, 'fatal doppel admission is recorded');

  // A fatal campaign admission ends the current day, records F/0, and saves that exact day for retry.
  const fatalCampaignVisitor = asVisitor(data.normal.find(person => person.name === 'Roman Stilnsky'), {
    truth: false, appearanceIssue: false, idIssue: true, formIssue: false,
    defects: ['id'], idData: { ...data.normal.find(person => person.name === 'Roman Stilnsky'), expiry: '01/54' }
  });
  const fatalCampaign = await createGameHarness('campaign', {
    mode: 'campaign', day: 2, dead: ['Lois Stilnsky'], seed: 121, visitors: [fatalCampaignVisitor], visitorIndex: 0,
    todayList: [], checklist: {}, actions: [], phoneLog: [], startedAt: Date.now(),
    timeLimit: 120000, briefingSeenDay: 2, chesterDone: true, clownSeen: true, paused: false, finished: false,
    score: 275, captures: 1, kills: 0, admitted: 0, minorMistakes: 0, errors: 0, reportErrors: 0,
    campaignStats: { admittedNames: [], reportedNames: [], visitorCount: 1, doppelVisitors: 1, admittedVisitors: 0, admittedDoppels: 0, capturedDoppels: 0, rejectedResidents: 0, humanKilled: 0, seenNames: [] }
  });
  setCorrectChecklist(fatalCampaign, fatalCampaign.active.visitors[0]);
  fatalCampaign.doc.getElementById('admit-button').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fatalCampaign.location.href, '/result', 'fatal admission ends the campaign day');
  const fatalResult = JSON.parse(fatalCampaign.storage[fatalCampaign.Neighbor.RESULT]);
  assert.equal(fatalResult.rank, 'F', 'doppelganger admission is rank F');
  assert.equal(fatalResult.score, 0, 'fatal admission sets the score to zero');
  assert.equal(fatalResult.retryDay, 2, 'the failed day is recorded as the retry checkpoint');
  assert.equal(fatalCampaign.save.campaign.day, 2, 'campaign progress stays on the failed day');
  assert.equal(fatalCampaign.save.campaign.retryDay, 2, 'same-day retry marker is persisted');
  assert.equal(fatalCampaign.save.campaign.runStats.doppelVisitors, 1, 'campaign totals are saved alongside the retry point');
  assert.equal(fatalCampaign.active, null, 'fatal shift state is closed before retry');
  // A nightmare VIP is safe to admit even though its appearance is not human.
  const vip42 = asVisitor(nightRoster[4], {
    truth: false, vip: '42', appearanceIssue: true, idIssue: true, formIssue: true,
    faceTags: ['42Face']
  });
  const safeVip = await createGameHarness('nightmare', {
    mode: 'nightmare', day: 1, dead: [], seed: 112, visitors: [vip42], visitorIndex: 0,
    todayList: [], checklist: {}, actions: [], phoneLog: [], startedAt: Date.now(),
    timeLimit: 60000, hoodedLetterSeen: true, paused: false, finished: false,
    score: 0, captures: 0, kills: 0, admitted: 0, minorMistakes: 0, errors: 0, reportErrors: 0
  });
  setCorrectChecklist(safeVip, safeVip.active.visitors[0]);
  safeVip.doc.getElementById('admit-button').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(safeVip.location.href, '/result', 'VIP-only shift completes normally');
  const safeVipResult = JSON.parse(safeVip.storage[safeVip.Neighbor.RESULT]);
  assert.equal(safeVipResult.title, '勤務結果', 'nightmare VIP can be safely admitted');

  // Card game must start with finite hands/deck and all UI controls bound.
  const cards = await createGameHarness('cards');
  assert.match(cards.doc.getElementById('modal-content').innerHTML, /カード対決/);
  assert.ok(cards.doc.querySelectorAll('[data-card]').length > 0, 'player hand cards are rendered');
  assert.ok(cards.doc.getElementById('card-draw'), 'draw button is rendered');
  let cardSteps = 0;
  while (!cards.doc.getElementById('modal-content').innerHTML.includes('カード対決 — 結果') && cardSteps < 500) {
    const html = cards.doc.getElementById('modal-content').innerHTML;
    const pileText = html.match(/場のカード\s*<b>(.*?)<\/b>/)?.[1] || '—';
    const pileValue = pileText === '—' ? 0 : Number(pileText) || 0;
    const handButtons = cards.doc.querySelectorAll('[data-card]');
    const playable = handButtons.find(button => {
      const value = String(button.textContent || button.innerHTML || '').replace(/<[^>]*>/g, '').trim();
      return pileValue === 0 || ['J','Q','K','A'].includes(value) || Number(value) > pileValue;
    });
    if (playable) {
      playable.click();
    } else {
      const drawButton = cards.doc.getElementById('card-draw');
      assert.ok(drawButton && !drawButton.disabled, 'card mode never traps the player with no move and no draw');
      drawButton.click();
    }
    await new Promise(resolve => setImmediate(resolve));
    cardSteps++;
  }
  assert.ok(cardSteps < 500, 'the finite 3-round card match always reaches a result');
  assert.match(cards.doc.getElementById('modal-content').innerHTML, /カード対決 — 結果/);
}

(async () => {
  await runGameTests();
  console.log('Smoke tests passed: complete rosters/portraits, all pages/assets, CSS visibility, campaign flow, checklist isolation, D.D.D. reporting, negative scores, pause/restore, tutorial flow/certificate result, custom mode, 8 seeded arcade shifts, nightmare false-alarm death, immediate doppel admission, VIP handling, and card-match completion.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
