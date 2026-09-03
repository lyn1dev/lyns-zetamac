/**
 * Zetamac GitHub Contents API Sync Engine
 * - Private Repository storage with Contents API
 * - 3-File Partition: core.json (<64KB), stats.json, history.json
 * - Optimistic Concurrency with SHA-based Compare-And-Swap (CAS) retry loop
 * - Commutative Merges (CRDT)
 * - Keepalive discipline strictly for core.json on visibilitychange hidden
 * - Comprehensive Error State Machine & Secondary Rate Limit Pacing
 */

(() => {
  'use strict';

  const SCHEMA_VERSIONS = {
    'core.json': 1,
    'stats.json': 1,
    'history.json': 1
  };

  const STORAGE_KEY_CREDS = 'zetamac_github_creds';
  const STORAGE_KEY_PENDING = 'zetamac_has_pending_sync';
  const STORAGE_KEY_CACHE = 'zetamac_local_db_cache';
  const STORAGE_KEY_PROCESSED_ROUNDS = 'zetamac_processed_round_ids';
  const STORAGE_KEY_SHAS = 'zetamac_cached_shas';
  const STORAGE_KEY_MUTATION_SEQ = 'zetamac_mutation_seq';

  // State
  let creds = null; // { token, owner, repo, deviceId }
  let cachedShas = loadCachedShas(); // { 'core.json': sha, ... }
  let isSyncing = false;
  let currentSyncingFile = null; // 'core.json' | 'stats.json' | 'history.json' | null
  let syncListeners = [];

  function loadCachedShas() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SHAS);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  function saveCachedSha(path, sha) {
    cachedShas[path] = sha;
    try {
      localStorage.setItem(STORAGE_KEY_SHAS, JSON.stringify(cachedShas));
    } catch (e) {}
  }

  function getMutationSeq() {
    return parseInt(localStorage.getItem(STORAGE_KEY_MUTATION_SEQ) || '0', 10);
  }

  function incrementMutationSeq() {
    const next = getMutationSeq() + 1;
    localStorage.setItem(STORAGE_KEY_MUTATION_SEQ, String(next));
    return next;
  }

  // Initialize or load Device ID
  function getOrCreateDeviceId() {
    let devId = localStorage.getItem('zetamac_device_id');
    if (!devId) {
      devId = 'dev_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('zetamac_device_id', devId);
    }
    return devId;
  }

  const deviceId = getOrCreateDeviceId();

  // Load Credentials
  function loadCredentials() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CREDS);
      if (raw) {
        creds = JSON.parse(raw);
        if (!creds.deviceId) creds.deviceId = deviceId;
      }
    } catch (e) {
      creds = null;
    }
    return creds;
  }

  function saveCredentials(token, owner, repo) {
    creds = {
      token: token.trim(),
      owner: owner.trim(),
      repo: repo.trim(),
      deviceId
    };
    localStorage.setItem(STORAGE_KEY_CREDS, JSON.stringify(creds));
    return creds;
  }

  function clearCredentials() {
    creds = null;
    localStorage.removeItem(STORAGE_KEY_CREDS);
    notifySyncListeners('disconnected');
  }

  // --- Local Database Cache ---
  function getInitialLocalData() {
    return {
      core: {
        schemaVersion: 1,
        settingsUpdatedAt: Date.now(),
        settings: {
          duration: 120,
          addEnabled: true,
          addMin1: 2, addMax1: 100,
          addMin2: 2, addMax2: 100,
          multEnabled: true,
          multMin1: 2, multMax1: 12,
          multMin2: 2, multMax2: 100,
          subEnabled: true,
          divEnabled: true
        },
        dailyStats: {
          date: new Date().toISOString().slice(0, 10),
          rounds: 0,
          lastReminderTime: 0,
          remindersEnabled: false,
          reminderStart: '09:00',
          reminderEnd: '22:00'
        },
        personalBests: [],
        achievements: {}
      },
      stats: {
        schemaVersion: 1,
        agg: {}
      },
      history: {
        schemaVersion: 1,
        history: []
      }
    };
  }

  function getLocalData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CACHE);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {}
    return getInitialLocalData();
  }

  function persistLocalDataInternal(data) {
    try {
      localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(data));
    } catch (e) {}
  }

  function saveLocalData(data) {
    try {
      localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(data));
      incrementMutationSeq();
    } catch (e) {}
  }

  function getProcessedRoundIds() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROCESSED_ROUNDS);
      if (raw) return new Set(JSON.parse(raw));
    } catch (e) {}
    return new Set();
  }

  function addProcessedRoundId(roundId) {
    const set = getProcessedRoundIds();
    set.add(roundId);
    // Keep max 200 processed IDs in set
    const arr = Array.from(set).slice(-200);
    localStorage.setItem(STORAGE_KEY_PROCESSED_ROUNDS, JSON.stringify(arr));
  }

  // --- Dirty Flag Management ---
  function hasPendingSync() {
    return localStorage.getItem(STORAGE_KEY_PENDING) === 'true';
  }

  function setPendingSync(pending) {
    localStorage.setItem(STORAGE_KEY_PENDING, pending ? 'true' : 'false');
    notifySyncListeners(pending ? 'pending' : 'synced');
  }

  function onSyncChange(fn) {
    syncListeners.push(fn);
  }

  function notifySyncListeners(status, detail) {
    syncListeners.forEach(fn => {
      try { fn(status, detail); } catch (e) {}
    });
  }

  // --- GitHub API Base64 Helpers ---
  function unicodeToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function base64ToUnicode(b64) {
    return decodeURIComponent(escape(atob(b64.replace(/\s/g, ''))));
  }

  // Sleep utility for rate limiting and backoff
  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  // --- Commutative Merge Implementations ---

  // 1. Merge Core
  function mergeCore(remote, local) {
    if (!remote) return local;
    if (!local) return remote;

    // Schema version check
    if (remote.schemaVersion && remote.schemaVersion > SCHEMA_VERSIONS['core.json']) {
      throw new Error(`Cloud core schema v${remote.schemaVersion} is newer than client v${SCHEMA_VERSIONS['core.json']}`);
    }

    // Settings: LWW on settingsUpdatedAt
    const localTs = local.settingsUpdatedAt || 0;
    const remoteTs = remote.settingsUpdatedAt || 0;
    const winningSettings = remoteTs > localTs ? remote.settings : local.settings;
    const winningSettingsTs = Math.max(localTs, remoteTs);

    // Personal Bests: Union by timestamp (append-only)
    const pbMap = new Map();
    (remote.personalBests || []).forEach(pb => {
      if (pb && pb.timestamp) pbMap.set(pb.timestamp, pb);
    });
    (local.personalBests || []).forEach(pb => {
      if (pb && pb.timestamp) pbMap.set(pb.timestamp, pb);
    });
    const mergedPbs = Array.from(pbMap.values());

    // Achievements: Take min timestamp (earliest true unlock)
    const mergedAchievements = { ...(local.achievements || {}) };
    if (remote.achievements) {
      for (const [key, remoteTs] of Object.entries(remote.achievements)) {
        if (!mergedAchievements[key] || remoteTs < mergedAchievements[key]) {
          mergedAchievements[key] = remoteTs;
        }
      }
    }

    // Daily stats: If same day, take max rounds
    const mergedDaily = { ...(local.dailyStats || {}) };
    if (remote.dailyStats && remote.dailyStats.date === mergedDaily.date) {
      mergedDaily.rounds = Math.max(mergedDaily.rounds || 0, remote.dailyStats.rounds || 0);
      mergedDaily.lastReminderTime = Math.max(mergedDaily.lastReminderTime || 0, remote.dailyStats.lastReminderTime || 0);
    }
    if (remote.dailyStats) {
      if (remote.dailyStats.reminderStart) mergedDaily.reminderStart = remote.dailyStats.reminderStart;
      if (remote.dailyStats.reminderEnd) mergedDaily.reminderEnd = remote.dailyStats.reminderEnd;
    }

    return {
      schemaVersion: SCHEMA_VERSIONS['core.json'],
      settingsUpdatedAt: winningSettingsTs,
      settings: winningSettings,
      dailyStats: mergedDaily,
      personalBests: mergedPbs,
      achievements: mergedAchievements
    };
  }

  // 2. Merge Stats (Log-Spaced Histograms)
  function mergeStats(remote, local) {
    if (!remote) return local;
    if (!local) return remote;

    if (remote.schemaVersion && remote.schemaVersion > SCHEMA_VERSIONS['stats.json']) {
      throw new Error(`Cloud stats schema v${remote.schemaVersion} is newer than client v${SCHEMA_VERSIONS['stats.json']}`);
    }

    const mergedAgg = window.ZetamacAnalytics.mergeAggregates(remote.agg, local.agg);
    return {
      schemaVersion: SCHEMA_VERSIONS['stats.json'],
      agg: mergedAgg
    };
  }

  // 3. Merge History (Union by round id, sort desc, slice 30)
  function mergeHistory(remote, local) {
    if (!remote) return local;
    if (!local) return remote;

    if (remote.schemaVersion && remote.schemaVersion > SCHEMA_VERSIONS['history.json']) {
      throw new Error(`Cloud history schema v${remote.schemaVersion} is newer than client v${SCHEMA_VERSIONS['history.json']}`);
    }

    const roundMap = new Map();
    (remote.history || []).forEach(r => {
      if (r && r.id) roundMap.set(r.id, r);
    });
    (local.history || []).forEach(r => {
      if (r && r.id) roundMap.set(r.id, r);
    });

    const merged = Array.from(roundMap.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 30);

    return {
      schemaVersion: SCHEMA_VERSIONS['history.json'],
      history: merged
    };
  }

  // --- GitHub Contents API Client ---

  async function githubRequest(path, options = {}) {
    if (!creds || !creds.token || !creds.owner || !creds.repo) {
      throw new Error('NO_CREDENTIALS');
    }

    const url = `https://api.github.com/repos/${creds.owner}/${creds.repo}/contents/${path}`;
    const headers = {
      'Authorization': `Bearer ${creds.token}`,
      'Accept': 'application/vnd.github.v3+json',
      ...options.headers
    };

    const fetchOptions = {
      ...options,
      headers
    };

    // If timeout signal not provided, default to 8s
    if (!fetchOptions.signal && !fetchOptions.keepalive) {
      fetchOptions.signal = AbortSignal.timeout(8000);
    }

    const res = await fetch(url, fetchOptions);

    // Rate Limit / Retry-After check
    if (res.status === 403) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      const resetTime = res.headers.get('x-ratelimit-reset');
      const retryAfter = res.headers.get('retry-after');
      if (remaining === '0' && resetTime) {
        const waitMs = Math.max(0, parseInt(resetTime, 10) * 1000 - Date.now());
        notifySyncListeners('rate_limited', { waitMs });
        await sleep(Math.min(waitMs, 60000));
      } else if (retryAfter) {
        await sleep(parseInt(retryAfter, 10) * 1000);
      }
    }

    return res;
  }

  async function getRemoteFile(path) {
    try {
      const res = await githubRequest(path, { method: 'GET' });
      if (res.status === 404) {
        return null;
      }
      if (res.status === 401) {
        notifySyncListeners('auth_error', { status: 401 });
        throw new Error('AUTH_ERROR');
      }
      if (!res.ok) {
        throw new Error(`HTTP_${res.status}`);
      }

      const data = await res.json();
      // Store sha
      if (data.sha) saveCachedSha(path, data.sha);

      // Check for large file or empty content fallback
      let rawContent = '';
      if (data.content) {
        rawContent = base64ToUnicode(data.content);
      } else if (data.download_url) {
        // Fallback to raw download URL if above soft cap
        const rawRes = await fetch(data.download_url);
        rawContent = await rawRes.text();
      }

      const json = JSON.parse(rawContent);
      return { json, sha: data.sha };
    } catch (err) {
      if (err.message === 'NO_CREDENTIALS' || err.message === 'AUTH_ERROR') throw err;
      return null;
    }
  }

  async function putRemoteFile(path, contentObj, sha) {
    const contentStr = window.ZetamacAnalytics.canonicalStringify(contentObj);
    const body = {
      message: `Sync ${path} [skip ci]`,
      content: unicodeToBase64(contentStr)
    };
    if (sha) {
      body.sha = sha;
    }

    const res = await githubRequest(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    return res;
  }

  // --- Compare-And-Swap (CAS) File Writer Loop ---
  async function writeFileWithCAS(path, localObj, mergeFn) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const remote = await getRemoteFile(path);
      const merged = mergeFn(remote?.json, localObj);

      const res = await putRemoteFile(path, merged, remote?.sha || cachedShas[path]);

      if (res.status === 409) {
        // Optimistic concurrency collision: retry with fresh remote SHA
        await sleep(300 + Math.random() * 400);
        continue;
      }

      if (res.status === 401) {
        notifySyncListeners('auth_error', { status: 401 });
        throw new Error('AUTH_ERROR');
      }

      if (res.status === 404) {
        notifySyncListeners('repo_missing', { path });
        throw new Error('REPO_MISSING');
      }

      if (res.ok) {
        const resData = await res.json();
        const freshSha = resData.content?.sha || resData.commit?.sha;
        if (freshSha) saveCachedSha(path, freshSha);
        return merged;
      }

      throw new Error(`PUT_FAILED_${res.status}`);
    }
    throw new Error('CAS_RETRY_EXCEEDED');
  }

  // --- Opportunistic Dying-Page Flush (visibilitychange hidden) ---
  function flushCoreOnlyOpportunistic() {
    if (!creds || !creds.token || !hasPendingSync()) return;
    // Guard 1: If syncAll is actively in-flight writing core.json, avoid conflicting keepalive race
    if (isSyncing && currentSyncingFile === 'core.json') return;
    // Guard 2: If we have no cached SHA for core.json, GitHub Contents API PUT will fail with 422
    if (!cachedShas['core.json']) return;

    try {
      const localData = getLocalData();
      const contentStr = window.ZetamacAnalytics.canonicalStringify(localData.core);
      const body = {
        message: `Flush core.json [skip ci]`,
        content: unicodeToBase64(contentStr),
        sha: cachedShas['core.json']
      };

      const url = `https://api.github.com/repos/${creds.owner}/${creds.repo}/contents/core.json`;
      // Use keepalive: true strictly for dying page flush
      // NOTE: DO NOT clear hasPendingSync here!
      fetch(url, {
        method: 'PUT',
        keepalive: true,
        headers: {
          'Authorization': `Bearer ${creds.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }).catch(() => {});
    } catch (e) {}
  }

  // --- Primary Full Synchronizer ---
  async function syncAll() {
    if (!creds) {
      notifySyncListeners('no_token');
      return;
    }
    if (isSyncing) return;
    isSyncing = true;
    notifySyncListeners('syncing');

    const startMutationSeq = getMutationSeq();

    try {
      // 1. Sync core.json
      currentSyncingFile = 'core.json';
      const initialCore = getLocalData().core;
      const mergedCore = await writeFileWithCAS('core.json', initialCore, mergeCore);
      // Incrementally merge back into freshest local state so changes made during CAS are preserved
      const fresh1 = getLocalData();
      fresh1.core = mergeCore(mergedCore, fresh1.core);
      persistLocalDataInternal(fresh1);

      await sleep(1000); // Pacing for GitHub secondary rate limits

      // 2. Sync stats.json
      currentSyncingFile = 'stats.json';
      const initialStats = getLocalData().stats;
      const mergedStats = await writeFileWithCAS('stats.json', initialStats, mergeStats);
      const fresh2 = getLocalData();
      fresh2.stats = mergeStats(mergedStats, fresh2.stats);
      persistLocalDataInternal(fresh2);

      await sleep(1000);

      // 3. Sync history.json
      currentSyncingFile = 'history.json';
      const initialHistory = getLocalData().history;
      const mergedHistory = await writeFileWithCAS('history.json', initialHistory, mergeHistory);
      const fresh3 = getLocalData();
      fresh3.history = mergeHistory(mergedHistory, fresh3.history);
      persistLocalDataInternal(fresh3);

      // TOCTOU Check: Verify if new local mutations occurred while syncing
      const endMutationSeq = getMutationSeq();
      if (endMutationSeq === startMutationSeq) {
        setPendingSync(false);
        notifySyncListeners('synced', { timestamp: Date.now() });
      } else {
        // User mutated state while sync was running; maintain pending sync and schedule catch-up
        setPendingSync(true);
        notifySyncListeners('pending');
        setTimeout(() => {
          if (!isSyncing && hasPendingSync()) syncAll();
        }, 2500);
      }
    } catch (err) {
      console.warn('Zetamac sync error:', err);
      if (err.message !== 'AUTH_ERROR' && err.message !== 'REPO_MISSING') {
        setPendingSync(true); // Maintain dirty flag for next opportunity
        notifySyncListeners('offline_pending');
      }
    } finally {
      currentSyncingFile = null;
      isSyncing = false;
    }
  }

  // Initial pull and merge on startup
  async function startupPullAndMerge() {
    if (!creds) return;
    // If pending changes exist, execute full syncAll to push and merge
    if (hasPendingSync()) {
      return syncAll();
    }
    if (isSyncing) return;
    isSyncing = true;
    try {
      notifySyncListeners('syncing');
      const localData = getLocalData();

      const remoteCore = await getRemoteFile('core.json');
      if (remoteCore) localData.core = mergeCore(remoteCore.json, localData.core);

      const remoteStats = await getRemoteFile('stats.json');
      if (remoteStats) localData.stats = mergeStats(remoteStats.json, localData.stats);

      const remoteHistory = await getRemoteFile('history.json');
      if (remoteHistory) localData.history = mergeHistory(remoteHistory.json, localData.history);

      persistLocalDataInternal(localData);
      notifySyncListeners('synced', { timestamp: Date.now() });
    } catch (e) {
      console.warn('Startup pull deferred:', e);
    } finally {
      isSyncing = false;
    }
  }

  // Validate Token and verify repo access
  async function validateAndConnect(token, owner, repo) {
    const testUrl = `https://api.github.com/repos/${owner.trim()}/${repo.trim()}`;
    const res = await fetch(testUrl, {
      headers: {
        'Authorization': `Bearer ${token.trim()}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (res.status === 401) {
      throw new Error('Invalid personal access token.');
    }
    if (res.status === 404) {
      throw new Error(`Repository "${owner.trim()}/${repo.trim()}" not found or token lacks access. Ensure you created the private repo with a README.`);
    }
    if (!res.ok) {
      throw new Error(`GitHub error: HTTP ${res.status}`);
    }

    saveCredentials(token, owner, repo);
    await syncAll();
    return true;
  }

  // --- Lifecycle Listeners ---
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && hasPendingSync()) {
        flushCoreOnlyOpportunistic();
      } else if (document.visibilityState === 'visible' && hasPendingSync()) {
        syncAll();
      }
    });
  }

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pageshow', () => {
      if (hasPendingSync()) syncAll();
    });

    window.addEventListener('focus', () => {
      if (hasPendingSync()) syncAll();
    });
  }

  // Export module
  window.ZetamacSync = {
    deviceId,
    loadCredentials,
    saveCredentials,
    clearCredentials,
    getLocalData,
    saveLocalData,
    getProcessedRoundIds,
    addProcessedRoundId,
    hasPendingSync,
    setPendingSync,
    onSyncChange,
    syncAll,
    startupPullAndMerge,
    validateAndConnect,
    mergeCore,
    mergeStats,
    mergeHistory
  };

})();
