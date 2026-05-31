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
// lands on a real string / pitch the reader can actually play.
//
// Bass: E2 (40) — bass-guitar / contrabaixo open E, the practical lowest
//   across the bass-clef-reading instruments we target. (Cello's open C
//   is lower at MIDI 36, but tutti work rarely sits there and we'd
//   rather err on the playable side.) High end stays at D5 (74) so
//   first-read sessions don't hit thumb position.
// Alto: viola's C string (48) to F5 (77).
// Treble: violin's G string (55) to C6 (84).
export const CLEF_RANGES = {
  treble: [55, 84],
  alto:   [48, 77],
  bass:   [40, 74],
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

// Scales available as a global Practice override. When set, beats every
// act's `params.scale` default. Keys match scaleNotesInRange's vocabulary
// in src/js/theory/scales.js so the generator + clef-clamp paths stay
// in sync.
export const SCALE_OPTIONS = [
  { id: 'auto',           label: 'Auto (per act)' },
  { id: 'major',          label: 'Major' },
  { id: 'natural_minor',  label: 'Natural minor' },
  { id: 'harmonic_minor', label: 'Harmonic minor' },
  { id: 'dorian',         label: 'Dorian' },
  { id: 'mixolydian',     label: 'Mixolydian' },
  { id: 'lydian',         label: 'Lydian' },
  { id: 'pentatonic_major', label: 'Pentatonic major' },
  { id: 'pentatonic_minor', label: 'Pentatonic minor' },
];

// Contour preset that overrides the act's contour. 'auto' falls back to
// the act's own default (which is what shipped originally — Exposition
// = arc, Development = wave, Recapitulation = descending).
export const CONTOUR_OPTIONS = [
  { id: 'auto',       label: 'Auto (per act)' },
  { id: 'arc',        label: 'Arc' },
  { id: 'wave',       label: 'Wave' },
  { id: 'ascending',  label: 'Ascending' },
  { id: 'descending', label: 'Descending' },
];

// Voice presets the Practice player can switch to. 'piano' uses the
// real-sample library; the others are SynthVoice presets. Each study
// declares a default kind-appropriate voice, and learners can override.
export const VOICE_OPTIONS = [
  { id: 'piano',  label: 'Piano (samples)' },
  { id: 'epiano', label: 'Electric piano' },
  { id: 'strings', label: 'Strings' },
  { id: 'bass',   label: 'Synth bass' },
  { id: 'organ',  label: 'Organ' },
  { id: 'marimba', label: 'Marimba' },
  { id: 'pluck',  label: 'Pluck' },
];

// Scale-etude pattern definitions. Each pattern is a function of the
// scale's pitch classes (0-indexed within the scale) → an array of
// pitch-class steps that build the line. Combined with a key + a scale
// shape (a list of semitone offsets from the tonic), the buildSong path
// can produce a full method-book piece.
export const SCALE_PATTERNS = {
  asc:         { label: 'Ascending',         build: (n) => Array.from({ length: n }, (_, i) => [i]) },
  desc:        { label: 'Descending',        build: (n) => Array.from({ length: n }, (_, i) => [n - 1 - i]) },
  pairs_asc:   { label: 'Pairs ascending',   build: (n) => Array.from({ length: n - 1 }, (_, i) => [i, i + 1]) },
  pairs_desc:  { label: 'Pairs descending',  build: (n) => Array.from({ length: n - 1 }, (_, i) => [n - 1 - i, n - 2 - i]) },
  threes_asc:  { label: 'Threes ascending',  build: (n) => Array.from({ length: n - 2 }, (_, i) => [i, i + 1, i + 2]) },
  threes_desc: { label: 'Threes descending', build: (n) => Array.from({ length: n - 2 }, (_, i) => [n - 1 - i, n - 2 - i, n - 3 - i]) },
};

// Scale shapes — semitone offsets from the tonic, ending on the octave.
// Used by scale-etude when applying a pattern.
export const SCALE_SHAPES = {
  major:          [0, 2, 4, 5, 7, 9, 11, 12],
  natural_minor:  [0, 2, 3, 5, 7, 8, 10, 12],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11, 12],
  dorian:         [0, 2, 3, 5, 7, 9, 10, 12],
  mixolydian:     [0, 2, 4, 5, 7, 9, 10, 12],
  lydian:         [0, 2, 4, 6, 7, 9, 11, 12],
  pentatonic_major: [0, 2, 4, 7, 9, 12],
  pentatonic_minor: [0, 3, 5, 7, 10, 12],
  blues:          [0, 3, 5, 6, 7, 10, 12],
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
  {
    id: 'scale-etude',
    kind: 'scale-etude',
    category: 'technique',
    title: 'Scale Etude',
    summary: 'Method-book patterns (pairs and threes, asc + desc) built into one continuous piece per act. Pick the scale, get the etude.',
    eyebrow: 'Technique · 3 acts',
    clefPresets: [
      { id: 'bass',   label: 'Bass clef (cello / bass)',  voices: ['bass'] },
      { id: 'treble', label: 'Treble clef (violin / RH)', voices: ['treble'] },
      { id: 'alto',   label: 'Alto clef (viola)',         voices: ['alto'] },
    ],
    keyOptions: [0, 2, 5, 7, 9],
    acts: [
      {
        id: 'ascending',
        title: 'I — Up the scale (pairs)',
        bars: 4,
        keyShift: 0,
        patternId: 'pairs_asc',
        params: { tempo: 80, scale: 'major' },
      },
      {
        id: 'descending',
        title: 'II — Down the scale (pairs)',
        bars: 4,
        keyShift: 0,
        patternId: 'pairs_desc',
        params: { tempo: 88, scale: 'major' },
      },
      {
        id: 'threes',
        title: 'III — Threes up + down',
        bars: 8,
        keyShift: 0,
        patternId: 'threes_asc',     // build path chains asc + desc for this act
        patternIdSecond: 'threes_desc',
        params: { tempo: 96, scale: 'major' },
      },
    ],
  },
  {
    id: 'solo-etude',
    kind: 'solo-etude',
    category: 'melody',
    title: 'Solo Etude',
    summary: 'One voice over real chord changes — 3 movements, each a procedural melody you can read alone.',
    eyebrow: 'Melody · 3 acts',
    clefPresets: [
      { id: 'treble', label: 'Treble clef',                voices: ['treble'] },
      { id: 'bass',   label: 'Bass clef (cello / bass)',   voices: ['bass'] },
      { id: 'alto',   label: 'Alto clef (viola)',          voices: ['alto'] },
    ],
    rhythmDefault: 'square',
    keyOptions: [0, 2, 5, 7, 9],
    acts: [
      {
        id: 'exposition',
        title: 'I — Pop axis',
        bars: 8,
        keyShift: 0,
        progression: 'pop',
        params: { density: 0.5, chromaticPct: 0, tempo: 90, contour: 'arc' },
      },
      {
        id: 'jazz',
        title: 'II — ii-V-I changes',
        bars: 8,
        keyShift: 0,
        progression: 'ii-V-I',
        params: { density: 0.6, chromaticPct: 0.15, tempo: 100, contour: 'wave', scale: 'major' },
      },
      {
        id: 'blues',
        title: 'III — Blues turnaround',
        bars: 12,
        keyShift: 0,
        progression: '12-bar-blues',
        params: { density: 0.55, chromaticPct: 0.1, tempo: 110, contour: 'descending', scale: 'blues' },
      },
    ],
  },
  {
    id: 'modal-vamp',
    kind: 'modal-vamp',
    category: 'modal',
    title: 'Modal Vamp',
    summary: 'A repeating two-chord vamp under a melodic exploration — one mode per act. Builds your ear for modal colour.',
    eyebrow: 'Modal · 3 acts',
    clefPresets: [
      { id: 'treble', label: 'Treble clef',              voices: ['treble'] },
      { id: 'bass',   label: 'Bass clef (cello / bass)', voices: ['bass'] },
    ],
    rhythmDefault: 'flowing',
    keyOptions: [0, 2, 5, 7, 9],
    acts: [
      {
        id: 'dorian',
        title: 'I — Dorian (i — IV)',
        bars: 8,
        keyShift: 0,
        vampDegrees: [1, 4],
        params: { density: 0.55, chromaticPct: 0, tempo: 90, contour: 'wave', scale: 'dorian' },
      },
      {
        id: 'mixolydian',
        title: 'II — Mixolydian (I — ♭VII)',
        bars: 8,
        keyShift: 0,
        vampDegrees: [1, 7],
        params: { density: 0.6, chromaticPct: 0, tempo: 96, contour: 'arc', scale: 'mixolydian' },
      },
      {
        id: 'lydian',
        title: 'III — Lydian (I — II)',
        bars: 8,
        keyShift: 0,
        vampDegrees: [1, 2],
        params: { density: 0.55, chromaticPct: 0.05, tempo: 88, contour: 'wave', scale: 'lydian' },
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
