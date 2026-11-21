// SHADOW PROTOCOL — saved progress.
// One job: remember which levels are unlocked and the best grade per level,
// in localStorage, under one key. Nothing else is persisted.

const KEY = 'shadow-protocol-progress-v1';

export function defaultProgress() {
  return { unlocked: 1, grades: {}, bestScores: {}, muted: false };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProgress();
    const data = JSON.parse(raw);
    return {
      unlocked: Math.max(1, Math.min(3, data.unlocked | 0 || 1)),
      grades: data.grades || {},
      bestScores: data.bestScores || {},
      muted: !!data.muted,
    };
  } catch (e) {
    return defaultProgress();
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch (e) {
    // Storage may be unavailable (private mode); the game still plays.
  }
}
