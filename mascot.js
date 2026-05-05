const FUR = '#f4a261';
const FUR_LIGHT = '#fcd5b5';
const INNER_EAR = '#f8a5b8';
const NOSE = '#e87b9e';
const STROKE = '#3d2817';
const BOW = '#ec4899';
const BOW_LIGHT = '#f9a8d4';
const EYE = '#2d3748';
const EYE_GREEN = '#10b981';
const BLUSH = '#fda4af';

function eyes(mood) {
  switch (mood) {
    case 'happy':
      return `
        <path d="M 70 95 Q 80 85 90 95" stroke="${STROKE}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M 110 95 Q 120 85 130 95" stroke="${STROKE}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      `;
    case 'excited':
      return `
        <circle cx="80" cy="95" r="9" fill="white" stroke="${STROKE}" stroke-width="2"/>
        <circle cx="120" cy="95" r="9" fill="white" stroke="${STROKE}" stroke-width="2"/>
        <circle cx="80" cy="93" r="6" fill="${EYE_GREEN}"/>
        <circle cx="120" cy="93" r="6" fill="${EYE_GREEN}"/>
        <circle cx="82" cy="91" r="2" fill="white"/>
        <circle cx="122" cy="91" r="2" fill="white"/>
      `;
    case 'sad':
      return `
        <ellipse cx="80" cy="98" rx="5" ry="6" fill="${EYE}"/>
        <ellipse cx="120" cy="98" rx="5" ry="6" fill="${EYE}"/>
        <path d="M 70 88 Q 80 92 90 88" stroke="${STROKE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M 110 88 Q 120 92 130 88" stroke="${STROKE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <ellipse cx="86" cy="108" rx="2.5" ry="4" fill="#60a5fa" opacity="0.85"/>
      `;
    case 'confused':
      return `
        <circle cx="80" cy="95" r="4" fill="${EYE}"/>
        <ellipse cx="120" cy="95" rx="6" ry="7" fill="${EYE}"/>
        <path d="M 68 86 L 92 84" stroke="${STROKE}" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M 108 84 L 132 88" stroke="${STROKE}" stroke-width="2.5" stroke-linecap="round"/>
      `;
    case 'idle':
    default:
      return `
        <ellipse cx="80" cy="95" rx="5" ry="7" fill="${EYE}"/>
        <ellipse cx="120" cy="95" rx="5" ry="7" fill="${EYE}"/>
        <circle cx="82" cy="92" r="1.8" fill="white"/>
        <circle cx="122" cy="92" r="1.8" fill="white"/>
      `;
  }
}

function mouth(mood) {
  switch (mood) {
    case 'happy':
      return `
        <path d="M 95 122 Q 100 127 105 122" stroke="${STROKE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M 88 122 Q 100 138 112 122" stroke="${STROKE}" stroke-width="3" fill="${NOSE}" stroke-linecap="round" stroke-linejoin="round"/>
      `;
    case 'excited':
      return `
        <ellipse cx="100" cy="128" rx="10" ry="9" fill="${STROKE}"/>
        <ellipse cx="100" cy="132" rx="6" ry="4" fill="${NOSE}"/>
      `;
    case 'sad':
      return `
        <path d="M 90 130 Q 100 122 110 130" stroke="${STROKE}" stroke-width="3" fill="none" stroke-linecap="round"/>
      `;
    case 'confused':
      return `
        <path d="M 90 125 L 95 122 L 100 125 L 105 122 L 110 125" stroke="${STROKE}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      `;
    case 'idle':
    default:
      return `
        <path d="M 95 122 Q 100 126 105 122" stroke="${STROKE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M 92 122 Q 100 130 108 122" stroke="${STROKE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      `;
  }
}

export function mascotSvg(mood = 'idle') {
  return `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Lily la gatta">
  <ellipse cx="100" cy="180" rx="55" ry="8" fill="rgba(0,0,0,0.08)"/>

  <path d="M 55 70 L 45 35 L 80 60 Z" fill="${FUR}" stroke="${STROKE}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M 145 70 L 155 35 L 120 60 Z" fill="${FUR}" stroke="${STROKE}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M 60 65 L 55 45 L 75 60 Z" fill="${INNER_EAR}"/>
  <path d="M 140 65 L 145 45 L 125 60 Z" fill="${INNER_EAR}"/>

  <circle cx="100" cy="105" r="55" fill="${FUR}" stroke="${STROKE}" stroke-width="2.5"/>

  <ellipse cx="100" cy="118" rx="32" ry="22" fill="${FUR_LIGHT}"/>

  <ellipse cx="68" cy="118" rx="9" ry="6" fill="${BLUSH}" opacity="0.6"/>
  <ellipse cx="132" cy="118" rx="9" ry="6" fill="${BLUSH}" opacity="0.6"/>

  ${eyes(mood)}

  <path d="M 96 113 L 100 118 L 104 113 Z" fill="${NOSE}" stroke="${STROKE}" stroke-width="1.5" stroke-linejoin="round"/>

  ${mouth(mood)}

  <line x1="55" y1="120" x2="80" y2="118" stroke="${STROKE}" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="55" y1="128" x2="80" y2="124" stroke="${STROKE}" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="120" y1="118" x2="145" y2="120" stroke="${STROKE}" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="120" y1="124" x2="145" y2="128" stroke="${STROKE}" stroke-width="1.5" stroke-linecap="round"/>

  <g transform="translate(135 55) rotate(15)">
    <ellipse cx="-10" cy="0" rx="11" ry="8" fill="${BOW}" stroke="${STROKE}" stroke-width="2"/>
    <ellipse cx="10" cy="0" rx="11" ry="8" fill="${BOW}" stroke="${STROKE}" stroke-width="2"/>
    <circle cx="0" cy="0" r="5" fill="${BOW_LIGHT}" stroke="${STROKE}" stroke-width="2"/>
    <path d="M -8 -3 Q -4 -1 -2 -3" stroke="${BOW_LIGHT}" stroke-width="1.5" fill="none" opacity="0.7"/>
    <path d="M 2 -3 Q 4 -1 8 -3" stroke="${BOW_LIGHT}" stroke-width="1.5" fill="none" opacity="0.7"/>
  </g>
</svg>`.trim();
}

const PHRASES = {
  welcome: [
    'Ciao, sono Lily! Pronta a cacciare gli errori?',
    'Miao! Trovi le parole sbagliate con me?',
    'Benvenuto! Scegli un livello e iniziamo.',
  ],
  level_intro: [
    'Tocca le parole che pensi siano sbagliate!',
    'Occhio agli errori nascosti, miao!',
    'Sei pronto? Concentrati sulle parole!',
  ],
  correct: [
    'Bravissimo! ⭐',
    'Perfetto! Continua così!',
    'Esatto! Sei un campione!',
    'Miao miao! Ottimo lavoro!',
  ],
  wrong_choice: [
    'Quasi! Era questa la giusta.',
    'Ops, attento all\'ortografia!',
    'Non era proprio giusta...',
  ],
  not_error: [
    'Questa parola era già corretta!',
    'Mmm, prova un\'altra parola!',
    'No, qui non c\'è errore.',
  ],
  level_done_3: [
    'Wow! Tre stelle! Sei un fenomeno!',
    'Pazzesco! Livello perfetto!',
  ],
  level_done_2: [
    'Bravissimo! Due stelle!',
    'Ottimo lavoro!',
  ],
  level_done_1: [
    'Ce l\'hai fatta! Ora puoi solo migliorare!',
    'Una stella, ma è solo l\'inizio!',
  ],
  level_fail: [
    'Niente paura, riprova!',
    'Ti aspetto per un\'altra partita!',
  ],
};

export function pickPhrase(key) {
  const list = PHRASES[key] || [''];
  return list[Math.floor(Math.random() * list.length)];
}
