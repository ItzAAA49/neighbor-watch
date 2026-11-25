(() => {
  'use strict';

  const KEY = 'neighbor-watch-save-v1';
  const ACTIVE = 'neighbor-watch-active-v1';
  const RESULT = 'neighbor-watch-result-v1';
  const TOKEN = 'neighbor-watch-token-v1';
  const USER = 'neighbor-watch-user-v1';
  const GUEST = 'neighbor-watch-guest-v1';
  const MODES = new Set(['tutorial', 'campaign', 'arcade', 'nightmare', 'custom', 'cards']);

  const emptySave = () => ({
    records: [],
    posters: [],
    achievements: [],
    campaign: { unlockedNightmare: false, completed: false, day: 1, retryDay: 0, dead: [] },
    chesterBadge: false,
    stats: { captures: 0, kills: 0, admitted: 0, shifts: 0, highScore: 0, highRank: '—' },
    updatedAt: 0
  });

  function readStorage(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function writeStorage(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (error) { console.error('Local save could not be written:', error); return false; }
  }
  function removeStorage(key) {
    try { localStorage.removeItem(key); } catch (error) { console.warn('Local storage cleanup failed:', error); }
  }
  function parseJSON(value, fallback = null) {
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  }
  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  function normalizeSave(value) {
    const source = isObject(value) ? value : {};
    const defaults = emptySave();
    const campaignSource = isObject(source.campaign) ? source.campaign : {};
    const statsSource = isObject(source.stats) ? source.stats : {};
    const day = Number(campaignSource.day);
    const numeric = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    return {
      ...defaults,
      ...source,
      records: Array.isArray(source.records) ? source.records.filter(isObject).slice(-500) : [],
      posters: Array.isArray(source.posters) ? [...new Set(source.posters.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < 32))] : [],
      achievements: Array.isArray(source.achievements) ? [...new Set(source.achievements.filter(v => typeof v === 'string').slice(0, 200))] : [],
      campaign: {
        ...defaults.campaign,
        ...campaignSource,
        day: Math.max(1, Math.min(5, Number.isInteger(day) ? day : 1)),
        retryDay: Math.max(0, Math.min(5, Math.floor(numeric(campaignSource.retryDay)))),
        unlockedNightmare: Boolean(campaignSource.unlockedNightmare),
        completed: Boolean(campaignSource.completed),
        dead: Array.isArray(campaignSource.dead) ? [...new Set(campaignSource.dead.filter(v => typeof v === 'string'))] : []
      },
      stats: {
        ...defaults.stats,
        ...statsSource,
        captures: numeric(statsSource.captures),
        kills: numeric(statsSource.kills),
        admitted: numeric(statsSource.admitted),
        shifts: numeric(statsSource.shifts),
        highScore: numeric(statsSource.highScore),
        highRank: typeof statsSource.highRank === 'string' ? statsSource.highRank : '—'
      },
      chesterBadge: Boolean(source.chesterBadge),
      updatedAt: numeric(source.updatedAt)
    };
  }

  function getSave() {
    return normalizeSave(parseJSON(readStorage(KEY), {}));
  }

  let saveTimer = null;
  let syncQueue = Promise.resolve();
  let lastSyncErrorAt = 0;
  let navigationPending = false;

  function scheduleSync() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      syncSave().catch(error => console.warn('Save sync deferred:', error));
    }, 350);
  }

  function setSave(value) {
    const next = normalizeSave(value);
    next.updatedAt = Date.now();
    if (writeStorage(KEY, JSON.stringify(next))) scheduleSync();
    return next;
  }

  function getToken() { return readStorage(TOKEN) || ''; }
  function getGuestId() {
    let id = readStorage(GUEST);
    if (!id) {
      const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      id = random.replace(/[^a-zA-Z0-9_-]/g, '');
      writeStorage(GUEST, id);
    }
    return id;
  }

  function mergeSaves(localValue, remoteValue) {
    const local = normalizeSave(localValue);
    const remote = normalizeSave(remoteValue);
    const remoteIsNewer = remote.updatedAt >= local.updatedAt;
    const newer = remoteIsNewer ? remote : local;
    const older = remoteIsNewer ? local : remote;
    const recordKey = record => record.id || [record.date, record.day, record.mode, record.score, record.captures, record.kills, record.admitted].join('|');
    const records = new Map();
    [...older.records, ...newer.records].forEach(record => records.set(recordKey(record), record));
    const rankOrder = { '—': 0, F: 1, D: 2, C: 3, B: 4, A: 5, S: 6 };
    const localStats = local.stats;
    const remoteStats = remote.stats;
    const preferredRank = (rankOrder[localStats.highRank] || 0) >= (rankOrder[remoteStats.highRank] || 0) ? localStats.highRank : remoteStats.highRank;
    const merged = {
      ...newer,
      records: [...records.values()].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))).slice(-500),
      posters: [...new Set([...local.posters, ...remote.posters])],
      achievements: [...new Set([...local.achievements, ...remote.achievements])],
      campaign: {
        ...older.campaign,
        ...newer.campaign,
        dead: [...new Set([...local.campaign.dead, ...remote.campaign.dead])],
        unlockedNightmare: local.campaign.unlockedNightmare || remote.campaign.unlockedNightmare,
        completed: local.campaign.completed || remote.campaign.completed,
        retryDay: Math.max(0, Math.min(5, Math.floor(Number(newer.campaign.retryDay) || 0)))
      },
      stats: {
        captures: Math.max(localStats.captures, remoteStats.captures),
        kills: Math.max(localStats.kills, remoteStats.kills),
        admitted: Math.max(localStats.admitted, remoteStats.admitted),
        shifts: Math.max(localStats.shifts, remoteStats.shifts),
        highScore: Math.max(localStats.highScore, remoteStats.highScore),
        highRank: preferredRank
      },
      chesterBadge: local.chesterBadge || remote.chesterBadge,
      updatedAt: Math.max(local.updatedAt, remote.updatedAt)
    };
    if (Object.prototype.hasOwnProperty.call(newer, 'activeGame')) merged.activeGame = newer.activeGame;
    else delete merged.activeGame;
    return normalizeSave(merged);
  }

  function syncSave(options = {}) {
    const snapshot = getSave();
    const token = getToken();
    const guest = getGuestId();
    const url = token ? '/api/account/save' : `/api/guest/${encodeURIComponent(guest)}`;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const task = async () => {
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ save: snapshot }),
        keepalive: Boolean(options.keepalive)
      });
      if (response.status === 401 && token) {
        removeStorage(TOKEN);
        removeStorage(USER);
        throw new Error('セッションの有効期限が切れました。もう一度ログインしてください。');
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `セーブ同期に失敗しました (${response.status})`);
      }
      return true;
    };
    syncQueue = syncQueue.catch(() => false).then(task);
    return syncQueue.catch(error => {
      if (Date.now() - lastSyncErrorAt > 10000) {
        console.warn('Remote save sync failed:', error.message);
        lastSyncErrorAt = Date.now();
      }
      throw error;
    });
  }

  async function restoreRemote() {
    const token = getToken();
    const guest = getGuestId();
    const url = token ? '/api/account/save' : `/api/guest/${encodeURIComponent(guest)}`;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const response = await fetch(url, { headers, cache: 'no-store' });
      if (response.status === 401 && token) {
        removeStorage(TOKEN);
        removeStorage(USER);
        return false;
      }
      if (!response.ok) return false;
      const data = await response.json();
      const localBefore = getSave();
      const remoteBefore = normalizeSave(data.save || {});
      const merged = mergeSaves(localBefore, remoteBefore);
      writeStorage(KEY, JSON.stringify(merged));
      if (Object.prototype.hasOwnProperty.call(merged, 'activeGame') && merged.activeGame) {
        writeStorage(ACTIVE, JSON.stringify(merged.activeGame));
      } else {
        removeStorage(ACTIVE);
      }
      if (localBefore.updatedAt > remoteBefore.updatedAt) scheduleSync();
      return true;
    } catch (error) {
      console.warn('Remote save restore unavailable:', error.message);
      return false;
    }
  }

  function active() {
    const value = parseJSON(readStorage(ACTIVE), null);
    return isObject(value) ? value : null;
  }

  function writeActive(game) {
    const save = getSave();
    if (game) {
      game.updatedAt = Date.now();
      writeStorage(ACTIVE, JSON.stringify(game));
      save.activeGame = game;
    } else {
      removeStorage(ACTIVE);
      delete save.activeGame;
    }
    setSave(save);
  }

  function toast(message) {
    let element = document.getElementById('toast');
    if (!element) {
      element = document.createElement('div');
      element.className = 'toast';
      element.setAttribute('role', 'status');
      document.body.appendChild(element);
    }
    element.textContent = String(message ?? '');
    element.classList.add('show');
    clearTimeout(element._toastTimer);
    element._toastTimer = setTimeout(() => element.classList.remove('show'), 2600);
  }

  function setStatus(message) {
    const element = document.getElementById('auth-status');
    if (element) element.textContent = message;
  }

  function refreshHome() {
    const activeGame = active();
    const save = getSave();
    const retryDay = Number(save.campaign.retryDay) || 0;
    const continueButton = document.getElementById('continue-button');
    const continueNote = document.getElementById('continue-note');
    if (continueButton) continueButton.disabled = !activeGame && !retryDay;
    if (continueNote) continueNote.textContent = activeGame ? `${activeGame.day || 1}日目の勤務が保存されています` : retryDay ? `${retryDay}日目の再挑戦が保存されています` : '進行中の勤務記録はありません';
    const nightmareLock = document.getElementById('nightmare-lock');
    if (nightmareLock) nightmareLock.textContent = save.campaign.unlockedNightmare ? '解放済み' : 'キャンペーンクリアで解放';
    const nightmareButton = document.querySelector('[data-mode="nightmare"]');
    if (nightmareButton) nightmareButton.disabled = !save.campaign.unlockedNightmare;
    const username = readStorage(USER);
    if (username) setStatus(`${username} としてログイン中`);
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) logoutButton.hidden = !username;
  }

  async function initHome() {
    const launchButtons = [...document.querySelectorAll('[data-mode]')];
    const continueButton = document.getElementById('continue-button');
    launchButtons.forEach(button => { button.disabled = true; });
    if (continueButton) continueButton.disabled = true;
    try {
      await restoreRemote();
    } finally {
      refreshHome();
      const latestSave = getSave();
      launchButtons.forEach(button => { button.disabled = button.dataset?.mode === 'nightmare' && !latestSave.campaign.unlockedNightmare; });
      navigationPending = false;
    }
  }

  async function auth(kind) {
    if (!['signup', 'login'].includes(kind)) return;
    const username = document.getElementById('auth-user')?.value.trim() || '';
    const password = document.getElementById('auth-pass')?.value || '';
    if (!username || !password) { setStatus('ユーザー名とパスワードを入力してください。'); return; }
    try {
      const response = await fetch(`/api/auth/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '認証できませんでした。');
      writeStorage(TOKEN, data.token);
      writeStorage(USER, data.username);
      await restoreRemote();
      await syncSave();
      setStatus(`${data.username} としてログイン中 / 保存先: ${data.storage === 'server-db' ? 'PostgreSQL' : '一時サーバー保存'}`);
      const logoutButton = document.getElementById('logout-button');
      if (logoutButton) logoutButton.hidden = false;
      refreshHome();
    } catch (error) {
      setStatus(error.message || '認証できませんでした。');
    }
  }

  async function logout() {
    try { await syncSave(); } catch { /* Keep the local save even if the server is unavailable. */ }
    const token = getToken();
    if (token) {
      try { await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); }
      catch { /* Local logout still proceeds. */ }
    }
    removeStorage(TOKEN);
    removeStorage(USER);
    setStatus('ゲストとしてプレイ中');
    const button = document.getElementById('logout-button');
    if (button) button.hidden = true;
  }

  function startMode(mode) {
    if (navigationPending) return;
    if (!MODES.has(mode)) { toast('選択できないゲームモードです。'); return; }
    const save = getSave();
    if (mode === 'nightmare' && !save.campaign.unlockedNightmare) {
      toast('ナイトメアはキャンペーンをクリアすると解放されます。');
      return;
    }
    navigationPending = true;
    if (mode === 'campaign' && save.campaign.retryDay) { save.campaign.retryDay = 0; setSave(save); }
    const game = {
      mode,
      day: mode === 'campaign' && !save.campaign.completed ? Math.max(1, save.campaign.retryDay || save.campaign.day || 1) : 1,
      dead: mode === 'campaign' && !save.campaign.completed && save.campaign.day > 1 ? [...save.campaign.dead] : [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      seed: Math.floor(Math.random() * 0xFFFFFFFF),
      visitorIndex: 0,
      visitors: [],
      todayList: [],
      checklist: {},
      actions: [],
      score: 0,
      captures: 0,
      kills: 0,
      admitted: 0,
      minorMistakes: 0,
      errors: 0,
      reportErrors: 0,
      chesterDone: false,
      campaignStats: { admittedNames: [], reportedNames: [], visitorCount: 0, doppelVisitors: 0, admittedVisitors: 0, admittedDoppels: 0, capturedDoppels: 0, rejectedResidents: 0, humanKilled: 0, seenNames: [] }
    };
    writeActive(game);
    syncSave({ keepalive: true }).catch(() => {});
    location.href = `/play?mode=${encodeURIComponent(mode)}`;
  }

  function continueGame() {
    if (navigationPending) return;
    if (!active() && (Number(getSave().campaign.retryDay) || 0) > 0) { startMode('campaign'); return; }
    if (active()) {
      navigationPending = true;
      syncSave({ keepalive: true }).catch(() => {});
      location.href = '/play';
      return;
    }
    toast('続きから遊べる勤務記録がありません。');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  async function initRecords() {
    await restoreRemote();
    renderRecords();
  }

  function renderRecords() {
    const save = getSave();
    const stats = save.stats;
    const el = id => document.getElementById(id);
    const setText = (id, value) => { const node = el(id); if (node) node.textContent = String(value); };
    setText('record-days', stats.shifts || save.records.length);
    setText('record-captures', stats.captures);
    setText('record-mistakes', stats.kills);
    setText('record-rank', stats.highRank || '—');

    const history = el('record-history');
    if (history) {
      history.replaceChildren();
      if (!save.records.length) {
        const empty = document.createElement('p');
        empty.className = 'empty-record';
        empty.textContent = 'まだ勤務記録がありません。';
        history.appendChild(empty);
      } else {
        save.records.slice().reverse().slice(0, 20).forEach(record => {
          const row = document.createElement('div');
          row.className = 'history-row';
          const date = document.createElement('small'); date.textContent = record.date || '1955/02';
          const mode = document.createElement('span'); mode.textContent = `${record.modeLabel || record.mode || '勤務'} / ${record.day || 1}日目`;
          const rank = document.createElement('b'); rank.className = 'history-rank'; rank.textContent = record.rank || '—';
          const score = document.createElement('small'); score.textContent = `${Number(record.score || 0).toLocaleString()} PTS`;
          row.append(date, mode, rank, score);
          history.appendChild(row);
        });
      }
    }

    const posters = el('poster-grid');
    if (posters) {
      posters.replaceChildren();
      (window.NW_DATA?.posterNames || []).forEach((name, index) => {
        const found = save.posters.includes(index);
        const node = document.createElement('div');
        node.className = `poster${found ? ' found' : ''}`;
        const number = document.createElement('b'); number.textContent = found ? '✓' : String(index + 1).padStart(2, '0');
        const label = document.createElement('small'); label.textContent = found ? name : '未確認';
        node.append(number, label);
        posters.appendChild(node);
      });
    }

    const achievements = el('achievement-grid');
    if (achievements) {
      achievements.replaceChildren();
      (window.NW_DATA?.achievements || []).forEach(([id, title, description]) => {
        const earned = save.achievements.includes(id);
        const node = document.createElement('div');
        node.className = `achievement${earned ? ' earned' : ''}`;
        const heading = document.createElement('b'); heading.textContent = `${earned ? '★' : '◇'} ${title}`;
        const detail = document.createElement('small'); detail.textContent = description;
        node.append(heading, detail);
        achievements.appendChild(node);
      });
    }
  }

  async function initResult() {
    await restoreRemote();
    renderResult();
  }

  function renderResult() {
    const result = parseJSON(readStorage(RESULT), {}) || {};
    const el = id => document.getElementById(id);
    const setText = (id, value) => { const node = el(id); if (node) node.textContent = String(value); };
    setText('result-title', result.title || '勤務結果');
    setText('result-rank', result.rank || '—');
    setText('result-message', result.message || '今日の勤務が終了しました。');
    setText('result-captures', result.captures || 0);
    setText('result-kills', result.kills || 0);
    setText('result-admitted', result.admitted || 0);
    setText('result-misadmitted', result.misadmitted || 0);
    setText('result-minor-mistakes', result.minorMistakes || 0);
    setText('result-score', Number(result.score || 0).toLocaleString());

    const details = el('result-details');
    if (details) {
      details.className = 'result-details-list';
      const list = document.createElement('ul');
      (Array.isArray(result.details) ? result.details : []).forEach(detailText => {
        const item = document.createElement('li'); item.textContent = String(detailText); list.appendChild(item);
      });
      details.replaceChildren(list);
    }

    if (result.tutorial) {
      const actions = el('result-actions');
      if (actions && !el('certificate-button')) {
        const certificate = document.createElement('button');
        certificate.id = 'certificate-button';
        certificate.className = 'button';
        certificate.textContent = '研修修了証をPNGで保存';
        certificate.onclick = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 1400; canvas.height = 900;
          const context = canvas.getContext('2d');
          if (!context) { toast('修了証を作成できませんでした。'); return; }
          context.fillStyle = '#eee5cf'; context.fillRect(0, 0, canvas.width, canvas.height);
          context.strokeStyle = '#6c5b43'; context.lineWidth = 18; context.strokeRect(35, 35, canvas.width - 70, canvas.height - 70);
          context.strokeStyle = '#9b3a31'; context.lineWidth = 6; context.strokeRect(65, 65, canvas.width - 130, canvas.height - 130);
          context.textAlign = 'center'; context.fillStyle = '#493c2c'; context.font = '32px serif'; context.fillText('DOPPELGÄNGER DETECTION DEPARTMENT', 700, 190);
          context.font = '76px serif'; context.fillText('研修修了証', 700, 360);
          context.font = '30px serif'; context.fillText('Agent #1314 の審査研修を修了したことを証明します。', 700, 470);
          context.font = '24px monospace'; context.fillText('FEBRUARY 1955  /  D.D.D. PERSONNEL', 700, 590);
          context.fillStyle = '#983b33'; context.font = 'bold 44px serif'; context.fillText('APPROVED', 700, 710);
          const anchor = document.createElement('a');
          anchor.href = canvas.toDataURL('image/png');
          anchor.download = 'DDD-training-certificate.png';
          anchor.click();
        };
        actions.prepend(certificate);
      }
    }

    const toggle = el('details-toggle');
    if (toggle && details) {
      toggle.onclick = () => {
        details.hidden = !details.hidden;
        toggle.textContent = details.hidden ? '詳細を見る ＋' : '詳細を閉じる −';
      };
    }

    const ending = el('campaign-ending');
    if (ending && result.ending) {
      ending.hidden = false;
      ending.replaceChildren();
      const heading = document.createElement('h2'); heading.textContent = result.ending.title || 'キャンペーン終了';
      const paragraph = document.createElement('p'); paragraph.textContent = result.ending.text || '';
      ending.append(heading, paragraph);
    }

    const next = el('next-day-button');
    if (next) {
      const gameAtRender = active();
      const alreadyAdvanced = Boolean(result.id && gameAtRender?.lastAdvancedResultId === result.id);
      if (result.next && !alreadyAdvanced) {
        next.hidden = false;
        next.disabled = false;
        next.textContent = result.nextLabel || '次の日へ進む';
        let advancing = false;
        next.onclick = () => {
          if (advancing) return;
          const game = active();
          if (!game || game.mode !== 'campaign' || game.day >= 5 || (result.id && game.lastAdvancedResultId === result.id)) {
            next.disabled = true;
            next.hidden = true;
            toast('この勤務から次の日へ進む処理は、すでに完了しています。');
            return;
          }
          advancing = true;
          next.disabled = true;
          if (result.id) game.lastAdvancedResultId = result.id;
          game.day += 1;
          game.finished = false;
          game.visitorIndex = 0;
          game.visitors = [];
          game.todayList = [];
          game.checklist = {};
          game.paused = false;
          game.pausedAt = 0;
          game.actions = [];
          game.phoneLog = [];
          game.score = 0;
          game.captures = 0;
          game.kills = 0;
          game.admitted = 0;
          game.minorMistakes = 0;
          game.errors = 0;
          game.reportErrors = 0;
          game.fatalAdmission = false;
          game.entityDeath = false;
          game.entityAppeared = false;
          game.chesterDone = false;
          game.chesterCorrect = Number(game.chesterCorrect || 0);
          game.hoodedLetterSeen = false;
          game.startedAt = 0;
          game.timeLimit = 0;
          game.timeBonusAwarded = false;
          game.seed = Math.floor(Math.random() * 0xFFFFFFFF);
          const save = getSave();
          save.campaign.day = game.day;
          save.campaign.retryDay = 0;
          setSave(save);
          writeActive(game);
          syncSave({ keepalive: true }).catch(() => {});
          location.href = '/play';
        };
      } else {
        next.hidden = true;
        next.disabled = true;
        next.onclick = null;
      }
    }

    const retry = el('retry-day-button');
    if (retry) {
      const save = getSave();
      const retryAvailable = result.mode === 'campaign' && Number(result.retryDay) === Number(result.day) &&
        Number(save.campaign.retryDay) === Number(result.day);
      retry.hidden = !retryAvailable;
      retry.disabled = !retryAvailable;
      retry.onclick = () => {
        const latest = getSave();
        if (!retryAvailable || Number(latest.campaign.retryDay) !== Number(result.day)) {
          retry.disabled = true;
          retry.hidden = true;
          toast('この日の再挑戦はすでに終了しています。');
          return;
        }
        startMode('campaign');
      };
    }
  }

  function flushPendingSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    // Send a keepalive snapshot even if a debounced request has already started.
    syncSave({ keepalive: true }).catch(() => {});
  }
  window.addEventListener('pagehide', flushPendingSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingSave();
  });

  window.Neighbor = {
    getSave,
    setSave,
    syncSave,
    active,
    writeActive,
    startMode,
    continueGame,
    toast,
    initHome,
    initRecords,
    initResult,
    auth,
    logout,
    renderRecords,
    renderResult,
    restoreRemote,
    escapeHtml,
    KEY,
    ACTIVE,
    RESULT
  };
})();
