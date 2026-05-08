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

/* ---- Sheet music (lazy OSMD) ---- */

let osmdLoading = null;
let exerciseOSMD = null;

function loadOSMD() {
  if (window.opensheetmusicdisplay) return Promise.resolve();
  if (osmdLoading) return osmdLoading;
  osmdLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.6/build/opensheetmusicdisplay.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load OSMD'));
    document.head.appendChild(script);
  });
  return osmdLoading;
}

const PITCH_STEPS = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
const PITCH_ALTERS = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];

function midiToPitchXml(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const step = PITCH_STEPS[pc];
  const alter = PITCH_ALTERS[pc];
  const alterTag = alter ? `<alter>${alter}</alter>` : '';
  return `<step>${step}</step>${alterTag}<octave>${octave}</octave>`;
}

function buildMusicXMLFor(module) {
  // Default: quarter notes, 4/4 time, treble clef
  const measures = [];
  const notes = module.notes;
  const beatsPerMeasure = 4;
  let currentMeasure = [];
  let beatsInMeasure = 0;

  function flushMeasure(force) {
    if (currentMeasure.length === 0 && !force) return;
    measures.push(currentMeasure.join(''));
    currentMeasure = [];
    beatsInMeasure = 0;
  }

  function pushQuarter(midi, isChordMember = false) {
    const chordTag = isChordMember ? '<chord/>' : '';
    currentMeasure.push(`<note>${chordTag}<pitch>${midiToPitchXml(midi)}</pitch><duration>1</duration><type>quarter</type></note>`);
  }

  if (module.style === 'chord' && Array.isArray(notes) && typeof notes[0] === 'number') {
    // Single chord — one whole note per pitch (chorded)
    const sorted = [...notes].sort((a, b) => a - b);
    sorted.forEach((m, i) => {
      const chordTag = i > 0 ? '<chord/>' : '';
      currentMeasure.push(`<note>${chordTag}<pitch>${midiToPitchXml(m)}</pitch><duration>4</duration><type>whole</type></note>`);
    });
    flushMeasure(true);
  } else if (module.style === 'progression' && Array.isArray(notes) && Array.isArray(notes[0])) {
    // Each chord = one whole note in its own measure
    for (const chord of notes) {
      currentMeasure = [];
      const sorted = [...chord].sort((a, b) => a - b);
      sorted.forEach((m, i) => {
        const chordTag = i > 0 ? '<chord/>' : '';
        currentMeasure.push(`<note>${chordTag}<pitch>${midiToPitchXml(m)}</pitch><duration>4</duration><type>whole</type></note>`);
      });
      measures.push(currentMeasure.join(''));
    }
  } else {
    // Melody/rhythm: quarters
    for (const note of notes) {
      if (Array.isArray(note)) {
        // chord-as-quarter
        const sorted = [...note].sort((a, b) => a - b);
        sorted.forEach((m, i) => pushQuarter(m, i > 0));
      } else {
        pushQuarter(note);
      }
      beatsInMeasure += 1;
      if (beatsInMeasure >= beatsPerMeasure) flushMeasure();
    }
    if (beatsInMeasure > 0) {
      // Pad with rests
      while (beatsInMeasure < beatsPerMeasure) {
        currentMeasure.push('<note><rest/><duration>1</duration><type>quarter</type></note>');
        beatsInMeasure += 1;
      }
      flushMeasure(true);
    }
  }

  const measuresXml = measures.map((m, i) => `
    <measure number="${i + 1}">
      ${i === 0 ? `<attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>` : ''}
      ${m}
    </measure>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>${module.title}</part-name></score-part>
  </part-list>
  <part id="P1">${measuresXml}</part>
</score-partwise>`;
}

async function renderExerciseSheet(module) {
  const container = document.getElementById('exercise-sheet');
  if (!container) return;
  container.textContent = '';
  container.classList.add('exercise-sheet-loading');
  try {
    await loadOSMD();
    if (!window.opensheetmusicdisplay) throw new Error('OSMD not available');
    if (!exerciseOSMD || exerciseOSMD.container !== container) {
      exerciseOSMD = new window.opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
        backend: 'svg',
        autoResize: true,
        drawTitle: false,
        drawSubtitle: false,
        drawComposer: false,
        drawLyricist: false,
        drawPartNames: false,
        drawPartAbbreviations: false,
      });
      exerciseOSMD.container = container;
    }
    const xml = buildMusicXMLFor(module);
    await exerciseOSMD.load(xml);
    exerciseOSMD.render();
  } catch {
    container.textContent = 'Sheet music unavailable.';
  } finally {
    container.classList.remove('exercise-sheet-loading');
  }
}

/* ---- Pitch detection (autocorrelation) ---- */

let pitchAudioCtx = null;
let pitchAnalyser = null;
let pitchBuf = null;
let pitchStream = null;
let pitchRafId = null;
let pitchTargetSequence = [];
let pitchTargetIdx = 0;
let pitchSustainStart = 0;
let pitchSustainNote = null;
const PITCH_SUSTAIN_MS = 400;

function autoCorrelatePitch(buffer, sampleRate) {
  let SIZE = buffer.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; // silence
  let r1 = 0, r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  buffer = buffer.slice(r1, r2);
  SIZE = buffer.length;
  const c = new Array(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE - i; j++) c[i] += buffer[j] * buffer[j + i];
  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  let T0 = maxpos;
  if (T0 === 0) return -1;
  const x1 = c[T0 - 1] || 0, x2 = c[T0], x3 = c[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);
  return sampleRate / T0;
}

function freqToMidi(freq) {
  if (freq <= 0) return -1;
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

function midiToName(midi) {
  if (midi < 0) return '—';
  const oct = Math.floor(midi / 12) - 1;
  return `${PITCH_STEPS[((midi % 12) + 12) % 12]}${PITCH_ALTERS[((midi % 12) + 12) % 12] ? '#' : ''}${oct}`;
}

async function startPitchDetection(module) {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  if (!window.AudioContext) return false;
  try {
    pitchStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch { return false; }
  pitchAudioCtx = new window.AudioContext();
  const source = pitchAudioCtx.createMediaStreamSource(pitchStream);
  pitchAnalyser = pitchAudioCtx.createAnalyser();
  pitchAnalyser.fftSize = 2048;
  pitchBuf = new Float32Array(pitchAnalyser.fftSize);
  source.connect(pitchAnalyser);

  // Build flat target sequence (octave-agnostic — match by pitch class)
  pitchTargetSequence = [];
  if (module.style === 'progression' && Array.isArray(module.notes[0])) {
    for (const chord of module.notes) for (const m of chord) pitchTargetSequence.push(m);
  } else if (module.style === 'chord') {
    pitchTargetSequence = [...module.notes];
  } else {
    pitchTargetSequence = module.notes.flat();
  }
  pitchTargetIdx = 0;
  pitchSustainStart = 0;
  pitchSustainNote = null;
  const panel = document.getElementById('exercise-pitch');
  if (panel) panel.hidden = false;
  updatePitchTarget();
  pitchLoop();
  return true;
}

function updatePitchTarget() {
  const target = pitchTargetSequence[pitchTargetIdx];
  const targetEl = document.getElementById('exercise-pitch-target');
  const fill = document.getElementById('exercise-pitch-fill');
  if (targetEl) targetEl.textContent = target == null ? '🎉' : midiToName(target);
  if (fill) {
    const pct = pitchTargetSequence.length === 0 ? 0 : Math.round((pitchTargetIdx / pitchTargetSequence.length) * 100);
    fill.style.width = `${pct}%`;
  }
}

function setPitchStatus(text, kind) {
  const el = document.getElementById('exercise-pitch-status');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('match', 'miss', 'idle');
  if (kind) el.classList.add(kind);
}

function pitchLoop() {
  if (!pitchAnalyser || !pitchAudioCtx) return;
  pitchAnalyser.getFloatTimeDomainData(pitchBuf);
  const freq = autoCorrelatePitch(pitchBuf, pitchAudioCtx.sampleRate);
  const midi = freqToMidi(freq);
  const cur = document.getElementById('exercise-pitch-current');
  if (cur) cur.textContent = midi > 0 ? midiToName(midi) : '—';

  const target = pitchTargetSequence[pitchTargetIdx];
  if (target != null && midi > 0) {
    const targetPC = ((target % 12) + 12) % 12;
    const heardPC = ((midi % 12) + 12) % 12;
    if (targetPC === heardPC) {
      if (pitchSustainNote === heardPC) {
        if (Date.now() - pitchSustainStart >= PITCH_SUSTAIN_MS) {
          pitchTargetIdx++;
          updatePitchTarget();
          if (pitchTargetIdx >= pitchTargetSequence.length) {
            setPitchStatus('Nailed it 🎉', 'match');
          } else {
            setPitchStatus('✓ matched', 'match');
          }
          pitchSustainNote = null;
          pitchSustainStart = 0;
        } else {
          setPitchStatus('Hold…', 'match');
        }
      } else {
        pitchSustainNote = heardPC;
        pitchSustainStart = Date.now();
        setPitchStatus('Hold…', 'match');
      }
    } else {
      pitchSustainNote = null;
      pitchSustainStart = 0;
      setPitchStatus(`Try ${midiToName(target)}`, 'miss');
    }
  } else if (target != null) {
    setPitchStatus('listening…', 'idle');
  }

  pitchRafId = requestAnimationFrame(pitchLoop);
}

function stopPitchDetection() {
  if (pitchRafId) { cancelAnimationFrame(pitchRafId); pitchRafId = null; }
  if (pitchStream) { pitchStream.getTracks().forEach(t => t.stop()); pitchStream = null; }
  if (pitchAudioCtx) { try { pitchAudioCtx.close(); } catch {} pitchAudioCtx = null; }
  pitchAnalyser = null;
  pitchBuf = null;
  const panel = document.getElementById('exercise-pitch');
  if (panel) panel.hidden = true;
}

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
  setPitchStatus('listening…', 'idle');
  document.getElementById('exercise-pitch').hidden = true;
  overlay.classList.remove('hidden');
  renderExerciseSheet(m);
}

function closeExercise() {
  stopAllNotes();
  stopRecording(false);
  stopPitchDetection();
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
    stopPitchDetection();
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
    setRecordHint('Recording + listening for pitch — tap again to stop.');
    // Kick off pitch detection in parallel (separate stream so we can stop independently)
    if (activeIndex >= 0) startPitchDetection(MODULES[activeIndex]);
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
