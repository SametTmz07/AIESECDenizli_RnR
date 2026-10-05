let confettiEngine = null;
let celebrationActive = false;
let celebrationTimer = null;
let celebrationFrame = null;
const CONFETTI_STORAGE_KEY = 'rnr-confetti-enabled';
let confettiEnabled = true;
try { confettiEnabled = localStorage.getItem(CONFETTI_STORAGE_KEY) !== 'false'; } catch {}

export function isConfettiEnabled() {
  return confettiEnabled && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function setConfettiEnabled(enabled) {
  confettiEnabled = Boolean(enabled);
  try { localStorage.setItem(CONFETTI_STORAGE_KEY, String(confettiEnabled)); } catch {}
  if (!confettiEnabled) resetPodiumCelebration();
}

function getPerformanceProfile() {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const constrained = isMobile || cores <= 4 || memory <= 4;

  return constrained
    ? { particleCount: 48, ticks: 105, scalar: 0.78, startVelocity: 32 }
    : { particleCount: 84, ticks: 135, scalar: 0.9, startVelocity: 38 };
}

function getConfettiEngine() {
  if (confettiEngine) return confettiEngine;
  if (typeof confetti !== 'function') return null;

  if (typeof confetti.create === 'function') {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '9999'
    });
    document.body.appendChild(canvas);
    confettiEngine = confetti.create(canvas, { resize: true, useWorker: true });
  } else {
    confettiEngine = confetti;
  }

  return confettiEngine;
}

export function celebratePodium() {
  if (celebrationActive || !isConfettiEnabled()) return;

  const engine = getConfettiEngine();
  if (!engine) return;

  celebrationActive = true;
  const profile = getPerformanceProfile();

  // Podyum/kart dönüşümünün ilk karesini tamamlamasına izin ver; sonra tek atım yap.
  celebrationFrame = requestAnimationFrame(() => {
    celebrationFrame = null;
    if (!celebrationActive || !isConfettiEnabled()) return;
    engine({
      ...profile,
      spread: 86,
      decay: 0.92,
      gravity: 1.08,
      origin: { y: 0.72 },
      colors: ['#f59e0b', '#ffc845', '#0CB9C1', '#F48924', '#7552CC', '#F85A40'],
      disableForReducedMotion: true
    });
  });

  clearTimeout(celebrationTimer);
  celebrationTimer = setTimeout(() => {
    celebrationActive = false;
  }, 1800);
}

export function resetPodiumCelebration() {
  if (celebrationFrame !== null) cancelAnimationFrame(celebrationFrame);
  celebrationFrame = null;
  clearTimeout(celebrationTimer);
  celebrationTimer = null;
  celebrationActive = false;
  if (confettiEngine && typeof confettiEngine.reset === 'function') confettiEngine.reset();
}
