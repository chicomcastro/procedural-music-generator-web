// Practice studies catalog. Each study is a multi-act procedural piece;
// the act list is fixed but every act's runtime parameters get scaled by
// the master-difficulty slider so the player can ramp things up over time.
//
// Shape:
//   id: stable identifier for storage / hash routing
//   kind: 'two-voice-counterpoint' | 'walking-bass-workout'
//   title / summary / category: display strings (EN; PT/ES live in practice-translations.js)
//   clefs: [string, string?] — clef per voice ('treble' | 'bass' | 'alto')
//   acts: ordered list of { id, title, bars, key, progression, params }
//
// `params` is what gets fed to the generator after the master-difficulty
// scaling. Each kind has its own param shape; PracticeView dispatches on
// study.kind to pick the right generator + renderer.

export const STUDIES = [
  {
    id: 'two-voice-invention',
    kind: 'two-voice-counterpoint',
    category: 'counterpoint',
    title: 'Two-voice Invention',
    summary: 'Three movements of melody-plus-counterpoint, in the Bach inventions tradition. Adjust difficulty per act or with the master slider.',
    eyebrow: 'Counterpoint · 3 acts',
    clefs: ['treble', 'treble'],
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
    clefs: ['bass'],
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
