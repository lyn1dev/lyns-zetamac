/**
 * Zetamac 1:1 Clone - Application Engine
 * Optimized for iPhone PWA with True OLED Pitch Black theme,
 * exclusive custom on-screen keypad, granular cognitive latency tracking,
 * and conflict-free private GitHub repository sync.
 */

(() => {
  'use strict';

  // --- Global Database Reference ---
  let db = window.ZetamacSync.getLocalData();

  // Active session state
  let gameState = 'idle'; // 'idle' | 'running' | 'ended'
  let currentProblem = null;
  let virtualBuffer = '';
  let score = 0;
  let gameStartTime = 0;
  let timerAnimFrame = null;
  let timerInterval = null;
  let currentSessionProblems = [];
  let problemInterruptedByBackground = false;

  // Granular Timing
  let problemShownAt = 0;
  let problemFirstKeyMs = null;
  let problemCorrections = 0;

  // DOM Elements
  const screens = {
    start: document.getElementById('start-screen'),
    settings: document.getElementById('settings-screen'),
    stats: document.getElementById('stats-screen'),
    game: document.getElementById('game-screen'),
    gameOver: document.getElementById('game-over-screen')
  };

  const el = {
    // Start Screen
    startBtn: document.getElementById('start-game-btn'),
    openSettingsBtn: document.getElementById('open-settings-btn'),
    openStatsBtn: document.getElementById('open-stats-btn'),
    bestScoreDisplay: document.getElementById('best-score-display'),

    // Settings Screen
    closeSettingsBtn: document.getElementById('close-settings-btn'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    restoreDefaultsBtn: document.getElementById('restore-defaults-btn'),
    durationInput: document.getElementById('game-duration'),
    opAdd: document.getElementById('op-add'),
    addMin1: document.getElementById('add-min-1'),
    addMax1: document.getElementById('add-max-1'),
    addMin2: document.getElementById('add-min-2'),
    addMax2: document.getElementById('add-max-2'),
    opMult: document.getElementById('op-mult'),
    multMin1: document.getElementById('mult-min-1'),
    multMax1: document.getElementById('mult-max-1'),
    multMin2: document.getElementById('mult-min-2'),
    multMax2: document.getElementById('mult-max-2'),
    opSub: document.getElementById('op-sub'),
    opDiv: document.getElementById('op-div'),

    // Daily Goals
    dailyCount: document.getElementById('daily-rounds-count'),
    goalProgressBar: document.getElementById('goal-progress-bar'),
    goalStatusMessage: document.getElementById('goal-status-message'),
    reminderToggleBtn: document.getElementById('reminder-toggle-btn'),
    reminderToggleLabel: document.getElementById('reminder-toggle-label'),

    // Game Screen
    gameTimer: document.getElementById('game-timer'),
    gameScore: document.getElementById('game-score'),
    problemPrompt: document.getElementById('problem-prompt'),
    virtualAnswerBox: document.getElementById('virtual-answer-box'),
    virtualAnswerText: document.getElementById('virtual-answer-text'),
    numpadContainer: document.getElementById('numpad-container'),
    abortBtn: document.getElementById('abort-game-btn'),

    // Game Over Screen
    finalScoreNumber: document.getElementById('final-score-number'),
    newRecordBadge: document.getElementById('new-record-badge'),
    resultsDailyCount: document.getElementById('results-daily-count'),
    resultsProgressBar: document.getElementById('results-progress-bar'),
    resultsGoalMsg: document.getElementById('results-goal-msg'),
    statPace: document.getElementById('stat-pace'),
    statPpm: document.getElementById('stat-ppm'),
    statDuration: document.getElementById('stat-duration'),
    statPersonalBest: document.getElementById('stat-personal-best'),
    playAgainBtn: document.getElementById('play-again-btn'),
    viewGameStatsBtn: document.getElementById('view-game-stats-btn'),
    returnHomeBtn: document.getElementById('return-home-btn'),
    returnSettingsBtn: document.getElementById('return-settings-btn'),

    // Statistics Screen
    closeStatsBtn: document.getElementById('close-stats-btn'),
    cloudSyncBadge: document.getElementById('cloud-sync-badge'),
    subtabBtns: document.querySelectorAll('.subtab-btn'),
    subtabContents: document.querySelectorAll('.subtab-content'),
    weaknessDiagnosisContainer: document.getElementById('weakness-diagnosis-container'),
    opBaselinesList: document.getElementById('op-baselines-list'),
    factorBreakdownList: document.getElementById('factor-breakdown-list'),
    hesitationList: document.getElementById('hesitation-list'),
    historyRoundsList: document.getElementById('history-rounds-list'),
    pbTimelineList: document.getElementById('pb-timeline-list'),
    milestonesGrid: document.getElementById('milestones-grid'),
    cloudRepoDisplay: document.getElementById('cloud-repo-display'),
    cloudDeviceDisplay: document.getElementById('cloud-device-display'),
    cloudSyncState: document.getElementById('cloud-sync-state'),
    forceSyncBtn: document.getElementById('force-sync-btn'),
    reconnectGithubBtn: document.getElementById('reconnect-github-btn'),

    // Onboarding Modal
    githubModalBackdrop: document.getElementById('github-modal-backdrop'),
    githubConnectForm: document.getElementById('github-connect-form'),
    ghTokenInput: document.getElementById('gh-token-input'),
    ghOwnerInput: document.getElementById('gh-owner-input'),
    ghRepoInput: document.getElementById('gh-repo-input'),
    ghModalError: document.getElementById('gh-modal-error'),
    ghConnectSubmitBtn: document.getElementById('gh-connect-submit-btn'),
    ghConnectSkipBtn: document.getElementById('gh-connect-skip-btn')
  };

  // --- Screen Navigation ---
  function showScreen(name) {
    Object.values(screens).forEach((scr) => scr && scr.classList.remove('active'));
    if (screens[name]) {
      screens[name].classList.add('active');
    }
  }

  // --- Formatting Helpers ---
  function getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getCurrentMonthKey() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  function formatDisplayDateTime(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  // --- Database Accessors & Cache ---
  function reloadDbFromCache() {
    db = window.ZetamacSync.getLocalData();
    applySettingsToUI();
    updateDailyGoalUI();
    updateBestScoreDisplay();
  }

  function getHighScore() {
    const pbs = window.ZetamacAnalytics.derivePbTimeline(db.core.personalBests);
    return pbs.length > 0 ? pbs[pbs.length - 1].score : 0;
  }

  function updateBestScoreDisplay() {
    const best = getHighScore();
    if (el.bestScoreDisplay) {
      el.bestScoreDisplay.textContent = best;
    }
  }

  // --- Settings Synchronization ---
  function applySettingsToUI() {
    const s = db.core.settings;
    el.durationInput.value = s.duration;
    el.opAdd.checked = s.addEnabled;
    el.addMin1.value = s.addMin1;
    el.addMax1.value = s.addMax1;
    el.addMin2.value = s.addMin2;
    el.addMax2.value = s.addMax2;

    el.opMult.checked = s.multEnabled;
    el.multMin1.value = s.multMin1;
    el.multMax1.value = s.multMax1;
    el.multMin2.value = s.multMin2;
    el.multMax2.value = s.multMax2;

    el.opSub.checked = s.subEnabled;
    el.opDiv.checked = s.divEnabled;

    updateBestScoreDisplay();
  }

  function readSettingsFromUI() {
    const s = db.core.settings;
    const dur = parseInt(el.durationInput.value, 10);
    s.duration = (!isNaN(dur) && dur > 0) ? dur : 120;

    s.addEnabled = el.opAdd.checked;
    s.addMin1 = Math.max(1, parseInt(el.addMin1.value, 10) || 2);
    s.addMax1 = Math.max(s.addMin1, parseInt(el.addMax1.value, 10) || 100);
    s.addMin2 = Math.max(1, parseInt(el.addMin2.value, 10) || 2);
    s.addMax2 = Math.max(s.addMin2, parseInt(el.addMax2.value, 10) || 100);

    s.multEnabled = el.opMult.checked;
    s.multMin1 = Math.max(1, parseInt(el.multMin1.value, 10) || 2);
    s.multMax1 = Math.max(s.multMin1, parseInt(el.multMax1.value, 10) || 12);
    s.multMin2 = Math.max(1, parseInt(el.multMin2.value, 10) || 2);
    s.multMax2 = Math.max(s.multMin2, parseInt(el.multMax2.value, 10) || 100);

    s.subEnabled = el.opSub.checked;
    s.divEnabled = el.opDiv.checked;

    if (!s.addEnabled && !s.multEnabled && !s.subEnabled && !s.divEnabled) {
      s.addEnabled = true;
      el.opAdd.checked = true;
    }

    db.core.settingsUpdatedAt = Date.now();
    window.ZetamacSync.saveLocalData(db);
    window.ZetamacSync.setPendingSync(true);
    // Debounced sync for settings changes
    scheduleDebouncedSync();
  }

  let settingsDebounceTimer = null;
  function scheduleDebouncedSync() {
    if (gameState === 'running') return; // never sync mid-game
    if (settingsDebounceTimer) clearTimeout(settingsDebounceTimer);
    settingsDebounceTimer = setTimeout(() => {
      window.ZetamacSync.syncAll();
    }, 3000);
  }

  // --- Daily Goal & Notification System ---
  function updateDailyGoalUI() {
    const ds = db.core.dailyStats;
    const count = ds.rounds || 0;
    el.dailyCount.textContent = count;
    el.resultsDailyCount.textContent = count;

    [el.goalProgressBar, el.resultsProgressBar].forEach((bar) => {
      if (!bar) return;
      const segments = bar.querySelectorAll('.progress-segment');
      segments.forEach((seg, idx) => {
        if (idx < count) {
          seg.classList.add('completed');
        } else {
          seg.classList.remove('completed');
        }
      });
    });

    if (count >= 5) {
      el.goalStatusMessage.textContent = `Goal reached! 🎉 ${count} rounds completed today!`;
      el.resultsGoalMsg.textContent = `Daily Goal complete! Excellent consistency.`;
    } else {
      const remaining = 5 - count;
      el.goalStatusMessage.textContent = `${count} of 5 rounds completed today (${remaining} more to go)`;
      el.resultsGoalMsg.textContent = `Keep going! ${remaining} more round${remaining > 1 ? 's' : ''} to reach your daily goal.`;
    }

    if (ds.remindersEnabled) {
      el.reminderToggleBtn.classList.add('active');
      el.reminderToggleLabel.textContent = 'Reminders ON';
    } else {
      el.reminderToggleBtn.classList.remove('active');
      el.reminderToggleLabel.textContent = 'Enable Reminders';
    }
  }

  function sendNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body,
            icon: './icons/icon-192.png',
            badge: './icons/icon-192.png',
            tag: 'zetamac-hourly-reminder',
            renotify: true
          });
        });
      } else {
        new Notification(title, { body, icon: './icons/icon-192.png' });
      }
    } catch (e) {}
  }

  function checkAndSendHourlyReminder() {
    const ds = db.core.dailyStats;
    if (!ds.remindersEnabled) return;
    const today = getTodayDateString();
    if (ds.date !== today) {
      ds.date = today;
      ds.rounds = 0;
      window.ZetamacSync.saveLocalData(db);
      updateDailyGoalUI();
    }
    if (ds.rounds >= 5) return;

    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    if (now - (ds.lastReminderTime || 0) >= oneHourMs) {
      ds.lastReminderTime = now;
      window.ZetamacSync.saveLocalData(db);
      const remaining = 5 - ds.rounds;
      sendNotification(
        'Time for Zetamac! 🧮',
        `You have completed ${ds.rounds}/5 rounds today. Knock out ${remaining} more round${remaining > 1 ? 's' : ''} to hit your goal!`
      );
    }
  }

  // --- Arithmetic Problem Generator ---
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateProblem() {
    const s = db.core.settings;
    const availableOps = [];
    if (s.addEnabled) availableOps.push(0);
    if (s.subEnabled) availableOps.push(1);
    if (s.multEnabled) availableOps.push(2);
    if (s.divEnabled) availableOps.push(3);

    if (availableOps.length === 0) availableOps.push(0);
    const opIndex = availableOps[Math.floor(Math.random() * availableOps.length)];

    let a, b, prompt, answer;

    switch (opIndex) {
      case 0: { // Addition
        a = randInt(s.addMin1, s.addMax1);
        b = randInt(s.addMin2, s.addMax2);
        answer = a + b;
        prompt = `${a} + ${b} =`;
        break;
      }
      case 1: { // Subtraction
        const x = randInt(s.addMin1, s.addMax1);
        const y = randInt(s.addMin2, s.addMax2);
        a = x + y;
        b = x;
        answer = y;
        prompt = `${a} – ${b} =`;
        break;
      }
      case 2: { // Multiplication
        a = randInt(s.multMin1, s.multMax1);
        b = randInt(s.multMin2, s.multMax2);
        answer = a * b;
        prompt = `${a} × ${b} =`;
        break;
      }
      case 3: { // Division
        const factor1 = randInt(s.multMin1, s.multMax1);
        const factor2 = randInt(s.multMin2, s.multMax2);
        a = factor1 * factor2;
        b = factor1;
        answer = factor2;
        prompt = `${a} ÷ ${b} =`;
        break;
      }
    }

    return { opIndex, a, b, prompt, answer: String(answer) };
  }

  function displayNextProblem() {
    currentProblem = generateProblem();
    virtualBuffer = '';
    el.virtualAnswerText.textContent = '';
    el.problemPrompt.textContent = currentProblem.prompt;

    // Reset timing capture for new problem
    problemShownAt = performance.now();
    problemFirstKeyMs = null;
    problemCorrections = 0;
    problemInterruptedByBackground = false;
  }

  // --- Virtual Input Engine ---
  function handleInput(key) {
    if (gameState !== 'running' || !currentProblem) return;

    if (key === 'clear') {
      if (virtualBuffer.length > 0) {
        virtualBuffer = '';
        problemCorrections++;
        el.virtualAnswerText.textContent = '';
      }
      return;
    }

    if (key === 'backspace') {
      if (virtualBuffer.length > 0) {
        virtualBuffer = virtualBuffer.slice(0, -1);
        problemCorrections++;
        el.virtualAnswerText.textContent = virtualBuffer;
      }
      return;
    }

    // Digit entry (0 - 9)
    if (/^[0-9]$/.test(key)) {
      // First keystroke captures pure cognitive latency
      if (problemFirstKeyMs === null) {
        problemFirstKeyMs = Math.round(performance.now() - problemShownAt);
      }

      if (virtualBuffer.length >= 7) return;
      virtualBuffer += key;
      el.virtualAnswerText.textContent = virtualBuffer;

      // Immediate match evaluation
      if (virtualBuffer === currentProblem.answer) {
        const totalMs = Math.round(performance.now() - problemShownAt);
        score++;
        el.gameScore.textContent = score;

        // Visual flash feedback
        el.virtualAnswerBox.classList.add('correct-flash');
        setTimeout(() => {
          el.virtualAnswerBox.classList.remove('correct-flash');
        }, 120);

        // Record problem trial if not invalidated by app backgrounding
        if (!problemInterruptedByBackground) {
          currentSessionProblems.push({
            opIndex: currentProblem.opIndex,
            a: currentProblem.a,
            b: currentProblem.b,
            totalMs,
            firstKeyMs: problemFirstKeyMs || totalMs,
            corrections: problemCorrections
          });
        }

        displayNextProblem();
      }
    }
  }

  // --- High Precision Timer ---
  function startTimer() {
    gameStartTime = Date.now();
    const duration = db.core.settings.duration;

    function updateTimer() {
      if (gameState !== 'running') return;
      const elapsed = (Date.now() - gameStartTime) / 1000;
      const remaining = Math.max(0, Math.ceil(duration - elapsed));
      el.gameTimer.textContent = remaining;

      if (remaining <= 0) {
        endGame();
        return;
      }
      timerAnimFrame = requestAnimationFrame(updateTimer);
    }

    timerAnimFrame = requestAnimationFrame(updateTimer);
    timerInterval = setInterval(() => {
      if (gameState !== 'running') return;
      const elapsed = (Date.now() - gameStartTime) / 1000;
      const remaining = Math.max(0, Math.ceil(duration - elapsed));
      el.gameTimer.textContent = remaining;
      if (remaining <= 0) endGame();
    }, 250);
  }

  function stopTimer() {
    if (timerAnimFrame) cancelAnimationFrame(timerAnimFrame);
    if (timerInterval) clearInterval(timerInterval);
    timerAnimFrame = null;
    timerInterval = null;
  }

  // Invalidate problem timing if app is backgrounded mid-problem
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && gameState === 'running') {
      problemInterruptedByBackground = true;
    }
  });

  // --- Milestone Achievements Checker ---
  function evaluateAchievements(sessionScore, totalGames) {
    const ach = db.core.achievements;
    const now = Date.now();
    let newlyUnlocked = false;

    const milestones = [
      { id: 'first_game', cond: totalGames >= 1 },
      { id: 'speed_40', cond: sessionScore >= 40 },
      { id: 'turbo_60', cond: sessionScore >= 60 },
      { id: 'grandmaster_80', cond: sessionScore >= 80 },
      { id: 'century_100', cond: sessionScore >= 100 },
      { id: 'games_10', cond: totalGames >= 10 },
      { id: 'games_25', cond: totalGames >= 25 },
      { id: 'daily_5', cond: db.core.dailyStats.rounds >= 5 }
    ];

    milestones.forEach((m) => {
      if (m.cond && !ach[m.id]) {
        ach[m.id] = now;
        newlyUnlocked = true;
      }
    });

    return newlyUnlocked;
  }

  // --- Game Lifecycle ---
  function startGame() {
    score = 0;
    el.gameScore.textContent = '0';
    gameState = 'running';
    currentSessionProblems = [];
    problemInterruptedByBackground = false;

    showScreen('game');
    displayNextProblem();
    startTimer();
  }

  function endGame() {
    if (gameState !== 'running') return;
    gameState = 'ended';
    stopTimer();

    const duration = db.core.settings.duration;
    const elapsedSeconds = Math.max(1, Math.min(duration, Math.round((Date.now() - gameStartTime) / 1000)));
    const pace = score > 0 ? (elapsedSeconds / score).toFixed(2) : '0.00';
    const ppm = ((score / elapsedSeconds) * 60).toFixed(1);

    el.finalScoreNumber.textContent = score;
    el.statPace.textContent = `${pace}s / problem`;
    el.statPpm.textContent = `${ppm} / min`;
    el.statDuration.textContent = `${elapsedSeconds}s`;

    const prevBest = getHighScore();
    const isNewBest = score > prevBest;
    if (isNewBest) {
      el.newRecordBadge.classList.remove('hidden');
      // Append PB to personalBests CRDT
      db.core.personalBests.push({
        score,
        timestamp: gameStartTime,
        dateFormatted: formatDisplayDateTime(gameStartTime),
        duration: elapsedSeconds
      });
    } else {
      el.newRecordBadge.classList.add('hidden');
    }

    updateBestScoreDisplay();
    el.statPersonalBest.textContent = getHighScore();

    // 1. Accumulate histogram counts for locally played round
    const devId = window.ZetamacSync.deviceId;
    const monthKey = getCurrentMonthKey();
    const roundId = `${devId}-${gameStartTime}`;

    const processed = window.ZetamacSync.getProcessedRoundIds();
    if (!processed.has(roundId)) {
      window.ZetamacSync.addProcessedRoundId(roundId);

      if (!db.stats.agg[devId]) db.stats.agg[devId] = {};
      if (!db.stats.agg[devId][monthKey]) db.stats.agg[devId][monthKey] = {};

      const devMonth = db.stats.agg[devId][monthKey];

      currentSessionProblems.forEach((p) => {
        const cellKey = window.ZetamacAnalytics.getCellKey(p.opIndex, p.a, p.b);
        const binIdx = window.ZetamacAnalytics.getBinIndex(p.firstKeyMs / 1000);
        const opName = window.ZetamacAnalytics.getOpName(p.opIndex);

        // Bin into factor/feature cell
        if (!devMonth[cellKey]) devMonth[cellKey] = [];
        while (devMonth[cellKey].length <= binIdx) devMonth[cellKey].push(0);
        devMonth[cellKey][binIdx] = (devMonth[cellKey][binIdx] || 0) + 1;

        // Bin into operational total
        const opTotalKey = `${opName}|total`;
        if (!devMonth[opTotalKey]) devMonth[opTotalKey] = [];
        while (devMonth[opTotalKey].length <= binIdx) devMonth[opTotalKey].push(0);
        devMonth[opTotalKey][binIdx] = (devMonth[opTotalKey][binIdx] || 0) + 1;
      });

      // Rollup months older than 12
      db.stats.agg = window.ZetamacAnalytics.rollupOldMonths(db.stats.agg, monthKey);
    }

    // 2. Compact problems encoding: [opIndex, a, b, totalMs, firstKeyMs, corrections]
    const compactProblems = currentSessionProblems.map((p) => [
      p.opIndex,
      p.a,
      p.b,
      p.totalMs,
      p.firstKeyMs,
      p.corrections
    ]);

    // 3. Append to history and slice to 30
    const newRound = {
      id: roundId,
      timestamp: gameStartTime,
      dateFormatted: formatDisplayDateTime(gameStartTime),
      duration: elapsedSeconds,
      score,
      avgPace: pace,
      p: compactProblems
    };

    db.history.history = [newRound, ...(db.history.history || [])]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 30);

    // 4. Update Daily Stats
    const today = getTodayDateString();
    if (db.core.dailyStats.date !== today) {
      db.core.dailyStats.date = today;
      db.core.dailyStats.rounds = 0;
    }
    db.core.dailyStats.rounds++;
    updateDailyGoalUI();

    // 5. Evaluate Achievements
    evaluateAchievements(score, (db.history.history || []).length);

    // 6. Save locally & trigger cloud sync
    window.ZetamacSync.saveLocalData(db);
    window.ZetamacSync.setPendingSync(true);
    window.ZetamacSync.syncAll();

    showScreen('gameOver');
  }

  // --- Statistics & Analytics View Renderer ---
  function renderStatisticsScreen() {
    renderWeaknessAnalysis();
    renderRoundHistory();
    renderAchievementsAndCloud();
  }

  function renderWeaknessAnalysis() {
    const agg = db.stats.agg;
    const windowMonths = window.ZetamacAnalytics.getLastNMonths(2);
    const report = window.ZetamacAnalytics.analyzeWeaknesses(agg, windowMonths);

    // 1. Diagnostic Summary
    const diagContainer = el.weaknessDiagnosisContainer;
    diagContainer.innerHTML = '';

    if (report.totalProblemsInWindow === 0 || report.collectingData.length === 0 && report.weaknesses.length === 0 && report.strengths.length === 0) {
      diagContainer.innerHTML = `
        <p class="stats-placeholder">Play a few rounds to generate your personalized weakness analysis! Data accumulates permanently across sessions.</p>
      `;
    } else {
      if (report.weaknesses.length === 0 && report.collectingData.length > 0) {
        diagContainer.innerHTML = `
          <div class="weakness-item" style="border-left-color: #38bdf8; border-color: rgba(56, 189, 248, 0.3);">
            <div class="weakness-headline">
              <strong>Data Collection In Progress</strong>
              <span class="window-badge">${report.totalProblemsInWindow} problems logged</span>
            </div>
            <p class="card-subtitle" style="margin-top: 4px; margin-bottom: 0;">
              Cells require at least 20 trials to prevent random noise. Keep training to unlock your 90% confidence interval analysis!
            </p>
          </div>
        `;
      } else {
        report.weaknesses.forEach((w) => {
          const item = document.createElement('div');
          item.className = 'weakness-item';
          item.innerHTML = `
            <div class="weakness-headline">
              <strong>${w.label}</strong>
              <span class="delta-tag slow">${w.deltaPercent} slower</span>
            </div>
            <div class="evidence-line">
              ${w.geoMean}s vs ${w.baseGeoMean}s baseline (90% CI: ${w.ciLowerPercent} to ${w.ciUpperPercent}, n=${w.n})
            </div>
          `;
          diagContainer.appendChild(item);
        });

        report.strengths.slice(0, 3).forEach((s) => {
          const item = document.createElement('div');
          item.className = 'strength-item';
          item.innerHTML = `
            <div class="weakness-headline">
              <strong>${s.label}</strong>
              <span class="delta-tag fast">${s.deltaPercent} faster</span>
            </div>
            <div class="evidence-line">
              ${s.geoMean}s vs ${s.baseGeoMean}s baseline (90% CI: ${s.ciLowerPercent} to ${s.ciUpperPercent}, n=${s.n})
            </div>
          `;
          diagContainer.appendChild(item);
        });
      }
    }

    // 2. Operational Baselines
    const baseGrid = el.opBaselinesList;
    baseGrid.innerHTML = '';
    ['+', '–', '×', '÷'].forEach((sym, idx) => {
      const opKey = ['+', '-', '*', '/'][idx];
      const stats = report.opBaselines[opKey];
      const box = document.createElement('div');
      box.className = 'baseline-box';
      box.innerHTML = `
        <span class="baseline-op">${sym}</span>
        <span class="baseline-time">${stats ? stats.geoMean.toFixed(2) + 's' : '—'}</span>
      `;
      baseGrid.appendChild(box);
    });

    // 3. Factor Latency Breakdown
    const factorList = el.factorBreakdownList;
    factorList.innerHTML = '';

    const testFactors = [
      { key: '*|2', label: '×2' }, { key: '*|3', label: '×3' }, { key: '*|4', label: '×4' },
      { key: '*|5', label: '×5' }, { key: '*|6', label: '×6' }, { key: '*|7', label: '×7' },
      { key: '*|8', label: '×8' }, { key: '*|9', label: '×9' }, { key: '*|10', label: '×10' },
      { key: '*|11', label: '×11' }, { key: '*|12', label: '×12' }
    ];

    testFactors.forEach((tf) => {
      const hist = window.ZetamacAnalytics.poolHistograms(agg, tf.key, windowMonths);
      const st = window.ZetamacAnalytics.computeHistogramStats(hist);
      const row = document.createElement('div');
      row.className = 'factor-row';
      if (st && st.n >= 20) {
        row.innerHTML = `
          <span class="factor-label">${tf.label}</span>
          <div class="factor-stats">
            <strong>${st.geoMean.toFixed(2)}s</strong>
            <span class="factor-ci">(90% CI: ${st.ci90Lower.toFixed(2)}–${st.ci90Upper.toFixed(2)}s, n=${st.n})</span>
          </div>
        `;
      } else {
        row.innerHTML = `
          <span class="factor-label">${tf.label}</span>
          <div class="factor-stats">
            <span class="factor-ci">Collecting data (${st ? st.n : 0}/20)</span>
          </div>
        `;
      }
      factorList.appendChild(row);
    });

    // 4. Notable Hesitations from recent games
    const hesList = el.hesitationList;
    hesList.innerHTML = '';
    const slowProblems = [];

    (db.history.history || []).forEach((r) => {
      (r.p || []).forEach((p) => {
        const [opIndex, a, b, totalMs, firstKeyMs] = p;
        const opSym = ['+', '–', '×', '÷'][opIndex] || '+';
        slowProblems.push({
          prompt: `${a} ${opSym} ${b}`,
          firstKeyMs,
          totalMs
        });
      });
    });

    slowProblems.sort((a, b) => b.firstKeyMs - a.firstKeyMs);
    const topHesitations = slowProblems.slice(0, 6);

    if (topHesitations.length === 0) {
      hesList.innerHTML = `<p class="stats-placeholder">No recent hesitation bottlenecks recorded.</p>`;
    } else {
      topHesitations.forEach((h) => {
        const row = document.createElement('div');
        row.className = 'hesitation-row';
        row.innerHTML = `
          <span class="hesitation-prompt">${h.prompt}</span>
          <span class="hesitation-time">${(h.firstKeyMs / 1000).toFixed(2)}s first key (${(h.totalMs / 1000).toFixed(2)}s total)</span>
        `;
        hesList.appendChild(row);
      });
    }
  }

  function renderRoundHistory() {
    const list = el.historyRoundsList;
    list.innerHTML = '';
    const rounds = db.history.history || [];

    if (rounds.length === 0) {
      list.innerHTML = `<p class="stats-placeholder">No rounds played yet. Complete your first 120s round!</p>`;
      return;
    }

    rounds.forEach((round) => {
      const item = document.createElement('div');
      item.className = 'history-round-item';

      const summary = document.createElement('div');
      summary.className = 'history-round-summary';
      summary.innerHTML = `
        <div class="round-meta">
          <span class="round-date">${round.dateFormatted}</span>
          <span class="round-sub">${round.duration}s • ${round.avgPace}s / problem</span>
        </div>
        <div class="round-score-pill">
          <span>${round.score}</span>
          <span class="round-arrow">▶</span>
        </div>
      `;

      summary.addEventListener('click', () => {
        item.classList.toggle('open');
      });

      const drawer = document.createElement('div');
      drawer.className = 'history-problems-drawer';

      (round.p || []).forEach((prob, idx) => {
        const [opIndex, a, b, totalMs, firstKeyMs, corr] = prob;
        const opSym = ['+', '–', '×', '÷'][opIndex] || '+';
        const row = document.createElement('div');
        row.className = 'problem-row';
        row.innerHTML = `
          <div class="problem-row-left">
            <span class="problem-row-index">#${idx + 1}</span>
            <span class="problem-row-prompt">${a} ${opSym} ${b}</span>
          </div>
          <div class="problem-row-right">
            <span class="problem-row-time">${(firstKeyMs / 1000).toFixed(2)}s</span>
            ${corr > 0 ? `<span class="problem-row-corr">(${corr} fix)</span>` : ''}
          </div>
        `;
        drawer.appendChild(row);
      });

      item.appendChild(summary);
      item.appendChild(drawer);
      list.appendChild(item);
    });
  }

  function renderAchievementsAndCloud() {
    // 1. Monotonic Personal Best Timeline
    const pbList = el.pbTimelineList;
    pbList.innerHTML = '';
    const pbs = window.ZetamacAnalytics.derivePbTimeline(db.core.personalBests);

    if (pbs.length === 0) {
      pbList.innerHTML = `<p class="stats-placeholder">No Personal Bests recorded yet.</p>`;
    } else {
      pbs.slice().reverse().forEach((pb) => {
        const item = document.createElement('div');
        item.className = 'pb-timeline-item';
        item.innerHTML = `
          <span class="pb-score-val">${pb.score}</span>
          <div class="pb-meta-info">
            <span class="pb-date">${pb.dateFormatted}</span>
            <span class="pb-duration">${pb.duration}s duration</span>
          </div>
        `;
        pbList.appendChild(item);
      });
    }

    // 2. Milestone Badges
    const badgeGrid = el.milestonesGrid;
    badgeGrid.innerHTML = '';
    const allMilestones = [
      { id: 'first_game', title: '🎯 First Steps', desc: 'Complete your first round' },
      { id: 'speed_40', title: '⚡ Speed Demon', desc: 'Score 40+ in a round' },
      { id: 'turbo_60', title: '🚀 Turbo Mind', desc: 'Score 60+ in a round' },
      { id: 'grandmaster_80', title: '👑 Grandmaster', desc: 'Score 80+ in a round' },
      { id: 'century_100', title: '🌌 Century Club', desc: 'Score 100+ in a round' },
      { id: 'games_10', title: '📚 Dedicated', desc: 'Complete 10 total rounds' },
      { id: 'games_25', title: '🔥 Arithmetic Machine', desc: 'Complete 25 total rounds' },
      { id: 'daily_5', title: '🌟 Daily Champion', desc: 'Finish 5 rounds in a single day' }
    ];

    const ach = db.core.achievements || {};
    allMilestones.forEach((m) => {
      const unlocked = !!ach[m.id];
      const box = document.createElement('div');
      box.className = `milestone-badge ${unlocked ? 'unlocked' : ''}`;
      box.innerHTML = `
        <span class="milestone-title">${m.title}</span>
        <span class="milestone-desc">${m.desc}</span>
        ${unlocked ? `<span class="milestone-date">Unlocked ${formatDisplayDateTime(ach[m.id])}</span>` : ''}
      `;
      badgeGrid.appendChild(box);
    });

    // 3. Cloud Repo Info
    const creds = window.ZetamacSync.loadCredentials();
    if (creds) {
      el.cloudRepoDisplay.textContent = `${creds.owner}/${creds.repo}`;
      el.cloudDeviceDisplay.textContent = creds.deviceId || window.ZetamacSync.deviceId;
    } else {
      el.cloudRepoDisplay.textContent = 'Not Connected';
      el.cloudDeviceDisplay.textContent = window.ZetamacSync.deviceId;
    }
  }

  // --- GitHub Cloud Sync Status Listener ---
  window.ZetamacSync.onSyncChange((status, detail) => {
    const badge = el.cloudSyncBadge;
    const stateEl = el.cloudSyncState;

    badge.className = 'cloud-sync-badge';
    if (status === 'synced') {
      badge.classList.add('synced');
      badge.textContent = '☁️ Synced';
      if (stateEl) stateEl.textContent = 'Fully Synced';
      reloadDbFromCache();
    } else if (status === 'syncing') {
      badge.classList.add('pending');
      badge.textContent = '🔄 Syncing...';
      if (stateEl) stateEl.textContent = 'Syncing...';
    } else if (status === 'pending' || status === 'offline_pending') {
      badge.classList.add('pending');
      badge.textContent = '⚠️ Sync Pending';
      if (stateEl) stateEl.textContent = 'Offline (Sync Pending)';
    } else if (status === 'auth_error') {
      badge.classList.add('error');
      badge.textContent = '⚠️ Auth Error';
      if (stateEl) stateEl.textContent = 'Token Expired / Invalid';
    } else if (status === 'no_token') {
      badge.textContent = '☁️ Local Mode';
      if (stateEl) stateEl.textContent = 'Not Connected (Local Only)';
    }
  });

  // --- Event Listeners ---

  // Custom On-Screen Keypad Listeners
  const numpadKeys = el.numpadContainer.querySelectorAll('.numpad-key');
  numpadKeys.forEach((keyBtn) => {
    keyBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const key = keyBtn.getAttribute('data-key');
      handleInput(key);
    });
  });

  // Physical Keyboard fallback for desktop testing
  window.addEventListener('keydown', (e) => {
    if (gameState !== 'running') return;
    if (e.key >= '0' && e.key <= '9') {
      handleInput(e.key);
    } else if (e.key === 'Backspace') {
      handleInput('backspace');
    } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
      handleInput('clear');
    }
  });

  // Screen Navigation Buttons
  el.startBtn.addEventListener('click', startGame);
  el.playAgainBtn.addEventListener('click', startGame);

  el.openSettingsBtn.addEventListener('click', () => {
    applySettingsToUI();
    showScreen('settings');
  });

  el.closeSettingsBtn.addEventListener('click', () => {
    readSettingsFromUI();
    showScreen('start');
  });

  el.saveSettingsBtn.addEventListener('click', () => {
    readSettingsFromUI();
    showScreen('start');
  });

  el.openStatsBtn.addEventListener('click', () => {
    renderStatisticsScreen();
    showScreen('stats');
  });

  el.viewGameStatsBtn.addEventListener('click', () => {
    renderStatisticsScreen();
    showScreen('stats');
  });

  el.closeStatsBtn.addEventListener('click', () => {
    showScreen('start');
  });

  el.returnHomeBtn.addEventListener('click', () => {
    showScreen('start');
  });

  el.returnSettingsBtn.addEventListener('click', () => {
    applySettingsToUI();
    showScreen('settings');
  });

  el.abortBtn.addEventListener('click', () => {
    if (confirm('End current game?')) {
      endGame();
    }
  });

  el.restoreDefaultsBtn.addEventListener('click', () => {
    const defaultData = window.ZetamacSync.getLocalData();
    db.core.settings = defaultData.core.settings;
    applySettingsToUI();
    readSettingsFromUI();
  });

  // Sub-tab switcher in Statistics screen
  el.subtabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      el.subtabBtns.forEach((b) => b.classList.remove('active'));
      el.subtabContents.forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = `tab-${btn.getAttribute('data-tab')}`;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // Cloud Actions in Achievements sub-tab
  el.forceSyncBtn.addEventListener('click', () => {
    window.ZetamacSync.syncAll();
  });

  el.reconnectGithubBtn.addEventListener('click', () => {
    const creds = window.ZetamacSync.loadCredentials();
    if (creds) {
      el.ghTokenInput.value = creds.token || '';
      el.ghOwnerInput.value = creds.owner || '';
      el.ghRepoInput.value = creds.repo || 'zetamac-data';
    }
    el.githubModalBackdrop.classList.remove('hidden');
  });

  // Reminder Toggle Button
  el.reminderToggleBtn.addEventListener('click', () => {
    if (!('Notification' in window)) {
      alert('Notifications are not supported in this browser. On iPhone, make sure you are on iOS 16.4+ and have added this app to your Home Screen.');
      return;
    }

    if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          db.core.dailyStats.remindersEnabled = true;
          db.core.dailyStats.lastReminderTime = Date.now();
          window.ZetamacSync.saveLocalData(db);
          updateDailyGoalUI();
          sendNotification('Hourly Reminders Active! 🔔', 'We will remind you every hour if you have completed fewer than 5 rounds today.');
        } else {
          alert('Notification permission was not granted. Reminders cannot be enabled without permission.');
          updateDailyGoalUI();
        }
      });
    } else if (Notification.permission === 'granted') {
      db.core.dailyStats.remindersEnabled = !db.core.dailyStats.remindersEnabled;
      if (db.core.dailyStats.remindersEnabled) {
        db.core.dailyStats.lastReminderTime = Date.now();
      }
      window.ZetamacSync.saveLocalData(db);
      updateDailyGoalUI();
    } else if (Notification.permission === 'denied') {
      alert('Notifications are blocked in your browser/iOS settings. To enable reminders, open iPhone Settings > Safari / Zetamac and allow notifications.');
    }
  });

  // Onboarding Modal Form Submit
  el.githubConnectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.ghModalError.classList.add('hidden');
    el.ghConnectSubmitBtn.disabled = true;
    el.ghConnectSubmitBtn.textContent = 'Connecting...';

    const token = el.ghTokenInput.value;
    const owner = el.ghOwnerInput.value;
    const repo = el.ghRepoInput.value;

    try {
      await window.ZetamacSync.validateAndConnect(token, owner, repo);
      el.githubModalBackdrop.classList.add('hidden');
      renderStatisticsScreen();
    } catch (err) {
      el.ghModalError.textContent = err.message || 'Connection failed';
      el.ghModalError.classList.remove('hidden');
    } finally {
      el.ghConnectSubmitBtn.disabled = false;
      el.ghConnectSubmitBtn.textContent = 'Connect & Sync';
    }
  });

  el.ghConnectSkipBtn.addEventListener('click', () => {
    el.githubModalBackdrop.classList.add('hidden');
  });

  // Prevent double-tap zoom on iOS
  document.addEventListener('dblclick', (e) => {
    e.preventDefault();
  }, { passive: false });

  // --- Register Service Worker ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          reg.update();
        })
        .catch((err) => {
          console.warn('ServiceWorker registration failed:', err);
        });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  // --- Bootstrap ---
  applySettingsToUI();
  updateDailyGoalUI();
  updateBestScoreDisplay();
  showScreen('start');

  // Check if first-time user needs GitHub connection
  const creds = window.ZetamacSync.loadCredentials();
  if (!creds) {
    // Show onboarding modal on initial startup
    setTimeout(() => {
      el.githubModalBackdrop.classList.remove('hidden');
    }, 600);
  } else {
    // Attempt startup pull & merge
    window.ZetamacSync.startupPullAndMerge();
  }

  // Reminders check loop
  setInterval(checkAndSendHourlyReminder, 60000);
  checkAndSendHourlyReminder();

})();
