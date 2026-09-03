/**
 * Zetamac 1:1 Clone - Application Engine
 * Optimized for iPhone PWA with True OLED Pitch Black theme & exclusive custom on-screen keypad
 */

(() => {
  'use strict';

  // --- Default Configuration (Default to OLED Pitch Black Dark Mode) ---
  const DEFAULT_SETTINGS = {
    duration: 120,
    addEnabled: true,
    addMin1: 2,
    addMax1: 100,
    addMin2: 2,
    addMax2: 100,
    multEnabled: true,
    multMin1: 2,
    multMax1: 12,
    multMin2: 2,
    multMax2: 100,
    subEnabled: true,
    divEnabled: true,
    theme: 'dark'
  };

  // State
  let settings = { ...DEFAULT_SETTINGS };
  let highScore = 0;
  let gameState = 'idle'; // 'idle' | 'running' | 'ended'
  let currentProblem = null;
  let virtualBuffer = '';
  let score = 0;
  let gameStartTime = 0;
  let gameEndTime = 0;
  let timerAnimFrame = null;
  let timerInterval = null;

  // DOM Screens
  const screens = {
    start: document.getElementById('start-screen'),
    settings: document.getElementById('settings-screen'),
    game: document.getElementById('game-screen'),
    gameOver: document.getElementById('game-over-screen')
  };

  const el = {
    // Header
    themeToggleBtn: document.getElementById('theme-toggle-btn'),

    // Start Screen Elements
    startBtn: document.getElementById('start-game-btn'),
    openSettingsBtn: document.getElementById('open-settings-btn'),
    bestScoreDisplay: document.getElementById('best-score-display'),

    // Settings Screen Elements
    closeSettingsBtn: document.getElementById('close-settings-btn'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
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
    restoreDefaultsBtn: document.getElementById('restore-defaults-btn'),

    // Daily Goal & Reminder Elements
    dailyRoundsCount: document.getElementById('daily-rounds-count'),
    goalProgressBar: document.getElementById('goal-progress-bar'),
    goalStatusMessage: document.getElementById('goal-status-message'),
    reminderToggleBtn: document.getElementById('reminder-toggle-btn'),
    reminderToggleLabel: document.getElementById('reminder-toggle-label'),

    // Active Gameplay Elements
    gameTimer: document.getElementById('game-timer'),
    gameScore: document.getElementById('game-score'),
    problemPrompt: document.getElementById('problem-prompt'),
    virtualAnswerBox: document.getElementById('virtual-answer-box'),
    virtualAnswerText: document.getElementById('virtual-answer-text'),
    numpadContainer: document.getElementById('numpad-container'),
    abortBtn: document.getElementById('abort-game-btn'),

    // Results Screen Elements
    finalScoreNumber: document.getElementById('final-score-number'),
    newRecordBadge: document.getElementById('new-record-badge'),
    statPace: document.getElementById('stat-pace'),
    statPpm: document.getElementById('stat-ppm'),
    statDuration: document.getElementById('stat-duration'),
    statPersonalBest: document.getElementById('stat-personal-best'),
    playAgainBtn: document.getElementById('play-again-btn'),
    returnHomeBtn: document.getElementById('return-home-btn'),
    returnSettingsBtn: document.getElementById('return-settings-btn'),
    resultsDailyCount: document.getElementById('results-daily-count'),
    resultsProgressBar: document.getElementById('results-progress-bar'),
    resultsGoalMsg: document.getElementById('results-goal-msg')
  };

  function getTodayDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  let dailyStats = {
    date: getTodayDateString(),
    rounds: 0,
    lastReminderTime: 0,
    remindersEnabled: false
  };

  // --- Storage & Initialization ---
  function loadSavedData() {
    try {
      const savedSettings = localStorage.getItem('zetamac_custom_settings');
      if (savedSettings) {
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      }
      const savedHigh = localStorage.getItem('zetamac_high_score');
      if (savedHigh) {
        highScore = parseInt(savedHigh, 10) || 0;
      }
      const savedDaily = localStorage.getItem('zetamac_daily_stats');
      if (savedDaily) {
        const parsed = JSON.parse(savedDaily);
        const today = getTodayDateString();
        if (parsed.date === today) {
          dailyStats = { ...dailyStats, ...parsed };
        } else {
          dailyStats = {
            date: today,
            rounds: 0,
            lastReminderTime: parsed.lastReminderTime || 0,
            remindersEnabled: parsed.remindersEnabled || false
          };
          saveDailyStats();
        }
      }
    } catch (e) {
      console.warn('LocalStorage unavailable:', e);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem('zetamac_custom_settings', JSON.stringify(settings));
    } catch (e) {}
  }

  function saveHighScore(score) {
    highScore = score;
    try {
      localStorage.setItem('zetamac_high_score', String(highScore));
    } catch (e) {}
  }

  function saveDailyStats() {
    try {
      localStorage.setItem('zetamac_daily_stats', JSON.stringify(dailyStats));
    } catch (e) {}
  }

  function applySettingsToUI() {
    el.durationInput.value = settings.duration;
    el.opAdd.checked = settings.addEnabled;
    el.addMin1.value = settings.addMin1;
    el.addMax1.value = settings.addMax1;
    el.addMin2.value = settings.addMin2;
    el.addMax2.value = settings.addMax2;

    el.opMult.checked = settings.multEnabled;
    el.multMin1.value = settings.multMin1;
    el.multMax1.value = settings.multMax1;
    el.multMin2.value = settings.multMin2;
    el.multMax2.value = settings.multMax2;

    el.opSub.checked = settings.subEnabled;
    el.opDiv.checked = settings.divEnabled;

    el.bestScoreDisplay.textContent = highScore;

    document.documentElement.setAttribute('data-theme', settings.theme);
    el.themeToggleBtn.textContent = settings.theme === 'dark' ? '☀️' : '🌙';
  }

  function readSettingsFromUI() {
    const dur = parseInt(el.durationInput.value, 10);
    settings.duration = (!isNaN(dur) && dur > 0) ? dur : 120;

    settings.addEnabled = el.opAdd.checked;
    settings.addMin1 = Math.max(1, parseInt(el.addMin1.value, 10) || 2);
    settings.addMax1 = Math.max(settings.addMin1, parseInt(el.addMax1.value, 10) || 100);
    settings.addMin2 = Math.max(1, parseInt(el.addMin2.value, 10) || 2);
    settings.addMax2 = Math.max(settings.addMin2, parseInt(el.addMax2.value, 10) || 100);

    settings.multEnabled = el.opMult.checked;
    settings.multMin1 = Math.max(1, parseInt(el.multMin1.value, 10) || 2);
    settings.multMax1 = Math.max(settings.multMin1, parseInt(el.multMax1.value, 10) || 12);
    settings.multMin2 = Math.max(1, parseInt(el.multMin2.value, 10) || 2);
    settings.multMax2 = Math.max(settings.multMin2, parseInt(el.multMax2.value, 10) || 100);

    settings.subEnabled = el.opSub.checked;
    settings.divEnabled = el.opDiv.checked;

    // Safety: ensure at least one operation is enabled
    if (!settings.addEnabled && !settings.multEnabled && !settings.subEnabled && !settings.divEnabled) {
      settings.addEnabled = true;
      el.opAdd.checked = true;
    }

    saveSettings();
  }

  function updateDailyGoalUI() {
    if (!el.dailyRoundsCount || !el.goalProgressBar) return;
    
    // 1. Start screen count
    el.dailyRoundsCount.textContent = dailyStats.rounds;

    // 2. Start screen 5-segment bar
    const segments = el.goalProgressBar.querySelectorAll('.progress-segment');
    segments.forEach((seg, idx) => {
      seg.classList.toggle('completed', idx < dailyStats.rounds);
    });

    // 3. Goal status message
    if (dailyStats.rounds >= 5) {
      el.goalStatusMessage.textContent = `🎉 Daily goal achieved! (${dailyStats.rounds}/5 rounds completed today)`;
      el.goalStatusMessage.classList.add('goal-reached');
    } else {
      const remaining = 5 - dailyStats.rounds;
      el.goalStatusMessage.textContent = `${dailyStats.rounds} of 5 rounds completed today (${remaining} more to reach goal)`;
      el.goalStatusMessage.classList.remove('goal-reached');
    }

    // 4. Reminder toggle button state
    if (!('Notification' in window)) {
      el.reminderToggleBtn.className = 'btn-toggle';
      el.reminderToggleLabel.textContent = 'Not Supported';
      el.reminderToggleBtn.disabled = true;
    } else if (Notification.permission === 'denied') {
      el.reminderToggleBtn.className = 'btn-toggle';
      el.reminderToggleLabel.textContent = 'Notifications Blocked';
      el.reminderToggleBtn.title = 'Enable notifications in iPhone Settings > Safari';
    } else if (Notification.permission !== 'granted') {
      el.reminderToggleBtn.className = 'btn-toggle needs-permission';
      el.reminderToggleLabel.textContent = 'Enable Reminders';
    } else {
      if (dailyStats.remindersEnabled) {
        el.reminderToggleBtn.className = 'btn-toggle active';
        el.reminderToggleLabel.textContent = 'Reminders: ON';
      } else {
        el.reminderToggleBtn.className = 'btn-toggle';
        el.reminderToggleLabel.textContent = 'Reminders: OFF';
      }
    }

    // 5. Results screen daily banner
    if (el.resultsDailyCount && el.resultsProgressBar) {
      el.resultsDailyCount.textContent = dailyStats.rounds;
      const resSegments = el.resultsProgressBar.querySelectorAll('.progress-segment');
      resSegments.forEach((seg, idx) => {
        seg.classList.toggle('completed', idx < dailyStats.rounds);
      });
      if (dailyStats.rounds >= 5) {
        el.resultsGoalMsg.textContent = '🎉 Daily Goal Complete! 5/5 rounds done today.';
      } else {
        const left = 5 - dailyStats.rounds;
        el.resultsGoalMsg.textContent = `Keep going! ${left} more round${left > 1 ? 's' : ''} to reach your daily goal.`;
      }
    }
  }

  // --- Notification System ---
  function sendNotification(title, body) {
    const options = {
      body: body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'zetamac-hourly-reminder',
      renotify: true,
      data: { url: './' }
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, options);
      }).catch(() => {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, options);
        }
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, options);
    }
  }

  function checkAndSendHourlyReminder() {
    const today = getTodayDateString();
    if (dailyStats.date !== today) {
      dailyStats.date = today;
      dailyStats.rounds = 0;
      saveDailyStats();
      updateDailyGoalUI();
    }

    if (!dailyStats.remindersEnabled) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (dailyStats.rounds >= 5) return; // Daily goal achieved

    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    if (now - dailyStats.lastReminderTime >= oneHourMs) {
      dailyStats.lastReminderTime = now;
      saveDailyStats();
      const remaining = 5 - dailyStats.rounds;
      const title = 'Time for Zetamac! 🧮';
      const body = `You've done ${dailyStats.rounds}/5 rounds today. Complete ${remaining} more to hit your daily goal!`;
      sendNotification(title, body);
    }
  }

  // --- Screen Navigation ---
  function showScreen(name) {
    Object.keys(screens).forEach((screenKey) => {
      if (screens[screenKey]) {
        screens[screenKey].classList.toggle('active', screenKey === name);
      }
    });
  }

  // --- Random Utilities ---
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // --- Zetamac 1:1 Problem Generator ---
  function generateProblem() {
    const allowed = [];
    if (settings.addEnabled) allowed.push('+');
    if (settings.subEnabled) allowed.push('-');
    if (settings.multEnabled) allowed.push('*');
    if (settings.divEnabled) allowed.push('/');

    if (allowed.length === 0) allowed.push('+');

    const op = allowed[Math.floor(Math.random() * allowed.length)];

    switch (op) {
      case '+': {
        const a = randomInt(settings.addMin1, settings.addMax1);
        const b = randomInt(settings.addMin2, settings.addMax2);
        return {
          prompt: `${a} + ${b} =`,
          answer: a + b
        };
      }
      case '-': {
        const a = randomInt(settings.addMin1, settings.addMax1);
        const b = randomInt(settings.addMin2, settings.addMax2);
        const sum = a + b;
        if (Math.random() < 0.5) {
          return {
            prompt: `${sum} – ${a} =`,
            answer: b
          };
        } else {
          return {
            prompt: `${sum} – ${b} =`,
            answer: a
          };
        }
      }
      case '*': {
        let a = randomInt(settings.multMin1, settings.multMax1);
        let b = randomInt(settings.multMin2, settings.multMax2);
        if (Math.random() < 0.5) {
          [a, b] = [b, a];
        }
        return {
          prompt: `${a} × ${b} =`,
          answer: a * b
        };
      }
      case '/': {
        const a = randomInt(settings.multMin1, settings.multMax1);
        const b = randomInt(settings.multMin2, settings.multMax2);
        const prod = a * b;
        if (Math.random() < 0.5) {
          return {
            prompt: `${prod} ÷ ${a} =`,
            answer: b
          };
        } else {
          return {
            prompt: `${prod} ÷ ${b} =`,
            answer: a
          };
        }
      }
      default:
        return { prompt: '2 + 2 =', answer: 4 };
    }
  }

  function displayNextProblem() {
    currentProblem = generateProblem();
    virtualBuffer = '';
    el.problemPrompt.textContent = currentProblem.prompt;
    el.virtualAnswerText.textContent = '';
  }

  // --- Timestamp-Diffing Timer ---
  function startTimer() {
    gameStartTime = Date.now();
    gameEndTime = gameStartTime + settings.duration * 1000;
    updateTimerDisplay();

    const tick = () => {
      if (gameState !== 'running') return;
      const now = Date.now();
      const remainingMs = gameEndTime - now;

      if (remainingMs <= 0) {
        el.gameTimer.textContent = '0';
        endGame();
        return;
      }

      const secondsLeft = Math.ceil(remainingMs / 1000);
      el.gameTimer.textContent = secondsLeft;

      if (secondsLeft <= 10) {
        el.gameTimer.classList.add('timer-warning');
      } else {
        el.gameTimer.classList.remove('timer-warning');
      }

      timerAnimFrame = requestAnimationFrame(tick);
    };

    timerAnimFrame = requestAnimationFrame(tick);
    timerInterval = setInterval(() => {
      if (gameState !== 'running') return;
      if (Date.now() >= gameEndTime) {
        endGame();
      }
    }, 150);
  }

  function stopTimer() {
    if (timerAnimFrame) cancelAnimationFrame(timerAnimFrame);
    if (timerInterval) clearInterval(timerInterval);
    timerAnimFrame = null;
    timerInterval = null;
    el.gameTimer.classList.remove('timer-warning');
  }

  function updateTimerDisplay() {
    const remainingMs = Math.max(0, gameEndTime - Date.now());
    el.gameTimer.textContent = Math.ceil(remainingMs / 1000);
  }

  document.addEventListener('visibilitychange', () => {
    if (gameState === 'running') {
      if (Date.now() >= gameEndTime) {
        endGame();
      } else {
        updateTimerDisplay();
      }
    }
  });

  // --- Input & Instant Answer Matching ---
  function handleInput(key) {
    if (gameState !== 'running') return;

    if (key === 'clear') {
      virtualBuffer = '';
      el.virtualAnswerText.textContent = '';
      return;
    }

    if (key === 'backspace') {
      if (virtualBuffer.length > 0) {
        virtualBuffer = virtualBuffer.slice(0, -1);
        el.virtualAnswerText.textContent = virtualBuffer;
      }
      return;
    }

    // Number input (0-9)
    if (/^[0-9]$/.test(key)) {
      if (virtualBuffer.length >= 8) return;

      virtualBuffer += key;
      el.virtualAnswerText.textContent = virtualBuffer;

      const userVal = parseInt(virtualBuffer, 10);
      if (userVal === currentProblem.answer) {
        score++;
        el.gameScore.textContent = score;

        if (navigator.vibrate) {
          try { navigator.vibrate(10); } catch (e) {}
        }
        
        el.virtualAnswerBox.classList.remove('correct-flash');
        void el.virtualAnswerBox.offsetWidth;
        el.virtualAnswerBox.classList.add('correct-flash');

        displayNextProblem();
      }
    }
  }

  // --- Game Lifecycle ---
  function startGame() {
    score = 0;
    el.gameScore.textContent = '0';
    gameState = 'running';

    showScreen('game');
    displayNextProblem();
    startTimer();
  }

  function endGame() {
    if (gameState !== 'running') return;
    gameState = 'ended';
    stopTimer();

    // Results computation
    const elapsedSeconds = Math.max(1, Math.min(settings.duration, Math.round((Date.now() - gameStartTime) / 1000)));
    const pace = score > 0 ? (elapsedSeconds / score).toFixed(2) : '0.00';
    const ppm = ((score / elapsedSeconds) * 60).toFixed(1);

    el.finalScoreNumber.textContent = score;
    el.statPace.textContent = `${pace}s / problem`;
    el.statPpm.textContent = `${ppm} / min`;
    el.statDuration.textContent = `${elapsedSeconds}s`;

    const isNewBest = score > highScore;
    if (isNewBest) {
      saveHighScore(score);
      el.newRecordBadge.classList.remove('hidden');
    } else {
      el.newRecordBadge.classList.add('hidden');
    }

    el.statPersonalBest.textContent = highScore;
    el.bestScoreDisplay.textContent = highScore;

    // Record daily completed round
    const today = getTodayDateString();
    if (dailyStats.date !== today) {
      dailyStats.date = today;
      dailyStats.rounds = 0;
    }
    dailyStats.rounds++;
    saveDailyStats();
    updateDailyGoalUI();

    showScreen('gameOver');
  }

  // --- Event Listeners ---

  // Custom On-Screen Keypad Listeners (Touch / Pointer without iOS zoom or keyboard)
  const numpadKeys = el.numpadContainer.querySelectorAll('.numpad-key');
  numpadKeys.forEach((keyBtn) => {
    keyBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const key = keyBtn.getAttribute('data-key');
      keyBtn.classList.add('key-pressed');
      handleInput(key);
    });

    const removePressState = () => keyBtn.classList.remove('key-pressed');
    keyBtn.addEventListener('pointerup', removePressState);
    keyBtn.addEventListener('pointerleave', removePressState);
    keyBtn.addEventListener('pointercancel', removePressState);
  });

  // Physical Keyboard listener for Desktop testing
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') {
      if (e.key === 'Enter') {
        e.target.blur();
        readSettingsFromUI();
        showScreen('start');
      }
      return;
    }

    if (gameState === 'running') {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleInput(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleInput('backspace');
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleInput('clear');
      }
    } else if (gameState === 'idle') {
      if (e.key === 'Enter') {
        e.preventDefault();
        startGame();
      }
    } else if (gameState === 'ended') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        startGame();
      }
    }
  });

  // Navigation & Button Actions
  el.startBtn.addEventListener('click', () => startGame());
  el.playAgainBtn.addEventListener('click', () => startGame());

  el.openSettingsBtn.addEventListener('click', () => {
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

  el.returnHomeBtn.addEventListener('click', () => {
    showScreen('start');
    gameState = 'idle';
  });

  el.returnSettingsBtn.addEventListener('click', () => {
    showScreen('settings');
    gameState = 'idle';
  });

  el.abortBtn.addEventListener('click', () => {
    if (confirm('End current game?')) {
      endGame();
    }
  });

  el.restoreDefaultsBtn.addEventListener('click', () => {
    settings = { ...DEFAULT_SETTINGS, theme: settings.theme };
    applySettingsToUI();
    saveSettings();
  });

  // Theme Toggle
  el.themeToggleBtn.addEventListener('click', () => {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', settings.theme);
    el.themeToggleBtn.textContent = settings.theme === 'dark' ? '☀️' : '🌙';
    saveSettings();
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
          dailyStats.remindersEnabled = true;
          dailyStats.lastReminderTime = Date.now();
          saveDailyStats();
          updateDailyGoalUI();
          sendNotification('Hourly Reminders Active! 🔔', 'We will remind you every hour if you have completed fewer than 5 rounds today.');
        } else {
          updateDailyGoalUI();
        }
      });
    } else if (Notification.permission === 'granted') {
      dailyStats.remindersEnabled = !dailyStats.remindersEnabled;
      if (dailyStats.remindersEnabled) {
        dailyStats.lastReminderTime = Date.now();
      }
      saveDailyStats();
      updateDailyGoalUI();
    } else if (Notification.permission === 'denied') {
      alert('Notifications are blocked in your browser/iOS settings. To enable reminders, open iPhone Settings > Safari / Zetamac and allow notifications.');
    }
  });

  // Prevent default double-tap zoom behavior on entire screen
  document.addEventListener('dblclick', (e) => {
    e.preventDefault();
  }, { passive: false });

  // --- Register Service Worker for Offline PWA Support ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('Zetamac ServiceWorker registered:', reg.scope);
          // Force update check on every load
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
  loadSavedData();
  applySettingsToUI();
  updateDailyGoalUI();
  showScreen('start');

  // Check reminders on load and periodically every 60 seconds
  setInterval(checkAndSendHourlyReminder, 60000);
  checkAndSendHourlyReminder();

})();
