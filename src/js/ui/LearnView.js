const STORAGE_KEY = 'seedsong-learn-progress';
const RECORDINGS_KEY = 'seedsong-learn-recordings';
const STREAK_KEY = 'seedsong-learn-streak';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readStreak() {
  try {
    const v = JSON.parse(localStorage.getItem(STREAK_KEY)) || {};
    return { current: v.current || 0, best: v.best || 0, lastDay: v.lastDay || null };
  } catch { return { current: 0, best: 0, lastDay: null }; }
}

function writeStreak(s) { localStorage.setItem(STREAK_KEY, JSON.stringify(s)); }

function bumpStreak() {
  const today = todayKey();
  const s = readStreak();
  if (s.lastDay === today) return s;
  if (s.lastDay) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    s.current = s.lastDay === yKey ? s.current + 1 : 1;
  } else {
    s.current = 1;
  }
  s.best = Math.max(s.best, s.current);
  s.lastDay = today;
  writeStreak(s);
  return s;
}

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
function writeProgress(set) { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); }

function readRecordings() {
  try { return JSON.parse(localStorage.getItem(RECORDINGS_KEY)) || {}; }
  catch { return {}; }
}
function writeRecordings(map) { localStorage.setItem(RECORDINGS_KEY, JSON.stringify(map)); }

let progress = new Set();
let audioApiRef = null;
let activeIndex = -1;

let activeOscillators = [];
let mediaRecorder = null;
let recordedChunks = [];
let recordingObjectUrl = null;

function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

function playOneNote(ctx, dest, midi, when, dur, wave = 'sine', vel = 0.1) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.value = midiToFreq(midi);
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(vel, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(gain).connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.05);
  activeOscillators.push(osc);
}

async function playSequence(notes, style = 'melody') {
  if (!audioApiRef) return;
  stopAllNotes();
  try { await audioApiRef.ensureInit(); } catch {}
  const ctx = audioApiRef.getContext();
  if (!ctx) return;
  const dest = audioApiRef.getTrackDest(style === 'chord' ? 'chord' : 'melody') || audioApiRef.getMasterGain();
  const startTime = ctx.currentTime + 0.05;

  if (style === 'chord' && Array.isArray(notes) && typeof notes[0] === 'number') {
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
  const stepDur = style === 'rhythm' ? 0.35 : 0.42;
  for (let i = 0; i < notes.length; i++) {
    playOneNote(ctx, dest, notes[i], startTime + i * stepDur, stepDur * 0.85, 'sine', 0.10);
  }
}

function stopAllNotes() {
  for (const osc of activeOscillators) {
    try { osc.stop(); } catch {}
  }
  activeOscillators = [];
}

function updateProgress() {
  const pct = Math.round((progress.size / MODULES.length) * 100);
  const fill = document.getElementById('learn-progress-fill');
  const lbl = document.getElementById('learn-progress-pct');
  if (fill) fill.style.width = `${pct}%`;
  if (lbl) lbl.textContent = `${pct}%`;
  updateStreakUI();
}

function updateStreakUI() {
  const s = readStreak();
  const cur = document.getElementById('learn-streak-current');
  const best = document.getElementById('learn-streak-best');
  const wrap = document.getElementById('learn-streak');
  if (cur) cur.textContent = String(s.current);
  if (best) best.textContent = String(s.best);
  if (wrap) {
    wrap.classList.toggle('learn-streak-active', s.current > 0);
    if (s.lastDay === todayKey()) wrap.classList.add('learn-streak-today');
    else wrap.classList.remove('learn-streak-today');
  }
}

function nextIncompleteIndex(from = 0) {
  for (let i = from; i < MODULES.length; i++) {
    if (!progress.has(MODULES[i].id)) return i;
  }
  return -1;
}

function renderContinueCard() {
  const card = document.getElementById('learn-continue');
  if (!card) return;
  const idx = nextIncompleteIndex();
  if (idx < 0) {
    card.hidden = true;
    return;
  }
  const m = MODULES[idx];
  card.hidden = false;
  document.getElementById('learn-continue-title').textContent = m.title;
  document.getElementById('learn-continue-desc').textContent = m.description;
  card.dataset.targetIndex = String(idx);
}

function renderCards() {
  const root = document.getElementById('learn-modules');
  if (!root) return;
  root.innerHTML = '';
  for (let i = 0; i < MODULES.length; i++) {
    const m = MODULES[i];
    const done = progress.has(m.id);
    const card = document.createElement('div');
    card.className = `learn-card${done ? ' completed' : ''}`;
    card.dataset.id = m.id;
    card.dataset.index = String(i);
    card.tabIndex = 0;
    card.innerHTML = `
      <span class="learn-card-tag">${m.tag}</span>
      <h3 class="learn-card-title">${m.title}</h3>
      <p class="learn-card-desc">${m.description}</p>
      <div class="learn-card-footer">
        <span class="learn-card-status${done ? ' done' : ''}">${done ? '✓ Completed' : 'Tap to open'}</span>
        <span class="learn-card-cta">${done ? 'Replay →' : 'Open →'}</span>
      </div>
    `;
    card.addEventListener('click', () => openExercise(i));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openExercise(i);
      }
    });
    root.appendChild(card);
  }
  updateProgress();
}

/* ---- Exercise modal ---- */

function openExercise(index) {
  if (index < 0 || index >= MODULES.length) return;
  activeIndex = index;
  const m = MODULES[index];
  const overlay = document.getElementById('learn-exercise-overlay');
  if (!overlay) return;
  document.getElementById('exercise-progress').textContent = `${index + 1} / ${MODULES.length}`;
  document.getElementById('exercise-tag').textContent = m.tag;
  document.getElementById('exercise-title').textContent = m.title;
  document.getElementById('exercise-desc').textContent = m.description;
  const doneBtn = document.getElementById('exercise-done');
  if (doneBtn) {
    doneBtn.textContent = progress.has(m.id) ? '✓ Already done — Next →' : 'Mark done →';
  }
  attachRecording(m.id);
  overlay.classList.remove('hidden');
}

function closeExercise() {
  stopAllNotes();
  stopRecording(false);
  const overlay = document.getElementById('learn-exercise-overlay');
  if (overlay) overlay.classList.add('hidden');
  if (recordingObjectUrl) {
    URL.revokeObjectURL(recordingObjectUrl);
    recordingObjectUrl = null;
  }
}

function advanceExercise(markDone) {
  if (activeIndex < 0) return;
  const m = MODULES[activeIndex];
  if (markDone) {
    progress.add(m.id);
    bumpStreak();
  }
  writeProgress(progress);
  updateProgress();
  renderContinueCard();
  renderCards();
  const next = nextIncompleteIndex(activeIndex + 1);
  const nextWrap = next < 0 ? nextIncompleteIndex(0) : next;
  if (nextWrap < 0) {
    closeExercise();
    return;
  }
  openExercise(nextWrap);
}

function attachRecording(moduleId) {
  const audio = document.getElementById('exercise-recording');
  const recordings = readRecordings();
  if (audio && recordings[moduleId]) {
    audio.src = recordings[moduleId];
    audio.hidden = false;
  } else if (audio) {
    audio.removeAttribute('src');
    audio.hidden = true;
  }
}

async function toggleRecording(moduleId) {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    setRecordHint('Recording not supported in this browser.');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new window.MediaRecorder(stream);
    mediaRecorder.addEventListener('dataavailable', (e) => { if (e.data.size > 0) recordedChunks.push(e.data); });
    mediaRecorder.addEventListener('stop', async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      const dataUrl = await blobToDataUrl(blob);
      const recordings = readRecordings();
      recordings[moduleId] = dataUrl;
      writeRecordings(recordings);
      attachRecording(moduleId);
      setRecordingUI(false);
      setRecordHint('Saved! Play back above or re-record.');
    });
    mediaRecorder.start();
    setRecordingUI(true);
    setRecordHint('Recording… tap again to stop.');
  } catch (_err) {
    setRecordHint('Microphone access denied.');
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function stopRecording() {
  try { if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop(); } catch {}
  setRecordingUI(false);
}

function setRecordingUI(recording) {
  const btn = document.getElementById('exercise-record');
  const lbl = btn?.querySelector('.exercise-record-label');
  if (!btn) return;
  btn.classList.toggle('recording', recording);
  if (lbl) lbl.textContent = recording ? 'Stop' : 'Record';
}

function setRecordHint(text) {
  const el = document.getElementById('exercise-record-hint');
  if (el) el.textContent = text;
}

/* ---- Init ---- */

export function initLearnView({ audioApi }) {
  audioApiRef = audioApi;
  progress = readProgress();

  renderCards();
  renderContinueCard();

  const continueBtn = document.getElementById('learn-continue-btn');
  const continueCard = document.getElementById('learn-continue');
  continueBtn?.addEventListener('click', () => {
    const idx = Number(continueCard?.dataset.targetIndex || '0');
    openExercise(idx);
  });

  document.getElementById('exercise-close')?.addEventListener('click', closeExercise);
  document.getElementById('exercise-play')?.addEventListener('click', () => {
    if (activeIndex < 0) return;
    const m = MODULES[activeIndex];
    playSequence(m.notes, m.style);
  });
  document.getElementById('exercise-record')?.addEventListener('click', () => {
    if (activeIndex < 0) return;
    toggleRecording(MODULES[activeIndex].id);
  });
  document.getElementById('exercise-done')?.addEventListener('click', () => advanceExercise(true));
  document.getElementById('exercise-skip')?.addEventListener('click', () => advanceExercise(false));

  document.getElementById('learn-exercise-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'learn-exercise-overlay') closeExercise();
  });
  document.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('learn-exercise-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeExercise();
    else if (e.key === ' ') { e.preventDefault(); document.getElementById('exercise-play')?.click(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); advanceExercise(true); }
  });
}
