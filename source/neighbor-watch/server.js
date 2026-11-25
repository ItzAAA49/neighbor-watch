'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const STORE_PATH = process.env.NEIGHBOR_STORE_PATH || path.join(ROOT, 'data-store.json');
const MAX_SAVE_BYTES = 500 * 1024;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const sessions = new Map();
const rateLimits = new Map();
let storeWriteQueue = Promise.resolve();
let pool = null;
let dbReady = false;
let httpServer = null;
const maintenanceTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimits) if (record.expiresAt <= now) rateLimits.delete(key);
  for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token);
  if (rateLimits.size > 10_000) {
    const entries = [...rateLimits.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (const [key] of entries.slice(0, rateLimits.size - 10_000)) rateLimits.delete(key);
  }
}, 5 * 60_000);
maintenanceTimer.unref?.();

app.disable('x-powered-by');
// Render terminates TLS at its edge proxy; trust exactly the nearest proxy hop.
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.json({ limit: '600kb', strict: true }));

function dictionaryFrom(value) {
  const target = Object.create(null);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
      target[key] = item;
    }
  }
  return target;
}

function defaultStore() {
  return { accounts: Object.create(null), guests: Object.create(null) };
}

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return {
      accounts: dictionaryFrom(parsed?.accounts),
      guests: dictionaryFrom(parsed?.guests)
    };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // Preserve an unreadable/corrupt file before falling back; never silently
      // replace the only copy of a player's save with an empty store.
      const backupPath = `${STORE_PATH}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(STORE_PATH, backupPath);
        console.error('Save file was unreadable; original moved to:', backupPath);
      } catch (backupError) {
        console.error('Save file could not be read or backed up:', error.message, backupError.message);
      }
    }
    return defaultStore();
  }
}

function writeStore(store) {
  const tempPath = `${STORE_PATH}.${process.pid}.${crypto.randomBytes(5).toString('hex')}.tmp`;
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(tempPath, JSON.stringify(store), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tempPath, STORE_PATH);
  } catch (error) {
    try { fs.unlinkSync(tempPath); } catch { /* No temporary file to clean up. */ }
    throw error;
  }
}

function mutateStore(mutator) {
  const operation = storeWriteQueue.then(async () => {
    const store = readStore();
    const result = await mutator(store);
    writeStore(store);
    return result;
  });
  storeWriteQueue = operation.catch(() => undefined);
  return operation;
}

function requestLimit({ keyPrefix, max = 12, windowMs = 60_000 }) {
  return (req, res, next) => {
    const key = `${keyPrefix}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    const now = Date.now();
    let record = rateLimits.get(key);
    if (!record || record.expiresAt <= now) record = { count: 0, expiresAt: now + windowMs };
    record.count += 1;
    rateLimits.set(key, record);
    if (record.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((record.expiresAt - now) / 1000)));
      return res.status(429).json({ error: '操作が多すぎます。少し時間をおいて再試行してください。' });
    }
    next();
  };
}

function newSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(token, { username, createdAt: now, expiresAt: now + SESSION_TTL_MS });
  return token;
}

function auth(req, res, next) {
  const authorization = String(req.headers.authorization || '');
  const match = authorization.match(/^Bearer\s+([a-f0-9]{64})$/i);
  if (!match) return res.status(401).json({ error: 'ログインが必要です。' });
  const token = match[1];
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ error: 'セッションの有効期限が切れました。もう一度ログインしてください。' });
  }
  req.authToken = token;
  req.username = session.username;
  next();
}

function validateSave(body) {
  const save = body?.save;
  if (!save || typeof save !== 'object' || Array.isArray(save)) {
    return { error: 'セーブデータが不正です。' };
  }
  let serialized;
  try { serialized = JSON.stringify(save); }
  catch { return { error: 'セーブデータを読み取れません。' }; }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SAVE_BYTES) {
    return { error: 'セーブデータが大きすぎます。不要な履歴を整理してください。', tooLarge: true };
  }
  return { save, serialized };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, database: dbReady ? 'connected' : 'temporary-file', version: '1.2.0' });
});

app.post('/api/auth/signup', requestLimit({ keyPrefix: 'signup', max: 5 }), asyncRoute(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!/^[A-Za-z0-9_ぁ-んァ-ヶ一-龠ー]{3,24}$/.test(username) || ['__proto__','prototype','constructor'].includes(username.toLowerCase())) {
    return res.status(400).json({ error: 'ユーザー名は3〜24文字で入力してください。' });
  }
  if (password.length < 8 || password.length > 72 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'パスワードは8〜72バイトにしてください。' });
  }
  const hash = await bcrypt.hash(password, 12);
  try {
    if (dbReady) {
      await pool.query('INSERT INTO neighbor_accounts(username,password_hash) VALUES($1,$2)', [username, hash]);
    } else {
      const created = await mutateStore(store => {
        if (Object.prototype.hasOwnProperty.call(store.accounts, username)) return false;
        store.accounts[username] = { passwordHash: hash, save: {} };
        return true;
      });
      if (!created) return res.status(409).json({ error: 'そのユーザー名はすでに使われています。' });
    }
    const token = newSession(username);
    return res.json({ token, username, storage: dbReady ? 'server-db' : 'temporary-file' });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'そのユーザー名はすでに使われています。' });
    console.error('Signup failed:', error.message);
    return res.status(500).json({ error: 'アカウントを作成できませんでした。' });
  }
}));

app.post('/api/auth/login', requestLimit({ keyPrefix: 'login', max: 10 }), asyncRoute(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  try {
    let record;
    if (dbReady) {
      const result = await pool.query('SELECT password_hash FROM neighbor_accounts WHERE username=$1', [username]);
      record = result.rows[0] && { passwordHash: result.rows[0].password_hash };
    } else {
      record = readStore().accounts[username];
    }
    if (!record || !(await bcrypt.compare(password, record.passwordHash))) {
      return res.status(401).json({ error: 'ユーザー名またはパスワードが違います。' });
    }
    const token = newSession(username);
    return res.json({ token, username, storage: dbReady ? 'server-db' : 'temporary-file' });
  } catch (error) {
    console.error('Login failed:', error.message);
    return res.status(500).json({ error: 'ログインできませんでした。' });
  }
}));

app.post('/api/auth/logout', auth, (req, res) => {
  sessions.delete(req.authToken);
  res.json({ ok: true });
});

app.get('/api/account/save', auth, asyncRoute(async (req, res) => {
  try {
    let save = {};
    if (dbReady) {
      const result = await pool.query('SELECT save_data FROM neighbor_accounts WHERE username=$1', [req.username]);
      if (!result.rowCount) return res.status(404).json({ error: 'アカウントが見つかりません。' });
      save = result.rows[0].save_data || {};
    } else {
      save = readStore().accounts[req.username]?.save || {};
    }
    return res.json({ save, storage: dbReady ? 'server-db' : 'temporary-file' });
  } catch (error) {
    console.error('Account save read failed:', error.message);
    return res.status(500).json({ error: 'セーブを読み込めませんでした。' });
  }
}));

app.put('/api/account/save', auth, asyncRoute(async (req, res) => {
  const validated = validateSave(req.body);
  if (validated.error) return res.status(validated.tooLarge ? 413 : 400).json({ error: validated.error });
  try {
    if (dbReady) {
      const result = await pool.query(
        'UPDATE neighbor_accounts SET save_data=$1::jsonb, updated_at=NOW() WHERE username=$2',
        [validated.serialized, req.username]
      );
      if (!result.rowCount) return res.status(404).json({ error: 'アカウントが見つかりません。' });
    } else {
      const updated = await mutateStore(store => {
        const account = store.accounts[req.username];
        if (!account) return false;
        account.save = JSON.parse(validated.serialized);
        return true;
      });
      if (!updated) return res.status(404).json({ error: 'アカウントが見つかりません。' });
    }
    return res.json({ ok: true, savedAt: new Date().toISOString(), storage: dbReady ? 'server-db' : 'temporary-file' });
  } catch (error) {
    console.error('Account save write failed:', error.message);
    return res.status(500).json({ error: 'セーブを保存できませんでした。' });
  }
}));

app.get('/api/guest/:id', requestLimit({ keyPrefix: 'guest-read', max: 240, windowMs: 60_000 }), asyncRoute(async (req, res) => {
  if (!/^[a-zA-Z0-9_-]{12,80}$/.test(req.params.id)) return res.status(400).json({ error: 'IDが不正です。' });
  try {
    if (dbReady) {
      const result = await pool.query('SELECT save_data FROM neighbor_guests WHERE guest_id=$1', [req.params.id]);
      return res.json({ save: result.rows[0]?.save_data || {}, storage: 'server-db' });
    }
    return res.json({ save: readStore().guests[req.params.id] || {}, storage: 'temporary-file' });
  } catch (error) {
    console.error('Guest save read failed:', error.message);
    return res.status(500).json({ error: 'ゲストデータを読み込めませんでした。' });
  }
}));

app.put('/api/guest/:id', requestLimit({ keyPrefix: 'guest-save', max: 300, windowMs: 60_000 }), asyncRoute(async (req, res) => {
  if (!/^[a-zA-Z0-9_-]{12,80}$/.test(req.params.id)) return res.status(400).json({ error: 'IDが不正です。' });
  const validated = validateSave(req.body);
  if (validated.error) return res.status(validated.tooLarge ? 413 : 400).json({ error: validated.error });
  try {
    if (dbReady) {
      await pool.query(
        `INSERT INTO neighbor_guests(guest_id,save_data,updated_at) VALUES($1,$2::jsonb,NOW())
         ON CONFLICT(guest_id) DO UPDATE SET save_data=EXCLUDED.save_data, updated_at=NOW()`,
        [req.params.id, validated.serialized]
      );
      return res.json({ ok: true, savedAt: new Date().toISOString(), storage: 'server-db' });
    }
    await mutateStore(store => {
      store.guests[req.params.id] = JSON.parse(validated.serialized);
      return true;
    });
    return res.json({ ok: true, savedAt: new Date().toISOString(), storage: 'temporary-file' });
  } catch (error) {
    console.error('Guest save write failed:', error.message);
    return res.status(500).json({ error: 'ゲストデータを保存できませんでした。' });
  }
}));

app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  fallthrough: true,
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    if (path.extname(filePath).toLowerCase() === '.html') res.setHeader('Cache-Control', 'no-cache');
    else res.setHeader('Cache-Control', 'no-cache');
  }
}));
app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/play', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'play.html')));
app.get('/how-to', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'how-to.html')));
app.get('/records', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'records.html')));
app.get('/result', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'result.html')));
app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.use((error, _req, res, _next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ error: '送信データが大きすぎます。' });
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: 'JSON形式が正しくありません。' });
  console.error('Unhandled request error:', error.message);
  return res.status(500).json({ error: 'サーバーでエラーが発生しました。' });
});

async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not configured. Server-file saves are temporary on ephemeral hosts.');
    return;
  }
  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000
    });
    pool.on('error', error => console.error('Unexpected PostgreSQL client error:', error.message));
    await pool.query(`CREATE TABLE IF NOT EXISTS neighbor_accounts (
      username VARCHAR(24) PRIMARY KEY,
      password_hash TEXT NOT NULL,
      save_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS neighbor_guests (
      guest_id VARCHAR(80) PRIMARY KEY,
      save_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    dbReady = true;
    console.log('PostgreSQL save store ready');
  } catch (error) {
    console.error('PostgreSQL initialization failed; temporary-file fallback enabled:', error.message);
    if (pool) await pool.end().catch(() => {});
    pool = null;
    dbReady = false;
  }
}

async function start() {
  await initDb();
  httpServer = app.listen(PORT, '0.0.0.0', () => console.log(`Neighbor Watch listening on ${PORT}`));
}

async function shutdown(signal) {
  console.log(`${signal} received; shutting down gracefully.`);
  if (httpServer) await new Promise(resolve => httpServer.close(resolve));
  if (pool) await pool.end().catch(error => console.error('PostgreSQL shutdown error:', error.message));
  clearInterval(maintenanceTimer);
  process.exit(0);
}

if (require.main === module) {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  start().catch(error => {
    console.error('Server startup failed:', error);
    process.exit(1);
  });
}

module.exports = { app, start, shutdown, validateSave, readStore, writeStore, STORE_PATH };
