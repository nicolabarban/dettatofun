import * as game from './game.js';
import * as ui from './ui.js';
import { loadProgress, saveStars } from './storage.js';
import { pickPhrase } from './mascot.js';

const root = document.getElementById('app');

let data = null;
let progress = loadProgress();

function showHome() {
  ui.renderHome(root, {
    levels: data.levels,
    progress,
    onSelectLevel: (id) => startLevel(id),
  });
}

function startLevel(levelId) {
  const exercises = game.exercisesForLevel(data, levelId);
  const session = game.createSession(levelId, exercises);
  renderSession(session, pickPhrase('level_intro'), 'idle');
}

function renderSession(session, bubble, mood) {
  const levelInfo = game.levelById(data, session.levelId);
  ui.renderGame(root, {
    session,
    levelInfo,
    mood,
    bubble,
    onWordClick: (idx) => handleWordClick(session, idx),
    onBack: () => showHome(),
  });
}

function handleWordClick(session, wordIndex) {
  const ex = game.currentExercise(session);
  const err = game.getError(ex, wordIndex);

  if (!err) {
    const next = game.applyClickOnNonError(session, wordIndex);
    if (game.isGameOver(next)) {
      finishLevel(next, false);
      return;
    }
    renderSession(next, pickPhrase('not_error'), 'confused');
    return;
  }

  ui.showOptionsModal({
    correct: err.correct,
    options: err.options,
    onPick: (isCorrect) => {
      const next = isCorrect
        ? game.applyCorrectChoice(session, wordIndex)
        : game.applyWrongChoice(session, wordIndex);

      if (!isCorrect && game.isGameOver(next)) {
        finishLevel(next, false);
        return;
      }

      const cleared = game.isCleared(next);
      if (cleared) {
        renderSession(next, pickPhrase('correct'), 'excited');
        setTimeout(() => advanceExercise(next), 1200);
      } else {
        renderSession(
          next,
          isCorrect ? pickPhrase('correct') : pickPhrase('wrong_choice'),
          isCorrect ? 'happy' : 'sad',
        );
      }
    },
  });
}

function advanceExercise(session) {
  const advanced = game.nextExercise(session);
  if (advanced.finished) {
    finishLevel(advanced, true);
    return;
  }
  renderSession(advanced, pickPhrase('level_intro'), 'idle');
}

function finishLevel(session, passed) {
  const stars = passed ? game.starsEarned(session) : 0;
  if (passed && stars > 0) {
    progress = saveStars(session.levelId, stars);
  }
  const levelInfo = game.levelById(data, session.levelId);
  const hasNext = session.levelId < data.levels.length;

  ui.renderResult(root, {
    passed,
    stars,
    levelInfo,
    hasNext,
    onRetry: () => startLevel(session.levelId),
    onHome: () => showHome(),
    onNext: () => startLevel(session.levelId + 1),
  });
}

async function bootstrap() {
  try {
    data = await game.loadExercisesData();
    showHome();
  } catch (err) {
    root.innerHTML = `
      <div style="padding: 24px; text-align: center;">
        <h2 style="margin-bottom: 12px;">Ops! Non riesco a caricare gli esercizi.</h2>
        <p style="color: #4b5563;">Devi avviare un piccolo server locale (vedi README).</p>
        <p style="color: #9ca3af; font-size: 0.85rem; margin-top: 12px;">${err.message}</p>
      </div>
    `;
  }
}

bootstrap();
