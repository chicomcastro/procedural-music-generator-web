const STORAGE_KEY = 'seedsong-onboarding-done';

const STEPS = [
  {
    target: '#hero',
    title: 'Welcome to SeedSong',
    text: 'A procedural music generator that creates infinite piano melodies from a single seed number. Let\'s take a quick tour of all the features!',
    position: 'bottom',
  },
  {
    target: '#piano-scroll',
    title: 'Piano Keyboard',
    text: 'Play notes with your mouse, touch, or keyboard. Keys A–J play white notes, W E T Y U play black notes. Press Z/X to shift octave down/up.',
    position: 'bottom',
  },
  {
    target: '#score-section',
    title: 'Score Visualizer',
    text: 'See your melody as a piano roll. Click a bar to lock it — locked bars survive when you regenerate. Drag notes to rearrange them.',
    position: 'bottom',
  },
  {
    target: '.player-transport',
    title: 'Player Controls',
    text: 'Play/pause, stop, and seek through the song. The progress bar is clickable — jump to any point in the loop. You can also press Space to toggle playback.',
    position: 'bottom',
  },
  {
    target: '#metronome > :nth-child(3)',
    title: 'Tempo & Time Signature',
    text: 'Adjust the BPM (40–240) and time signature (2/4, 3/4, 4/4, 6/8). The beat indicator pulses on each beat, with accent on the downbeat.',
    position: 'bottom',
  },
  {
    target: '#metronome > :nth-child(4)',
    title: 'Click Track & Recording',
    text: 'Toggle the metronome click and the procedural music. Hit Rec to record your own keyboard notes into the melody — they replace existing melody notes.',
    position: 'bottom',
  },
  {
    target: '#mixer',
    title: 'Mixer Console',
    text: 'Control volume for each track (melody, chords, bass, drums) with vertical faders. Mute individual tracks with the M button. Adjust reverb/delay sends, 3-band EQ, and master volume.',
    position: 'bottom',
  },
  {
    target: '#presets-row',
    title: 'Style Presets',
    text: 'Quick-load genre presets: Lo-fi, Jazz, Classical, Blues, Dark, Funk. Each sets the BPM, scale, density, swing, and other parameters to match the style.',
    position: 'bottom',
  },
  {
    target: '#generator > :nth-child(3)',
    title: 'Tonic, Scale, Bars & Voice',
    text: 'Choose the root note (tonic), musical scale (major, minor, dorian, blues...), loop length in bars, and instrument voice (piano, synth pad, pluck, bass, organ, strings).',
    position: 'bottom',
  },
  {
    target: '#generator > :nth-child(4)',
    title: 'Transpose',
    text: 'Shift all notes up or down by semitones (-24 to +24). Useful for matching a key or finding a sweeter register.',
    position: 'bottom',
  },
  {
    target: '#generator > :nth-child(5)',
    title: 'Density, Swing & Velocity',
    text: 'Density controls how many notes per bar. Swing adds groovy off-beat timing. Velocity sets note loudness — softer notes also get a darker timbre.',
    position: 'bottom',
  },
  {
    target: '#generator > :nth-child(6)',
    title: 'Seed & Sharing',
    text: 'The seed number is the DNA of your melody — same seed = same song. Randomize to explore, or type a number to reproduce. Share copies a URL that recreates the exact same song.',
    position: 'top',
  },
  {
    target: '#save-section',
    title: 'Save Your Melodies',
    text: 'Give your melody a name and save it to browser storage. Unsaved changes show a warning. All data stays local — nothing is sent to a server.',
    position: 'bottom',
  },
  {
    target: '#history',
    title: 'History',
    text: 'All saved melodies appear here. Load, rename, or delete entries. Use "Clear all" to start fresh.',
    position: 'top',
  },
  {
    target: '#export',
    title: 'Export',
    text: 'Download your song as MIDI (for any DAW) or WAV (audio file). Preview Clip renders a quick 2-bar audio snippet you can listen to instantly.',
    position: 'top',
  },
  {
    target: '#gallery',
    title: 'Gallery',
    text: 'A curated collection of community seeds. Click any card to load its settings — a great starting point for exploration.',
    position: 'top',
  },
  {
    target: '#theme-toggle',
    title: 'Theme & Shortcuts',
    text: 'Toggle between dark and light themes. Press ? or click the help button next to it to see all keyboard shortcuts. Your theme preference is saved.',
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

function renderStep() {
  cleanup();
  const step = STEPS[currentStep];
  const target = document.querySelector(step.target);

  // Fade the card out before repositioning
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

  // Wait for scroll to settle, then reposition and fade in
  setTimeout(() => {
    const stepNum = `${currentStep + 1} / ${STEPS.length}`;
    const isFirst = currentStep === 0;
    const isLast = currentStep === STEPS.length - 1;

    // Set data-arrow attribute based on position
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
