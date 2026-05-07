const STORAGE_KEY = 'seedsong-learn-progress';

const MODULES = [
  {
    id: 'major-scale',
    tag: 'Theory · Scales',
    title: 'The Major Scale',
    description: 'The brightest scale family. Built from a fixed pattern of whole and half steps (W-W-H-W-W-W-H). Hear it played from C.',
    notes: [60, 62, 64, 65, 67, 69, 71, 72],
    style: 'melody',
  },
  {
    id: 'natural-minor',
    tag: 'Theory · Scales',
    title: 'The Natural Minor Scale',
    description: 'The melancholic counterpart to major. Same notes as A minor, played here from A.',
    notes: [69, 71, 72, 74, 76, 77, 79, 81],
    style: 'melody',
  },
  {
    id: 'pentatonic-minor',
    tag: 'Theory · Scales',
    title: 'Pentatonic Minor',
    description: 'Five-note scale that anchors blues, rock and pop solos. Skips the half steps for a smoother feel.',
    notes: [69, 72, 74, 76, 79, 81],
    style: 'melody',
  },
  {
    id: 'major-triad',
    tag: 'Theory · Chords',
    title: 'Major Triad',
    description: 'Three notes (root, major 3rd, perfect 5th) that produce the bright "happy" chord sound. C – E – G.',
    notes: [60, 64, 67],
    style: 'chord',
  },
  {
    id: 'minor-triad',
    tag: 'Theory · Chords',
    title: 'Minor Triad',
    description: 'Same idea as major but with a flatted 3rd. Darker, more contemplative. A – C – E.',
    notes: [69, 72, 76],
    style: 'chord',
  },
  {
    id: 'cadence-I-V-vi-IV',
    tag: 'Harmony · Progressions',
    title: 'I–V–vi–IV',
    description: 'The most popular progression in modern pop. Hear all four chords in C major.',
    notes: [
      [60, 64, 67],
      [67, 71, 74],
      [69, 72, 76],
      [65, 69, 72],
    ],
    style: 'progression',
  },
  {
    id: 'reading-rhythms',
    tag: 'Reading',
    title: 'Quarters, eighths and rests',
    description: 'Hear and feel the difference between a steady quarter pulse, syncopated eighths, and breathing rests.',
    notes: [60, 60, 60, 60, 62, 64, 60, 64, 67],
    style: 'rhythm',
  },
];

function readProgress() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []); }
  catch { return new Set(); }
}

function writeProgress(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

let progress = new Set();

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

async function playSequence(notes, audioApi, style = 'melody') {
  if (!audioApi) return;
  try { await audioApi.ensureInit(); } catch {}
  const ctx = audioApi.getContext();
  if (!ctx) return;
  const dest = audioApi.getTrackDest(style === 'chord' ? 'chord' : 'melody') || audioApi.getMasterGain();
  const startTime = ctx.currentTime + 0.05;

  if (style === 'chord' && Array.isArray(notes) && typeof notes[0] === 'number') {
    // single chord — play simultaneously
    for (const m of notes) playOneNote(ctx, dest, m, startTime, 1.4, 'triangle', 0.06);
    return;
  }

  if (style === 'progression') {
    let t = startTime;
    for (const chord of notes) {
      for (const m of chord) playOneNote(ctx, dest, m, t, 1.0, 'triangle', 0.06);
      t += 1.1;
    }
    return;
  }

  // Default: arpeggiated melody
  const stepDur = style === 'rhythm' ? 0.35 : 0.42;
  for (let i = 0; i < notes.length; i++) {
    playOneNote(ctx, dest, notes[i], startTime + i * stepDur, stepDur * 0.85, 'sine', 0.10);
  }
}

function playOneNote(ctx, dest, midi, when, dur, wave = 'sine', vel = 0.1) {
  const freq = midiToFreq(midi);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(vel, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(gain).connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

function updateProgress() {
  const pct = Math.round((progress.size / MODULES.length) * 100);
  const fill = document.getElementById('learn-progress-fill');
  const lbl = document.getElementById('learn-progress-pct');
  if (fill) fill.style.width = `${pct}%`;
  if (lbl) lbl.textContent = `${pct}%`;
}

function render(audioApi) {
  const root = document.getElementById('learn-modules');
  if (!root) return;
  root.innerHTML = '';
  for (const m of MODULES) {
    const done = progress.has(m.id);
    const card = document.createElement('div');
    card.className = `learn-card${done ? ' completed' : ''}`;
    card.dataset.id = m.id;
    card.innerHTML = `
      <span class="learn-card-tag">${m.tag}</span>
      <h3 class="learn-card-title">${m.title}</h3>
      <p class="learn-card-desc">${m.description}</p>
      <div class="learn-card-footer">
        <span class="learn-card-status${done ? ' done' : ''}">${done ? '✓ Completed' : 'Tap card to listen'}</span>
        <button class="learn-card-cta" data-action="${done ? 'reset' : 'complete'}" type="button">${done ? 'Replay' : 'Mark done'}</button>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.learn-card-cta')) return;
      playSequence(m.notes, audioApi, m.style);
    });
    card.querySelector('.learn-card-cta')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = e.target.dataset.action;
      if (action === 'complete') progress.add(m.id);
      else if (action === 'reset') {
        playSequence(m.notes, audioApi, m.style);
        return;
      }
      writeProgress(progress);
      updateProgress();
      render(audioApi);
    });
    root.appendChild(card);
  }
  updateProgress();
}

export function initLearnView({ audioApi }) {
  progress = readProgress();
  render(audioApi);
}
