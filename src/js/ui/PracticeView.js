// Practice view — long-form procedural study pieces. Each "study" is an
// ordered list of acts; each act gets fed through the generator (melody +
// counterpoint, or walking-bass) and the resulting events are concatenated
// into one song that renders to OSMD as a single continuous score.
//
// The master-difficulty slider scales each act's baseline params (density,
// chromatic %, tempo, etc.). Seed is reproducible — same seed + same params
// always produces the same study.
//
// PR 1 scope: catalog, study player, two-voice invention + walking-bass
// workout, master slider, key picker, seed reroll, audio playback, print
// stylesheet (no per-act overrides yet — those land in PR 2).

import { STUDIES, scaleParams, tonicName, CLEF_ANCHORS, RHYTHM_PRESETS } from './practice-studies.js';
import { getStudyField } from './practice-translations.js';
import { mulberry32, randomSeed } from '../generate/rng.js';
import { generateMelody } from '../generate/melody.js';
import { generateCounterpoint } from '../generate/counterpoint.js';
import { generateRhythm } from '../generate/rhythm.js';
import { generateWalkingBass, progressionToChords, chordSymbolFor } from '../generate/walking-bass.js';
import { chordFromDegree, PROGRESSIONS } from '../theory/chords.js';
import { songToMusicXML } from '../export/musicxml.js';
import { t, onLangChange } from '../i18n/i18n.js';

const STORAGE_KEY = 'seedsong-practice-prefs-v1';

let audioApiRef = null;
let activeStudy = null;
let prefs = { studyId: null, byStudy: {} };
// One OSMD instance per container — Practice owns its own.
let osmdLoading = null;
let practiceOSMD = null;
let lastSong = null;            // most recent generated song (for playback)
let lastBpm = 100;
let playbackTimer = null;
let scheduledNodes = [];

// =============================================================================
// Persistence

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') prefs = { studyId: parsed.studyId || null, byStudy: parsed.byStudy || {} };
  } catch { /* ignore */ }
}

function savePrefs() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

function getStudyPrefs(studyId) {
  const study = STUDIES.find(s => s.id === studyId);
  if (!prefs.byStudy[studyId]) {
    prefs.byStudy[studyId] = {
      keyPc: study?.keyOptions?.[0] ?? 0,
      difficulty: 50,
      seed: randomSeed(),
      clefPresetId: study?.clefPresets?.[0]?.id ?? null,
      rhythmPresetId: study?.rhythmDefault ?? null,
    };
  }
  // Backfill new fields for users who already have a saved prefs blob from a
  // previous build, so the picker doesn't show a blank option.
  const p = prefs.byStudy[studyId];
  if (study?.clefPresets && !study.clefPresets.find(c => c.id === p.clefPresetId)) {
    p.clefPresetId = study.clefPresets[0]?.id ?? null;
  }
  if (study?.rhythmDefault && p.rhythmPresetId == null) {
    p.rhythmPresetId = study.rhythmDefault;
  }
  return p;
}

function activeClefVoices(study, studyPrefs) {
  const preset = study.clefPresets?.find(c => c.id === studyPrefs.clefPresetId)
    || study.clefPresets?.[0];
  return preset?.voices || ['treble'];
}

// =============================================================================
// OSMD wiring

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

async function renderSheet(xml) {
  const container = document.getElementById('practice-sheet');
  if (!container) return;
  container.setAttribute('aria-busy', 'true');
  try {
    await loadOSMD();
    if (!window.opensheetmusicdisplay) throw new Error('OSMD not available');
    if (!practiceOSMD || practiceOSMD.container !== container) {
      practiceOSMD = new window.opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
        autoResize: true,
        drawTitle: false,
        drawComposer: false,
        drawSubtitle: false,
        drawCredits: false,
        drawPartNames: false,
        drawingParameters: 'compact',
        backend: 'svg',
        renderSingleHorizontalStaffline: false,
      });
      practiceOSMD.container = container;
    }
    await practiceOSMD.load(xml);
    requestAnimationFrame(() => {
      try {
        const w = container.clientWidth;
        practiceOSMD.zoom = w < 500 ? 0.7 : w < 720 ? 0.85 : 1.0;
        practiceOSMD.render();
      } catch (err) {
        container.innerHTML = `<p class="practice-sheet-fallback">Sheet music unavailable: ${err.message || err}</p>`;
      }
    });
  } catch {
    container.innerHTML = `<p class="practice-sheet-fallback">Sheet music unavailable.</p>`;
  } finally {
    container.setAttribute('aria-busy', 'false');
  }
}

// =============================================================================
// Generation — two-voice counterpoint

function buildTwoVoiceSong(study, opts) {
  const { keyPc, seed, difficulty, clefVoices, rhythmPresetId } = opts;
  const beatsPerBar = 4;
  const events = [];
  let accumulatedBeats = 0;
  let actBpm = null;

  // Per-voice tessitura anchor — keeps the line inside the chosen clef's
  // staff so the sheet music doesn't drift onto ledger lines.
  const [clef1, clef2 = clef1] = clefVoices || ['treble', 'treble'];
  const anchor1 = CLEF_ANCHORS[clef1] ?? 60;
  const anchor2 = CLEF_ANCHORS[clef2] ?? anchor1;

  // Rhythm preset → density/template overrides. When set, this wins over
  // the act's baseline density (which the master slider also influences).
  const rhythmPreset = rhythmPresetId && RHYTHM_PRESETS[rhythmPresetId];

  for (let i = 0; i < study.acts.length; i++) {
    const act = study.acts[i];
    const p = scaleParams(act.params, difficulty / 100);
    const actSeed = seed + i * 1000003;
    const rng = mulberry32(actSeed);

    const actTonicPc = (keyPc + (act.keyShift || 0)) % 12;
    const tonicMidi1 = anchor1 + actTonicPc;
    const tonicMidi2 = anchor2 + actTonicPc;
    const scale = act.params.scale || 'major';

    // Build the progression: PROGRESSIONS[name] is a degree array. Anchor
    // chord roots to voice 1's tessitura so the harmonic context tracks
    // the upper voice; the counterpoint is then placed relative to it.
    const degrees = PROGRESSIONS[act.progression] || PROGRESSIONS.pop;
    const beatsPerChord = (act.bars * beatsPerBar) / degrees.length;
    const progression = degrees.map((deg, idx) => {
      const notes = chordFromDegree(tonicMidi1, scale, deg);
      return {
        startBeat: idx * beatsPerChord,
        durationBeats: beatsPerChord,
        notes,
      };
    });

    // Rhythm preset wins over the slider-scaled density. The master slider
    // still nudges things via chromaticPct + tempo + independence.
    const rhythmDensity = rhythmPreset ? rhythmPreset.density : p.density;
    const rhythmTemplate = rhythmPreset ? rhythmPreset.template : 'auto';

    const rhythm = generateRhythm(rng, {
      bars: act.bars,
      beatsPerBar,
      density: rhythmDensity,
      swing: 0,
      template: rhythmTemplate,
    });
    const v1 = generateMelody(rng, {
      progression,
      rhythm,
      scale,
      tonic: tonicMidi1,
      contour: p.contour || 'auto',
    });
    const v2 = generateCounterpoint(rng, {
      melody: v1,
      scale,
      tonic: tonicMidi2,
      mode: 'free',
      independence: p.independence ?? 0.5,
      bars: act.bars,
      beatsPerBar,
      density: rhythmDensity,
    });

    for (const ev of v1) {
      events.push({
        type: 'melody',
        midi: ev.midi,
        atBeat: accumulatedBeats + ev.atBeat,
        durationBeats: ev.durationBeats,
        velocity: ev.velocity ?? 0.7,
      });
    }
    for (const ev of v2) {
      events.push({
        type: 'melody2',
        midi: ev.midi,
        atBeat: accumulatedBeats + ev.atBeat,
        durationBeats: ev.durationBeats,
        velocity: ev.velocity ?? 0.6,
      });
    }

    accumulatedBeats += act.bars * beatsPerBar;
    // Use the first act's tempo for transport. (Per-act tempo can land in PR 2
    // alongside per-act overrides — OSMD supports tempo changes mid-score.)
    if (actBpm == null) actBpm = p.tempo || 90;
  }

  return {
    bars: accumulatedBeats / beatsPerBar,
    beatsPerBar,
    lengthBeats: accumulatedBeats,
    events,
    bpm: actBpm,
  };
}

// Generation — walking-bass workout

function buildWalkingBassSong(study, opts) {
  const { keyPc, seed, difficulty, clefVoices } = opts;
  const beatsPerBar = 4;
  const events = [];
  const chordSymbols = [];   // indexed by bar — one symbol per bar
  let accumulatedBeats = 0;
  let actBpm = null;

  // When the user picks treble clef we move the generated bassline up an
  // octave so the notes sit in the treble staff (cellists reading up,
  // viola etc.). Otherwise stick with the original cello-friendly range.
  const clef = clefVoices?.[0] || 'bass';
  const bassMidi = clef === 'treble' ? 52 : 40;

  for (let i = 0; i < study.acts.length; i++) {
    const act = study.acts[i];
    const p = scaleParams(act.params, difficulty / 100);
    const actTonicPc = (keyPc + (act.keyShift || 0)) % 12;
    const chords = progressionToChords(act.progression, actTonicPc);

    // Repeat the chord cycle to fill the act's bar count.
    const repeats = Math.max(1, Math.ceil(act.bars / chords.length));
    const expanded = [];
    for (let r = 0; r < repeats; r++) expanded.push(...chords);
    const slice = expanded.slice(0, act.bars);

    const { notes } = generateWalkingBass({
      seed: seed + i * 7919,
      tonicPc: actTonicPc,
      scale: act.params.scale || 'natural_minor',
      chords: slice,
      bassMidi,
    });

    // 4 quarter notes per bar.
    for (let j = 0; j < notes.length; j++) {
      events.push({
        type: 'bass',
        midi: notes[j],
        atBeat: accumulatedBeats + j,
        durationBeats: 1,
        velocity: 0.75,
      });
    }

    // One chord symbol per bar; songToMusicXML renders these as <harmony>
    // tags above the staff.
    for (let b = 0; b < slice.length; b++) {
      chordSymbols.push(chordSymbolFor(slice[b]));
    }

    accumulatedBeats += act.bars * beatsPerBar;
    if (actBpm == null) actBpm = p.tempo || 100;
  }

  return {
    bars: accumulatedBeats / beatsPerBar,
    beatsPerBar,
    lengthBeats: accumulatedBeats,
    events,
    chordSymbols,
    bpm: actBpm,
  };
}

function buildSong(study, opts) {
  if (study.kind === 'two-voice-counterpoint') return buildTwoVoiceSong(study, opts);
  if (study.kind === 'walking-bass-workout') return buildWalkingBassSong(study, opts);
  throw new Error(`Unknown study kind: ${study.kind}`);
}

// =============================================================================
// Catalog rendering

function renderCatalog() {
  const root = document.getElementById('practice-catalog');
  if (!root) return;
  root.innerHTML = '';
  for (const study of STUDIES) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'practice-card';
    card.dataset.id = study.id;

    const eyebrow = document.createElement('span');
    eyebrow.className = 'practice-card-eyebrow';
    eyebrow.textContent = getStudyField(study, 'eyebrow');

    const title = document.createElement('h3');
    title.className = 'practice-card-title';
    title.textContent = getStudyField(study, 'title');

    const summary = document.createElement('p');
    summary.className = 'practice-card-summary';
    summary.textContent = getStudyField(study, 'summary');

    const cta = document.createElement('span');
    cta.className = 'practice-card-cta';
    cta.textContent = t('practice.open', 'Open');

    card.appendChild(eyebrow);
    card.appendChild(title);
    card.appendChild(summary);
    card.appendChild(cta);
    card.addEventListener('click', () => openStudy(study.id));
    root.appendChild(card);
  }
}

// =============================================================================
// Study player

function openStudy(studyId) {
  const study = STUDIES.find(s => s.id === studyId);
  if (!study) return;
  activeStudy = study;
  prefs.studyId = studyId;
  savePrefs();
  populateControls();
  document.getElementById('practice-study-eyebrow').textContent = getStudyField(study, 'eyebrow');
  document.getElementById('practice-study-title').textContent = getStudyField(study, 'title');
  document.getElementById('practice-study-desc').textContent = getStudyField(study, 'summary');
  renderActRail();
  document.getElementById('practice-study-overlay').classList.remove('hidden');
  document.body.classList.add('practice-overlay-open');
  regenerate();
}

function closeStudy() {
  stopPlayback();
  document.getElementById('practice-study-overlay').classList.add('hidden');
  document.body.classList.remove('practice-overlay-open');
  activeStudy = null;
}

function populateControls() {
  if (!activeStudy) return;
  const studyPrefs = getStudyPrefs(activeStudy.id);

  const keySel = document.getElementById('practice-key');
  keySel.innerHTML = '';
  for (const pc of activeStudy.keyOptions) {
    const opt = document.createElement('option');
    opt.value = String(pc);
    opt.textContent = tonicName(pc);
    if (pc === studyPrefs.keyPc) opt.selected = true;
    keySel.appendChild(opt);
  }

  // Clef preset picker — populated from the study's clefPresets list.
  const clefSel = document.getElementById('practice-clef');
  const clefField = document.getElementById('practice-clef-field');
  if (clefSel && activeStudy.clefPresets?.length) {
    clefSel.innerHTML = '';
    for (const preset of activeStudy.clefPresets) {
      const opt = document.createElement('option');
      opt.value = preset.id;
      opt.textContent = preset.label;
      if (preset.id === studyPrefs.clefPresetId) opt.selected = true;
      clefSel.appendChild(opt);
    }
    if (clefField) clefField.style.display = '';
  } else if (clefField) {
    clefField.style.display = 'none';
  }

  // Rhythm preset picker — only shown for studies that declared rhythm presets
  // (currently the two-voice invention; walking-bass has its own rhythm logic).
  const rhythmSel = document.getElementById('practice-rhythm');
  const rhythmField = document.getElementById('practice-rhythm-field');
  if (rhythmSel && activeStudy.rhythmDefault) {
    rhythmSel.innerHTML = '';
    for (const [id, preset] of Object.entries(RHYTHM_PRESETS)) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = preset.label;
      if (id === studyPrefs.rhythmPresetId) opt.selected = true;
      rhythmSel.appendChild(opt);
    }
    if (rhythmField) rhythmField.style.display = '';
  } else if (rhythmField) {
    rhythmField.style.display = 'none';
  }

  const diff = document.getElementById('practice-difficulty');
  diff.value = String(studyPrefs.difficulty);
  document.getElementById('practice-difficulty-display').textContent = `${studyPrefs.difficulty}%`;

  document.getElementById('practice-seed').value = String(studyPrefs.seed);
  updateControlsInfo();
}

function updateControlsInfo() {
  if (!activeStudy) return;
  const sp = getStudyPrefs(activeStudy.id);
  const info = document.getElementById('practice-controls-info');
  if (!info) return;
  const pieces = [tonicName(sp.keyPc), `${sp.difficulty}%`];
  const preset = activeStudy.clefPresets?.find(c => c.id === sp.clefPresetId);
  if (preset) pieces.push(preset.voices.join('+'));
  if (sp.rhythmPresetId && activeStudy.rhythmDefault) {
    pieces.push(RHYTHM_PRESETS[sp.rhythmPresetId]?.label || sp.rhythmPresetId);
  }
  pieces.push(`seed ${sp.seed}`);
  info.textContent = pieces.join(' · ');
}

function renderActRail() {
  if (!activeStudy) return;
  const rail = document.getElementById('practice-act-rail');
  rail.innerHTML = '';
  activeStudy.acts.forEach((act, idx) => {
    const item = document.createElement('div');
    item.className = 'practice-act-rail-item';
    const dot = document.createElement('span');
    dot.className = 'practice-act-rail-dot';
    dot.textContent = String(idx + 1);
    const label = document.createElement('span');
    label.className = 'practice-act-rail-label';
    label.textContent = act.title;
    item.appendChild(dot);
    item.appendChild(label);
    rail.appendChild(item);
  });
}

async function regenerate() {
  if (!activeStudy) return;
  const sp = getStudyPrefs(activeStudy.id);
  updateControlsInfo();
  const clefVoices = activeClefVoices(activeStudy, sp);
  const song = buildSong(activeStudy, { ...sp, clefVoices });
  lastSong = song;
  lastBpm = song.bpm;
  // Pick which track types to include based on the study kind.
  const tracks = activeStudy.kind === 'two-voice-counterpoint'
    ? ['melody', 'melody2']
    : ['bass'];
  const clefOverrides = {
    melody: clefVoices[0],
    melody2: clefVoices[1] || clefVoices[0],
    bass: clefVoices[0],
  };
  const xml = songToMusicXML(song, {
    bpm: song.bpm,
    tracks,
    clefOverrides,
    chordSymbols: song.chordSymbols,
  });
  await renderSheet(xml);
}

// =============================================================================
// Audio playback

function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

async function playSong() {
  if (!lastSong || !audioApiRef) return;
  await audioApiRef.ensureInit();
  const ctx = audioApiRef.getContext();
  if (!ctx) return;
  const dest = audioApiRef.getMasterGain();
  if (!dest) return;
  stopPlayback();

  const beatDuration = 60 / lastBpm;
  const startAt = ctx.currentTime + 0.05;
  for (const ev of lastSong.events) {
    const when = startAt + ev.atBeat * beatDuration;
    const dur = ev.durationBeats * beatDuration;
    const osc = ctx.createOscillator();
    osc.type = ev.type === 'bass' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(midiToFreq(ev.midi), when);
    const gain = ctx.createGain();
    const v = (ev.velocity || 0.7) * 0.4;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(v, when + 0.01);
    gain.gain.linearRampToValueAtTime(0, when + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(when);
    osc.stop(when + dur + 0.05);
    scheduledNodes.push(osc, gain);
  }

  const totalSec = lastSong.lengthBeats * beatDuration + 0.5;
  const playBtn = document.getElementById('practice-play');
  if (playBtn) playBtn.classList.add('is-playing');
  playbackTimer = setTimeout(() => stopPlayback(), totalSec * 1000);
  // tick the timer display
  const startTs = performance.now();
  const tick = () => {
    if (!playbackTimer) return;
    const elapsed = (performance.now() - startTs) / 1000;
    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60).toString().padStart(2, '0');
    const t = document.getElementById('practice-playback-time');
    if (t) t.textContent = `${m}:${s}`;
    if (playbackTimer) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function stopPlayback() {
  if (playbackTimer) { clearTimeout(playbackTimer); playbackTimer = null; }
  for (const n of scheduledNodes) {
    try { n.stop?.(); } catch { /* ignore */ }
    try { n.disconnect(); } catch { /* ignore */ }
  }
  scheduledNodes = [];
  const playBtn = document.getElementById('practice-play');
  if (playBtn) playBtn.classList.remove('is-playing');
  const t = document.getElementById('practice-playback-time');
  if (t) t.textContent = '0:00';
}

// =============================================================================
// Print / PDF

function openPrintView() {
  if (!activeStudy) return;
  document.body.classList.add('practice-printing');
  // Browsers handle the dialog; we remove the class on afterprint.
  const cleanup = () => {
    document.body.classList.remove('practice-printing');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

// =============================================================================
// Init

export function initPracticeView({ audioApi } = {}) {
  audioApiRef = audioApi;
  loadPrefs();
  renderCatalog();

  onLangChange(() => {
    renderCatalog();
    if (activeStudy) {
      document.getElementById('practice-study-eyebrow').textContent = getStudyField(activeStudy, 'eyebrow');
      document.getElementById('practice-study-title').textContent = getStudyField(activeStudy, 'title');
      document.getElementById('practice-study-desc').textContent = getStudyField(activeStudy, 'summary');
    }
  });

  document.getElementById('practice-study-close')?.addEventListener('click', closeStudy);
  document.getElementById('practice-study-print')?.addEventListener('click', openPrintView);

  document.getElementById('practice-key')?.addEventListener('change', (e) => {
    if (!activeStudy) return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.keyPc = Number(e.target.value);
    savePrefs();
    regenerate();
  });
  document.getElementById('practice-clef')?.addEventListener('change', (e) => {
    if (!activeStudy) return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.clefPresetId = e.target.value;
    savePrefs();
    regenerate();
  });
  document.getElementById('practice-rhythm')?.addEventListener('change', (e) => {
    if (!activeStudy) return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.rhythmPresetId = e.target.value;
    savePrefs();
    regenerate();
  });
  document.getElementById('practice-difficulty')?.addEventListener('input', (e) => {
    if (!activeStudy) return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.difficulty = Number(e.target.value);
    document.getElementById('practice-difficulty-display').textContent = `${sp.difficulty}%`;
    savePrefs();
    regenerate();
  });
  document.getElementById('practice-seed')?.addEventListener('change', (e) => {
    if (!activeStudy) return;
    const sp = getStudyPrefs(activeStudy.id);
    const v = Number(e.target.value);
    if (Number.isFinite(v)) {
      sp.seed = v;
      savePrefs();
      regenerate();
    }
  });
  document.getElementById('practice-reroll')?.addEventListener('click', () => {
    if (!activeStudy) return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.seed = randomSeed();
    document.getElementById('practice-seed').value = String(sp.seed);
    savePrefs();
    regenerate();
  });
  document.getElementById('practice-play')?.addEventListener('click', () => {
    if (playbackTimer) stopPlayback();
    else playSong();
  });
}

// For tests: expose pure helpers (the side-effectful init isn't tested directly).
export const __test = { buildSong, scaleParams };
