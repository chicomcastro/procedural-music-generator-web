import { pitchClass } from './notes.js';

export const SCALES = {
  major:           [0, 2, 4, 5, 7, 9, 11],
  natural_minor:   [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor:  [0, 2, 3, 5, 7, 8, 11],
  melodic_minor:   [0, 2, 3, 5, 7, 9, 11],
  dorian:          [0, 2, 3, 5, 7, 9, 10],
  phrygian:        [0, 1, 3, 5, 7, 8, 10],
  lydian:          [0, 2, 4, 6, 7, 9, 11],
  mixolydian:      [0, 2, 4, 5, 7, 9, 10],
  locrian:         [0, 1, 3, 5, 6, 8, 10],
  pentatonic_major:[0, 2, 4, 7, 9],
  pentatonic_minor:[0, 3, 5, 7, 10],
  blues:           [0, 3, 5, 6, 7, 10],
};

// Interval (in semitones) from the RELATIVE MAJOR tonic up to each
// scale's tonic — used to derive the conventional key signature.
// E.g. natural minor sits a major sixth (9) above its relative major
// (A minor ↔ C major); dorian a major second (D dorian ↔ C major).
// Harmonic/melodic minor and blues conventionally take the natural-
// minor signature; pentatonics take their major/minor parent's.
const RELATIVE_MAJOR_OFFSET = {
  major: 0,
  lydian: 5,
  mixolydian: 7,
  dorian: 2,
  phrygian: 4,
  locrian: 11,
  natural_minor: 9,
  harmonic_minor: 9,
  melodic_minor: 9,
  pentatonic_major: 0,
  pentatonic_minor: 9,
  blues: 9,
};

/**
 * Conventional key signature for a tonic pitch class + scale, as the
 * MusicXML `<fifths>` value: positive = sharps, negative = flats.
 * C major → 0, G major → 1, F major → -1, F natural_minor → -4,
 * D dorian → 0. Range is normalised to [-5, 6] (F# major over Gb).
 * @param {number} tonicPc 0–11 @param {string} scaleName
 * @returns {number}
 */
export function keyFifths(tonicPc, scaleName) {
  const offset = RELATIVE_MAJOR_OFFSET[scaleName] ?? 0;
  const majorPc = (((tonicPc | 0) - offset) % 12 + 12) % 12;
  // 7 is its own inverse mod 12, so this recovers the circle-of-fifths
  // position from the pitch class.
  let f = (majorPc * 7) % 12;
  if (f > 6) f -= 12;
  return f;
}

/** @param {string} scaleName @returns {number[]} interval pattern */
export function getScale(scaleName) {
  const intervals = SCALES[scaleName];
  if (!intervals) throw new Error(`Unknown scale: ${scaleName}`);
  return intervals;
}

/** @param {number} rootMidi @param {string} scaleName @param {number} [octaves] @returns {number[]} */
export function scaleNotes(rootMidi, scaleName, octaves = 1) {
  const intervals = getScale(scaleName);
  const out = [];
  for (let o = 0; o < octaves; o++) {
    for (const i of intervals) out.push(rootMidi + 12 * o + i);
  }
  return out;
}

/** @param {number} midi @param {number} rootMidi @param {string} scaleName @returns {boolean} */
export function isInScale(midi, rootMidi, scaleName) {
  const intervals = getScale(scaleName);
  const pc = pitchClass(midi - rootMidi);
  return intervals.includes(pc);
}

/** @param {number} midi @param {number} rootMidi @param {string} scaleName @returns {number|null} */
export function degreeOf(midi, rootMidi, scaleName) {
  const intervals = getScale(scaleName);
  const pc = pitchClass(midi - rootMidi);
  const idx = intervals.indexOf(pc);
  return idx === -1 ? null : idx;
}
