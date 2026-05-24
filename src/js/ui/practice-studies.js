// Practice studies catalog. Each study is a multi-act procedural piece;
// the act list is fixed but every act's runtime parameters get scaled by
// the master-difficulty slider so the player can ramp things up over time.
//
// Shape:
//   id: stable identifier for storage / hash routing
//   kind: 'two-voice-counterpoint' | 'walking-bass-workout'
//   title / summary / category: display strings (EN; PT/ES live in practice-translations.js)
//   clefPresets: ordered list of { id, label, voices: [clef, clef?] } —
//                rendered as a dropdown; first entry is the default.
//   rhythmPresets (counterpoint only): density/template overrides per style.
//   acts: ordered list of { id, title, bars, key, progression, params }
//
// `params` is what gets fed to the generator after the master-difficulty
// scaling. Each kind has its own param shape; PracticeView dispatches on
// study.kind to pick the right generator + renderer.

// Tessitura per clef — anchor MIDI used as the lowest note of the voice's
// comfortable range. Treble centres around C4-C6, alto around C3-C5, bass
// around C2-C4. These align with the standard instrument ranges (cello in
// bass clef, viola in alto, violin in treble).
export const CLEF_ANCHORS = {
  treble: 60,  // C4 — top of the staff sits around F5
  alto: 53,    // F3 — middle line is C4
  bass: 41,    // F2 — middle line is D3, comfortable for cello / bassoon
};

// Playable range per clef — used to clamp generator output so every note
// lands on a real string / pitch the reader can actually play. The free
// counterpoint mode previously produced notes below cello's open C
// (MIDI 36) when fed a bass-clef anchor; this is the safety net.
//
// Bass: cello's open C (36) to a comfortable D5 (74). The high end stays
//   below the thumb-position cliff so first-read sessions don't hit
//   uncomfortable territory.
// Alto: viola's C string (48) to F5 (77).
// Treble: violin's G string (55) to C6 (84).
export const CLEF_RANGES = {
  treble: [55, 84],
  alto:   [48, 77],
  bass:   [36, 74],
};

// Counterpoint duet styles. Each maps to generateCounterpoint's `mode` +
// `independence` knobs. Keep the labels short — they ride in a dropdown
// next to the rhythm picker.
export const DUET_STYLES = {
  free:            { label: 'Independent (default)', mode: 'free',            independence: 0.5 },
  parallel_thirds: { label: 'Parallel thirds',        mode: 'parallel_thirds', independence: 0 },
  parallel_sixths: { label: 'Parallel sixths',        mode: 'parallel_sixths', independence: 0 },
  contrary:        { label: 'Contrary motion',        mode: 'contrary',        independence: 0.7 },
  call_response:   { label: 'Call & response',        mode: 'call_response',   independence: 0.5 },
};

// Rhythm presets for the two-voice invention. Map to generateRhythm's
// density + template knobs. "Square" is the new default — half notes,
// dotted quarters, occasional eighths; suitable for first-read duet.
export const RHYTHM_PRESETS = {
  square:     { label: 'Square',     density: 0.30, template: 'sparse' },
  walking:    { label: 'Walking',    density: 0.55, template: 'straight' },
  flowing:    { label: 'Flowing',    density: 0.75, template: 'straight' },
  syncopated: { label: 'Syncopated', density: 0.85, template: 'syncopated' },
};

// Octave-shift a midi number so it lands inside [low, high]. If the note
// is below `low`, repeatedly raise by 12; if above `high`, drop by 12.
// Falls back to the nearest range bound on degenerate ranges.
export function clampMidiToRange(midi, range) {
  if (!range || range.length !== 2) return midi;
  const [low, high] = range;
  let m = midi;
  let safety = 12;   // worst case: full octave bracket
  while (m < low && safety-- > 0) m += 12;
  while (m > high && safety-- > 0) m -= 12;
  if (m < low) return low;
  if (m > high) return high;
  return m;
}

export const STUDIES = [
  {
    id: 'two-voice-invention',
    kind: 'two-voice-counterpoint',
    category: 'counterpoint',
    title: 'Two-voice Invention',
    summary: 'Three movements of melody-plus-counterpoint, in the Bach inventions tradition. Adjust difficulty per act or with the master slider.',
    eyebrow: 'Counterpoint · 3 acts',
    // Default: cello duo (Bass + Bass). Configurable via the picker.
    clefPresets: [
      { id: 'bass-bass',     label: 'Bass + Bass (cello duo)',     voices: ['bass', 'bass'] },
      { id: 'treble-bass',   label: 'Treble + Bass',               voices: ['treble', 'bass'] },
      { id: 'treble-treble', label: 'Treble + Treble',             voices: ['treble', 'treble'] },
      { id: 'alto-bass',     label: 'Alto + Bass (viola + cello)', voices: ['alto', 'bass'] },
    ],
    rhythmDefault: 'square',
    duetDefault: 'free',
    // Default key picker shows these tonic options (pitch class 0-11).
    keyOptions: [0, 2, 5, 7, 9],  // C, D, F, G, A — friendly for strings + piano
    acts: [
      {
        id: 'exposition',
        title: 'I — Exposition',
        bars: 8,
        keyShift: 0,            // relative to study key
        progression: 'pop',     // PROGRESSIONS.pop → I-V-vi-IV
        params: {
          density: 0.5,
          chromaticPct: 0,
          tempo: 80,
          contour: 'arc',
          independence: 0.4,
        },
      },
      {
        id: 'development',
        title: 'II — Development',
        bars: 8,
        keyShift: 9,            // jump to the relative minor
        progression: 'minor_loop',
        params: {
          density: 0.7,
          chromaticPct: 0.15,
          tempo: 90,
          contour: 'wave',
          independence: 0.6,
        },
      },
      {
        id: 'recapitulation',
        title: 'III — Recapitulation',
        bars: 8,
        keyShift: 0,
        progression: 'fifties',  // I-vi-IV-V
        params: {
          density: 0.55,
          chromaticPct: 0.05,
          tempo: 84,
          contour: 'descending',
          independence: 0.45,
        },
      },
    ],
  },
  {
    id: 'walking-bass-workout',
    kind: 'walking-bass-workout',
    category: 'bass',
    title: 'Walking-Bass Workout',
    summary: 'Three acts of walking-bass over real changes — escalating tempo and harmonic density. Same study, infinite variations.',
    eyebrow: 'Bass · 3 acts',
    clefPresets: [
      { id: 'bass',   label: 'Bass clef (default)', voices: ['bass'] },
      { id: 'treble', label: 'Treble clef (octave-up)', voices: ['treble'] },
    ],
    keyOptions: [0, 2, 3, 5, 7, 9, 10],
    acts: [
      {
        id: 'pulse',
        title: 'I — Quarter pulse @ 80',
        bars: 4,
        keyShift: 0,
        progression: 'I-V-vi-IV',
        params: { tempo: 80, scale: 'major' },
      },
      {
        id: 'changes',
        title: 'II — ii-V-I @ 100',
        bars: 4,
        keyShift: 0,
        progression: 'ii-V-I',
        params: { tempo: 100, scale: 'major' },
      },
      {
        id: 'blues',
        title: 'III — 12-bar blues @ 130',
        bars: 12,
        keyShift: 0,
        progression: '12-bar-blues',
        params: { tempo: 130, scale: 'natural_minor' },
      },
    ],
  },
];

const TONIC_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export function tonicName(pc) {
  return TONIC_NAMES[((pc % 12) + 12) % 12];
}

// Map master-difficulty (0-1) to a multiplicative scaling of per-act params.
// The act's baseline params represent "comfortable" — difficulty 0.5 sits
// on top of those untouched. Below 0.5 we ease tempo + density; above we
// push them. Caps protect against absurd values.
export function scaleParams(actParams, master /* 0..1 */) {
  const m = Math.max(0, Math.min(1, master));
  const lerp = (lo, hi) => lo + (hi - lo) * m;
  return {
    ...actParams,
    density: clamp(actParams.density != null ? actParams.density * lerp(0.6, 1.4) : undefined, 0.2, 0.95),
    chromaticPct: clamp(actParams.chromaticPct != null ? actParams.chromaticPct * lerp(0, 2) : undefined, 0, 0.5),
    tempo: actParams.tempo != null ? Math.round(actParams.tempo * lerp(0.8, 1.2)) : undefined,
    independence: clamp(actParams.independence != null ? actParams.independence * lerp(0.7, 1.3) : undefined, 0, 1),
  };
}

function clamp(v, lo, hi) {
  if (v == null || Number.isNaN(v)) return v;
  return Math.max(lo, Math.min(hi, v));
}
