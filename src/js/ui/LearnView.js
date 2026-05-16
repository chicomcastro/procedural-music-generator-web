import { MODULES, GROUPS } from './learn-modules.js';
import { t, onLangChange } from '../i18n/i18n.js';
import { getModuleField as mf, getStepField as sf, getStepArray as sfa } from './learn-translations.js';

const PROGRESS_KEY = 'seedsong-learn-progress-v2';
const RECORDINGS_KEY = 'seedsong-learn-recordings';
const STREAK_KEY = 'seedsong-learn-streak';
const PREFS_KEY = 'seedsong-learn-exercise-prefs';

const SUPPORTED_CLEFS = ['treble', 'bass', 'alto'];
// Approximate centre of each clef's tessitura (MIDI). Used to auto-pick an
// octave shift that keeps a step's notes within a comfortable range.
const TESSITURA_CENTER = { treble: 71, bass: 50, alto: 60 };

function readPrefs() {
  try {
    const v = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    return {
      clef: SUPPORTED_CLEFS.includes(v.clef) ? v.clef : 'treble',
      tempo: Number.isFinite(v.tempo) ? Math.max(40, Math.min(200, v.tempo)) : 110,
      // Repeat each example twice by default — feels more like a practice loop.
      repeat: v.repeat !== false,
      recordMode: v.recordMode === true,
    };
  } catch { return { clef: 'treble', tempo: 110, repeat: true, recordMode: false }; }
}

function writePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      clef: prefs.clef,
      tempo: prefs.tempo,
      repeat: !!prefs.repeat,
      recordMode: !!prefs.recordMode,
    }));
  } catch { /* ignore */ }
}

function flattenStepNotes(notes) {
  const flat = [];
  const visit = (v) => {
    if (v == null) return;
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (typeof v === 'number') { flat.push(v); return; }
    // Object form: { m: number | number[], t: type, r: true } or rest.
    if (v.r) return;
    if (Array.isArray(v.m)) v.m.forEach(x => { if (typeof x === 'number') flat.push(x); });
    else if (typeof v.m === 'number') flat.push(v.m);
  };
  visit(notes);
  return flat;
}

// Compute the integer octave shift that lands the median of the step's notes
// closest to the chosen clef's tessitura centre. Excludes any user transpose
// (transpose is applied on top of the shift downstream).
function autoOctaveForClef(notes, clef) {
  const center = TESSITURA_CENTER[clef] ?? 71;
  const flat = flattenStepNotes(notes);
  if (flat.length === 0) return 0;
  const sorted = [...flat].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return Math.round((center - median) / 12);
}

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

// Rhythm primitives. We use divisions=12 ticks per quarter so a single
// measure of 4/4 = 48 ticks. That cleanly represents quarters, eighths,
// sixteenths, dotted variants and 3-in-2 triplet eighths/quarters.
const DIVISIONS = 12;
const TYPE_INFO = {
  // [ticks, MusicXML <type>, dotted?, triplet?]
  w:  [48, 'whole',   false, false],
  h:  [24, 'half',    false, false],
  qd: [18, 'quarter', true,  false],
  q:  [12, 'quarter', false, false],
  ed: [9,  'eighth',  true,  false],
  e:  [6,  'eighth',  false, false],
  et: [4,  'eighth',  false, true],
  qt: [8,  'quarter', false, true],
  s:  [3,  '16th',    false, false],
};
function ticksOf(t) { return (TYPE_INFO[t] || TYPE_INFO.q)[0]; }
function beatsOf(t) { return ticksOf(t) / DIVISIONS; }
// What an entry is worth in beats. Plain numbers / null / number arrays =
// 1 beat (quarter, the default). Object form reads its `t` field.
function noteBeats(note) {
  if (note == null) return 1;
  if (typeof note === 'number' || Array.isArray(note)) return 1;
  return beatsOf(note.t || 'q');
}
function noteTicks(note) { return Math.round(noteBeats(note) * DIVISIONS); }
function isRest(note) {
  if (note == null) return true;
  if (typeof note === 'object' && !Array.isArray(note) && note.r) return true;
  return false;
}
// Extract pitch(es) from a note in any of the supported shapes.
function notePitches(note) {
  if (isRest(note)) return [];
  if (typeof note === 'number') return [note];
  if (Array.isArray(note)) return note;
  if (Array.isArray(note.m)) return note.m;
  if (typeof note.m === 'number') return [note.m];
  return [];
}

function noteXmlFor(note, type) {
  const [ticks, xmlType, dotted, triplet] = TYPE_INFO[type] || TYPE_INFO.q;
  const dotTag = dotted ? '<dot/>' : '';
  const mod = triplet ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>' : '';
  if (isRest(note)) {
    return `<note><rest/><duration>${ticks}</duration><type>${xmlType}</type>${dotTag}${mod}</note>`;
  }
  const pitches = notePitches(note);
  return pitches.map((m, i) => {
    const chordTag = i > 0 ? '<chord/>' : '';
    return `<note>${chordTag}<pitch>${midiToPitchXml(m)}</pitch><duration>${ticks}</duration><type>${xmlType}</type>${dotTag}${mod}</note>`;
  }).join('');
}

function buildMusicXMLFor(step, opts) {
  const measureCap = 4 * DIVISIONS;  // 48 ticks per 4/4 bar
  const measures = [];
  let currentMeasure = [];
  let ticksInMeasure = 0;

  function flushMeasure(force) {
    if (currentMeasure.length === 0 && !force) return;
    measures.push(currentMeasure.join(''));
    currentMeasure = [];
    ticksInMeasure = 0;
  }
  function padRestToBar() {
    const need = measureCap - ticksInMeasure;
    if (need <= 0) return;
    // Pad with the smallest set of rest figures (quarter, eighth, sixteenth).
    let remaining = need;
    const fills = [['q', 12], ['e', 6], ['s', 3]];
    for (const [t, tk] of fills) {
      while (remaining >= tk) {
        currentMeasure.push(noteXmlFor({ r: true }, t));
        remaining -= tk;
      }
    }
    ticksInMeasure = measureCap;
  }

  const notes = step.notes;
  if (step.style === 'chord' && Array.isArray(notes) && typeof notes[0] === 'number') {
    const sorted = [...notes].sort((a, b) => a - b);
    currentMeasure.push(noteXmlFor(sorted, 'w'));
    ticksInMeasure = measureCap;
    flushMeasure(true);
  } else if (step.style === 'progression' && Array.isArray(notes) && Array.isArray(notes[0])) {
    for (const chord of notes) {
      currentMeasure = [];
      const sorted = [...chord].sort((a, b) => a - b);
      currentMeasure.push(noteXmlFor(sorted, 'w'));
      measures.push(currentMeasure.join(''));
    }
    currentMeasure = [];
  } else {
    for (const note of notes) {
      const tType = (note && typeof note === 'object' && !Array.isArray(note) && note.t) || 'q';
      currentMeasure.push(noteXmlFor(note, tType));
      ticksInMeasure += ticksOf(tType);
      if (ticksInMeasure >= measureCap) flushMeasure();
    }
    if (ticksInMeasure > 0) {
      padRestToBar();
      flushMeasure(true);
    }
  }

  const clefXml = CLEFS[opts.clef] || CLEFS.treble;
  const measuresXml = measures.map((m, i) => `
    <measure number="${i + 1}">
      ${i === 0 ? `<attributes>
        <divisions>${DIVISIONS}</divisions>
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
  // Supports plain number, null (rest), number arrays (chord), and object
  // form { m: midi | midi[], t: type, r: true }.
  const apply = (n) => {
    if (n == null) return null;
    if (typeof n === 'number') return n + totalShift;
    if (Array.isArray(n)) return n.map(x => x + totalShift);
    if (n.r) return n;
    const m = Array.isArray(n.m) ? n.m.map(x => x + totalShift) : n.m + totalShift;
    return { ...n, m };
  };
  if (Array.isArray(notes) && Array.isArray(notes[0])) {
    return notes.map(c => c.map(m => m + totalShift));
  }
  return notes.map(apply);
}

// Cache rendered SVG by configuration so step-to-step navigation doesn't
// re-parse + re-render the same MusicXML. Keys include every input that
// affects the visual output. FIFO-capped at 20 entries.
const sheetCache = new Map();
const SHEET_CACHE_LIMIT = 20;

function cacheKey(modId, stepIdx, opts, containerWidth) {
  const zoomBucket = containerWidth < 500 ? 'm' : containerWidth < 720 ? 't' : 'd';
  return `${modId}::${stepIdx}::${opts.clef}::${opts.transpose}::${opts.octaveShift}::${zoomBucket}`;
}

async function renderExerciseSheet(step, opts) {
  const container = document.getElementById('exercise-sheet');
  if (!container) return;
  container.textContent = '';
  container.classList.add('exercise-sheet-loading');
  try {
    await loadOSMD();
    if (!window.opensheetmusicdisplay) throw new Error('OSMD not available');

    // Try the cache first.
    const mod = MODULES[activeModuleIdx];
    const containerWidth = container.clientWidth;
    const key = mod ? cacheKey(mod.id, activeStepIdx, opts, containerWidth) : null;
    if (key && containerWidth > 0 && sheetCache.has(key)) {
      container.innerHTML = sheetCache.get(key);
      container.classList.remove('exercise-sheet-loading');
      // Re-bind OSMD's cursor onto the restored DOM by re-running render so
      // cursor APIs keep working. If that's too slow we can drop this — but
      // load() is the expensive part, render() against a parsed sheet is fast.
      try {
        const w = container.clientWidth;
        exerciseOSMD.zoom = w < 500 ? 0.7 : w < 720 ? 0.85 : 1.0;
        exerciseOSMD.render();
      } catch (_e) { /* ignore — cached SVG is still on screen */ }
      return;
    }

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
      try {
        // Scale down on narrow viewports so OSMD packs >=2 measures per
        // system. Default zoom is 1; on mobile (~390px) 0.7 gives clearer
        // multi-bar lines without losing notehead readability.
        const w = container.clientWidth;
        exerciseOSMD.zoom = w < 500 ? 0.7 : w < 720 ? 0.85 : 1.0;
        exerciseOSMD.render();
        // Stash the rendered SVG so the next visit to this step skips OSMD.
        if (mod && w > 0) {
          const k = cacheKey(mod.id, activeStepIdx, opts, w);
          sheetCache.set(k, container.innerHTML);
          if (sheetCache.size > SHEET_CACHE_LIMIT) {
            const first = sheetCache.keys().next().value;
            sheetCache.delete(first);
          }
        }
      } catch (_e) { /* ignore */ }
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
    // Drop rests, walk through every melodic note in order. notePitches()
    // unpacks both plain numbers and the object form ({ m, t }).
    for (const n of xnotes) {
      if (isRest(n)) continue;
      for (const p of notePitches(n)) pitchTargetSequence.push(p);
    }
  }
  pitchTargetIdx = 0;
  pitchSustainStart = 0;
  pitchSustainNote = null;
  const panel = document.getElementById('exercise-pitch');
  if (panel) panel.hidden = false;
  syncStaffCursorToTarget();
  updatePitchTarget();
  pitchLoop();
  return true;
}

// OSMD ships a built-in cursor that highlights the current staff entry.
// We show it while pitch detection is running so the user can see which
// note is being listened for, on the staff itself.
function syncStaffCursorToTarget() {
  if (!exerciseOSMD || !exerciseOSMD.cursor) return;
  try {
    exerciseOSMD.cursor.show();
    exerciseOSMD.cursor.reset();
    const target = Math.min(pitchTargetIdx, Math.max(0, pitchTargetSequence.length - 1));
    for (let i = 0; i < target; i++) {
      try { exerciseOSMD.cursor.next(); } catch { break; }
    }
  } catch { /* ignore */ }
}

function hideStaffCursor() {
  if (!exerciseOSMD || !exerciseOSMD.cursor) return;
  try { exerciseOSMD.cursor.hide(); } catch { /* ignore */ }
}

// Briefly flash the cursor green to signal a matched note.
function flashStaffCursorMatch() {
  if (!exerciseOSMD?.cursor?.cursorElement) return;
  const el = exerciseOSMD.cursor.cursorElement;
  el.classList.add('cursor-match');
  setTimeout(() => el.classList.remove('cursor-match'), 320);
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
          try { exerciseOSMD?.cursor?.next(); } catch { /* ignore */ }
          flashStaffCursorMatch();
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
  hideStaffCursor();
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

let playbackTimer = null;

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
  const loops = opts.repeat ? 2 : 1;
  const interLoopGap = opts.repeat ? beatDur : 0;  // a one-beat breather between passes

  // The duration of ONE pass through the example (the cursor cycles per pass).
  let passDur = 0;
  // entriesPerPass = how many staff entries OSMD will advance through in one pass.
  // melodic = one entry per beat; chord = one entry; progression = one per chord.
  let entriesPerPass = 0;

  if (step.style === 'chord' && Array.isArray(xnotes) && typeof xnotes[0] === 'number') {
    passDur = beatDur * 4;
    entriesPerPass = 1;
  } else if (step.style === 'progression') {
    passDur = beatDur * 4 * xnotes.length;
    entriesPerPass = xnotes.length;
  } else {
    // Melodic: sum each note's own beat-duration so eighths/triplets cost
    // less than quarters and we land on the right total time.
    passDur = xnotes.reduce((acc, n) => acc + noteBeats(n) * beatDur, 0);
    entriesPerPass = xnotes.length;
  }

  for (let loop = 0; loop < loops; loop++) {
    const offset = loop * (passDur + interLoopGap);
    if (step.style === 'chord' && Array.isArray(xnotes) && typeof xnotes[0] === 'number') {
      for (const m of xnotes) playOneNote(ctx, dest, m, startTime + offset, beatDur * 4 * 0.95, 'triangle', 0.06);
    } else if (step.style === 'progression') {
      let t = startTime + offset;
      const chordDur = beatDur * 4;
      for (const chord of xnotes) {
        for (const m of chord) playOneNote(ctx, dest, m, t, chordDur * 0.92, 'triangle', 0.06);
        t += chordDur;
      }
    } else {
      let cursor = startTime + offset;
      for (const v of xnotes) {
        const noteDur = noteBeats(v) * beatDur;
        if (!isRest(v)) {
          const pitches = notePitches(v);
          if (pitches.length === 1) {
            playOneNote(ctx, dest, pitches[0], cursor, noteDur * 0.85, 'sine', 0.10);
          } else {
            for (const m of pitches) playOneNote(ctx, dest, m, cursor, noteDur * 0.85, 'triangle', 0.07);
          }
        }
        cursor += noteDur;
      }
    }
  }

  const totalDur = passDur * loops + interLoopGap * (loops - 1);

  // Optionally start mic-recording + pitch detection alongside the example.
  if (opts.recordMode) {
    await startRecording(step, opts);
  }

  // Drive UI: play-button pulse, progress bar under the sheet, and the OSMD
  // cursor in lockstep with audio.
  if (typeof setPlayingState === 'function') setPlayingState(true);
  // Show OSMD's cursor on the staff so the user sees which note is sounding.
  try {
    exerciseOSMD?.cursor?.show();
    exerciseOSMD?.cursor?.reset();
  } catch { /* ignore */ }
  const startMs = performance.now();
  const totalMs = totalDur * 1000;
  let lastEntry = -1;
  let lastLoop = -1;
  if (playbackTimer) clearInterval(playbackTimer);
  playbackTimer = setInterval(() => {
    const elapsed = performance.now() - startMs;
    const pct = Math.min(100, (elapsed / totalMs) * 100);
    setPlaybackProgress(pct);

    // Compute the current loop and the index inside the loop.
    const passSpanMs = (passDur + interLoopGap) * 1000;
    const currentLoop = Math.min(loops - 1, Math.floor(elapsed / passSpanMs));
    const inLoopMs = elapsed - currentLoop * passSpanMs;
    const entry = Math.min(entriesPerPass - 1, Math.max(0, Math.floor(inLoopMs / (passDur / entriesPerPass) / 1000 * 1000)));
    // If we entered a new loop, reset the cursor to the top of the staff.
    if (currentLoop !== lastLoop && currentLoop >= 0) {
      try { exerciseOSMD?.cursor?.reset(); } catch { /* ignore */ }
      lastLoop = currentLoop;
      lastEntry = -1;
    }
    // Advance the cursor as we cross entry boundaries.
    while (lastEntry < entry) {
      try { exerciseOSMD?.cursor?.next(); } catch { break; }
      lastEntry += 1;
    }

    if (pct >= 100) {
      clearInterval(playbackTimer);
      playbackTimer = null;
      setPlayingState(false);
      // Stop the optional recording at the end of playback.
      if (opts.recordMode && mediaRecorder?.state === 'recording') {
        try { mediaRecorder.stop(); } catch { /* ignore */ }
      }
      // Keep the cursor visible briefly so the user sees where it stopped,
      // then hide unless pitch-detection is still running for record mode.
      setTimeout(() => {
        if (!pitchAudioCtx) hideStaffCursor();
      }, 400);
    }
  }, 60);
}

function stopAllNotes() {
  for (const osc of activeOscillators) {
    try { osc.stop(); } catch {}
  }
  activeOscillators = [];
  if (playbackTimer) {
    clearInterval(playbackTimer);
    playbackTimer = null;
  }
  if (typeof setPlayingState === 'function') setPlayingState(false);
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

async function startRecording(step, opts) {
  if (mediaRecorder && mediaRecorder.state === 'recording') return;
  if (!navigator.mediaDevices?.getUserMedia) return;
  if (activeModuleIdx < 0) return;
  const mod = MODULES[activeModuleIdx];
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
      stopPitchDetection();
    });
    mediaRecorder.start();
    startPitchDetection(step, opts);
  } catch (_err) {
    // Mic permission denied or unavailable — fall back to silent playback.
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

/* ---- View state ---- */
let activeModuleIdx = -1;
let activeStepIdx = 0;
const exerciseOpts = {
  clef: 'treble',
  octaveShift: 0,
  transpose: 0,
  tempo: 110,
  repeat: true,
  recordMode: false,
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
  card.hidden = false;
  document.getElementById('learn-continue-title').textContent = mf(m, 'title');
  document.getElementById('learn-continue-desc').textContent = `${stepDone}/${m.steps.length} · ${t('learn.next')}: ${sf(m, next, 'title')}`;
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
      heading.textContent = t(`learn.group.${m.group.toLowerCase().replace(/\s+/g, '_')}`);
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
      <span class="learn-card-tag">${mf(m, 'tag')}</span>
      <h3 class="learn-card-title">${mf(m, 'title')}</h3>
      <p class="learn-card-desc">${mf(m, 'summary')}</p>
      <div class="learn-card-progress" aria-hidden="true"><div style="width:${moduleProgressPct(m)}%"></div></div>
      <div class="learn-card-footer">
        <span class="learn-card-status${done ? ' done' : ''}">${stepsDone}/${m.steps.length} ${t('learn.steps_label')}</span>
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
  // Restore persisted clef + tempo + repeat + record-mode. Transpose is always
  // per-step (no carry-over).
  const prefs = readPrefs();
  exerciseOpts.clef = prefs.clef;
  exerciseOpts.tempo = prefs.tempo;
  exerciseOpts.repeat = prefs.repeat;
  exerciseOpts.recordMode = prefs.recordMode;
  exerciseOpts.transpose = 0;
  // octaveShift is recomputed inside renderActiveStep so it fits the step's
  // notes inside the chosen clef's tessitura.
  exerciseOpts.octaveShift = 0;
  syncOpsUI();
  const overlay = document.getElementById('learn-exercise-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  renderActiveStep();
}

// Re-derive octaveShift from the current step + clef so notes fit the clef's
// tessitura. Called when a new step is shown or when the clef is changed.
function normalizeOctaveForCurrentStep() {
  if (activeModuleIdx < 0) return;
  const mod = MODULES[activeModuleIdx];
  const step = mod.steps[activeStepIdx];
  if (!step) return;
  const notes = step.notes ?? step.audio;
  if (!notes) { exerciseOpts.octaveShift = 0; return; }
  exerciseOpts.octaveShift = autoOctaveForClef(notes, exerciseOpts.clef);
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
  const repeatChk = document.getElementById('exercise-repeat');
  if (repeatChk) repeatChk.checked = !!exerciseOpts.repeat;
  const recordChk = document.getElementById('exercise-record-mode');
  if (recordChk) recordChk.checked = !!exerciseOpts.recordMode;
  const playBtn = document.getElementById('exercise-play');
  if (playBtn) playBtn.classList.toggle('record-mode-on', !!exerciseOpts.recordMode);
  updateKeyLabel();
  if (typeof updateControlsSummary === 'function') updateControlsSummary();
}

function updateKeyLabel() {
  const label = document.getElementById('exercise-key-label');
  if (!label || activeModuleIdx < 0) return;
  const mod = MODULES[activeModuleIdx];
  const step = mod.steps[activeStepIdx];
  // Walk the notes array to find the first sounding pitch — works across
  // all supported shapes (plain number, number array chord, object form,
  // null rests).
  const firstNote = (() => {
    if (!step || !step.notes || step.type !== 'exercise') return 60;
    for (const n of step.notes) {
      const pitches = notePitches(n);
      if (pitches.length > 0) return Math.min(...pitches);
    }
    return 60;
  })();
  const pc = ((firstNote + exerciseOpts.transpose) % 12 + 12) % 12;
  const sharp = PITCH_ALTERS[pc] ? '#' : '';
  label.textContent = `${PITCH_STEPS[pc]}${sharp}`;
}

// Track which step was just completed so the rail's check can pop-animate it.
let justCompletedStepIdx = -1;

function renderActiveStep() {
  if (activeModuleIdx < 0) return;
  const mod = MODULES[activeModuleIdx];
  const step = mod.steps[activeStepIdx];
  const isExercise = step.type === 'exercise';

  // Header: module name + tag
  const moduleNameEl = document.getElementById('exercise-module-name');
  if (moduleNameEl) moduleNameEl.textContent = mf(mod, 'title');
  const tagEl = document.getElementById('exercise-tag');
  if (tagEl) tagEl.textContent = mf(mod, 'tag');

  // Title / description
  document.getElementById('exercise-title').textContent = sf(mod, activeStepIdx, 'title');
  const descEl = document.getElementById('exercise-desc');
  if (descEl) {
    if (step.type === 'theory') {
      const diagramHtml = step.diagram ? renderDiagram(step.diagram) : '';
      const audioBtn = step.audio
        ? `<button type="button" class="theory-audio-btn" id="theory-audio-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            <span>${t('learn.hear_example')}</span>
          </button>`
        : '';
      const refs = sfa(mod, activeStepIdx, 'references');
      const referencesHtml = refs && refs.length
        ? `<div class="theory-refs"><span class="theory-refs-title">${t('learn.listen_in')}</span><ul>${
            refs.map(r => `<li>${r}</li>`).join('')
          }</ul></div>`
        : '';
      descEl.innerHTML = `
        ${sf(mod, activeStepIdx, 'text')}
        ${diagramHtml}
        ${audioBtn}
        ${referencesHtml}
      `;
      const btn = document.getElementById('theory-audio-btn');
      if (btn && step.audio) {
        btn.addEventListener('click', () => playStep({ notes: step.audio, style: step.audioStyle || 'melody' }, exerciseOpts));
      }
    } else {
      descEl.innerHTML = sf(mod, activeStepIdx, 'description') || '';
    }
  }

  renderStepRail(mod);

  // Show/hide exercise-only machinery
  document.querySelectorAll('.exercise-only').forEach(el => {
    el.style.display = isExercise ? '' : 'none';
  });
  document.querySelectorAll('.theory-only').forEach(el => {
    el.style.display = isExercise ? 'none' : '';
  });

  // Header back arrow: disable on first step of first module
  const backBtn = document.getElementById('exercise-back-arrow');
  if (backBtn) backBtn.disabled = activeStepIdx === 0 && activeModuleIdx === 0;

  // Single unified CTA — text adapts to context.
  const nextBtn = document.getElementById('exercise-next');
  if (nextBtn) {
    const isLastStep = activeStepIdx === mod.steps.length - 1;
    const isLastModule = activeModuleIdx === MODULES.length - 1;
    const alreadyDone = moduleStepsDone(mod.id).has(activeStepIdx);
    if (isLastStep && isLastModule) nextBtn.textContent = t('exercise.finish');
    else if (isLastStep) nextBtn.textContent = t('exercise.next_module');
    else if (alreadyDone) nextBtn.textContent = t('exercise.done_already');
    else nextBtn.textContent = t('exercise.done');
  }

  // Per-step normalization: reset transpose and refit octave for the chosen
  // clef so this step's notes land inside the clef's tessitura.
  exerciseOpts.transpose = 0;
  normalizeOctaveForCurrentStep();

  // Sheet music + recording
  attachRecording(mod.id, activeStepIdx);
  if (isExercise) {
    setPitchStatus(t('exercise.listening'), 'idle');
    const pitchEl = document.getElementById('exercise-pitch');
    if (pitchEl) pitchEl.hidden = true;
    syncOpsUI();
    renderExerciseSheet(step, exerciseOpts);
    updateControlsSummary();
  } else {
    syncOpsUI();
    const sheet = document.getElementById('exercise-sheet');
    if (sheet) sheet.textContent = '';
  }

  // Reset playback progress
  setPlaybackProgress(0);
  showPlaybackProgress(false);
  const playBtn = document.getElementById('exercise-play');
  if (playBtn) playBtn.classList.remove('is-playing');
}

// Render the new step-rail (replaces dots): icon + number, connectors.
function renderStepRail(mod) {
  const rail = document.getElementById('exercise-step-rail');
  if (!rail) return;
  rail.innerHTML = '';
  rail.setAttribute('role', 'tablist');
  const done = moduleStepsDone(mod.id);
  for (let i = 0; i < mod.steps.length; i++) {
    const st = mod.steps[i];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'exercise-step-rail-item';
    if (done.has(i)) btn.classList.add('done');
    if (i === activeStepIdx) btn.classList.add('current');
    if (i === justCompletedStepIdx) btn.classList.add('just-completed');
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', i === activeStepIdx ? 'true' : 'false');
    btn.setAttribute('aria-label', `${i + 1}. ${sf(mod, i, 'title')} (${st.type === 'theory' ? 'theory' : 'exercise'}${done.has(i) ? ', done' : ''})`);
    // Roving tabindex: only the active tab is in the tab order.
    btn.tabIndex = i === activeStepIdx ? 0 : -1;

    const icon = document.createElement('span');
    icon.className = 'exercise-step-rail-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = done.has(i)
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
      : String(i + 1);
    btn.appendChild(icon);

    const type = document.createElement('span');
    type.className = 'exercise-step-rail-type';
    type.setAttribute('aria-hidden', 'true');
    type.textContent = st.type === 'theory' ? '📖' : '🎵';
    btn.appendChild(type);

    btn.addEventListener('click', () => {
      if (i === activeStepIdx) return;
      navigateToStep(i);
    });
    btn.addEventListener('keydown', (e) => handleStepRailKeydown(e, i, mod.steps.length));
    rail.appendChild(btn);

    if (i < mod.steps.length - 1) {
      const conn = document.createElement('span');
      conn.className = 'exercise-step-rail-connector';
      if (done.has(i)) conn.classList.add('done');
      rail.appendChild(conn);
    }
  }
  // Clear the pop after one render so it doesn't replay.
  justCompletedStepIdx = -1;
}

// Keyboard navigation inside the step rail (ArrowLeft/Right + Home/End).
// Same pattern as a tablist — focus moves with the keys, Enter/Space activates.
function handleStepRailKeydown(e, i, total) {
  let target = -1;
  switch (e.key) {
    case 'ArrowRight': target = (i + 1) % total; break;
    case 'ArrowLeft':  target = (i - 1 + total) % total; break;
    case 'Home':       target = 0; break;
    case 'End':        target = total - 1; break;
    case 'Enter':
    case ' ':
      if (i !== activeStepIdx) {
        e.preventDefault();
        navigateToStep(i);
      }
      return;
    default: return;
  }
  e.preventDefault();
  const items = document.querySelectorAll('#exercise-step-rail .exercise-step-rail-item');
  const btn = items[target];
  if (btn) btn.focus();
}

function updateControlsSummary() {
  const info = document.getElementById('exercise-controls-info');
  if (!info) return;
  const keyEl = document.getElementById('exercise-key-label');
  const key = keyEl ? keyEl.textContent : 'C';
  const clefBtn = document.querySelector('#exercise-clef .exercise-pill.active');
  const clef = clefBtn ? clefBtn.textContent.trim() : 'Treble';
  info.textContent = `${key} · ${exerciseOpts.tempo} ${t('exercise.bpm')} · ${clef}`;
}

function gotoStep(delta) {
  if (activeModuleIdx < 0) return;
  const mod = MODULES[activeModuleIdx];
  const wasLastIncompleteOfModule = activeStepIdx === mod.steps.length - 1
    && delta > 0
    && !moduleIsComplete(mod);

  // Mark current as done before moving forward
  if (delta > 0) {
    markStepDone(mod.id, activeStepIdx);
    justCompletedStepIdx = activeStepIdx;
    pulseCtaSuccess();
  }

  // If we just completed the last step of a module, celebrate before moving on.
  if (wasLastIncompleteOfModule && moduleIsComplete(mod)) {
    triggerModuleComplete(mod, () => doStepNavigation(delta));
    return;
  }
  doStepNavigation(delta);
}

function doStepNavigation(delta) {
  const mod = MODULES[activeModuleIdx];
  const nextIdx = activeStepIdx + delta;
  let newModuleIdx = activeModuleIdx;
  let newStepIdx = activeStepIdx;
  if (nextIdx < 0) {
    if (activeModuleIdx === 0) return;
    newModuleIdx = activeModuleIdx - 1;
    const prevMod = MODULES[newModuleIdx];
    newStepIdx = prevMod.steps.length - 1;
  } else if (nextIdx >= mod.steps.length) {
    if (activeModuleIdx >= MODULES.length - 1) {
      closeExercise();
      return;
    }
    newModuleIdx = activeModuleIdx + 1;
    newStepIdx = 0;
  } else {
    newStepIdx = nextIdx;
  }
  stopAllNotes();
  stopPitchDetection();
  renderCards();
  renderContinueCard();
  animateStepTransition(delta, () => {
    activeModuleIdx = newModuleIdx;
    activeStepIdx = newStepIdx;
    renderActiveStep();
  });
}

// Navigate directly to a specific step within the current module (rail click).
function navigateToStep(stepIdx) {
  if (activeModuleIdx < 0) return;
  const delta = stepIdx > activeStepIdx ? 1 : -1;
  stopAllNotes();
  stopPitchDetection();
  animateStepTransition(delta, () => {
    activeStepIdx = stepIdx;
    renderActiveStep();
  });
}

// Cross-fade with slide. Caller swaps state inside the callback (mid-transition).
function animateStepTransition(delta, swap) {
  const content = document.getElementById('exercise-content');
  if (!content || typeof swap !== 'function') {
    if (typeof swap === 'function') swap();
    return;
  }
  const outClass = delta > 0 ? 'slide-out-left' : 'slide-out-right';
  const inClass = delta > 0 ? 'slide-in-from-right' : 'slide-in-from-left';
  content.classList.remove('slide-in-from-right', 'slide-in-from-left');
  content.classList.add(outClass);
  // Wait for the out animation, then swap and animate in.
  setTimeout(() => {
    content.classList.remove(outClass);
    swap();
    content.classList.add(inClass);
    setTimeout(() => content.classList.remove(inClass), 280);
  }, 170);
}

function pulseCtaSuccess() {
  const btn = document.getElementById('exercise-next');
  if (!btn) return;
  btn.classList.remove('is-completing');
  void btn.offsetWidth;  // force reflow so the animation can restart
  btn.classList.add('is-completing');
  setTimeout(() => btn.classList.remove('is-completing'), 460);
}

/* ---- Module-complete celebration ---- */
function triggerModuleComplete(mod, onContinue) {
  const flash = document.getElementById('module-complete-flash');
  const sub = document.getElementById('module-complete-sub');
  if (!flash || !sub) { onContinue?.(); return; }
  const total = MODULES.length;
  const completed = totalCompletedModules();
  sub.textContent = t('exercise.complete_sub')
    .replace('{module}', mf(mod, 'title'))
    .replace('{modulesDone}', String(completed))
    .replace('{modulesTotal}', String(total));
  spawnConfetti(flash.querySelector('.confetti-shower'));
  flash.classList.remove('hidden');
  flash.setAttribute('aria-hidden', 'false');
  setTimeout(() => {
    flash.classList.add('hidden');
    flash.setAttribute('aria-hidden', 'true');
    onContinue?.();
  }, 2100);
}

function spawnConfetti(host) {
  if (!host) return;
  host.innerHTML = '';
  const colors = ['#38bf88', '#e8a735', '#5b9eff', '#f06292', '#bb86fc'];
  const count = 28;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    const left = Math.round(Math.random() * 100);
    const delay = Math.round(Math.random() * 250);
    const color = colors[i % colors.length];
    const drift = Math.round((Math.random() - 0.5) * 60);
    piece.style.left = `${left}%`;
    piece.style.background = color;
    piece.style.animationDelay = `${delay}ms`;
    piece.style.setProperty('--drift', `${drift}px`);
    host.appendChild(piece);
  }
}

/* ---- Playback progress (sheet music) ---- */
function showPlaybackProgress(visible) {
  const el = document.getElementById('exercise-playback-progress');
  if (el) el.hidden = !visible;
}
function setPlaybackProgress(pct) {
  const fill = document.querySelector('#exercise-playback-progress .exercise-playback-fill');
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}
function setPlayingState(isPlaying) {
  const btn = document.getElementById('exercise-play');
  if (btn) btn.classList.toggle('is-playing', isPlaying);
  showPlaybackProgress(isPlaying);
  if (!isPlaying) setPlaybackProgress(0);
}

function closeExercise() {
  stopAllNotes();
  stopPitchDetection();
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    try { mediaRecorder.stop(); } catch {}
  }
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
    groupEl.innerHTML = `<h3>${t(`learn.group.${group.toLowerCase().replace(/\s+/g, '_')}`)}</h3>`;
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
        <span class="learn-map-node-title">${mf(m, 'title')}</span>
        <span class="learn-map-node-meta">${stepsDone}/${m.steps.length} ${t('learn.steps_label')}</span>
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
  document.getElementById('exercise-back-arrow')?.addEventListener('click', () => gotoStep(-1));
  document.getElementById('exercise-next')?.addEventListener('click', () => gotoStep(1));
  document.getElementById('exercise-play')?.addEventListener('click', () => {
    if (activeModuleIdx < 0) return;
    const step = MODULES[activeModuleIdx].steps[activeStepIdx];
    if (!step || step.type !== 'exercise') return;
    // Tapping Play while playback is already running stops everything.
    if (playbackTimer || mediaRecorder?.state === 'recording') {
      stopAllNotes();
      if (mediaRecorder?.state === 'recording') {
        try { mediaRecorder.stop(); } catch { /* ignore */ }
      }
      return;
    }
    playStep(step, exerciseOpts);
  });

  document.getElementById('exercise-repeat')?.addEventListener('change', (e) => {
    exerciseOpts.repeat = !!e.target.checked;
    writePrefs(exerciseOpts);
  });

  document.getElementById('exercise-record-mode')?.addEventListener('change', (e) => {
    exerciseOpts.recordMode = !!e.target.checked;
    writePrefs(exerciseOpts);
    const playBtn = document.getElementById('exercise-play');
    if (playBtn) playBtn.classList.toggle('record-mode-on', exerciseOpts.recordMode);
  });

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
    // Re-fit the step's notes to the newly chosen clef's tessitura.
    normalizeOctaveForCurrentStep();
    writePrefs(exerciseOpts);
    syncOpsUI();
    const step = MODULES[activeModuleIdx].steps[activeStepIdx];
    if (step?.type === 'exercise') renderExerciseSheet(step, exerciseOpts);
  });
  document.getElementById('exercise-tempo')?.addEventListener('input', (e) => {
    exerciseOpts.tempo = Number(e.target.value) || 110;
    const disp = document.getElementById('exercise-tempo-display');
    if (disp) disp.textContent = String(exerciseOpts.tempo);
    writePrefs(exerciseOpts);
    if (typeof updateControlsSummary === 'function') updateControlsSummary();
  });

  document.getElementById('learn-exercise-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'learn-exercise-overlay') closeExercise();
  });
  document.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('learn-exercise-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    // Let the step rail keep its own arrow-key handling when focused.
    const focusedInRail = document.activeElement?.closest('#exercise-step-rail');
    // Don't hijack arrows while the user is typing into an input either.
    const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (e.key === 'Escape') closeExercise();
    else if (e.key === ' ' && !inField) { e.preventDefault(); document.getElementById('exercise-play')?.click(); }
    else if (e.key === 'ArrowRight' && !focusedInRail && !inField) { e.preventDefault(); gotoStep(1); }
    else if (e.key === 'ArrowLeft' && !focusedInRail && !inField) { e.preventDefault(); gotoStep(-1); }
  });
}
