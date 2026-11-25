'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'public/js/common.js'), 'utf8');

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.hidden = false;
    this.disabled = false;
    this.className = '';
    this.style = {};
    this.children = [];
    this.listeners = {};
    this.onclick = null;
    this.classList = {
      add: (...names) => { const s = new Set(this.className.split(/\s+/).filter(Boolean)); names.forEach(n => s.add(n)); this.className = [...s].join(' '); },
      remove: (...names) => { const s = new Set(this.className.split(/\s+/).filter(Boolean)); names.forEach(n => s.delete(n)); this.className = [...s].join(' '); },
      toggle: (name, force) => { const s = new Set(this.className.split(/\s+/).filter(Boolean)); const on = force === undefined ? !s.has(name) : Boolean(force); if (on) s.add(name); else s.delete(name); this.className = [...s].join(' '); return on; },
      contains: name => this.className.split(/\s+/).includes(name)
    };
  }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  click() { if (this.disabled || this.hidden) return; const e = { preventDefault() {}, stopPropagation() {}, target: this }; (this.listeners.click || []).forEach(fn => fn(e)); if (this.onclick) this.onclick(e); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  appendChild(node) { this.children.push(node); return node; }
  append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
  prepend(node) { this.children.unshift(node); }
  setAttribute(key, value) { this[key] = String(value); }
}

function response(status, body) {
  return { status, ok: status >= 200 && status < 300, async json() { return body; } };
}

function createEnv({ storage = {}, remoteSave = {}, fetchLog = [] } = {}) {
  const ids = [
    'continue-button','continue-note','nightmare-lock','auth-status','logout-button',
    'result-title','result-rank','result-message','result-captures','result-kills','result-admitted','result-score',
    'result-details','result-actions','details-toggle','campaign-ending','next-day-button','poster-grid','record-history',
    'record-days','record-captures','record-mistakes','record-rank','achievement-grid','toast'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new FakeElement(id)]));
  const launchButtons = ['campaign','tutorial','arcade','nightmare','custom','cards'].map(mode => {
    const b = new FakeElement(); b.dataset = { mode }; return b;
  });
  let timeoutId = 1;
  const timers = new Map();
  const windowListeners = {};
  const documentListeners = {};
  const localStorage = {
    getItem(key) { return Object.hasOwn(storage, key) ? storage[key] : null; },
    setItem(key, value) { storage[key] = String(value); },
    removeItem(key) { delete storage[key]; }
  };
  const document = {
    visibilityState: 'visible',
    body: new FakeElement('body'),
    getElementById(id) { return elements[id] || (elements[id] = new FakeElement(id)); },
    createElement(tag) { return new FakeElement(tag); },
    querySelectorAll(selector) { return selector === '[data-mode]' ? launchButtons : []; },
    addEventListener(type, fn) { (documentListeners[type] ||= []).push(fn); }
  };
  const window = {
    addEventListener(type, fn) { (windowListeners[type] ||= []).push(fn); }
  };
  const location = { href: '' };
  const fetch = async (url, options = {}) => {
    fetchLog.push({ url, ...options });
    if ((options.method || 'GET') === 'GET') return response(200, { save: remoteSave, storage: 'temporary-file' });
    if (url.endsWith('/api/auth/logout')) return response(200, { ok: true });
    return response(200, { ok: true, savedAt: new Date().toISOString(), storage: 'temporary-file' });
  };
  const context = {
    window, document, localStorage, location, fetch, crypto, Math, Date, URLSearchParams, console,
    setTimeout(fn, delay) { const id = timeoutId++; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.createContext(context);
  vm.runInContext(source, context, { timeout: 5000, filename: 'common.js' });
  return {
    api: window.Neighbor,
    storage, timers, launchButtons, elements, fetchLog, location, document, window,
    async runTimers() {
      const due = [...timers.entries()];
      timers.clear();
      due.forEach(([, task]) => task.fn());
      await new Promise(resolve => setImmediate(resolve));
    },
    firePageHide() { (windowListeners.pagehide || []).forEach(fn => fn()); },
    fireVisibilityHidden() { document.visibilityState = 'hidden'; (documentListeners.visibilitychange || []).forEach(fn => fn()); }
  };
}

(async () => {
  // Normalize and persist a bounded, structurally valid save.
  const env = createEnv();
  const normalized = env.api.setSave({
    records: ['bad', { id: 'r1', createdAt: '2026-01-01', rank: 'A' }],
    posters: [0, 0, 31, 32, -1, 'bad'],
    achievements: ['one', 'one', 4],
    campaign: { day: 99, unlockedNightmare: true, dead: ['A', 1, 'A'] },
    stats: { captures: -5, highScore: 250, highRank: 'S' },
    updatedAt: 25
  });
  assert.equal(normalized.records.length, 1, 'invalid record rows are removed');
  assert.deepEqual(Array.from(normalized.posters), [0, 31], 'poster IDs are unique and bounded');
  assert.deepEqual(Array.from(normalized.achievements), ['one'], 'achievement IDs are unique strings');
  assert.equal(normalized.campaign.day, 5, 'campaign day is clamped');
  assert.equal(normalized.campaign.retryDay, 0, 'retry day defaults safely when no failed checkpoint exists');
  assert.deepEqual(Array.from(normalized.campaign.dead), ['A'], 'dead residents are unique strings');
  assert.equal(normalized.stats.captures, -5, 'historical stats are retained as supplied');
  assert.ok(env.storage['neighbor-watch-save-v1'], 'save is written to browser storage');

  // The home screen prevents play from racing the asynchronous remote restore.
  const remote = createEnv({ remoteSave: { updatedAt: 50, stats: { captures: 7 } } });
  const homePromise = remote.api.initHome();
  assert.ok(remote.launchButtons.every(button => button.disabled), 'mode buttons are locked during remote restore');
  await homePromise;
  assert.ok(remote.launchButtons.every(button => button.dataset.mode === 'nightmare' ? button.disabled : !button.disabled), 'normal modes unlock while nightmare remains locked until campaign completion');
  assert.equal(remote.api.getSave().stats.captures, 7, 'remote save is merged into local save');

  // Failed campaign days remain available through the Continue button after active play is cleared.
  const retryEnv = createEnv({
    remoteSave: { updatedAt: 80, campaign: { day: 2, retryDay: 2, completed: false, dead: ['Roman Stilnsky'] } }
  });
  await retryEnv.api.initHome();
  assert.equal(retryEnv.elements['continue-button'].disabled, false, 'failed campaign day enables Continue');
  assert.match(retryEnv.elements['continue-note'].textContent, /2日目の再挑戦/);
  retryEnv.api.continueGame();
  assert.equal(retryEnv.api.active().mode, 'campaign', 'Continue launches the saved campaign checkpoint');
  assert.equal(retryEnv.api.active().day, 2, 'Continue resumes the failed day instead of day one');
  assert.deepEqual(Array.from(retryEnv.api.active().dead), ['Roman Stilnsky'], 'previously dead residents remain excluded on retry');
  assert.equal(retryEnv.api.getSave().campaign.retryDay, 0, 'retry marker clears once the retry session starts');

  // Local writes are debounced, and pagehide flushes even before the debounce fires.
  const syncEnv = createEnv();
  syncEnv.api.setSave({ records: [{ id: 'sync-record' }] });
  assert.equal(syncEnv.fetchLog.length, 0, 'debounce does not issue an immediate request');
  syncEnv.firePageHide();
  await new Promise(resolve => setImmediate(resolve));
  const put = syncEnv.fetchLog.find(item => item.method === 'PUT');
  assert.ok(put, 'pagehide sends pending save data');
  assert.equal(put.keepalive, true, 'pagehide requests keepalive');
  assert.ok(put.url.startsWith('/api/guest/'), 'guest save uses the guest API');
  assert.ok(JSON.parse(put.body).save.records.some(record => record.id === 'sync-record'), 'latest local snapshot is sent');

  // Newer local state is merged and re-uploaded instead of being silently discarded.
  const mergeStorage = {};
  const mergeEnv = createEnv({
    storage: mergeStorage,
    remoteSave: { updatedAt: 10, records: [{ id: 'remote' }], posters: [1], stats: { captures: 3 } }
  });
  mergeEnv.api.setSave({ updatedAt: 20, records: [{ id: 'local' }], posters: [2], stats: { captures: 8 } });
  const localBeforeRestore = mergeEnv.api.getSave();
  await mergeEnv.api.restoreRemote();
  const merged = mergeEnv.api.getSave();
  assert.deepEqual(Array.from(merged.records, record => record.id).sort(), ['local','remote'], 'record history from both devices is merged');
  assert.deepEqual(Array.from(merged.posters).sort(), [1,2], 'poster collection is merged');
  assert.equal(merged.stats.captures, 8, 'the best aggregate stat is retained');
  assert.ok(merged.updatedAt >= localBeforeRestore.updatedAt, 'merged timestamp remains current');
  assert.ok(mergeEnv.timers.size > 0, 'a newer local save is scheduled for remote upload');

  // Start/continue guard prevents duplicate navigation from rapid clicks.
  const startEnv = createEnv();
  startEnv.api.startMode('campaign');
  const created = startEnv.api.active();
  assert.equal(created.mode, 'campaign');
  const startLocation = startEnv.location.href;
  startEnv.api.startMode('arcade');
  assert.equal(startEnv.location.href, startLocation, 'a second mode click is ignored while navigation is pending');

  // Advancing to the next campaign day is idempotent, including after a reload.
  const navStorage = {};
  const navEnv = createEnv({ storage: navStorage });
  navEnv.api.writeActive({ mode: 'campaign', day: 1, finished: true, visitors: [], visitorIndex: 6, checklist: {}, actions: [], campaignStats: {} });
  navStorage['neighbor-watch-result-v1'] = JSON.stringify({ id: 'shift-result-1', next: true, day: 1, score: 150, details: [] });
  await navEnv.api.initResult();
  const nextButton = navEnv.elements['next-day-button'];
  assert.equal(nextButton.hidden, false, 'next-day button is shown when permitted');
  nextButton.click();
  nextButton.click();
  assert.equal(navEnv.api.active().day, 2, 'double-click advances exactly one day');
  assert.equal(navEnv.api.active().lastAdvancedResultId, 'shift-result-1', 'advance marker is persisted');
  assert.equal(navEnv.location.href, '/play');
  const reloadEnv = createEnv({ storage: navStorage });
  await reloadEnv.api.initResult();
  assert.equal(reloadEnv.elements['next-day-button'].hidden, true, 'reload cannot advance the same result twice');

  console.log('Common/save tests passed: normalization, home restore gating, debounced/keepalive sync, cross-device merge, duplicate-start guard, and idempotent campaign-day advancement.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
