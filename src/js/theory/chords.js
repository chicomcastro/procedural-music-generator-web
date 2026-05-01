import { getScale } from './scales.js';

export const TRIADS = {
  major:      [0, 4, 7],
  minor:      [0, 3, 7],
  diminished: [0, 3, 6],
  augmented:  [0, 4, 8],
};

export const SEVENTHS = {
  maj7:  [0, 4, 7, 11],
  min7:  [0, 3, 7, 10],
  dom7:  [0, 4, 7, 10],
  m7b5:  [0, 3, 6, 10],
  dim7:  [0, 3, 6, 9],
  minMaj7: [0, 3, 7, 11],
};

/** @param {number} rootMidi @param {string} [quality] @returns {number[]} */
export function triad(rootMidi, quality = 'major') {
  const intervals = TRIADS[quality];
  if (!intervals) throw new Error(`Unknown triad quality: ${quality}`);
  return intervals.map(i => rootMidi + i);
}

/** @param {number} rootMidi @param {string} [quality] @returns {number[]} */
export function seventh(rootMidi, quality = 'maj7') {
  const intervals = SEVENTHS[quality];
  if (!intervals) throw new Error(`Unknown seventh quality: ${quality}`);
  return intervals.map(i => rootMidi + i);
}

const CHORD_SCALE_FALLBACK = {
  blues: 'natural_minor',
  pentatonic_minor: 'natural_minor',
  pentatonic_major: 'major',
};

/** @param {number} tonicMidi @param {string} scaleName @param {number} degree 1-based @param {{ seventh?: boolean }} [opts] @returns {number[]} */
export function chordFromDegree(tonicMidi, scaleName, degree, { seventh: addSeventh = false } = {}) {
  const resolved = CHORD_SCALE_FALLBACK[scaleName] || scaleName;
  const intervals = getScale(resolved);
  if (intervals.length < 7) {
    throw new Error(`Diatonic chords require a 7-note scale, got ${resolved} (${intervals.length} notes)`);
  }
  const idx = degree - 1;
  const at = (k) => {
    const wrap = ((k % intervals.length) + intervals.length) % intervals.length;
    const octShift = Math.floor(k / intervals.length) * 12;
    return tonicMidi + intervals[wrap] + octShift;
  };
  const notes = [at(idx), at(idx + 2), at(idx + 4)];
  if (addSeventh) notes.push(at(idx + 6));
  return notes;
}

export const PROGRESSIONS = {
  pop:        [1, 5, 6, 4],
  fifties:    [1, 6, 4, 5],
  pachelbel:  [1, 5, 6, 3, 4, 1, 4, 5],
  jazz_ii_V_I:[2, 5, 1],
  minor_loop: [1, 6, 3, 7],
  twelve_bar: [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5],
};

/** @param {number} tonicMidi @param {string} scaleName @param {number[]} degrees @returns {number[][]} */
export function progression(tonicMidi, scaleName, degrees, opts) {
  return degrees.map(d => chordFromDegree(tonicMidi, scaleName, d, opts));
}
