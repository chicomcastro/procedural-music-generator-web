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

import { STUDIES, scaleParams, tonicName, CLEF_ANCHORS, CLEF_RANGES, RHYTHM_PRESETS, DUET_STYLES, SCALE_OPTIONS, CONTOUR_OPTIONS, SCALE_SHAPES, VOICE_OPTIONS, clampMidiToRange, tonicMidiFor, ETUDE_PATTERNS, ETUDE_OCTAVE_OPTIONS, ETUDE_RHYTHMS, extendShapeOctaves, etudeStartOptions, RHYTHM_VOCAB, RHYTHM_VOCAB_DEFAULTS, PROGRESSION_OPTIONS, PART_VIEW_OPTIONS } from './practice-studies.js';
import { getStudyField } from './practice-translations.js';
import { mulberry32, randomSeed } from '../generate/rng.js';
import { generateMelody } from '../generate/melody.js';
import { generateCounterpoint } from '../generate/counterpoint.js';
import { generateRhythm } from '../generate/rhythm.js';
import { generateWalkingBass, progressionToChords, chordSymbolFor } from '../generate/walking-bass.js';

// Infer a chord symbol from a diatonic triad's MIDI notes. The Practice
// invention / solo / modal builders use chordFromDegree which returns
// raw MIDI; we map back to the symbol shape (root + maj/min/dim suffix)
// so the score can label each chord span.
const PC_NAMES_CHORD = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
function chordSymbolFromTriad(notes) {
  if (!Array.isArray(notes) || notes.length < 3) return '';
  const [r, t, f] = notes;
  const rootPc = ((r % 12) + 12) % 12;
  const thirdInt = ((t - r) % 12 + 12) % 12;
  const fifthInt = ((f - r) % 12 + 12) % 12;
  const name = PC_NAMES_CHORD[rootPc];
  if (thirdInt === 4 && fifthInt === 7) return name;
  if (thirdInt === 3 && fifthInt === 7) return name + 'm';
  if (thirdInt === 3 && fifthInt === 6) return name + '°';
  if (thirdInt === 4 && fifthInt === 8) return name + 'aug';
  return name;
}
import { loadAll as loadSamples, getPlaybackFor } from '../audio/SampleLibrary.js';
import { createVoice } from '../audio/Voice.js';
import { createSynthVoice } from '../audio/SynthVoice.js';
import { chordFromDegree, PROGRESSIONS } from '../theory/chords.js';
import { keyFifths } from '../theory/scales.js';
import { songToMusicXML } from '../export/musicxml.js';
import { t, onLangChange } from '../i18n/i18n.js';

const STORAGE_KEY = 'seedsong-practice-prefs-v1';

let audioApiRef = null;
let activeStudy = null;
let prefs = { studyId: null, byStudy: {}, favorites: [] };
// One OSMD instance per container — Practice owns its own.
let osmdLoading = null;
let practiceOSMD = null;
let lastSong = null;            // most recent generated song (for playback)
let lastBpm = 100;
let playbackTimer = null;
// Play/pause fix: playbackTimer is only set AFTER the async setup
// (ensureInit + piano-sample loading), so it can't serve as the
// "is playing" flag — a click during that window used to start a
// SECOND playback on top. isPlaying flips synchronously on click;
// playGeneration invalidates in-flight playSong runs on stop.
let isPlaying = false;
let playGeneration = 0;
let scheduledVoices = [];

// =============================================================================
// Persistence

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      prefs = {
        studyId: parsed.studyId || null,
        byStudy: parsed.byStudy || {},
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
        // ADR 0006: stand-mode zoom is global — the right size for a given
        // music-stand distance doesn't change per study.
        standZoom: typeof parsed.standZoom === 'number' ? parsed.standZoom : 1.3,
      };
    }
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
      duetStyleId: study?.duetDefault ?? null,
      scaleId: 'auto',
      contourId: 'auto',
      swing: 0,
      intensity: 100,        // velocity multiplier %, 100 = baseline
      rhythmVocab: study?.kind === 'duet-workshop' ? [...RHYTHM_VOCAB_DEFAULTS] : null,
      progressionId: study?.kind === 'duet-workshop' ? 'pop' : null,
      partView: study?.kind === 'duet-workshop' ? 'both' : null,
      actIdx: 0,               // ADR 0007: selected exercise for actMode 'exercises'
      // ADR 0008: parametric scale etude.
      etudePatternId: study?.kind === 'scale-etude' ? 'scale' : null,
      etudeOctaves: study?.kind === 'scale-etude' ? 1 : null,
      etudeRhythm: study?.kind === 'scale-etude' ? 'eighth' : null,
      etudeStartMidi: null,   // ADR 0009: null = default register
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
  if (study?.duetDefault && p.duetStyleId == null) {
    p.duetStyleId = study.duetDefault;
  }
  if (p.scaleId == null) p.scaleId = 'auto';
  if (p.contourId == null) p.contourId = 'auto';
  if (p.swing == null) p.swing = 0;
  if (p.intensity == null) p.intensity = 100;
  if (p.voiceId == null) p.voiceId = null;   // null = use the kind's default
  if (!Number.isInteger(p.actIdx) || p.actIdx < 0) p.actIdx = 0;   // ADR 0007 backfill
  if (study?.kind === 'scale-etude') {                             // ADR 0008 backfill
    if (!ETUDE_PATTERNS.find(pt => pt.id === p.etudePatternId)) p.etudePatternId = 'scale';
    if (!ETUDE_OCTAVE_OPTIONS.includes(p.etudeOctaves)) p.etudeOctaves = 1;
    if (!ETUDE_RHYTHMS.find(r => r.id === p.etudeRhythm)) p.etudeRhythm = 'eighth';
    if (!Number.isInteger(p.etudeStartMidi)) p.etudeStartMidi = null;
  }
  if (study?.kind === 'duet-workshop') {
    if (!Array.isArray(p.rhythmVocab) || p.rhythmVocab.length === 0) p.rhythmVocab = [...RHYTHM_VOCAB_DEFAULTS];
    if (!p.progressionId) p.progressionId = 'pop';
    if (!p.partView) p.partView = 'both';
  }
  return p;
}

// ADR 0004: post-process generateRhythm's onsets to honour the user-
// picked vocab. Drops off-beat onsets when eighths aren't allowed, then
// snaps each onset's durationBeats DOWN to the largest allowed value
// ≤ the gap to the next onset.
function filterRhythmToVocab(onsets, allowed, totalBeats) {
  if (!Array.isArray(allowed) || allowed.length === 0) return onsets;
  const allowedBeats = allowed
    .map(id => RHYTHM_VOCAB[id]?.beats)
    .filter(b => typeof b === 'number')
    .sort((a, b) => a - b);
  if (allowedBeats.length === 0) return onsets;
  const eighthAllowed = allowedBeats.includes(0.5);
  const kept = onsets.filter(o => eighthAllowed || Number.isInteger(o.atBeat));
  if (kept.length === 0) return onsets;
  for (let i = 0; i < kept.length; i++) {
    const next = i < kept.length - 1 ? kept[i + 1].atBeat : totalBeats;
    const gap = next - kept[i].atBeat;
    let chosen = allowedBeats[0];   // fall back to smallest if gap < every allowed value
    for (const b of allowedBeats) {
      if (b <= gap) chosen = b;
    }
    kept[i] = { ...kept[i], durationBeats: chosen };
  }
  return kept;
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
  const {
    keyPc, seed, difficulty, clefVoices, rhythmPresetId, duetStyleId,
    scaleId, contourId, swing: swingPct, intensity: intensityPct,
    rhythmVocab, progressionId,   // ADR 0004: only used by 'duet-workshop' kind
  } = opts;
  const swing = (swingPct ?? 0) / 100;
  const velocityScale = (intensityPct ?? 100) / 100;
  const beatsPerBar = 4;
  const events = [];
  const chordSymbols = [];     // one entry per bar; '' = no change shown
  const doubleBarsBefore = []; // bar indices where a double bar precedes the bar
  const keySignatures = [];    // per-act { bar, fifths } (PR Q)
  let accumulatedBeats = 0;
  let actBpm = null;

  // Per-voice tessitura anchor — keeps the line inside the chosen clef's
  // staff so the sheet music doesn't drift onto ledger lines. The
  // companion CLEF_RANGES is applied as a hard clamp after generation:
  // generateCounterpoint's "free" mode can drift below the cello's open
  // C (its candidate range is melMin-19), so we octave-shift any note
  // that lands outside the playable bounds.
  const [clef1, clef2 = clef1] = clefVoices || ['treble', 'treble'];
  const anchor1 = CLEF_ANCHORS[clef1] ?? 60;
  const anchor2 = CLEF_ANCHORS[clef2] ?? anchor1;
  const range1 = CLEF_RANGES[clef1] || [36, 84];
  const range2 = CLEF_RANGES[clef2] || [36, 84];

  // Rhythm preset → density/template overrides. When set, this wins over
  // the act's baseline density (which the master slider also influences).
  const rhythmPreset = rhythmPresetId && RHYTHM_PRESETS[rhythmPresetId];
  // Duet style → counterpoint mode + independence baseline. Acts can
  // still nudge independence via the difficulty slider.
  const duetStyle = (duetStyleId && DUET_STYLES[duetStyleId]) || DUET_STYLES.free;

  for (let i = 0; i < study.acts.length; i++) {
    const act = study.acts[i];
    const p = scaleParams(act.params, difficulty / 100);
    const actSeed = seed + i * 1000003;
    const rng = mulberry32(actSeed);

    const actTonicPc = (keyPc + (act.keyShift || 0)) % 12;
    const tonicMidi1 = tonicMidiFor(anchor1, actTonicPc);
    const tonicMidi2 = tonicMidiFor(anchor2, actTonicPc);
    // Scale picker beats the act's default; 'auto' falls back to per-act.
    const scale = (scaleId && scaleId !== 'auto') ? scaleId : (act.params.scale || 'major');
    keySignatures.push({ bar: accumulatedBeats / beatsPerBar, fifths: keyFifths(actTonicPc, scale) });

    // Build the progression: PROGRESSIONS[name] is a degree array. Anchor
    // chord roots to voice 1's tessitura so the harmonic context tracks
    // the upper voice; the counterpoint is then placed relative to it.
    // ADR 0004: duet-workshop lets the user override the act's progression.
    const progKey = (study.kind === 'duet-workshop' && progressionId && PROGRESSIONS[progressionId])
      ? progressionId
      : act.progression;
    const degrees = PROGRESSIONS[progKey] || PROGRESSIONS.pop;
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

    let rhythm = generateRhythm(rng, {
      bars: act.bars,
      beatsPerBar,
      density: rhythmDensity,
      swing,
      template: rhythmTemplate,
    });
    // ADR 0004: duet-workshop applies a user-picked note-value vocab.
    if (study.kind === 'duet-workshop' && Array.isArray(rhythmVocab)) {
      rhythm = filterRhythmToVocab(rhythm, rhythmVocab, act.bars * beatsPerBar);
    }
    // Contour picker beats the act default ('auto' = fall back per-act).
    const contour = (contourId && contourId !== 'auto') ? contourId : (p.contour || 'auto');
    const v1 = generateMelody(rng, {
      progression,
      rhythm,
      scale,
      tonic: tonicMidi1,
      contour,
    });
    // Duet style picker overrides counterpoint mode. independence comes
    // from the style preset blended with the act's act-specific value so
    // higher-difficulty acts retain their character.
    const independence = duetStyle.mode === 'free'
      ? (p.independence ?? duetStyle.independence)
      : duetStyle.independence;
    const v2 = generateCounterpoint(rng, {
      melody: v1,
      scale,
      tonic: tonicMidi2,
      mode: duetStyle.mode,
      independence,
      bars: act.bars,
      beatsPerBar,
      density: rhythmDensity,
    });

    for (const ev of v1) {
      events.push({
        type: 'melody',
        midi: clampMidiToRange(ev.midi, range1),
        atBeat: accumulatedBeats + ev.atBeat,
        durationBeats: ev.durationBeats,
        velocity: Math.min(1, (ev.velocity ?? 0.7) * velocityScale),
      });
    }
    for (const ev of v2) {
      events.push({
        type: 'melody2',
        midi: clampMidiToRange(ev.midi, range2),
        atBeat: accumulatedBeats + ev.atBeat,
        durationBeats: ev.durationBeats,
        velocity: Math.min(1, (ev.velocity ?? 0.6) * velocityScale),
      });
    }

    // Lay down chord symbols. Each progression-chord occupies one or more
    // bars; emit the symbol on the bar where the chord starts, leave the
    // bars it sustains across blank so OSMD only labels the change.
    const actStartBar = accumulatedBeats / beatsPerBar;
    for (let b = 0; b < act.bars; b++) chordSymbols.push('');
    for (const ch of progression) {
      const bar = actStartBar + Math.floor(ch.startBeat / beatsPerBar);
      const idx = Math.round(bar);
      if (idx < chordSymbols.length) chordSymbols[idx] = chordSymbolFromTriad(ch.notes);
    }

    accumulatedBeats += act.bars * beatsPerBar;
    // Mark a double bar before the next act (skip after the final act).
    if (i < study.acts.length - 1) doubleBarsBefore.push(accumulatedBeats / beatsPerBar);
    // Use the first act's tempo for transport. (Per-act tempo can land in PR 2
    // alongside per-act overrides — OSMD supports tempo changes mid-score.)
    if (actBpm == null) actBpm = p.tempo || 90;
  }

  return {
    bars: accumulatedBeats / beatsPerBar,
    beatsPerBar,
    lengthBeats: accumulatedBeats,
    events,
    chordSymbols,
    doubleBarsBefore,
    keySignatures,
    bpm: actBpm,
  };
}

// Generation — walking-bass workout

function buildWalkingBassSong(study, opts) {
  const { keyPc, seed, difficulty, clefVoices, scaleId, intensity: intensityPct } = opts;
  const velocityScale = (intensityPct ?? 100) / 100;
  const beatsPerBar = 4;
  const events = [];
  const chordSymbols = [];     // indexed by bar — one symbol per bar
  const doubleBarsBefore = []; // bar indices preceded by a double bar (act boundaries)
  const keySignatures = [];    // per-act { bar, fifths } (PR Q)
  let accumulatedBeats = 0;
  let actBpm = null;

  // When the user picks treble clef we move the generated bassline up an
  // octave so the notes sit in the treble staff (cellists reading up,
  // viola etc.). Otherwise stick with the original cello-friendly range.
  const clef = clefVoices?.[0] || 'bass';
  const bassMidi = clef === 'treble' ? 52 : 40;
  const range = CLEF_RANGES[clef] || [36, 84];

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

    const wbScale = (scaleId && scaleId !== 'auto') ? scaleId : (act.params.scale || 'natural_minor');
    keySignatures.push({ bar: accumulatedBeats / beatsPerBar, fifths: keyFifths(actTonicPc, wbScale) });
    const { notes } = generateWalkingBass({
      seed: seed + i * 7919,
      tonicPc: actTonicPc,
      scale: wbScale,
      chords: slice,
      bassMidi,
    });

    // 4 quarter notes per bar.
    for (let j = 0; j < notes.length; j++) {
      events.push({
        type: 'bass',
        midi: clampMidiToRange(notes[j], range),
        atBeat: accumulatedBeats + j,
        durationBeats: 1,
        velocity: Math.min(1, 0.75 * velocityScale),
      });
    }

    // One chord symbol per bar; songToMusicXML renders these as <harmony>
    // tags above the staff.
    for (let b = 0; b < slice.length; b++) {
      chordSymbols.push(chordSymbolFor(slice[b]));
    }

    accumulatedBeats += act.bars * beatsPerBar;
    if (i < study.acts.length - 1) doubleBarsBefore.push(accumulatedBeats / beatsPerBar);
    if (actBpm == null) actBpm = p.tempo || 100;
  }

  return {
    bars: accumulatedBeats / beatsPerBar,
    beatsPerBar,
    lengthBeats: accumulatedBeats,
    events,
    chordSymbols,
    doubleBarsBefore,
    keySignatures,
    bpm: actBpm,
  };
}

function buildSong(study, opts) {
  // ADR 0007: in 'exercises' mode only the selected act is generated —
  // the builders all iterate study.acts, so a filtered copy is enough.
  if (study.actMode === 'exercises' && Array.isArray(study.acts) && study.acts.length > 1) {
    const idx = Math.max(0, Math.min(study.acts.length - 1, opts.actIdx | 0));
    study = { ...study, acts: [study.acts[idx]] };
  }
  if (study.kind === 'two-voice-counterpoint') return buildTwoVoiceSong(study, opts);
  if (study.kind === 'duet-workshop')          return buildTwoVoiceSong(study, opts);
  if (study.kind === 'walking-bass-workout') return buildWalkingBassSong(study, opts);
  if (study.kind === 'scale-etude') return buildScaleEtudeSong(study, opts);
  if (study.kind === 'solo-etude') return buildSoloEtudeSong(study, opts);
  if (study.kind === 'modal-vamp') return buildModalVampSong(study, opts);
  throw new Error(`Unknown study kind: ${study.kind}`);
}

// =============================================================================
// Generation — scale etude
//
// Each act runs a SCALE_PATTERNS function over the act's SCALE_SHAPES
// scale to produce a stream of pitch-class steps. Notes render as eighth
// notes (triplets for the threes patterns), one act after the next.

function buildScaleEtudeSong(study, opts) {
  // ADR 0008: single-act sandbox — pattern x octaves x note value.
  const {
    keyPc, difficulty, clefVoices, scaleId,
    etudePatternId, etudeOctaves, etudeRhythm, etudeStartMidi,
  } = opts;
  const beatsPerBar = 4;
  const events = [];

  const act = study.acts[0];
  const p = scaleParams(act.params, difficulty / 100);

  const [clef] = clefVoices || ['treble'];
  const anchor = CLEF_ANCHORS[clef] ?? 60;
  const range = CLEF_RANGES[clef] || [36, 84];

  const scaleName = (scaleId && scaleId !== 'auto') ? scaleId : (act.params.scale || 'major');
  const octaves = etudeOctaves === 2 ? 2 : 1;
  const shape = extendShapeOctaves(SCALE_SHAPES[scaleName] || SCALE_SHAPES.major, octaves);
  const pattern = ETUDE_PATTERNS.find(pt => pt.id === etudePatternId) || ETUDE_PATTERNS[0];
  const rhythm = ETUDE_RHYTHMS.find(r => r.id === etudeRhythm) || ETUDE_RHYTHMS.find(r => r.id === 'eighth');
  const maxOffset = shape[shape.length - 1];

  // ADR 0009: the Start-note dropdown picks the tonic register directly
  // (down to the instrument's low open string). Falls back to the
  // lowest tonic at/above the clef anchor when unset or invalid — the
  // pre-0009 behaviour.
  const startOpts = etudeStartOptions(clef, keyPc);
  let tonic;
  if (Number.isInteger(etudeStartMidi) && startOpts.some(o => o.midi === etudeStartMidi)) {
    tonic = etudeStartMidi;
  } else {
    tonic = tonicMidiFor(anchor, ((keyPc % 12) + 12) % 12);
    if (tonic + maxOffset > range[1] && tonic - 12 >= range[0]) tonic -= 12;
  }
  // Widen the clamp range so a low-string start (or a high one) isn't
  // pulled back toward the clef's default reading band.
  const etudeRange = [Math.min(range[0], tonic), Math.max(range[1], tonic + maxOffset)];

  // ADR 0010: rhythm is a repeating cell pattern — note j takes
  // cells[j % cells.length]. atBeat accumulates each cell's duration.
  const cells = rhythm.cells;
  // A wide interval (e.g. broken sevenths) may not fit a short scale
  // (pentatonic, one octave) — fall back to the plain scale so the drill
  // is never empty.
  let sequence = pattern.build(shape.length);
  if (sequence.length === 0) sequence = ETUDE_PATTERNS[0].build(shape.length);
  let at = 0;
  for (let j = 0; j < sequence.length; j++) {
    const cell = cells[j % cells.length];
    const midi = clampMidiToRange(tonic + shape[sequence[j]], etudeRange);
    events.push({
      type: 'melody',
      midi,
      atBeat: at,
      durationBeats: cell.beats,
      velocity: 0.75,
      noteType: cell.noteType,
    });
    at += cell.beats;
  }

  // Bars derive from the accumulated duration; the serializer pads the
  // last bar with rests.
  const totalBeats = at;
  const bars = Math.max(1, Math.ceil(totalBeats / beatsPerBar - 1e-9));

  return {
    bars,
    beatsPerBar,
    lengthBeats: bars * beatsPerBar,
    events,
    doubleBarsBefore: [],
    keySignatures: [{ bar: 0, fifths: keyFifths(((keyPc % 12) + 12) % 12, scaleName) }],
    bpm: p.tempo || 80,
  };
}

// =============================================================================
// Generation — solo etude (single voice over real chord changes)
//
// Same shape as the two-voice invention but only voice 1. Inherits the
// rhythm / contour / scale / swing / intensity controls so everything in
// the Adjust panel still works.

function buildSoloEtudeSong(study, opts) {
  const {
    keyPc, seed, difficulty, clefVoices, rhythmPresetId,
    scaleId, contourId, swing: swingPct, intensity: intensityPct,
  } = opts;
  const swing = (swingPct ?? 0) / 100;
  const velocityScale = (intensityPct ?? 100) / 100;
  const beatsPerBar = 4;
  const events = [];
  const chordSymbols = [];
  const doubleBarsBefore = [];
  const keySignatures = [];    // per-act { bar, fifths } (PR Q)
  let accumulatedBeats = 0;
  let actBpm = null;

  const [clef] = clefVoices || ['treble'];
  const anchor = CLEF_ANCHORS[clef] ?? 60;
  const range = CLEF_RANGES[clef] || [36, 84];
  const rhythmPreset = rhythmPresetId && RHYTHM_PRESETS[rhythmPresetId];

  for (let i = 0; i < study.acts.length; i++) {
    const act = study.acts[i];
    const p = scaleParams(act.params, difficulty / 100);
    const rng = mulberry32(seed + i * 1000003);

    const tonic = tonicMidiFor(anchor, (keyPc + (act.keyShift || 0)) % 12);
    const scale = (scaleId && scaleId !== 'auto') ? scaleId : (act.params.scale || 'major');
    keySignatures.push({ bar: accumulatedBeats / beatsPerBar, fifths: keyFifths((keyPc + (act.keyShift || 0)) % 12, scale) });
    const degrees = PROGRESSIONS[act.progression] || PROGRESSIONS.pop;
    const beatsPerChord = (act.bars * beatsPerBar) / degrees.length;
    const progression = degrees.map((deg, idx) => ({
      startBeat: idx * beatsPerChord,
      durationBeats: beatsPerChord,
      notes: chordFromDegree(tonic, scale, deg),
    }));

    const density = rhythmPreset ? rhythmPreset.density : p.density;
    const template = rhythmPreset ? rhythmPreset.template : 'auto';
    const rhythm = generateRhythm(rng, { bars: act.bars, beatsPerBar, density, swing, template });
    const contour = (contourId && contourId !== 'auto') ? contourId : (p.contour || 'auto');
    const line = generateMelody(rng, { progression, rhythm, scale, tonic, contour });

    for (const ev of line) {
      events.push({
        type: 'melody',
        midi: clampMidiToRange(ev.midi, range),
        atBeat: accumulatedBeats + ev.atBeat,
        durationBeats: ev.durationBeats,
        velocity: Math.min(1, (ev.velocity ?? 0.7) * velocityScale),
      });
    }

    // Chord symbols above the bar each chord starts on; subsequent bars
    // covered by the same chord stay blank so OSMD only labels changes.
    const actStartBar = accumulatedBeats / beatsPerBar;
    for (let b = 0; b < act.bars; b++) chordSymbols.push('');
    for (const ch of progression) {
      const idx = Math.round(actStartBar + Math.floor(ch.startBeat / beatsPerBar));
      if (idx < chordSymbols.length) chordSymbols[idx] = chordSymbolFromTriad(ch.notes);
    }

    accumulatedBeats += act.bars * beatsPerBar;
    if (i < study.acts.length - 1) doubleBarsBefore.push(accumulatedBeats / beatsPerBar);
    if (actBpm == null) actBpm = p.tempo || 90;
  }

  return {
    bars: accumulatedBeats / beatsPerBar,
    beatsPerBar,
    lengthBeats: accumulatedBeats,
    events,
    chordSymbols,
    doubleBarsBefore,
    keySignatures,
    bpm: actBpm,
  };
}

// =============================================================================
// Generation — modal vamp
//
// Each act repeats a short chord vamp (e.g. [1, 4] for i-IV) for the
// act's bar count, and a single voice improvises over it in the act's
// chosen mode. Single voice; clef + range controls apply.

function buildModalVampSong(study, opts) {
  const {
    keyPc, seed, difficulty, clefVoices, rhythmPresetId,
    scaleId, contourId, swing: swingPct, intensity: intensityPct,
  } = opts;
  const swing = (swingPct ?? 0) / 100;
  const velocityScale = (intensityPct ?? 100) / 100;
  const beatsPerBar = 4;
  const events = [];
  const chordSymbols = [];
  const doubleBarsBefore = [];
  const keySignatures = [];    // per-act { bar, fifths } (PR Q)
  let accumulatedBeats = 0;
  let actBpm = null;

  const [clef] = clefVoices || ['treble'];
  const anchor = CLEF_ANCHORS[clef] ?? 60;
  const range = CLEF_RANGES[clef] || [36, 84];
  const rhythmPreset = rhythmPresetId && RHYTHM_PRESETS[rhythmPresetId];

  for (let i = 0; i < study.acts.length; i++) {
    const act = study.acts[i];
    const p = scaleParams(act.params, difficulty / 100);
    const rng = mulberry32(seed + i * 1000003);

    const tonic = tonicMidiFor(anchor, (keyPc + (act.keyShift || 0)) % 12);
    const scale = (scaleId && scaleId !== 'auto') ? scaleId : (act.params.scale || 'major');
    keySignatures.push({ bar: accumulatedBeats / beatsPerBar, fifths: keyFifths((keyPc + (act.keyShift || 0)) % 12, scale) });
    // Each vamp degree gets 2 bars; cycle through act.bars.
    const vamp = act.vampDegrees || [1, 5];
    const beatsPerChord = beatsPerBar * 2;
    const totalChords = Math.ceil((act.bars * beatsPerBar) / beatsPerChord);
    const progression = [];
    for (let k = 0; k < totalChords; k++) {
      progression.push({
        startBeat: k * beatsPerChord,
        durationBeats: beatsPerChord,
        notes: chordFromDegree(tonic, scale, vamp[k % vamp.length]),
      });
    }

    const density = rhythmPreset ? rhythmPreset.density : p.density;
    const template = rhythmPreset ? rhythmPreset.template : 'auto';
    const rhythm = generateRhythm(rng, { bars: act.bars, beatsPerBar, density, swing, template });
    const contour = (contourId && contourId !== 'auto') ? contourId : (p.contour || 'auto');
    const line = generateMelody(rng, { progression, rhythm, scale, tonic, contour });

    for (const ev of line) {
      events.push({
        type: 'melody',
        midi: clampMidiToRange(ev.midi, range),
        atBeat: accumulatedBeats + ev.atBeat,
        durationBeats: ev.durationBeats,
        velocity: Math.min(1, (ev.velocity ?? 0.7) * velocityScale),
      });
    }

    // Chord symbols — one per bar where each vamp chord starts.
    const actStartBar = accumulatedBeats / beatsPerBar;
    for (let b = 0; b < act.bars; b++) chordSymbols.push('');
    for (const ch of progression) {
      const idx = Math.round(actStartBar + Math.floor(ch.startBeat / beatsPerBar));
      if (idx < chordSymbols.length) chordSymbols[idx] = chordSymbolFromTriad(ch.notes);
    }

    accumulatedBeats += act.bars * beatsPerBar;
    if (i < study.acts.length - 1) doubleBarsBefore.push(accumulatedBeats / beatsPerBar);
    if (actBpm == null) actBpm = p.tempo || 90;
  }

  return {
    bars: accumulatedBeats / beatsPerBar,
    beatsPerBar,
    lengthBeats: accumulatedBeats,
    events,
    chordSymbols,
    doubleBarsBefore,
    keySignatures,
    bpm: actBpm,
  };
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
  updateFavoriteButton();
  document.getElementById('practice-study-overlay').classList.remove('hidden');
  document.body.classList.add('practice-overlay-open');
  regenerate();
}

function closeStudy() {
  exitStandMode();   // ADR 0006: never leave the body stuck in stand mode
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

  // Duet style picker — only shown for two-voice studies.
  const duetSel = document.getElementById('practice-duet');
  const duetField = document.getElementById('practice-duet-field');
  if (duetSel && activeStudy.duetDefault) {
    duetSel.innerHTML = '';
    for (const [id, style] of Object.entries(DUET_STYLES)) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = style.label;
      if (id === studyPrefs.duetStyleId) opt.selected = true;
      duetSel.appendChild(opt);
    }
    if (duetField) duetField.style.display = '';
  } else if (duetField) {
    duetField.style.display = 'none';
  }

  // Scale picker — shared by all study kinds.
  const scaleSel = document.getElementById('practice-scale');
  if (scaleSel) {
    scaleSel.innerHTML = '';
    for (const opt of SCALE_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.id;
      o.textContent = opt.label;
      if (opt.id === studyPrefs.scaleId) o.selected = true;
      scaleSel.appendChild(o);
    }
  }

  // Contour picker — only meaningful for melodic studies (the invention + duet workshop).
  const isTwoVoice = activeStudy.kind === 'two-voice-counterpoint' || activeStudy.kind === 'duet-workshop';
  const contourSel = document.getElementById('practice-contour');
  const contourField = document.getElementById('practice-contour-field');
  if (contourSel && isTwoVoice) {
    contourSel.innerHTML = '';
    for (const opt of CONTOUR_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.id;
      o.textContent = opt.label;
      if (opt.id === studyPrefs.contourId) o.selected = true;
      contourSel.appendChild(o);
    }
    if (contourField) contourField.style.display = '';
  } else if (contourField) {
    contourField.style.display = 'none';
  }

  // ADR 0004: rhythm-vocabulary chip group — duet workshop only.
  const vocabHost = document.getElementById('practice-rhythm-vocab-chips');
  const vocabField = document.getElementById('practice-rhythm-vocab-field');
  if (vocabHost && activeStudy.kind === 'duet-workshop') {
    const active = new Set(studyPrefs.rhythmVocab || RHYTHM_VOCAB_DEFAULTS);
    vocabHost.innerHTML = '';
    for (const [id, def] of Object.entries(RHYTHM_VOCAB)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'practice-vocab-chip' + (active.has(id) ? ' is-active' : '');
      btn.dataset.vocab = id;
      btn.setAttribute('aria-pressed', active.has(id) ? 'true' : 'false');
      btn.textContent = def.label;
      vocabHost.appendChild(btn);
    }
    if (vocabField) vocabField.style.display = '';
  } else if (vocabField) {
    vocabField.style.display = 'none';
  }

  // ADR 0004: progression picker — duet workshop only.
  const progSel = document.getElementById('practice-progression');
  const progField = document.getElementById('practice-progression-field');
  if (progSel && activeStudy.kind === 'duet-workshop') {
    progSel.innerHTML = '';
    for (const opt of PROGRESSION_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.id;
      o.textContent = opt.label;
      if (opt.id === studyPrefs.progressionId) o.selected = true;
      progSel.appendChild(o);
    }
    if (progField) progField.style.display = '';
  } else if (progField) {
    progField.style.display = 'none';
  }

  // ADR 0004: part-view segmented toggle — duet workshop only.
  const partHost = document.getElementById('practice-part-view-chips');
  const partField = document.getElementById('practice-part-view-field');
  if (partHost && activeStudy.kind === 'duet-workshop') {
    const current = studyPrefs.partView || 'both';
    partHost.innerHTML = '';
    for (const opt of PART_VIEW_OPTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'practice-part-chip' + (opt.id === current ? ' is-active' : '');
      btn.dataset.part = opt.id;
      btn.setAttribute('aria-pressed', opt.id === current ? 'true' : 'false');
      btn.textContent = opt.label;
      partHost.appendChild(btn);
    }
    if (partField) partField.style.display = '';
  } else if (partField) {
    partField.style.display = 'none';
  }

  // ADR 0008: parametric scale-etude dropdowns — the bar sits above the
  // score (the pattern IS the exercise, not a fine-tuning knob).
  const etudeBar = document.getElementById('practice-etude-bar');
  if (etudeBar) etudeBar.style.display = activeStudy.kind === 'scale-etude' ? '' : 'none';
  const etudeIds = [
    ['practice-etude-pattern', 'practice-etude-pattern-field', ETUDE_PATTERNS.map(pt => ({ id: pt.id, label: pt.label })), studyPrefs.etudePatternId],
    ['practice-etude-octaves', 'practice-etude-octaves-field', ETUDE_OCTAVE_OPTIONS.map(o => ({ id: String(o), label: o === 1 ? '1 octave' : `${o} octaves` })), String(studyPrefs.etudeOctaves)],
    ['practice-etude-rhythm', 'practice-etude-rhythm-field', ETUDE_RHYTHMS.map(r => ({ id: r.id, label: r.label })), studyPrefs.etudeRhythm],
  ];
  for (const [selId, fieldId, options, current] of etudeIds) {
    const sel = document.getElementById(selId);
    const field = document.getElementById(fieldId);
    if (sel && activeStudy.kind === 'scale-etude') {
      sel.innerHTML = '';
      for (const opt of options) {
        const o = document.createElement('option');
        o.value = opt.id;
        o.textContent = opt.label;
        if (opt.id === current) o.selected = true;
        sel.appendChild(o);
      }
      if (field) field.style.display = '';
    } else if (field) {
      field.style.display = 'none';
    }
  }

  // ADR 0009: start-note dropdown — options depend on key + clef, so it
  // rebuilds every render. The stored midi selects when still valid;
  // otherwise the first (lowest) option shows and the pref resets to
  // null (= default register) so the builder picks the anchor tonic.
  const startSel = document.getElementById('practice-etude-start');
  const startField = document.getElementById('practice-etude-start-field');
  if (startSel && activeStudy.kind === 'scale-etude') {
    const clef = activeClefVoices(activeStudy, studyPrefs)[0] || 'treble';
    const opts = etudeStartOptions(clef, studyPrefs.keyPc);
    startSel.innerHTML = '';
    for (const opt of opts) {
      const o = document.createElement('option');
      o.value = String(opt.midi);
      o.textContent = `${tonicName(studyPrefs.keyPc)}${opt.octave}`;
      if (opt.midi === studyPrefs.etudeStartMidi) o.selected = true;
      startSel.appendChild(o);
    }
    if (startField) startField.style.display = '';
  } else if (startField) {
    startField.style.display = 'none';
  }

  // ADR 0009: seed + intensity carry no meaning in the (deterministic,
  // self-played) scale etude — hide them there.
  const noiseFor = activeStudy.kind === 'scale-etude';
  const intensityField = document.getElementById('practice-intensity-field');
  const seedField = document.getElementById('practice-seed-field');
  if (intensityField) intensityField.style.display = noiseFor ? 'none' : '';
  if (seedField) seedField.style.display = noiseFor ? 'none' : '';

  // Swing slider — only meaningful for melodic studies.
  const swingInput = document.getElementById('practice-swing');
  const swingField = document.getElementById('practice-swing-field');
  if (swingInput && isTwoVoice) {
    swingInput.value = String(studyPrefs.swing ?? 0);
    document.getElementById('practice-swing-display').textContent = `${swingInput.value}%`;
    if (swingField) swingField.style.display = '';
  } else if (swingField) {
    swingField.style.display = 'none';
  }

  // Intensity slider — applies to every kind.
  const intInput = document.getElementById('practice-intensity');
  if (intInput) {
    intInput.value = String(studyPrefs.intensity ?? 100);
    document.getElementById('practice-intensity-display').textContent = `${intInput.value}%`;
  }

  // Voice picker — defaults to the study kind's preferred instrument when
  // the user hasn't picked one. 'auto' = follow the per-kind default.
  const voiceSel = document.getElementById('practice-voice');
  if (voiceSel) {
    voiceSel.innerHTML = '';
    const autoOpt = document.createElement('option');
    autoOpt.value = '';
    autoOpt.textContent = `Auto (${DEFAULT_VOICE_BY_KIND[activeStudy.kind] || 'piano'})`;
    if (!studyPrefs.voiceId) autoOpt.selected = true;
    voiceSel.appendChild(autoOpt);
    for (const v of VOICE_OPTIONS) {
      const o = document.createElement('option');
      o.value = v.id;
      o.textContent = v.label;
      if (v.id === studyPrefs.voiceId) o.selected = true;
      voiceSel.appendChild(o);
    }
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
  if (sp.duetStyleId && activeStudy.duetDefault) {
    pieces.push(DUET_STYLES[sp.duetStyleId]?.label || sp.duetStyleId);
  }
  if (sp.scaleId && sp.scaleId !== 'auto') {
    pieces.push(SCALE_OPTIONS.find(s => s.id === sp.scaleId)?.label || sp.scaleId);
  }
  if (sp.contourId && sp.contourId !== 'auto' && activeStudy.kind === 'two-voice-counterpoint') {
    pieces.push(CONTOUR_OPTIONS.find(c => c.id === sp.contourId)?.label || sp.contourId);
  }
  // ADR 0009: seed is meaningless for the deterministic scale etude.
  if (activeStudy.kind !== 'scale-etude') pieces.push(`seed ${sp.seed}`);
  info.textContent = pieces.join(' · ');
  updateFavoriteButton();
}

function renderActRail() {
  if (!activeStudy) return;
  const rail = document.getElementById('practice-act-rail');
  rail.innerHTML = '';
  // Scale etude: the etude bar replaces the rail slot entirely.
  rail.style.display = activeStudy.kind === 'scale-etude' ? 'none' : '';
  if (activeStudy.kind === 'scale-etude') return;
  // ADR 0007: 'exercises' mode renders the rail as tabs — one drill at a
  // time. 'movements' mode keeps the passive rail (the score is one piece).
  const isTabs = activeStudy.actMode === 'exercises';
  const sp = isTabs ? getStudyPrefs(activeStudy.id) : null;
  activeStudy.acts.forEach((act, idx) => {
    const item = document.createElement(isTabs ? 'button' : 'div');
    item.className = 'practice-act-rail-item';
    if (isTabs) {
      item.type = 'button';
      item.classList.add('practice-act-rail-tab');
      const active = idx === (sp.actIdx | 0);
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', active ? 'true' : 'false');
      item.addEventListener('click', () => {
        const p = getStudyPrefs(activeStudy.id);
        if ((p.actIdx | 0) === idx) return;
        p.actIdx = idx;
        savePrefs();
        stopPlayback();
        renderActRail();
        regenerate();
      });
    }
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
  let tracks;
  if (activeStudy.kind === 'two-voice-counterpoint') tracks = ['melody', 'melody2'];
  else if (activeStudy.kind === 'duet-workshop') {
    // ADR 0004: part-view filters which staff renders. Audio always
    // plays both voices (handled by playSong).
    if (sp.partView === 'voice1') tracks = ['melody'];
    else if (sp.partView === 'voice2') tracks = ['melody2'];
    else tracks = ['melody', 'melody2'];
  }
  else if (activeStudy.kind === 'walking-bass-workout') tracks = ['bass'];
  else tracks = ['melody'];   // scale-etude / solo-etude / modal-vamp
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
    doubleBarsBefore: song.doubleBarsBefore,
    keySignatures: song.keySignatures,
  });
  await renderSheet(xml);
}

// =============================================================================
// Audio playback

// Default instrument per study kind. 'piano' uses the SampleLibrary; the
// others map to SynthVoice presets. Per-prefs override via the Voice
// picker on the Adjust panel.
const DEFAULT_VOICE_BY_KIND = {
  'two-voice-counterpoint': 'piano',
  'walking-bass-workout': 'bass',
  'scale-etude': 'piano',
  'solo-etude': 'piano',
  'modal-vamp': 'epiano',
};

let samplesReady = false;
let samplesLoading = null;

async function ensureSamplesLoaded(ctx) {
  if (samplesReady) return true;
  if (samplesLoading) {
    try { await samplesLoading; return samplesReady; } catch { return false; }
  }
  samplesLoading = loadSamples(ctx)
    .then(() => { samplesReady = true; })
    .catch(err => { console.warn('Practice: piano samples unavailable, falling back to synth.', err); samplesReady = false; });
  await samplesLoading;
  return samplesReady;
}

// Returns a voice for the given midi + chosen instrument id. Falls back
// to a synth preset when the piano samples aren't loaded yet.
function spawnVoice(ctx, dest, midi, instrument, when, duration, velocity) {
  if (instrument === 'piano' && samplesReady) {
    const { buffer, playbackRate } = getPlaybackFor(midi);
    return createVoice(ctx, dest, { buffer, playbackRate, velocity, when, duration, releaseTime: 0.25 });
  }
  // Map 'piano' fallback + any other id to a synth preset.
  const preset = instrument === 'piano' ? 'epiano' : instrument;
  return createSynthVoice(ctx, dest, { midi, velocity, when, duration, preset, releaseTime: 0.2 });
}

async function playSong() {
  if (!lastSong || !audioApiRef) return;
  stopPlayback();                       // clear any previous run (sync)
  const gen = ++playGeneration;         // this run's token
  isPlaying = true;
  const playBtn = document.getElementById('practice-play');
  if (playBtn) playBtn.classList.add('is-playing');   // responsive UI while samples load

  await audioApiRef.ensureInit();
  if (gen !== playGeneration) return;   // paused / superseded during init
  const ctx = audioApiRef.getContext();
  const dest = ctx ? audioApiRef.getMasterGain() : null;
  if (!ctx || !dest) { stopPlayback(); return; }

  // Pick the voice for this study. Walking-bass studies get the synth
  // bass; melodic studies prefer the piano samples (fall back to epiano
  // if the samples don't load — e.g. offline).
  const studyKind = activeStudy?.kind;
  const sp = activeStudy ? getStudyPrefs(activeStudy.id) : null;
  const instrument = sp?.voiceId || DEFAULT_VOICE_BY_KIND[studyKind] || 'piano';
  if (instrument === 'piano') await ensureSamplesLoaded(ctx);
  if (gen !== playGeneration) return;   // paused / superseded during sample load

  const beatDuration = 60 / lastBpm;
  const startAt = ctx.currentTime + 0.05;
  for (const ev of lastSong.events) {
    const when = startAt + ev.atBeat * beatDuration;
    const dur = ev.durationBeats * beatDuration;
    const v = (ev.velocity || 0.7) * 0.6;
    const voice = spawnVoice(ctx, dest, ev.midi, instrument, when, dur, v);
    scheduledVoices.push(voice);
  }

  const totalSec = lastSong.lengthBeats * beatDuration + 0.5;
  playbackTimer = setTimeout(() => stopPlayback(), totalSec * 1000);

  // Drive the OSMD cursor in lock-step with the audio. The cursor
  // advances per "staff entry" (a beat position that carries one or more
  // notes). Compute the distinct beat positions, sort them ascending,
  // and step next() each time the elapsed time crosses the next one.
  const beatPositions = Array.from(
    new Set(lastSong.events.map(e => Math.round(e.atBeat * 1000) / 1000))
  ).sort((a, b) => a - b);
  try {
    practiceOSMD?.cursor?.show();
    practiceOSMD?.cursor?.reset();
  } catch { /* ignore */ }
  let cursorIdx = 0;   // first entry == 0 means the cursor sits at beat 0 already

  const startTs = performance.now();
  const tick = () => {
    if (!playbackTimer) return;
    const elapsedMs = performance.now() - startTs;
    const elapsedSec = elapsedMs / 1000;
    const m = Math.floor(elapsedSec / 60);
    const s = Math.floor(elapsedSec % 60).toString().padStart(2, '0');
    const t = document.getElementById('practice-playback-time');
    if (t) t.textContent = `${m}:${s}`;

    // Advance the cursor as the elapsed beat crosses each next position.
    const elapsedBeats = elapsedSec / beatDuration;
    while (cursorIdx + 1 < beatPositions.length && elapsedBeats >= beatPositions[cursorIdx + 1]) {
      try { practiceOSMD?.cursor?.next(); } catch { break; }
      cursorIdx += 1;
    }

    if (playbackTimer) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function stopPlayback() {
  isPlaying = false;
  playGeneration++;   // aborts any playSong still awaiting init/samples
  if (playbackTimer) { clearTimeout(playbackTimer); playbackTimer = null; }
  for (const v of scheduledVoices) {
    try { v?.release?.(0.1); } catch { /* ignore */ }
  }
  scheduledVoices = [];
  const playBtn = document.getElementById('practice-play');
  if (playBtn) playBtn.classList.remove('is-playing');
  try { practiceOSMD?.cursor?.hide(); } catch { /* ignore */ }
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
// Music-stand mode (ADR 0006) — fullscreen score reading with page turning,
// zoom, and a screen wake lock. Fullscreen is a CSS state (body class pins
// #practice-sheet to the viewport); page turning steps scrollTop by one
// viewport height. OSMD's autoResize re-renders on the container resize.

let standActive = false;
let standWakeLock = null;

function standSheet() { return document.getElementById('practice-sheet'); }

function standPageInfo() {
  const el = standSheet();
  if (!el) return { page: 1, total: 1 };
  const pageH = el.clientHeight || 1;
  const total = Math.max(1, Math.ceil(el.scrollHeight / pageH));
  const page = Math.min(total, Math.floor(el.scrollTop / pageH) + 1);
  return { page, total };
}

function standUpdatePageIndicator() {
  const disp = document.getElementById('practice-stand-page');
  if (!disp) return;
  const { page, total } = standPageInfo();
  disp.textContent = `${page} / ${total}`;
  const prev = document.getElementById('practice-stand-prev');
  const next = document.getElementById('practice-stand-next');
  if (prev) prev.disabled = page <= 1;
  if (next) next.disabled = page >= total;
}

function standTurnPage(delta) {
  const el = standSheet();
  if (!el) return;
  const pageH = el.clientHeight || 1;
  const maxTop = Math.max(0, el.scrollHeight - pageH);
  el.scrollTop = Math.max(0, Math.min(maxTop, el.scrollTop + delta * pageH));
  standUpdatePageIndicator();
}

function standApplyZoom(deltaSteps) {
  if (deltaSteps) {
    const z = prefs.standZoom ?? 1.3;
    prefs.standZoom = Math.max(0.5, Math.min(2.5, Math.round((z + deltaSteps * 0.1) * 10) / 10));
    savePrefs();
  }
  if (practiceOSMD) {
    try {
      practiceOSMD.zoom = prefs.standZoom ?? 1.3;
      practiceOSMD.render();
    } catch { /* OSMD may not be loaded (offline) — page math still works */ }
  }
  const el = standSheet();
  if (el) el.scrollTop = 0;
  standUpdatePageIndicator();
}

async function standAcquireWakeLock() {
  try {
    standWakeLock = await navigator.wakeLock?.request?.('screen');
  } catch { standWakeLock = null; }
}

function standReleaseWakeLock() {
  try { standWakeLock?.release?.(); } catch { /* already released */ }
  standWakeLock = null;
}

// Re-acquire the wake lock when the tab becomes visible again — the
// browser silently releases it on backgrounding.
function standVisibilityHandler() {
  if (standActive && document.visibilityState === 'visible') standAcquireWakeLock();
}

function standKeyHandler(e) {
  if (!standActive) return;
  if (e.key === 'Escape') { exitStandMode(); e.preventDefault(); return; }
  // ArrowRight / PageDown / Space turn forward; ArrowLeft / PageUp back.
  // PageUp/PageDown + arrows are what Bluetooth page-turn pedals emit,
  // so pedal support comes for free (ADR 0006).
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
    standTurnPage(1); e.preventDefault();
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    standTurnPage(-1); e.preventDefault();
  }
}

// Tap zones: right third = next page, left third = previous.
function standTapHandler(e) {
  if (!standActive) return;
  const w = window.innerWidth || 1;
  if (e.clientX > (w * 2) / 3) standTurnPage(1);
  else if (e.clientX < w / 3) standTurnPage(-1);
}

function standFullscreenChangeHandler() {
  // Leaving browser fullscreen (Esc or system UI) exits stand mode too,
  // so the two states never desync.
  if (standActive && !document.fullscreenElement) exitStandMode();
}

function enterStandMode() {
  if (!activeStudy || standActive) return;
  standActive = true;
  document.body.classList.add('practice-stand-mode');
  const el = standSheet();
  if (el) {
    el.scrollTop = 0;
    el.addEventListener('click', standTapHandler);
  }
  document.addEventListener('keydown', standKeyHandler);
  document.addEventListener('visibilitychange', standVisibilityHandler);
  document.addEventListener('fullscreenchange', standFullscreenChangeHandler);
  standApplyZoom(0);           // apply persisted stand zoom + reset page
  standAcquireWakeLock();
  // Browser fullscreen is progressive enhancement — the CSS overlay is
  // the real mechanism.
  try { document.documentElement.requestFullscreen?.()?.catch?.(() => {}); } catch { /* unsupported */ }
}

function exitStandMode() {
  if (!standActive) return;
  standActive = false;
  document.body.classList.remove('practice-stand-mode');
  const el = standSheet();
  if (el) {
    el.scrollTop = 0;
    el.removeEventListener('click', standTapHandler);
  }
  document.removeEventListener('keydown', standKeyHandler);
  document.removeEventListener('visibilitychange', standVisibilityHandler);
  document.removeEventListener('fullscreenchange', standFullscreenChangeHandler);
  standReleaseWakeLock();
  try { if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {}); } catch { /* ignore */ }
  // Restore the regular width-based zoom heuristic.
  if (practiceOSMD) {
    try {
      const w = standSheet()?.clientWidth || 720;
      practiceOSMD.zoom = w < 500 ? 0.7 : w < 720 ? 0.85 : 1.0;
      practiceOSMD.render();
    } catch { /* ignore */ }
  }
}

// =============================================================================
// Share — Web Share API with clipboard fallback. The URL encodes the
// current study + every prefs field so the recipient lands on the exact
// same generated piece (seed + key + clef + rhythm + duet + difficulty).

export function buildShareUrl(studyId, sp) {
  const params = new URLSearchParams();
  params.set('study', studyId);
  if (sp.seed != null) params.set('seed', String(sp.seed));
  if (sp.keyPc != null) params.set('key', String(sp.keyPc));
  if (sp.clefPresetId) params.set('clef', sp.clefPresetId);
  if (sp.rhythmPresetId) params.set('rhythm', sp.rhythmPresetId);
  if (sp.duetStyleId) params.set('duet', sp.duetStyleId);
  if (sp.scaleId && sp.scaleId !== 'auto') params.set('scale', sp.scaleId);
  if (sp.contourId && sp.contourId !== 'auto') params.set('contour', sp.contourId);
  if (sp.swing) params.set('swing', String(sp.swing));
  if (sp.intensity != null && sp.intensity !== 100) params.set('intensity', String(sp.intensity));
  if (sp.difficulty != null) params.set('diff', String(sp.difficulty));
  // ADR 0007: selected exercise for exercises-mode studies.
  if (sp.actIdx) params.set('act', String(sp.actIdx));
  // ADR 0008: parametric scale etude.
  if (sp.etudePatternId && sp.etudePatternId !== 'scale') params.set('pattern', sp.etudePatternId);
  if (sp.etudeOctaves && sp.etudeOctaves !== 1) params.set('oct', String(sp.etudeOctaves));
  if (sp.etudeRhythm && sp.etudeRhythm !== 'eighth') params.set('rhy', sp.etudeRhythm);
  if (Number.isInteger(sp.etudeStartMidi)) params.set('start', String(sp.etudeStartMidi));
  // ADR 0004: duet-workshop extras.
  if (Array.isArray(sp.rhythmVocab) && sp.rhythmVocab.length) params.set('vocab', sp.rhythmVocab.join(','));
  if (sp.progressionId) params.set('prog', sp.progressionId);
  if (sp.partView && sp.partView !== 'both') params.set('part', sp.partView);
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/practice?${params.toString()}`;
}

function showShareToast(message) {
  const toast = document.getElementById('practice-share-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add('is-visible');
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => { toast.hidden = true; }, 200);
  }, 1800);
}

async function shareCurrentStudy() {
  if (!activeStudy) return;
  const sp = getStudyPrefs(activeStudy.id);
  const url = buildShareUrl(activeStudy.id, sp);
  const title = `SeedSong · ${getStudyField(activeStudy, 'title')}`;
  const text = `${title} — seed ${sp.seed}`;
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch {
      // user cancelled or share unsupported for this payload — fall through to clipboard
    }
  }
  try {
    await navigator.clipboard?.writeText(url);
    showShareToast(t('practice.share_copied', 'Link copied to clipboard'));
  } catch {
    showShareToast(url);
  }
}

// Apply incoming share URL params to the prefs blob before openStudy.
// Returns the resolved study id (or null if the param is missing / invalid).
export function applyShareParams() {
  if (!window.location.hash.startsWith('#/practice')) return null;
  const qIdx = window.location.hash.indexOf('?');
  if (qIdx < 0) return null;
  const params = new URLSearchParams(window.location.hash.slice(qIdx + 1));
  const studyId = params.get('study');
  if (!studyId || !STUDIES.find(s => s.id === studyId)) return null;
  const sp = getStudyPrefs(studyId);
  const n = (k) => params.get(k) != null ? Number(params.get(k)) : null;
  if (n('seed') != null && Number.isFinite(n('seed'))) sp.seed = n('seed');
  if (n('key')  != null && Number.isFinite(n('key')))  sp.keyPc = n('key');
  if (n('diff') != null && Number.isFinite(n('diff'))) sp.difficulty = n('diff');
  if (n('swing') != null && Number.isFinite(n('swing'))) sp.swing = n('swing');
  if (n('intensity') != null && Number.isFinite(n('intensity'))) sp.intensity = n('intensity');
  if (params.get('clef'))    sp.clefPresetId = params.get('clef');
  if (params.get('rhythm'))  sp.rhythmPresetId = params.get('rhythm');
  if (params.get('duet'))    sp.duetStyleId = params.get('duet');
  if (params.get('scale'))   sp.scaleId = params.get('scale');
  if (params.get('contour')) sp.contourId = params.get('contour');
  // ADR 0004
  if (params.get('vocab')) {
    const ids = params.get('vocab').split(',').filter(id => RHYTHM_VOCAB[id]);
    if (ids.length > 0) sp.rhythmVocab = ids;
  }
  if (params.get('prog')) sp.progressionId = params.get('prog');
  if (params.get('part')) sp.partView = params.get('part');
  if (n('act') != null && Number.isFinite(n('act'))) sp.actIdx = Math.max(0, n('act') | 0);
  // ADR 0008
  if (params.get('pattern') && ETUDE_PATTERNS.find(pt => pt.id === params.get('pattern'))) sp.etudePatternId = params.get('pattern');
  if (n('oct') != null) sp.etudeOctaves = n('oct') === 2 ? 2 : 1;
  if (params.get('rhy') && ETUDE_RHYTHMS.find(r => r.id === params.get('rhy'))) sp.etudeRhythm = params.get('rhy');
  if (n('start') != null && Number.isFinite(n('start'))) sp.etudeStartMidi = n('start') | 0;
  savePrefs();
  return studyId;
}

// =============================================================================
// Favorites — saved snapshots of {study, prefs} the user can return to.

function favoriteIdFor(studyId, sp) {
  // Stable id from the parameter set — same study + same prefs produces the
  // same key, so re-saving doesn't duplicate.
  return `${studyId}|${sp.seed}|${sp.keyPc}|${sp.clefPresetId || ''}|${sp.rhythmPresetId || ''}|${sp.duetStyleId || ''}|${sp.difficulty}|${sp.actIdx || 0}|${sp.etudePatternId || ''}|${sp.etudeOctaves || ''}|${sp.etudeRhythm || ''}|${sp.etudeStartMidi ?? ''}`;
}

function isFavorited(studyId, sp) {
  const id = favoriteIdFor(studyId, sp);
  return prefs.favorites.some(f => f.id === id);
}

function toggleFavorite() {
  if (!activeStudy) return;
  const sp = getStudyPrefs(activeStudy.id);
  const id = favoriteIdFor(activeStudy.id, sp);
  const idx = prefs.favorites.findIndex(f => f.id === id);
  if (idx >= 0) {
    prefs.favorites.splice(idx, 1);
  } else {
    prefs.favorites.unshift({
      id,
      studyId: activeStudy.id,
      keyPc: sp.keyPc,
      seed: sp.seed,
      difficulty: sp.difficulty,
      clefPresetId: sp.clefPresetId,
      rhythmPresetId: sp.rhythmPresetId,
      duetStyleId: sp.duetStyleId,
      actIdx: sp.actIdx || 0,   // ADR 0007: which exercise was favorited
      etudePatternId: sp.etudePatternId || null,   // ADR 0008
      etudeOctaves: sp.etudeOctaves || null,
      etudeRhythm: sp.etudeRhythm || null,
      etudeStartMidi: Number.isInteger(sp.etudeStartMidi) ? sp.etudeStartMidi : null,
      savedAt: Date.now(),
    });
    // Cap to a sane number so localStorage doesn't grow unbounded.
    if (prefs.favorites.length > 50) prefs.favorites.length = 50;
  }
  savePrefs();
  updateFavoriteButton();
  renderFavorites();
}

function updateFavoriteButton() {
  const btn = document.getElementById('practice-study-favorite');
  if (!btn || !activeStudy) return;
  const sp = getStudyPrefs(activeStudy.id);
  const fav = isFavorited(activeStudy.id, sp);
  btn.classList.toggle('is-favorited', fav);
  btn.setAttribute('aria-pressed', fav ? 'true' : 'false');
}

function renderFavorites() {
  const section = document.getElementById('practice-favorites-section');
  const list = document.getElementById('practice-favorites');
  if (!section || !list) return;
  list.innerHTML = '';
  if (!prefs.favorites.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  for (const fav of prefs.favorites) {
    const study = STUDIES.find(s => s.id === fav.studyId);
    if (!study) continue;
    const card = document.createElement('div');
    card.className = 'practice-favorite-card';

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'practice-favorite-open';
    open.dataset.favId = fav.id;
    const eyebrow = document.createElement('span');
    eyebrow.className = 'practice-favorite-eyebrow';
    eyebrow.textContent = getStudyField(study, 'title');
    const meta = document.createElement('span');
    meta.className = 'practice-favorite-meta';
    const pieces = [tonicName(fav.keyPc), `${fav.difficulty ?? 50}%`];
    const clefPreset = study.clefPresets?.find(c => c.id === fav.clefPresetId);
    if (clefPreset) pieces.push(clefPreset.voices.join('+'));
    if (fav.rhythmPresetId) pieces.push(RHYTHM_PRESETS[fav.rhythmPresetId]?.label || fav.rhythmPresetId);
    if (fav.duetStyleId) pieces.push(DUET_STYLES[fav.duetStyleId]?.label || fav.duetStyleId);
    pieces.push(`seed ${fav.seed}`);
    meta.textContent = pieces.join(' · ');
    open.appendChild(eyebrow);
    open.appendChild(meta);
    open.addEventListener('click', () => openFavorite(fav));
    card.appendChild(open);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'practice-favorite-remove';
    remove.setAttribute('aria-label', 'Remove favorite');
    remove.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    remove.addEventListener('click', (e) => {
      e.stopPropagation();
      prefs.favorites = prefs.favorites.filter(f => f.id !== fav.id);
      savePrefs();
      renderFavorites();
      updateFavoriteButton();
    });
    card.appendChild(remove);

    list.appendChild(card);
  }
}

function openFavorite(fav) {
  // Apply the snapshot to the per-study prefs blob first so openStudy
  // picks up the saved parameters from getStudyPrefs.
  const sp = getStudyPrefs(fav.studyId);
  sp.keyPc = fav.keyPc;
  sp.seed = fav.seed;
  sp.difficulty = fav.difficulty;
  sp.clefPresetId = fav.clefPresetId;
  sp.rhythmPresetId = fav.rhythmPresetId;
  sp.duetStyleId = fav.duetStyleId;
  sp.actIdx = fav.actIdx || 0;   // ADR 0007
  if (fav.etudePatternId) sp.etudePatternId = fav.etudePatternId;   // ADR 0008
  if (fav.etudeOctaves) sp.etudeOctaves = fav.etudeOctaves;
  if (fav.etudeRhythm) sp.etudeRhythm = fav.etudeRhythm;
  sp.etudeStartMidi = Number.isInteger(fav.etudeStartMidi) ? fav.etudeStartMidi : null;
  savePrefs();
  openStudy(fav.studyId);
}

// =============================================================================
// Init

export function initPracticeView({ audioApi } = {}) {
  audioApiRef = audioApi;
  loadPrefs();
  renderCatalog();
  renderFavorites();

  // If the page was opened with a share URL (#/practice?study=...&seed=...)
  // apply those params and open the study right away.
  const sharedStudyId = applyShareParams();
  if (sharedStudyId) {
    // Defer to the next tick so the rest of the app finishes booting.
    setTimeout(() => openStudy(sharedStudyId), 0);
  }

  // ADR 0005 bridge: in-app navigation to a practice deep link (e.g. the
  // Learn view's "Practice this" CTA) fires hashchange, not a page load —
  // hydrate the params and open the study the same way a share URL would.
  window.addEventListener('hashchange', () => {
    const id = applyShareParams();
    if (id) openStudy(id);
  });

  onLangChange(() => {
    renderCatalog();
    renderFavorites();
    if (activeStudy) {
      document.getElementById('practice-study-eyebrow').textContent = getStudyField(activeStudy, 'eyebrow');
      document.getElementById('practice-study-title').textContent = getStudyField(activeStudy, 'title');
      document.getElementById('practice-study-desc').textContent = getStudyField(activeStudy, 'summary');
    }
  });

  document.getElementById('practice-study-close')?.addEventListener('click', closeStudy);
  document.getElementById('practice-study-print')?.addEventListener('click', openPrintView);
  document.getElementById('practice-study-favorite')?.addEventListener('click', toggleFavorite);
  document.getElementById('practice-study-share')?.addEventListener('click', shareCurrentStudy);

  // ADR 0006: music-stand mode.
  document.getElementById('practice-study-stand')?.addEventListener('click', enterStandMode);
  document.getElementById('practice-stand-exit')?.addEventListener('click', exitStandMode);
  document.getElementById('practice-stand-prev')?.addEventListener('click', (e) => { e.stopPropagation(); standTurnPage(-1); });
  document.getElementById('practice-stand-next')?.addEventListener('click', (e) => { e.stopPropagation(); standTurnPage(1); });
  document.getElementById('practice-stand-zoom-out')?.addEventListener('click', (e) => { e.stopPropagation(); standApplyZoom(-1); });
  document.getElementById('practice-stand-zoom-in')?.addEventListener('click', (e) => { e.stopPropagation(); standApplyZoom(1); });
  document.getElementById('practice-stand-play')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isPlaying) stopPlayback();
    else playSong();
  });

  document.getElementById('practice-key')?.addEventListener('change', (e) => {
    if (!activeStudy) return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.keyPc = Number(e.target.value);
    sp.etudeStartMidi = null;   // ADR 0009: register options shifted — reset to default
    savePrefs();
    populateControls();         // rebuild the start-note options for the new key
    regenerate();
  });
  document.getElementById('practice-clef')?.addEventListener('change', (e) => {
    if (!activeStudy) return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.clefPresetId = e.target.value;
    sp.etudeStartMidi = null;   // ADR 0009: clef floor shifted — reset to default
    savePrefs();
    populateControls();         // rebuild the start-note options for the new clef
    regenerate();
  });
  document.getElementById('practice-rhythm')?.addEventListener('change', (e) => {
    if (!activeStudy) return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.rhythmPresetId = e.target.value;
    savePrefs();
    regenerate();
  });
  document.getElementById('practice-duet')?.addEventListener('change', (e) => {
    if (!activeStudy) return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.duetStyleId = e.target.value;
    savePrefs();
    regenerate();
  });
  document.getElementById('practice-scale')?.addEventListener('change', (e) => {
    if (!activeStudy) return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.scaleId = e.target.value;
    savePrefs();
    regenerate();
  });
  document.getElementById('practice-contour')?.addEventListener('change', (e) => {
    if (!activeStudy) return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.contourId = e.target.value;
    savePrefs();
    regenerate();
  });
  document.getElementById('practice-swing')?.addEventListener('input', (e) => {
    if (!activeStudy) return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.swing = Number(e.target.value);
    document.getElementById('practice-swing-display').textContent = `${sp.swing}%`;
    savePrefs();
    regenerate();
  });
  document.getElementById('practice-intensity')?.addEventListener('input', (e) => {
    if (!activeStudy) return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.intensity = Number(e.target.value);
    document.getElementById('practice-intensity-display').textContent = `${sp.intensity}%`;
    savePrefs();
    regenerate();
  });
  document.getElementById('practice-voice')?.addEventListener('change', (e) => {
    if (!activeStudy) return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.voiceId = e.target.value || null;
    savePrefs();
    // No regenerate() — voice only affects playback, not the score.
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
    if (isPlaying) stopPlayback();
    else playSong();
  });

  // ADR 0004: rhythm-vocab chip toggles.
  document.getElementById('practice-rhythm-vocab-chips')?.addEventListener('click', (e) => {
    if (!activeStudy || activeStudy.kind !== 'duet-workshop') return;
    const btn = e.target.closest('[data-vocab]');
    if (!btn) return;
    const sp = getStudyPrefs(activeStudy.id);
    const set = new Set(sp.rhythmVocab || RHYTHM_VOCAB_DEFAULTS);
    const id = btn.dataset.vocab;
    if (set.has(id)) {
      if (set.size > 1) set.delete(id);   // never let the user empty the set
    } else {
      set.add(id);
    }
    sp.rhythmVocab = Array.from(set);
    savePrefs();
    btn.classList.toggle('is-active', set.has(id));
    btn.setAttribute('aria-pressed', set.has(id) ? 'true' : 'false');
    regenerate();
  });

  // ADR 0004: progression picker.
  document.getElementById('practice-progression')?.addEventListener('change', (e) => {
    if (!activeStudy || activeStudy.kind !== 'duet-workshop') return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.progressionId = e.target.value;
    savePrefs();
    regenerate();
  });

  // ADR 0008: parametric scale-etude dropdowns.
  document.getElementById('practice-etude-pattern')?.addEventListener('change', (e) => {
    if (!activeStudy || activeStudy.kind !== 'scale-etude') return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.etudePatternId = e.target.value;
    savePrefs();
    regenerate();
  });
  document.getElementById('practice-etude-octaves')?.addEventListener('change', (e) => {
    if (!activeStudy || activeStudy.kind !== 'scale-etude') return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.etudeOctaves = Number(e.target.value) === 2 ? 2 : 1;
    savePrefs();
    regenerate();
  });
  document.getElementById('practice-etude-rhythm')?.addEventListener('change', (e) => {
    if (!activeStudy || activeStudy.kind !== 'scale-etude') return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.etudeRhythm = e.target.value;
    savePrefs();
    regenerate();
  });
  document.getElementById('practice-etude-start')?.addEventListener('change', (e) => {
    if (!activeStudy || activeStudy.kind !== 'scale-etude') return;
    const sp = getStudyPrefs(activeStudy.id);
    const v = Number(e.target.value);
    sp.etudeStartMidi = Number.isInteger(v) ? v : null;
    savePrefs();
    regenerate();
  });

  // ADR 0004: part-view segmented toggle.
  document.getElementById('practice-part-view-chips')?.addEventListener('click', (e) => {
    if (!activeStudy || activeStudy.kind !== 'duet-workshop') return;
    const btn = e.target.closest('[data-part]');
    if (!btn) return;
    const sp = getStudyPrefs(activeStudy.id);
    sp.partView = btn.dataset.part;
    savePrefs();
    for (const sibling of document.querySelectorAll('#practice-part-view-chips [data-part]')) {
      const on = sibling === btn;
      sibling.classList.toggle('is-active', on);
      sibling.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    regenerate();
  });
}

// For tests: expose pure helpers (the side-effectful init isn't tested directly).
export const __test = { buildSong, scaleParams };
