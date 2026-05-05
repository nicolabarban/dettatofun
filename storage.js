const KEY = 'caccia_errore_v1';

function readRaw() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadProgress() {
  const data = readRaw();
  if (!data || typeof data !== 'object') {
    return { stars: {} };
  }
  return { stars: data.stars || {} };
}

export function saveStars(levelId, stars) {
  const progress = loadProgress();
  const current = progress.stars[levelId] || 0;
  if (stars <= current) return progress;
  const next = {
    ...progress,
    stars: { ...progress.stars, [levelId]: stars },
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage indisponibile (privacy mode): ignoriamo, il gioco resta giocabile in sessione
  }
  return next;
}

export function getStars(progress, levelId) {
  return progress.stars[levelId] || 0;
}

export function isLevelUnlocked(progress, levelId, totalLevels) {
  if (levelId === 1) return true;
  if (levelId > totalLevels) return false;
  return (progress.stars[levelId - 1] || 0) > 0;
}
