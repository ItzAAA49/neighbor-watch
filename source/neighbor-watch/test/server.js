'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neighbor-watch-test-'));
process.env.NEIGHBOR_STORE_PATH = path.join(tempDir, 'nested', 'save-store.json');
process.env.NODE_ENV = 'test';

const { app, validateSave, readStore, writeStore } = require('../server');

(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const request = (url, options = {}) => fetch(`${base}${url}`, options);
  const json = (method, body, headers = {}) => ({
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  try {
    // Health and all routed pages/assets must respond.
    let response = await request('/health');
    assert.equal(response.status, 200);
    const health = await response.json();
    assert.equal(health.ok, true);
    assert.equal(health.database, 'temporary-file');
    for (const route of ['/', '/play', '/how-to', '/records', '/result', '/css/style.css', '/js/game.js', '/js/common.js']) {
      response = await request(route);
      assert.equal(response.status, 200, `${route} serves successfully`);
      const text = await response.text();
      assert.ok(text.length > 0, `${route} has content`);
      if (route === '/play') assert.match(text, /pause-overlay/);
      if (route === '/css/style.css') assert.match(text, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
    }

    // Save payload validation boundaries.
    assert.equal(validateSave({ save: [] }).error, 'セーブデータが不正です。');
    assert.ok(validateSave({ save: { ok: true } }).serialized);

    // Authentication validation, signup, duplicate prevention, and login.
    response = await request('/api/auth/signup', json('POST', { username: 'ab', password: 'short' }));
    assert.equal(response.status, 400, 'invalid username/password is rejected');
    response = await request('/api/auth/signup', json('POST', { username: 'Tester', password: 'correctHorseBatteryStaple' }));
    assert.equal(response.status, 200, 'valid signup succeeds');
    const signup = await response.json();
    assert.match(signup.token, /^[a-f0-9]{64}$/);
    assert.equal(signup.username, 'Tester');
    const authHeader = { Authorization: `Bearer ${signup.token}` };

    response = await request('/api/auth/signup', json('POST', { username: 'Tester', password: 'correctHorseBatteryStaple' }));
    assert.equal(response.status, 409, 'duplicate account is not created');
    response = await request('/api/auth/login', json('POST', { username: 'Tester', password: 'wrong-password' }));
    assert.equal(response.status, 401, 'wrong password is rejected');
    response = await request('/api/auth/login', json('POST', { username: 'Tester', password: 'correctHorseBatteryStaple' }));
    assert.equal(response.status, 200, 'valid login succeeds');
    const login = await response.json();
    assert.match(login.token, /^[a-f0-9]{64}$/);

    response = await request('/api/account/save');
    assert.equal(response.status, 401, 'account save requires authentication');
    response = await request('/api/account/save', json('PUT', { save: { records: [{ id: 'account-1' }], posters: [1, 2] } }, authHeader));
    assert.equal(response.status, 200, 'account save accepts a valid payload');
    response = await request('/api/account/save', { headers: authHeader });
    assert.equal(response.status, 200);
    let saved = await response.json();
    assert.equal(saved.save.records[0].id, 'account-1', 'account save can be read back');
    response = await request('/api/account/save', json('PUT', { save: [] }, authHeader));
    assert.equal(response.status, 400, 'invalid save shape is rejected');
    response = await request('/api/account/save', json('PUT', { save: { oversized: 'x'.repeat(510 * 1024) } }, authHeader));
    assert.equal(response.status, 413, 'oversized save is rejected before storage');

    // Guest path validates IDs and preserves the latest queued write.
    const guestId = '0123456789abcdef01234567';
    response = await request(`/api/guest/${guestId}`);
    assert.equal(response.status, 200);
    response = await request('/api/guest/short');
    assert.equal(response.status, 400, 'guest IDs must be in the allowed format');
    response = await request(`/api/guest/${guestId}`, json('PUT', { save: { marker: 'first' } }));
    assert.equal(response.status, 200);
    response = await request(`/api/guest/${guestId}`, json('PUT', { save: { marker: 'second' } }));
    assert.equal(response.status, 200);
    response = await request(`/api/guest/${guestId}`);
    saved = await response.json();
    assert.equal(saved.save.marker, 'second', 'queued guest writes do not overwrite the last request');

    // Parser and router errors have stable JSON responses.
    response = await request('/api/guest/0123456789abcdef', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
    assert.equal(response.status, 400, 'malformed JSON is a client error');
    const malformed = await response.json();
    assert.ok(malformed.error);
    response = await request('/api/not-a-route');
    assert.equal(response.status, 404);
    assert.ok((await response.json()).error);

    // Logout revokes the issued session immediately.
    response = await request('/api/auth/logout', { method: 'POST', headers: authHeader });
    assert.equal(response.status, 200);
    response = await request('/api/account/save', { headers: authHeader });
    assert.equal(response.status, 401, 'logout invalidates the token');

    // The local fallback creates its parent directory and uses atomic JSON storage.
    writeStore({ accounts: { tester: { save: { ok: 1 } } }, guests: { [guestId]: { ok: 2 } } });
    const disk = readStore();
    assert.equal(disk.accounts.tester.save.ok, 1);
    assert.equal(disk.guests[guestId].ok, 2);
    assert.ok(fs.existsSync(process.env.NEIGHBOR_STORE_PATH));

    // Corrupt or partially-written legacy data is preserved for manual recovery.
    fs.writeFileSync(process.env.NEIGHBOR_STORE_PATH, '{not-json', 'utf8');
    const recovered = readStore();
    assert.deepEqual(Object.keys(recovered.accounts), [], 'corrupt store falls back to an empty account index');
    assert.deepEqual(Object.keys(recovered.guests), [], 'corrupt store falls back to an empty guest index');
    const backupName = fs.readdirSync(path.dirname(process.env.NEIGHBOR_STORE_PATH)).find(name => name.startsWith('save-store.json.corrupt-'));
    assert.ok(backupName, 'corrupt source file is preserved as a backup instead of silently discarded');

    console.log('Server integration tests passed: health/static routes, authentication, session revocation, account/guest saves, validation limits, serialized writes, malformed input, filesystem fallback, and corrupt-save backup recovery.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
