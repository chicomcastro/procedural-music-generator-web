const STORAGE_KEY = 'seedsong-onboarding-done';

const STEPS = [
  {
    target: '#hero',
    title: 'Welcome to SeedSong',
    text: 'A procedural music generator that creates infinite melodies from a single seed number. Let\'s take a quick tour!',
    position: 'bottom',
  },
  {
    target: '#score-section',
    title: 'Score Canvas',
    text: 'Your song visualized as a piano roll. Multi-section songs show Intro, Verse, Chorus, and Outro. Click a bar to lock it — locked bars survive regeneration. Click notes to select, drag to move, resize edges to change duration.',
    position: 'bottom',
  },
  {
    target: '#tab-bar',
    title: 'Tabbed Controls',
    text: 'Switch between Generator, Mixer, History, Export, and Gallery tabs. The Piano toggle opens a playable keyboard below.',
    position: 'bottom',
  },
  {
    target: '#presets-row',
    title: 'Genre & Mood Presets',
    text: 'One-click presets set tonic, scale, tempo, density, swing, voice, and effects. Genre row (Lo-fi, Jazz, Classical...) and Mood row (Chill, Energetic, Dreamy...) give instant starting points.',
    position: 'bottom',
    activateTab: 'generator',
  },
  {
    target: '.gen-grid',
    title: 'Generator Controls',
    text: 'Fine-tune tonic, scale, chord progression, bars, song structure (single/short/full), melody voice, chord voice, contour, and rhythm template.',
    position: 'bottom',
    activateTab: 'generator',
  },
  {
    target: '.gen-seed-row',
    title: 'Seed & Sharing',
    text: 'The seed is the DNA of your song — same seed = same song. Randomize to explore, Share to copy a URL that recreates the exact piece. Save to keep it in your history.',
    position: 'top',
    activateTab: 'generator',
  },
  {
    target: '#panel-mixer',
    title: 'Mixer Console',
    text: 'Per-track volume faders (MEL, CHD, BASS, DRM, CLK) with pan knobs and mute/solo buttons. Reverb presets (Room/Hall/Cathedral), delay, chorus sends. 3-band EQ and master volume. All settings persist across reloads.',
    position: 'bottom',
    activateTab: 'mixer',
  },
  {
    target: '#transport-bar',
    title: 'Transport Bar',
    text: 'Play/pause, stop, record, and click track. Progress bar with time display. Adjust BPM and time signature on the right. Press Space for play/pause.',
    position: 'top',
  },
  {
    target: '#panel-export',
    title: 'Export',
    text: 'Download as multi-track MIDI (Format 1 with separate tracks per instrument) or WAV audio. Preview Clip renders a quick 2-bar snippet.',
    position: 'bottom',
    activateTab: 'export',
  },
  {
    target: '#theme-toggle',
    title: 'Theme & Shortcuts',
    text: 'Toggle dark/light theme. Press ? to see all keyboard shortcuts. Your preferences are saved.',
    position: 'below-fixed',
  },
];

let currentStep = 0;
let backdropEl = null;
let cardEl = null;
let onFinishCb = null;

function createElements() {
  backdropEl = document.createElement('div');
  backdropEl.className = 'onboarding-backdrop';
  backdropEl.addEventListener('click', (e) => {
    if (e.target === backdropEl) next();
  });

  cardEl = document.createElement('div');
  cardEl.className = 'onboarding-card';
  document.body.appendChild(backdropEl);
  document.body.appendChild(cardEl);
}

function cleanup() {
  document.querySelectorAll('.onboarding-spotlight').forEach(el => {
    el.classList.remove('onboarding-spotlight');
    el.style.removeProperty('position');
    el.style.removeProperty('z-index');
  });
}

function activateTab(panelName) {
  const tabBar = document.getElementById('tab-bar');
  if (!tabBar) return;
  for (const t of tabBar.querySelectorAll('[role="tab"]')) {
    t.setAttribute('aria-selected', t.dataset.panel === panelName ? 'true' : 'false');
  }
  for (const p of document.querySelectorAll('.tab-panel')) {
    p.classList.toggle('hidden', p.id !== `panel-${panelName}`);
  }
}

function renderStep() {
  cleanup();
  const step = STEPS[currentStep];

  if (step.activateTab) activateTab(step.activateTab);

  const target = document.querySelector(step.target);

  cardEl.classList.remove('visible');
  cardEl.style.transition = 'opacity 150ms';
  cardEl.style.opacity = '0';

  if (target) {
    target.classList.add('onboarding-spotlight');
    const cs = getComputedStyle(target);
    if (cs.position === 'static') target.style.position = 'relative';
    target.style.zIndex = '201';
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  setTimeout(() => {
    const stepNum = `${currentStep + 1} / ${STEPS.length}`;
    const isFirst = currentStep === 0;
    const isLast = currentStep === STEPS.length - 1;

    const arrow = step.position === 'top' ? 'down' : step.position === 'bottom' ? 'up' : '';
    cardEl.setAttribute('data-arrow', arrow);

    cardEl.innerHTML = `
      <div class="onboarding-step-num">${stepNum}</div>
      <div class="onboarding-title">${step.title}</div>
      <div class="onboarding-text">${step.text}</div>
      <div class="onboarding-progress">
        ${STEPS.map((_, i) => `<span class="onboarding-dot${i === currentStep ? ' active' : i < currentStep ? ' done' : ''}"></span>`).join('')}
      </div>
      <div class="onboarding-actions">
        <button class="onboarding-skip" type="button">Skip tour</button>
        <div class="onboarding-nav">
          ${isFirst ? '' : '<button class="onboarding-prev" type="button">Back</button>'}
          <button class="onboarding-next" type="button">${isLast ? 'Finish' : 'Next'}</button>
        </div>
      </div>
    `;

    cardEl.querySelector('.onboarding-skip').addEventListener('click', finish);
    const prevBtn = cardEl.querySelector('.onboarding-prev');
    if (prevBtn) prevBtn.addEventListener('click', prev);
    cardEl.querySelector('.onboarding-next').addEventListener('click', next);

    positionCard(target, step.position);
    cardEl.style.opacity = '1';
    cardEl.classList.add('visible');
  }, 300);
}

function positionCard(target, position) {
  cardEl.style.removeProperty('top');
  cardEl.style.removeProperty('bottom');
  cardEl.style.removeProperty('left');
  cardEl.style.removeProperty('right');
  cardEl.style.removeProperty('transform');

  if (!target) {
    cardEl.style.top = '50%';
    cardEl.style.left = '50%';
    cardEl.style.transform = 'translate(-50%, -50%)';
    return;
  }

  const rect = target.getBoundingClientRect();
  const cardW = Math.min(380, window.innerWidth - 32);
  const margin = 12;

  if (position === 'below-fixed') {
    cardEl.style.top = `${rect.bottom + margin}px`;
    cardEl.style.right = '16px';
    return;
  }

  let left = rect.left + rect.width / 2 - cardW / 2;
  left = Math.max(16, Math.min(left, window.innerWidth - cardW - 16));
  cardEl.style.left = `${left}px`;
  cardEl.style.width = `${cardW}px`;

  if (position === 'top') {
    const topPos = rect.top + window.scrollY - margin;
    cardEl.style.top = `${topPos}px`;
    cardEl.style.transform = 'translateY(-100%)';
  } else {
    const topPos = rect.bottom + window.scrollY + margin;
    cardEl.style.top = `${topPos}px`;
  }
}

function next() {
  if (currentStep < STEPS.length - 1) {
    currentStep++;
    renderStep();
  } else {
    finish();
  }
}

function prev() {
  if (currentStep > 0) {
    currentStep--;
    renderStep();
  }
}

function finish() {
  cleanup();
  activateTab('generator');
  window.removeEventListener('keydown', handleKeydown);
  backdropEl.remove();
  cardEl.remove();
  backdropEl = null;
  cardEl = null;
  localStorage.setItem(STORAGE_KEY, '1');
  if (onFinishCb) onFinishCb();
}

function handleKeydown(e) {
  if (!backdropEl) return;
  if (e.key === 'Escape') { finish(); e.preventDefault(); }
  if (e.key === 'ArrowRight' || e.key === 'Enter') { next(); e.preventDefault(); }
  if (e.key === 'ArrowLeft') { prev(); e.preventDefault(); }
}

export function startOnboarding({ onFinish } = {}) {
  if (backdropEl) return;
  currentStep = 0;
  onFinishCb = onFinish || null;
  createElements();
  renderStep();
  window.addEventListener('keydown', handleKeydown);
}

export function shouldShowOnboarding() {
  return !localStorage.getItem(STORAGE_KEY);
}
