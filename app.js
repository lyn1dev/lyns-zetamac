/**
 * Zetamac 1:1 Clone - Application Engine
 * Optimized for iPhone PWA with exclusive custom on-screen keypad & timestamp-diffing timer
 */

(() => {
  'use strict';

  // --- Audio Synthesis (No external assets required) ---
  let audioCtx = null;
  function playBeep(freq = 784, duration = 0.04) {
    if (!settings.soundEnabled) return;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio context might be restricted before first gesture
    }
  }

  // --- Default Configuration ---
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
    soundEnabled: true,
    theme: 'light'
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

  // DOM Elements
  const screens = {
    settings: document.getElementById('settings-screen'),
    game: document.getElementById('game-screen'),
    gameOver: document.getElementById('game-over-screen')
  };

  const el = {
    // Settings elements
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
    startBtn: document.getElementById('start-game-btn'),
    restoreDefaultsBtn: document.getElementById('restore-defaults-btn'),
    bestScoreDisplay: document.getElementById('best-score-display'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    soundToggleBtn: document.getElementById('sound-toggle-btn'),

    // Gameplay elements
    gameTimer: document.getElementById('game-timer'),
    gameScore: document.getElementById('game-score'),
    problemPrompt: document.getElementById('problem-prompt'),
    virtualAnswerBox: document.getElementById('virtual-answer-box'),
    virtualAnswerText: document.getElementById('virtual-answer-text'),
    numpadContainer: document.getElementById('numpad-container'),
    abortBtn: document.getElementById('abort-game-btn'),

    // Results elements
    finalScoreNumber: document.getElementById('final-score-number'),
    newRecordBadge: document.getElementById('new-record-badge'),
    statPace: document.getElementById('stat-pace'),
    statPpm: document.getElementById('stat-ppm'),
    statDuration: document.getElementById('stat-duration'),
    statPersonalBest: document.getElementById('stat-personal-best'),
    playAgainBtn: document.getElementById('play-again-btn'),
    returnSettingsBtn: document.getElementById('return-settings-btn')
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
    el.soundToggleBtn.textContent = settings.soundEnabled ? '🔊' : '🔇';

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

  // --- Screen Navigation ---
  function showScreen(name) {
    Object.keys(screens).forEach((screenKey) => {
      screens[screenKey].classList.toggle('active', screenKey === name);
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
        // Inversion of addition: pick operands in addition ranges, answer is one of them
        const a = randomInt(settings.addMin1, settings.addMax1);
        const b = randomInt(settings.addMin2, settings.addMax2);
        const sum = a + b;
        // 50% chance: (a + b) - a = b OR (a + b) - b = a
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
        // Randomly flip order of factors
        if (Math.random() < 0.5) {
          [a, b] = [b, a];
        }
        return {
          prompt: `${a} × ${b} =`,
          answer: a * b
        };
      }
      case '/': {
        // Inversion of multiplication: pick factors in mult ranges
        const a = randomInt(settings.multMin1, settings.multMax1);
        const b = randomInt(settings.multMin2, settings.multMax2);
        const prod = a * b;
        // 50% chance: (a * b) / a = b OR (a * b) / b = a
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

    // High accuracy animation frame loop + interval backup for screen dimming
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
    // Interval backup (every 150ms) to ensure background tabs or dimmed iOS screens tick accurately
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

  // Document visibility change listener ensures immediate sync upon unlocking or returning to app
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
      // Prevent overflow buffer
      if (virtualBuffer.length >= 8) return;

      virtualBuffer += key;
      el.virtualAnswerText.textContent = virtualBuffer;

      // Instant Match Check (Hallmark Zetamac mechanics)
      const userVal = parseInt(virtualBuffer, 10);
      if (userVal === currentProblem.answer) {
        // Correct answer!
        score++;
        el.gameScore.textContent = score;

        // Feedback: sound, haptic, visual flash
        playBeep(880, 0.04);
        if (navigator.vibrate) {
          try { navigator.vibrate(12); } catch (e) {}
        }
        
        el.virtualAnswerBox.classList.remove('correct-flash');
        // Force reflow for CSS animation restart
        void el.virtualAnswerBox.offsetWidth;
        el.virtualAnswerBox.classList.add('correct-flash');

        // Immediately advance to next problem
        displayNextProblem();
      }
    }
  }

  // --- Game Lifecycle ---
  function startGame() {
    readSettingsFromUI();
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

    playBeep(isNewBest ? 1046 : 523, 0.12);
    showScreen('gameOver');
  }

  // --- Event Listeners ---

  // Custom On-Screen Keypad Listeners (Touch / Pointer without iOS zoom or keyboard)
  const numpadKeys = el.numpadContainer.querySelectorAll('.numpad-key');
  numpadKeys.forEach((keyBtn) => {
    // Using pointerdown for instantaneous reaction without 300ms tap delay
    keyBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); // Prevents touch zoom & focus behaviors
      const key = keyBtn.getAttribute('data-key');
      keyBtn.classList.add('key-pressed');
      handleInput(key);
    });

    const removePressState = () => keyBtn.classList.remove('key-pressed');
    keyBtn.addEventListener('pointerup', removePressState);
    keyBtn.addEventListener('pointerleave', removePressState);
    keyBtn.addEventListener('pointercancel', removePressState);
  });

  // Physical Keyboard listener for Desktop testing (does NOT focus any mobile input)
  window.addEventListener('keydown', (e) => {
    // If typing inside settings number inputs, let standard input happen
    if (e.target.tagName === 'INPUT') {
      if (e.key === 'Enter') {
        e.target.blur();
        startGame();
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

  // Buttons
  el.startBtn.addEventListener('click', () => startGame());
  el.playAgainBtn.addEventListener('click', () => startGame());
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
    settings = { ...DEFAULT_SETTINGS, soundEnabled: settings.soundEnabled, theme: settings.theme };
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

  // Sound Toggle
  el.soundToggleBtn.addEventListener('click', () => {
    settings.soundEnabled = !settings.soundEnabled;
    el.soundToggleBtn.textContent = settings.soundEnabled ? '🔊' : '🔇';
    saveSettings();
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
        })
        .catch((err) => {
          console.warn('ServiceWorker registration failed:', err);
        });
    });
  }

  // --- Bootstrap ---
  loadSavedData();
  applySettingsToUI();
  showScreen('settings');

})();
