// Walking-bass line generator. Given a key, a sequence of chord symbols and a
// seed, produces a quarter-note bass line landing on chord roots at every bar
// and filling beats 2-4 with chord tones, scale steps and chromatic approach.
//
// Deterministic: same seed + same inputs always yields the same notes.

import { mulberry32, weighted } from './rng.js';

// Scale degrees relative to a tonic (semitone offsets).
const SCALES = {
  major:        [0, 2, 4, 5, 7, 9, 11],
  natural_minor:[0, 2, 3, 5, 7, 8, 10],
  dorian:       [0, 2, 3, 5, 7, 9, 10],
  mixolydian:   [0, 2, 4, 5, 7, 9, 10],
};

// Chord-tone semitone offsets from the chord root.
const CHORD_KIND = {
  maj:  [0, 4, 7],
  min:  [0, 3, 7],
  '7':  [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dim:  [0, 3, 6],
};

// Pitch-class names (sharps), matching the MusicXML pitch helpers.
const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * @typedef {object} ChordSpec
 * @property {number} rootPc  Pitch class 0..11 (C=0, C#=1, …).
 * @property {keyof typeof CHORD_KIND} kind
 * @property {number} [octave]  Optional explicit bass octave override (in midi octaves).
 */

/**
 * Resolve a chord root into a midi number near the target bass octave.
 * Target = `bassMidi` (default ~36 = C2). We pick the closest octave so the
 * line doesn't jump too far between chords.
 */
function chordRootMidi(chord, lastRootMidi, bassMidi) {
  const target = lastRootMidi != null ? lastRootMidi : bassMidi;
  let candidate = (chord.rootPc % 12) + 12 * Math.floor(bassMidi / 12);
  // Find the octave nearest to target (within +/- 6 semitones).
  while (candidate - target > 6) candidate -= 12;
  while (target - candidate > 6) candidate += 12;
  return candidate;
}

/**
 * Build the pitches reachable inside one bar — chord tones + scale degrees in
 * a one-octave band centred on the root.
 */
function reachablePitches(chord, scaleSemitones, rootMidi) {
  const out = new Set();
  // Chord tones in the same octave.
  for (const o of CHORD_KIND[chord.kind] || CHORD_KIND.maj) {
    out.add(rootMidi + o);
    out.add(rootMidi + o - 12);
    out.add(rootMidi + o + 12);
  }
  // Scale degrees within ±7 semitones (sounds bass-y).
  for (const o of scaleSemitones) {
    out.add(rootMidi + o);
    out.add(rootMidi + o - 12);
  }
  // Keep only the band [rootMidi - 7, rootMidi + 9].
  return [...out].filter(m => m >= rootMidi - 7 && m <= rootMidi + 9).sort((a, b) => a - b);
}

/**
 * Walk one bar. Beat 1 = chord root; beats 2/3/4 chosen with weighted picks
 * favouring chord tones at beat 3 and chromatic approach into the next root
 * at beat 4.
 */
function walkOneBar(rng, chord, scaleSemitones, rootMidi, nextRootMidi) {
  const chordTones = (CHORD_KIND[chord.kind] || CHORD_KIND.maj).map(o => rootMidi + o);
  const reachable = reachablePitches(chord, scaleSemitones, rootMidi);

  const notes = [rootMidi];  // beat 1

  // Beat 2: scale tone in either direction.
  const beat2Candidates = reachable.filter(p => Math.abs(p - rootMidi) <= 4 && p !== rootMidi);
  notes.push(beat2Candidates.length ? beat2Candidates[Math.floor(rng() * beat2Candidates.length)] : rootMidi + 2);

  // Beat 3: weighted — prefer 3rd (chord tone) or 5th.
  const beat3Choices = [chordTones[1] || rootMidi + 4, chordTones[2] || rootMidi + 7];
  notes.push(weighted(rng, beat3Choices, [3, 5]));

  // Beat 4: chromatic approach into nextRootMidi (above or below).
  if (nextRootMidi != null) {
    const above = nextRootMidi + 1;
    const below = nextRootMidi - 1;
    // 60% from below, 40% from above — but if either is way out of range,
    // fall back to a chord tone.
    const direction = rng() < 0.6 ? below : above;
    notes.push(direction);
  } else {
    // Last bar — land on the 5th or the root.
    notes.push(weighted(rng, [chordTones[2] || rootMidi + 7, rootMidi], [4, 6]));
  }
  return notes;
}

/**
 * @param {object} opts
 * @param {number} opts.seed
 * @param {number} opts.tonicPc      Key tonic, 0..11.
 * @param {keyof typeof SCALES} [opts.scale='major']
 * @param {ChordSpec[]} opts.chords  One chord per bar.
 * @param {number} [opts.bassMidi=40] Target lowest octave (40 = E2).
 * @returns {{ notes: number[], chordSymbols: string[] }}
 */
export function generateWalkingBass(opts) {
  const rng = mulberry32(opts.seed >>> 0);
  const scaleSemitones = SCALES[opts.scale || 'major'] || SCALES.major;
  // First chord root: just below the target bass midi.
  let lastRootMidi = null;
  const notes = [];
  const chordSymbols = [];
  for (let i = 0; i < opts.chords.length; i++) {
    const chord = opts.chords[i];
    const next = opts.chords[i + 1];
    const rootMidi = chordRootMidi(chord, lastRootMidi, opts.bassMidi || 40);
    const nextRootMidi = next ? chordRootMidi(next, rootMidi, opts.bassMidi || 40) : null;
    const bar = walkOneBar(rng, chord, scaleSemitones, rootMidi, nextRootMidi);
    notes.push(...bar);
    chordSymbols.push(chordSymbolFor(chord));
    lastRootMidi = rootMidi;
  }
  return { notes, chordSymbols };
}

export function chordSymbolFor(chord) {
  const name = PC_NAMES[chord.rootPc % 12];
  switch (chord.kind) {
    case 'min':  return `${name}m`;
    case '7':    return `${name}7`;
    case 'maj7': return `${name}maj7`;
    case 'min7': return `${name}m7`;
    case 'dim':  return `${name}°`;
    default:     return name;
  }
}

// Common progressions expressed as scale-degree numerals over a major key.
// Each entry is one bar.
// Quality refers to the chord built on that degree in the major key.
const DEGREES = {
  I:  { stepIdx: 0, kind: 'maj' },
  ii: { stepIdx: 1, kind: 'min' },
  iii:{ stepIdx: 2, kind: 'min' },
  IV: { stepIdx: 3, kind: 'maj' },
  V:  { stepIdx: 4, kind: 'maj' },
  V7: { stepIdx: 4, kind: '7' },
  vi: { stepIdx: 5, kind: 'min' },
};

export const PRESET_PROGRESSIONS = {
  'I-V-vi-IV':    ['I', 'V', 'vi', 'IV'],
  'I-vi-IV-V':    ['I', 'vi', 'IV', 'V'],
  'ii-V-I':       ['ii', 'V7', 'I', 'I'],
  '12-bar-blues': ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'],
  'Andalusian':   ['vi', 'V', 'IV', 'iii'],
};

/**
 * Translate a list of Roman-numeral degree names into chord specs in the
 * chosen key. The major-key qualities are used as a baseline; 7-chord forms
 * for V are spelled `V7`.
 */
export function progressionToChords(progressionName, tonicPc) {
  const degrees = PRESET_PROGRESSIONS[progressionName] || PRESET_PROGRESSIONS['I-V-vi-IV'];
  const major = SCALES.major;
  return degrees.map(d => {
    const info = DEGREES[d] || DEGREES.I;
    const rootPc = (tonicPc + major[info.stepIdx]) % 12;
    return { rootPc, kind: info.kind };
  });
}
