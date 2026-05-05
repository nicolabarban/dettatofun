import { mascotSvg, pickPhrase } from './mascot.js';
import * as game from './game.js';
import { getStars, isLevelUnlocked } from './storage.js';

const TOTAL_LEVELS = 4;

function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

function clear(root) {
  while (root.firstChild) root.removeChild(root.firstChild);
}

function starsDisplay(count, total = 3) {
  let html = '<span class="level-stars">';
  for (let i = 0; i < total; i++) {
    html += `<span class="star ${i < count ? 'earned' : ''}">⭐</span>`;
  }
  html += '</span>';
  return html;
}

function livesDisplay(lives, max = game.STARTING_LIVES) {
  let html = '<div class="lives">';
  for (let i = 0; i < max; i++) {
    html += `<span class="heart ${i < lives ? '' : 'lost'}">❤️</span>`;
  }
  html += '</div>';
  return html;
}

export function renderHome(root, { levels, progress, onSelectLevel }) {
  clear(root);
  const home = el(`
    <section class="home">
      <div class="mascot-stage">
        <div class="mascot">${mascotSvg('idle')}</div>
        <div class="mascot-bubble">${pickPhrase('welcome')}</div>
      </div>
      <div class="home-title">
        <h1>Caccia all'Errore</h1>
        <p>Tocca le parole sbagliate e correggile!</p>
      </div>
      <div class="levels-list"></div>
    </section>
  `);

  const list = home.querySelector('.levels-list');
  levels.forEach((lvl) => {
    const stars = getStars(progress, lvl.id);
    const unlocked = isLevelUnlocked(progress, lvl.id, TOTAL_LEVELS);
    const card = el(`
      <button class="level-card" ${unlocked ? '' : 'disabled'}>
        <div class="level-num">${lvl.id}</div>
        <div class="level-meta">
          <h3>${lvl.name}</h3>
          <p>${lvl.description}</p>
        </div>
        ${starsDisplay(stars)}
      </button>
    `);
    if (unlocked) {
      card.addEventListener('click', () => onSelectLevel(lvl.id));
    }
    list.appendChild(card);
  });

  root.appendChild(home);
}

export function renderGame(root, { session, levelInfo, mood, bubble, onWordClick, onBack }) {
  clear(root);
  const ex = game.currentExercise(session);
  const view = el(`
    <section class="game">
      <header class="game-header">
        <button class="btn-back" aria-label="Torna alla home">←</button>
        <div class="game-info">
          <span class="level">Livello ${session.levelId} · ${levelInfo.name}</span>
          <span class="progress">Esercizio ${session.currentIdx + 1} di ${session.exercises.length}</span>
        </div>
        ${livesDisplay(session.lives)}
      </header>

      <div class="mascot-row">
        <div class="mascot ${mood === 'idle' ? '' : (mood === 'sad' || mood === 'confused' ? 'shake' : 'bounce')}">${mascotSvg(mood)}</div>
        <div class="mascot-bubble">${bubble}</div>
      </div>

      <div class="paragraph-card"></div>
    </section>
  `);

  const paragraphEl = view.querySelector('.paragraph-card');
  ex.paragraph.forEach((token, idx) => {
    const state = game.tokenState(session, idx);
    const text = game.displayedToken(session, idx);
    const span = document.createElement('span');
    span.className = 'word';
    if (state === 'correct-pick') span.classList.add('locked', 'correct-pick');
    else if (state === 'wrong-pick') span.classList.add('locked', 'revealed');
    else if (state === 'click-non-error') span.classList.add('locked', 'wrong-pick');
    span.textContent = text;
    span.dataset.idx = idx;
    if (!span.classList.contains('locked')) {
      span.addEventListener('click', () => onWordClick(idx));
    }
    paragraphEl.appendChild(span);
    paragraphEl.appendChild(document.createTextNode(' '));
  });

  view.querySelector('.btn-back').addEventListener('click', onBack);

  root.appendChild(view);
}

export function showOptionsModal({ correct, options, onPick }) {
  const backdrop = el(`
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true">
        <h2>Qual è la versione giusta?</h2>
        <div class="modal-options"></div>
      </div>
    </div>
  `);

  const optsEl = backdrop.querySelector('.modal-options');
  const shuffled = game.shuffle(options);

  shuffled.forEach((opt) => {
    const btn = el(`<button class="option">${opt}</button>`);
    btn.addEventListener('click', () => {
      const isCorrect = opt === correct;
      btn.classList.add(isCorrect ? 'correct' : 'wrong');
      if (!isCorrect) {
        const correctBtn = Array.from(optsEl.querySelectorAll('.option')).find(
          (b) => b.textContent === correct,
        );
        if (correctBtn) correctBtn.classList.add('correct');
      }
      Array.from(optsEl.querySelectorAll('.option')).forEach((b) => (b.disabled = true));
      setTimeout(() => {
        backdrop.remove();
        onPick(isCorrect);
      }, 800);
    });
    optsEl.appendChild(btn);
  });

  document.body.appendChild(backdrop);
}

export function renderResult(root, { passed, stars, levelInfo, onRetry, onHome, onNext, hasNext }) {
  clear(root);
  const moodKey = passed ? (stars === 3 ? 'excited' : 'happy') : 'sad';
  const phraseKey = passed ? `level_done_${stars}` : 'level_fail';
  const view = el(`
    <section class="result ${passed ? '' : 'fail'}">
      <div class="mascot ${passed ? 'wiggle' : 'shake'}">${mascotSvg(moodKey)}</div>
      <h1>${passed ? 'Livello completato!' : 'Riprova!'}</h1>
      <p style="color: var(--ink-soft); font-weight: 700;">${pickPhrase(phraseKey)}</p>
      ${passed ? `
        <div class="result-stars">
          <span class="star ${stars >= 1 ? 'earned' : ''}">⭐</span>
          <span class="star ${stars >= 2 ? 'earned' : ''}">⭐</span>
          <span class="star ${stars >= 3 ? 'earned' : ''}">⭐</span>
        </div>
      ` : ''}
      <div class="result-actions"></div>
    </section>
  `);

  const actions = view.querySelector('.result-actions');
  if (passed && hasNext) {
    const next = el(`<button class="btn primary">Livello successivo →</button>`);
    next.addEventListener('click', onNext);
    actions.appendChild(next);
  }
  const retry = el(`<button class="btn ghost">${passed ? 'Rigioca' : 'Riprova'}</button>`);
  retry.addEventListener('click', onRetry);
  actions.appendChild(retry);

  const home = el(`<button class="btn ghost">🏠 Home</button>`);
  home.addEventListener('click', onHome);
  actions.appendChild(home);

  root.appendChild(view);
}
