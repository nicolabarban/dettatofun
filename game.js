export const STARTING_LIVES = 3;

export async function loadExercisesData() {
  const res = await fetch('data/exercises.json');
  if (!res.ok) throw new Error(`Caricamento esercizi fallito (${res.status})`);
  return res.json();
}

export function exercisesForLevel(data, levelId) {
  return data.exercises.filter((e) => e.level === levelId);
}

export function levelById(data, levelId) {
  return data.levels.find((l) => l.id === levelId);
}

export function createSession(levelId, exercises) {
  return {
    levelId,
    exercises,
    currentIdx: 0,
    lives: STARTING_LIVES,
    corrections: {},
    revealed: {},
    wrongClicks: {},
    finished: false,
  };
}

export function currentExercise(session) {
  return session.exercises[session.currentIdx];
}

export function getError(exercise, wordIndex) {
  return exercise.errors.find((e) => e.wordIndex === wordIndex);
}

export function isCleared(session) {
  const ex = currentExercise(session);
  return ex.errors.every((err) => session.corrections[`${ex.id}-${err.wordIndex}`] !== undefined);
}

export function shuffle(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function applyCorrectChoice(session, wordIndex) {
  const ex = currentExercise(session);
  const err = getError(ex, wordIndex);
  if (!err) return session;
  return {
    ...session,
    corrections: {
      ...session.corrections,
      [`${ex.id}-${wordIndex}`]: { value: err.correct, byPlayer: true },
    },
  };
}

export function applyWrongChoice(session, wordIndex) {
  const ex = currentExercise(session);
  const err = getError(ex, wordIndex);
  if (!err) return session;
  return {
    ...session,
    lives: Math.max(0, session.lives - 1),
    corrections: {
      ...session.corrections,
      [`${ex.id}-${wordIndex}`]: { value: err.correct, byPlayer: false },
    },
    revealed: { ...session.revealed, [`${ex.id}-${wordIndex}`]: true },
  };
}

export function applyClickOnNonError(session, wordIndex) {
  const ex = currentExercise(session);
  return {
    ...session,
    lives: Math.max(0, session.lives - 1),
    wrongClicks: { ...session.wrongClicks, [`${ex.id}-${wordIndex}`]: true },
  };
}

export function nextExercise(session) {
  const nextIdx = session.currentIdx + 1;
  if (nextIdx >= session.exercises.length) {
    return { ...session, finished: true };
  }
  return { ...session, currentIdx: nextIdx };
}

export function isGameOver(session) {
  return session.lives <= 0;
}

export function starsEarned(session) {
  if (isGameOver(session)) return 0;
  return Math.max(0, Math.min(3, session.lives));
}

export function tokenState(session, wordIndex) {
  const ex = currentExercise(session);
  const key = `${ex.id}-${wordIndex}`;
  if (session.corrections[key]) {
    return session.revealed[key] ? 'wrong-pick' : 'correct-pick';
  }
  if (session.wrongClicks[key]) return 'click-non-error';
  return 'idle';
}

export function displayedToken(session, wordIndex) {
  const ex = currentExercise(session);
  const original = ex.paragraph[wordIndex];
  const correction = session.corrections[`${ex.id}-${wordIndex}`];
  return correction ? correction.value : original;
}
