// === Timer Constants ===
const TIMER_CONFIG = {
  focus: { duration: 25 * 60, label: '专注时间' },
  shortBreak: { duration: 5 * 60, label: '短休息' },
  longBreak: { duration: 15 * 60, label: '长休息' }
};
const SESSIONS_BEFORE_LONG_BREAK = 4;

// === State ===
let currentState = 'focus';       // 'focus' | 'shortBreak' | 'longBreak'
let timeLeft = TIMER_CONFIG.focus.duration;
let totalDuration = TIMER_CONFIG.focus.duration;
let isRunning = false;
let sessionCount = 0;             // completed focus sessions in current cycle
let timerInterval = null;

// === Audio ===
let audioCtx = null;
function playNotificationSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
    frequencies.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.12 + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + i * 0.12);
      osc.stop(audioCtx.currentTime + i * 0.12 + 0.3);
    });
  } catch (e) {
    // Silently ignore audio errors
  }
}

// === DOM Elements ===
const timerText = document.getElementById('timer-text');
const timerLabel = document.getElementById('timer-label');
const progressCircle = document.getElementById('progress-circle');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const btnSkip = document.getElementById('btn-skip');
const btnTheme = document.getElementById('btn-theme');
const btnPin = document.getElementById('btn-pin');
const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');
const tomatoCounter = document.getElementById('tomato-counter');
const titlebar = document.getElementById('titlebar');

// === Init Progress Ring ===
const CIRCUMFERENCE = 2 * Math.PI * 85; // radius = 85
progressCircle.style.strokeDasharray = CIRCUMFERENCE;
progressCircle.style.strokeDashoffset = '0';

// === Format Time ===
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// === Update UI ===
function updateTimerDisplay() {
  timerText.textContent = formatTime(timeLeft);
  const offset = CIRCUMFERENCE * (1 - timeLeft / totalDuration);
  progressCircle.style.strokeDashoffset = offset;
}

function updateStateUI() {
  const config = TIMER_CONFIG[currentState];
  timerLabel.textContent = config.label;

  // Update body class for color theme
  document.body.classList.remove('focus', 'break');
  if (currentState === 'focus') {
    document.body.classList.add('focus');
  } else {
    document.body.classList.add('break');
  }
}

function updateTomatoCounter() {
  const tomatoes = tomatoCounter.querySelectorAll('.tomato');
  tomatoes.forEach((t, i) => {
    if (i < sessionCount) {
      t.classList.add('completed');
    } else {
      t.classList.remove('completed');
    }
  });
}

function updateButtonStates() {
  btnStart.disabled = isRunning;
  btnPause.disabled = !isRunning;
}

function updateRunningState() {
  if (isRunning) {
    document.body.classList.add('running');
  } else {
    document.body.classList.remove('running');
  }
}

function updateTray() {
  const label = TIMER_CONFIG[currentState].label;
  const timeStr = formatTime(timeLeft);
  window.pomodoroAPI.updateTray(
    `${label} - ${timeStr}`,
    isRunning
  );
}

function refreshUI() {
  updateTimerDisplay();
  updateStateUI();
  updateTomatoCounter();
  updateButtonStates();
  updateRunningState();
}

// === Timer Logic ===
function tick() {
  if (!isRunning) return;

  if (timeLeft > 0) {
    timeLeft--;
    updateTimerDisplay();
    updateTray();
  }

  if (timeLeft <= 0) {
    completeSession();
  }
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  timerInterval = setInterval(tick, 1000);
  refreshUI();
  updateTray();
}

function pauseTimer() {
  isRunning = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  refreshUI();
  updateTray();
}

function resetTimer() {
  const wasRunning = isRunning;
  isRunning = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timeLeft = TIMER_CONFIG[currentState].duration;
  totalDuration = timeLeft;
  refreshUI();
  updateTray();

  if (wasRunning) {
    startTimer();
  }
}

function skipSession() {
  isRunning = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  completeSession();
}

function completeSession() {
  // Clear timer running state
  isRunning = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  playNotificationSound();

  if (currentState === 'focus') {
    // Completed a focus session
    sessionCount++;
    if (sessionCount >= SESSIONS_BEFORE_LONG_BREAK) {
      // Time for a long break
      currentState = 'longBreak';
      sessionCount = 0;
      window.pomodoroAPI.sendNotification('🍅 番茄钟完成！', '太棒了！休息一下吧~进入长休息 15 分钟');
    } else {
      currentState = 'shortBreak';
      window.pomodoroAPI.sendNotification('🍅 番茄钟完成！', '休息一下，5 分钟后继续~');
    }
  } else {
    // Break finished, go back to focus
    currentState = 'focus';
    window.pomodoroAPI.sendNotification('⏰ 休息结束！', '准备开始新的番茄钟吧！');
  }

  timeLeft = TIMER_CONFIG[currentState].duration;
  totalDuration = timeLeft;
  refreshUI();
  updateTray();

  // Auto-start next session
  startTimer();
}

// === Button Events ===
btnStart.addEventListener('click', startTimer);
btnPause.addEventListener('click', pauseTimer);
btnReset.addEventListener('click', resetTimer);
btnSkip.addEventListener('click', skipSession);

// === Theme Toggle ===
function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  btnTheme.textContent = theme === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('pomodoro-theme', theme);
}

btnTheme.addEventListener('click', () => {
  const newTheme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
});

// === Always-on-Top Toggle ===
let isPinned = false;
btnPin.addEventListener('click', () => {
  isPinned = !isPinned;
  btnPin.classList.toggle('active', isPinned);
  window.pomodoroAPI.setAlwaysOnTop(isPinned);
});

// === Window Controls ===
btnMinimize.addEventListener('click', () => {
  window.pomodoroAPI.minimizeWindow();
});

btnClose.addEventListener('click', () => {
  window.pomodoroAPI.closeWindow();
});

// === Tray Toggle ===
window.pomodoroAPI.onTrayToggle(() => {
  if (isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
});

// === Keyboard Shortcuts ===
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    isRunning ? pauseTimer() : startTimer();
  } else if (e.code === 'KeyR' && !e.ctrlKey) {
    resetTimer();
  } else if (e.code === 'KeyS' && !e.ctrlKey) {
    skipSession();
  }
});

// === Init ===
function init() {
  // Load saved theme
  const savedTheme = localStorage.getItem('pomodoro-theme') || 'dark';
  setTheme(savedTheme);

  // Init display
  timeLeft = TIMER_CONFIG[currentState].duration;
  totalDuration = timeLeft;
  refreshUI();
  updateTray();
}

init();
