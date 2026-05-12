import { MODULES, GROUPS } from './learn-modules.js';
import { t, onLangChange } from '../i18n/i18n.js';

const PROGRESS_KEY = 'seedsong-learn-progress-v2';
const RECORDINGS_KEY = 'seedsong-learn-recordings';
const STREAK_KEY = 'seedsong-learn-streak';

/* ---- Streak ---- */
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

/* ---- Progress (per-step) ---- */
// Shape: { [moduleId]: number[] } — array of completed step indices.
function readProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return migrateLegacyProgress();
    return JSON.parse(raw) || {};
  } catch { return {}; }
}
function migrateLegacyProgress() {
  // Pick up the v1 module-level progress if present.
  try {
    const v1 = JSON.parse(localStorage.getItem('seedsong-learn-progress')) || [];
    if (!Array.isArray(v1) || v1.length === 0) return {};
    const out = {};
    for (const moduleId of v1) {
      const m = MODULES.find(mm => mm.id === moduleId);
      if (m) out[moduleId] = m.steps.map((_, i) => i);
    }
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(out));
    return out;
  } catch { return {}; }
}
function writeProgress(p) { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); }

let progress = {};

function moduleStepsDone(modId) { return new Set(progress[modId] || []); }
function moduleIsComplete(mod) {
  const done = moduleStepsDone(mod.id);
  return mod.steps.every((_, i) => done.has(i));
}
function nextIncompleteModuleIndex(from = 0) {
  for (let i = from; i < MODULES.length; i++) {
    if (!moduleIsComplete(MODULES[i])) return i;
  }
  return -1;
}
function nextIncompleteStepIndex(mod) {
  const done = moduleStepsDone(mod.id);
  for (let i = 0; i < mod.steps.length; i++) {
    if (!done.has(i)) return i;
  }
  return mod.steps.length - 1;
}
function markStepDone(modId, stepIndex) {
  const arr = progress[modId] || [];
  if (!arr.includes(stepIndex)) {
    progress[modId] = [...arr, stepIndex].sort((a, b) => a - b);
    writeProgress(progress);
    bumpStreak();
  }
}

function moduleProgressPct(mod) {
  const done = moduleStepsDone(mod.id);
  return Math.round((done.size / mod.steps.length) * 100);
}
function totalCompletedModules() {
  return MODULES.filter(moduleIsComplete).length;
}
function totalProgressPct() {
  return Math.round((totalCompletedModules() / MODULES.length) * 100);
}

/* ---- Recordings ---- */
function readRecordings() {
  try { return JSON.parse(localStorage.getItem(RECORDINGS_KEY)) || {}; }
  catch { return {}; }
}
function writeRecordings(map) { localStorage.setItem(RECORDINGS_KEY, JSON.stringify(map)); }

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

const CLEFS = {
  treble: '<clef><sign>G</sign><line>2</line></clef>',
  bass: '<clef><sign>F</sign><line>4</line></clef>',
  alto: '<clef><sign>C</sign><line>3</line></clef>',
};

function buildMusicXMLFor(step, opts) {
  const beatsPerMeasure = 4;
  const measures = [];
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

  const notes = step.notes;
  if (step.style === 'chord' && Array.isArray(notes) && typeof notes[0] === 'number') {
    const sorted = [...notes].sort((a, b) => a - b);
    sorted.forEach((m, i) => {
      const chordTag = i > 0 ? '<chord/>' : '';
      currentMeasure.push(`<note>${chordTag}<pitch>${midiToPitchXml(m)}</pitch><duration>4</duration><type>whole</type></note>`);
    });
    flushMeasure(true);
  } else if (step.style === 'progression' && Array.isArray(notes) && Array.isArray(notes[0])) {
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
    for (const note of notes) {
      if (Array.isArray(note)) {
        const sorted = [...note].sort((a, b) => a - b);
        sorted.forEach((m, i) => pushQuarter(m, i > 0));
      } else {
        pushQuarter(note);
      }
      beatsInMeasure += 1;
      if (beatsInMeasure >= beatsPerMeasure) flushMeasure();
    }
    if (beatsInMeasure > 0) {
      while (beatsInMeasure < beatsPerMeasure) {
        currentMeasure.push('<note><rest/><duration>1</duration><type>quarter</type></note>');
        beatsInMeasure += 1;
      }
      flushMeasure(true);
    }
  }

  const clefXml = CLEFS[opts.clef] || CLEFS.treble;
  const measuresXml = measures.map((m, i) => `
    <measure number="${i + 1}">
      ${i === 0 ? `<attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        ${clefXml}
      </attributes>` : ''}
      ${m}
    </measure>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>${escapeText(step.title || '')}</part-name></score-part>
  </part-list>
  <part id="P1">${measuresXml}</part>
</score-partwise>`;
}

function escapeText(s) {
  return String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

/* ---- Theory diagrams ---- */
// Supported shapes:
//   { type: 'intervals', steps: ['W','W','H',...], labels: ['1','2','3',...] }
//   { type: 'keyboard', highlight: [60, 62, 64,...], range: [60, 72] }
//   { type: 'progression', chords: ['I','V','vi','IV'], romans: true }
//   { type: 'stack', notes: ['C','E','G','B'], labels: ['1','3','5','7'] }
function renderDiagram(d) {
  if (!d || !d.type) return '';
  if (d.type === 'intervals') return renderIntervalsDiagram(d);
  if (d.type === 'keyboard') return renderKeyboardDiagram(d);
  if (d.type === 'progression') return renderProgressionDiagram(d);
  if (d.type === 'stack') return renderStackDiagram(d);
  return '';
}

function renderIntervalsDiagram({ steps = [], labels = [] }) {
  const items = labels.map((l, i) => `
    <span class="diag-degree">${l}</span>
    ${i < steps.length ? `<span class="diag-step ${steps[i] === 'H' ? 'diag-half' : 'diag-whole'}">${steps[i]}</span>` : ''}
  `).join('');
  return `<div class="theory-diagram theory-intervals" aria-hidden="true">${items}</div>`;
}

function renderKeyboardDiagram({ highlight = [], range = [60, 72] }) {
  const [from, to] = range;
  const set = new Set(highlight);
  const whitePcs = [0, 2, 4, 5, 7, 9, 11];
  const blackPcs = [1, 3, 6, 8, 10];
  const whites = [];
  const blacks = [];
  for (let m = from; m <= to; m++) {
    const pc = ((m % 12) + 12) % 12;
    const hl = set.has(m);
    const isC = pc === 0;
    if (whitePcs.includes(pc)) {
      whites.push(`<div class="diag-key diag-white${hl ? ' hl' : ''}${isC ? ' diag-c' : ''}" data-midi="${m}">${isC ? `<span class="diag-c-label">C${Math.floor(m / 12) - 1}</span>` : ''}</div>`);
    }
  }
  // black keys positioned absolutely
  let whiteIndex = 0;
  for (let m = from; m <= to; m++) {
    const pc = ((m % 12) + 12) % 12;
    if (whitePcs.includes(pc)) whiteIndex++;
    if (blackPcs.includes(pc)) {
      const left = (whiteIndex - 0.3) * (100 / (whites.length || 1));
      const hl = set.has(m);
      blacks.push(`<div class="diag-key diag-black${hl ? ' hl' : ''}" style="left:${left}%" data-midi="${m}"></div>`);
    }
  }
  return `<div class="theory-diagram theory-keyboard" aria-hidden="true">
    <div class="diag-keys-white">${whites.join('')}</div>
    <div class="diag-keys-black">${blacks.join('')}</div>
  </div>`;
}

function renderProgressionDiagram({ chords = [] }) {
  const items = chords.map(c => `<span class="diag-chord">${c}</span>`).join('<span class="diag-arrow">→</span>');
  return `<div class="theory-diagram theory-progression" aria-hidden="true">${items}</div>`;
}

function renderStackDiagram({ notes = [], labels = [] }) {
  const rows = notes.slice().reverse().map((n, idx) => {
    const realIdx = notes.length - 1 - idx;
    return `<div class="diag-stack-row">
      <span class="diag-stack-degree">${labels[realIdx] || ''}</span>
      <span class="diag-stack-note">${n}</span>
    </div>`;
  }).join('');
  return `<div class="theory-diagram theory-stack" aria-hidden="true">${rows}</div>`;
}

function transposeNotes(notes, semitones, octaveShift) {
  const totalShift = semitones + octaveShift * 12;
  if (!notes || totalShift === 0) return notes;
  const apply = (n) => Array.isArray(n) ? n.map(x => x + totalShift) : n + totalShift;
  if (Array.isArray(notes) && Array.isArray(notes[0])) {
    return notes.map(c => c.map(m => m + totalShift));
  }
  return notes.map(apply);
}

async function renderExerciseSheet(step, opts) {
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
    const xnotes = transposeNotes(step.notes, opts.transpose, opts.octaveShift);
    const stepForSheet = { ...step, notes: xnotes };
    const xml = buildMusicXMLFor(stepForSheet, opts);
    await exerciseOSMD.load(xml);
    container.classList.remove('exercise-sheet-loading');

    // OSMD renders into the container at its current width, so we wait one
    // frame for layout to settle (the container may have just been un-hidden
    // when transitioning from theory to exercise) and re-render once if the
    // width was still 0.
    const doRender = () => {
      try { exerciseOSMD.render(); } catch (_e) { /* ignore */ }
    };
    requestAnimationFrame(() => {
      doRender();
      if (container.clientWidth === 0) {
        requestAnimationFrame(doRender);
      }
    });
  } catch (_e) {
    container.classList.remove('exercise-sheet-loading');
    container.textContent = 'Sheet music unavailable.';
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
  if (rms < 0.01) return -1;
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
  for (let i = d; i < SIZE; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
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

async function startPitchDetection(step, opts) {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  if (!window.AudioContext) return false;
  try { pitchStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { return false; }
  pitchAudioCtx = new window.AudioContext();
  const source = pitchAudioCtx.createMediaStreamSource(pitchStream);
  pitchAnalyser = pitchAudioCtx.createAnalyser();
  pitchAnalyser.fftSize = 2048;
  pitchBuf = new Float32Array(pitchAnalyser.fftSize);
  source.connect(pitchAnalyser);

  const xnotes = transposeNotes(step.notes, opts.transpose, opts.octaveShift);
  pitchTargetSequence = [];
  if (step.style === 'progression' && Array.isArray(xnotes[0])) {
    for (const chord of xnotes) for (const m of chord) pitchTargetSequence.push(m);
  } else if (step.style === 'chord') {
    pitchTargetSequence = [...xnotes];
  } else {
    pitchTargetSequence = xnotes.flat();
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
          if (pitchTargetIdx >= pitchTargetSequence.length) setPitchStatus('Nailed it 🎉', 'match');
          else setPitchStatus('✓ matched', 'match');
          pitchSustainNote = null;
          pitchSustainStart = 0;
        } else setPitchStatus('Hold…', 'match');
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
  } else if (target != null) setPitchStatus('listening…', 'idle');

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

/* ---- Audio playback ---- */
let audioApiRef = null;
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

async function playStep(step, opts) {
  if (!audioApiRef) return;
  stopAllNotes();
  try { await audioApiRef.ensureInit(); } catch {}
  const ctx = audioApiRef.getContext();
  if (!ctx) return;
  const dest = audioApiRef.getTrackDest(step.style === 'chord' ? 'chord' : 'melody') || audioApiRef.getMasterGain();
  const startTime = ctx.currentTime + 0.05;
  const beatDur = 60 / opts.tempo;
  const xnotes = transposeNotes(step.notes, opts.transpose, opts.octaveShift);

  if (step.style === 'chord' && Array.isArray(xnotes) && typeof xnotes[0] === 'number') {
    for (const m of xnotes) playOneNote(ctx, dest, m, startTime, beatDur * 4 * 0.95, 'triangle', 0.06);
    return;
  }
  if (step.style === 'progression') {
    let t = startTime;
    const chordDur = beatDur * 4;
    for (const chord of xnotes) {
      for (const m of chord) playOneNote(ctx, dest, m, t, chordDur * 0.92, 'triangle', 0.06);
      t += chordDur;
    }
    return;
  }
  for (let i = 0; i < xnotes.length; i++) {
    const v = xnotes[i];
    if (Array.isArray(v)) {
      for (const m of v) playOneNote(ctx, dest, m, startTime + i * beatDur, beatDur * 0.85, 'triangle', 0.07);
    } else {
      playOneNote(ctx, dest, v, startTime + i * beatDur, beatDur * 0.85, 'sine', 0.10);
    }
  }
}

function stopAllNotes() {
  for (const osc of activeOscillators) {
    try { osc.stop(); } catch {}
  }
  activeOscillators = [];
}

/* ---- Recording (mic + pitch detection together) ---- */
function attachRecording(moduleId, stepIndex) {
  const audio = document.getElementById('exercise-recording');
  const recordings = readRecordings();
  const key = `${moduleId}::${stepIndex}`;
  if (audio && recordings[key]) {
    audio.src = recordings[key];
    audio.hidden = false;
  } else if (audio) {
    audio.removeAttribute('src');
    audio.hidden = true;
  }
}

async function toggleRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    stopPitchDetection();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    setRecordHint('Recording not supported in this browser.');
    return;
  }
  if (activeModuleIdx < 0) return;
  const mod = MODULES[activeModuleIdx];
  const step = mod.steps[activeStepIdx];
  if (!step || step.type !== 'exercise') return;
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
      const key = `${mod.id}::${activeStepIdx}`;
      recordings[key] = dataUrl;
      writeRecordings(recordings);
      attachRecording(mod.id, activeStepIdx);
      setRecordingUI(false);
      setRecordHint('Saved! Play back above or re-record.');
    });
    mediaRecorder.start();
    setRecordingUI(true);
    setRecordHint('Recording + listening for pitch — tap again to stop.');
    startPitchDetection(step, exerciseOpts);
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

/* ---- View state ---- */
let activeModuleIdx = -1;
let activeStepIdx = 0;
const exerciseOpts = {
  clef: 'treble',
  octaveShift: 0,
  transpose: 0,
  tempo: 110,
};

/* ---- Cards on the main Learn page ---- */
function updateGlobalProgressUI() {
  const pct = totalProgressPct();
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

function renderContinueCard() {
  const card = document.getElementById('learn-continue');
  if (!card) return;
  const idx = nextIncompleteModuleIndex();
  if (idx < 0) {
    card.hidden = true;
    return;
  }
  const m = MODULES[idx];
  const stepDone = moduleStepsDone(m.id).size;
  const next = nextIncompleteStepIndex(m);
  const step = m.steps[next] || m.steps[0];
  card.hidden = false;
  document.getElementById('learn-continue-title').textContent = m.title;
  document.getElementById('learn-continue-desc').textContent = `${stepDone}/${m.steps.length} · Next: ${step.title}`;
  card.dataset.targetIndex = String(idx);
  card.dataset.targetStep = String(next);
}

function renderCards() {
  const root = document.getElementById('learn-modules');
  if (!root) return;
  root.innerHTML = '';
  // Group modules visually
  const seenGroups = new Set();
  for (let i = 0; i < MODULES.length; i++) {
    const m = MODULES[i];
    if (!seenGroups.has(m.group)) {
      seenGroups.add(m.group);
      const heading = document.createElement('div');
      heading.className = 'learn-group-heading';
      heading.textContent = m.group;
      root.appendChild(heading);
    }
    const done = moduleIsComplete(m);
    const stepsDone = moduleStepsDone(m.id).size;
    const card = document.createElement('div');
    card.className = `learn-card${done ? ' completed' : ''}`;
    card.dataset.id = m.id;
    card.dataset.index = String(i);
    card.tabIndex = 0;
    card.innerHTML = `
      <span class="learn-card-tag">${m.tag}</span>
      <h3 class="learn-card-title">${m.title}</h3>
      <p class="learn-card-desc">${m.summary}</p>
      <div class="learn-card-progress" aria-hidden="true"><div style="width:${moduleProgressPct(m)}%"></div></div>
      <div class="learn-card-footer">
        <span class="learn-card-status${done ? ' done' : ''}">${stepsDone}/${m.steps.length} steps</span>
        <span class="learn-card-cta">${done ? t('learn.replay') : t('learn.open')}</span>
      </div>
    `;
    card.addEventListener('click', () => openExercise(i, nextIncompleteStepIndex(m)));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openExercise(i, nextIncompleteStepIndex(m));
      }
    });
    root.appendChild(card);
  }
  updateGlobalProgressUI();
}

/* ---- Exercise stage open / step rendering / nav ---- */

function openExercise(moduleIdx, stepIdx = 0) {
  if (moduleIdx < 0 || moduleIdx >= MODULES.length) return;
  activeModuleIdx = moduleIdx;
  activeStepIdx = Math.max(0, Math.min(stepIdx, MODULES[moduleIdx].steps.length - 1));
  exerciseOpts.clef = 'treble';
  exerciseOpts.octaveShift = 0;
  exerciseOpts.transpose = 0;
  exerciseOpts.tempo = 110;
  syncOpsUI();
  const overlay = document.getElementById('learn-exercise-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  renderActiveStep();
}

function syncOpsUI() {
  const tempoSlider = document.getElementById('exercise-tempo');
  const tempoDisp = document.getElementById('exercise-tempo-display');
  if (tempoSlider) tempoSlider.value = String(exerciseOpts.tempo);
  if (tempoDisp) tempoDisp.textContent = String(exerciseOpts.tempo);
  document.querySelectorAll('#exercise-clef .exercise-pill').forEach(b => {
    b.classList.toggle('active', b.dataset.clef === exerciseOpts.clef);
  });
  const oct = document.getElementById('exercise-octave-label');
  if (oct) oct.textContent = (exerciseOpts.octaveShift > 0 ? '+' : '') + String(exerciseOpts.octaveShift);
  updateKeyLabel();
}

function updateKeyLabel() {
  const label = document.getElementById('exercise-key-label');
  if (!label || activeModuleIdx < 0) return;
  const mod = MODULES[activeModuleIdx];
  const step = mod.steps[activeStepIdx];
  const firstNote = (() => {
    if (!step || !step.notes) return 60;
    if (step.type !== 'exercise') return 60;
    if (Array.isArray(step.notes[0])) return Math.min(...step.notes[0]);
    return step.notes[0];
  })();
  const pc = ((firstNote + exerciseOpts.transpose) % 12 + 12) % 12;
  const sharp = PITCH_ALTERS[pc] ? '#' : '';
  label.textContent = `${PITCH_STEPS[pc]}${sharp}`;
}

function renderActiveStep() {
  if (activeModuleIdx < 0) return;
  const mod = MODULES[activeModuleIdx];
  const step = mod.steps[activeStepIdx];

  // Header
  const progressEl = document.getElementById('exercise-progress');
  if (progressEl) progressEl.textContent = `Step ${activeStepIdx + 1} / ${mod.steps.length} · ${mod.title}`;
  document.getElementById('exercise-tag').textContent = mod.tag;

  // Title / description
  document.getElementById('exercise-title').textContent = step.title;
  const descEl = document.getElementById('exercise-desc');
  if (descEl) {
    if (step.type === 'theory') {
      const diagramHtml = step.diagram ? renderDiagram(step.diagram) : '';
      const audioBtn = step.audio
        ? `<button type="button" class="theory-audio-btn" id="theory-audio-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            <span>Hear example</span>
          </button>`
        : '';
      const referencesHtml = step.references && step.references.length
        ? `<div class="theory-refs"><span class="theory-refs-title">Listen to this in</span><ul>${
            step.references.map(r => `<li>${r}</li>`).join('')
          }</ul></div>`
        : '';
      descEl.innerHTML = `
        ${step.text}
        ${diagramHtml}
        ${audioBtn}
        ${referencesHtml}
      `;
      const btn = document.getElementById('theory-audio-btn');
      if (btn && step.audio) {
        btn.addEventListener('click', () => playStep({ notes: step.audio, style: step.audioStyle || 'melody' }, exerciseOpts));
      }
    } else {
      descEl.innerHTML = step.description || '';
    }
  }

  // Step indicator dots
  const dots = document.getElementById('exercise-step-dots');
  if (dots) {
    dots.innerHTML = '';
    for (let i = 0; i < mod.steps.length; i++) {
      const dot = document.createElement('span');
      dot.className = 'exercise-step-dot';
      const stepDone = moduleStepsDone(mod.id).has(i);
      if (i === activeStepIdx) dot.classList.add('current');
      if (stepDone) dot.classList.add('done');
      if (mod.steps[i].type === 'theory') dot.classList.add('theory');
      dot.title = `${i + 1}. ${mod.steps[i].title}`;
      dot.addEventListener('click', () => { activeStepIdx = i; renderActiveStep(); });
      dots.appendChild(dot);
    }
  }

  // Step type — show/hide exercise machinery
  const isExercise = step.type === 'exercise';
  document.querySelectorAll('.exercise-only').forEach(el => {
    el.style.display = isExercise ? '' : 'none';
  });
  document.querySelectorAll('.theory-only').forEach(el => {
    el.style.display = isExercise ? 'none' : '';
  });

  // Footer buttons
  const backBtn = document.getElementById('exercise-back');
  const nextBtn = document.getElementById('exercise-next');
  if (backBtn) backBtn.disabled = activeStepIdx === 0 && activeModuleIdx === 0;
  if (nextBtn) {
    const isLastStep = activeStepIdx === mod.steps.length - 1;
    const isLastModule = activeModuleIdx === MODULES.length - 1;
    nextBtn.textContent = isLastStep ? (isLastModule ? t('exercise.finish') : t('exercise.next_module')) : t('exercise.next');
  }

  // Sheet music + recording
  attachRecording(mod.id, activeStepIdx);
  if (isExercise) {
    setPitchStatus('listening…', 'idle');
    document.getElementById('exercise-pitch').hidden = true;
    syncOpsUI();
    renderExerciseSheet(step, exerciseOpts);
  } else {
    // Hide sheet for theory
    const sheet = document.getElementById('exercise-sheet');
    if (sheet) sheet.textContent = '';
  }
}

function gotoStep(delta) {
  if (activeModuleIdx < 0) return;
  const mod = MODULES[activeModuleIdx];
  // Mark current as done before moving forward (only if exercise)
  if (delta > 0) markStepDone(mod.id, activeStepIdx);
  const nextIdx = activeStepIdx + delta;
  if (nextIdx < 0) {
    if (activeModuleIdx === 0) return;
    activeModuleIdx -= 1;
    const prevMod = MODULES[activeModuleIdx];
    activeStepIdx = prevMod.steps.length - 1;
  } else if (nextIdx >= mod.steps.length) {
    if (activeModuleIdx >= MODULES.length - 1) {
      // Final step done
      closeExercise();
      return;
    }
    activeModuleIdx += 1;
    activeStepIdx = 0;
  } else {
    activeStepIdx = nextIdx;
  }
  stopAllNotes();
  stopPitchDetection();
  renderCards();
  renderContinueCard();
  renderActiveStep();
}

function closeExercise() {
  stopAllNotes();
  stopPitchDetection();
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    try { mediaRecorder.stop(); } catch {}
  }
  setRecordingUI(false);
  const overlay = document.getElementById('learn-exercise-overlay');
  if (overlay) overlay.classList.add('hidden');
  if (recordingObjectUrl) {
    URL.revokeObjectURL(recordingObjectUrl);
    recordingObjectUrl = null;
  }
  renderCards();
  renderContinueCard();
}

/* ---- Module map ---- */
function openMap() {
  const overlay = document.getElementById('learn-map-overlay');
  if (!overlay) return;
  const body = document.getElementById('learn-map-body');
  if (!body) return;
  body.innerHTML = '';
  for (const group of GROUPS) {
    const inGroup = MODULES.filter(m => m.group === group);
    if (inGroup.length === 0) continue;
    const groupEl = document.createElement('div');
    groupEl.className = 'learn-map-group';
    groupEl.innerHTML = `<h3>${group}</h3>`;
    const lane = document.createElement('div');
    lane.className = 'learn-map-lane';
    for (const m of inGroup) {
      const node = document.createElement('button');
      node.type = 'button';
      const done = moduleIsComplete(m);
      const stepsDone = moduleStepsDone(m.id).size;
      const ratio = stepsDone / m.steps.length;
      node.className = `learn-map-node${done ? ' done' : stepsDone > 0 ? ' partial' : ''}`;
      node.innerHTML = `
        <span class="learn-map-node-title">${m.title}</span>
        <span class="learn-map-node-meta">${stepsDone}/${m.steps.length} steps</span>
        <span class="learn-map-node-bar"><span style="width:${Math.round(ratio * 100)}%"></span></span>
      `;
      node.addEventListener('click', () => {
        const idx = MODULES.findIndex(mm => mm.id === m.id);
        closeMap();
        openExercise(idx, nextIncompleteStepIndex(m));
      });
      lane.appendChild(node);
    }
    groupEl.appendChild(lane);
    body.appendChild(groupEl);
  }
  overlay.classList.remove('hidden');
}
function closeMap() {
  document.getElementById('learn-map-overlay')?.classList.add('hidden');
}

/* ---- Init ---- */

export function initLearnView({ audioApi }) {
  audioApiRef = audioApi;
  progress = readProgress();

  renderCards();
  renderContinueCard();

  onLangChange(() => {
    renderCards();
    renderContinueCard();
    // Re-apply the exercise step labels if the overlay is open
    if (activeModuleIdx >= 0) renderActiveStep();
  });

  document.getElementById('learn-continue-btn')?.addEventListener('click', () => {
    const card = document.getElementById('learn-continue');
    const idx = Number(card?.dataset.targetIndex || '0');
    const stepIdx = Number(card?.dataset.targetStep || '0');
    openExercise(idx, stepIdx);
  });

  document.getElementById('learn-map-btn')?.addEventListener('click', openMap);
  document.getElementById('learn-map-close')?.addEventListener('click', closeMap);
  document.getElementById('learn-map-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'learn-map-overlay') closeMap();
  });

  document.getElementById('exercise-close')?.addEventListener('click', closeExercise);
  document.getElementById('exercise-back')?.addEventListener('click', () => gotoStep(-1));
  document.getElementById('exercise-next')?.addEventListener('click', () => gotoStep(1));
  document.getElementById('exercise-play')?.addEventListener('click', () => {
    if (activeModuleIdx < 0) return;
    const step = MODULES[activeModuleIdx].steps[activeStepIdx];
    if (!step || step.type !== 'exercise') return;
    playStep(step, exerciseOpts);
  });
  document.getElementById('exercise-record')?.addEventListener('click', toggleRecording);

  document.getElementById('exercise-transpose-down')?.addEventListener('click', () => {
    if (activeModuleIdx < 0) return;
    exerciseOpts.transpose = Math.max(-12, exerciseOpts.transpose - 1);
    syncOpsUI();
    const step = MODULES[activeModuleIdx].steps[activeStepIdx];
    if (step?.type === 'exercise') renderExerciseSheet(step, exerciseOpts);
  });
  document.getElementById('exercise-transpose-up')?.addEventListener('click', () => {
    if (activeModuleIdx < 0) return;
    exerciseOpts.transpose = Math.min(12, exerciseOpts.transpose + 1);
    syncOpsUI();
    const step = MODULES[activeModuleIdx].steps[activeStepIdx];
    if (step?.type === 'exercise') renderExerciseSheet(step, exerciseOpts);
  });
  document.getElementById('exercise-octave-down')?.addEventListener('click', () => {
    exerciseOpts.octaveShift = Math.max(-2, exerciseOpts.octaveShift - 1);
    syncOpsUI();
    const step = MODULES[activeModuleIdx].steps[activeStepIdx];
    if (step?.type === 'exercise') renderExerciseSheet(step, exerciseOpts);
  });
  document.getElementById('exercise-octave-up')?.addEventListener('click', () => {
    exerciseOpts.octaveShift = Math.min(2, exerciseOpts.octaveShift + 1);
    syncOpsUI();
    const step = MODULES[activeModuleIdx].steps[activeStepIdx];
    if (step?.type === 'exercise') renderExerciseSheet(step, exerciseOpts);
  });
  document.getElementById('exercise-clef')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.exercise-pill[data-clef]');
    if (!btn) return;
    exerciseOpts.clef = btn.dataset.clef;
    syncOpsUI();
    const step = MODULES[activeModuleIdx].steps[activeStepIdx];
    if (step?.type === 'exercise') renderExerciseSheet(step, exerciseOpts);
  });
  document.getElementById('exercise-tempo')?.addEventListener('input', (e) => {
    exerciseOpts.tempo = Number(e.target.value) || 110;
    const disp = document.getElementById('exercise-tempo-display');
    if (disp) disp.textContent = String(exerciseOpts.tempo);
  });

  document.getElementById('learn-exercise-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'learn-exercise-overlay') closeExercise();
  });
  document.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('learn-exercise-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeExercise();
    else if (e.key === ' ') { e.preventDefault(); document.getElementById('exercise-play')?.click(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); gotoStep(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); gotoStep(-1); }
  });
}
