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

export function getScale(scaleName) {
  const intervals = SCALES[scaleName];
  if (!intervals) throw new Error(`Unknown scale: ${scaleName}`);
  return intervals;
}

export function scaleNotes(rootMidi, scaleName, octaves = 1) {
  const intervals = getScale(scaleName);
  const out = [];
  for (let o = 0; o < octaves; o++) {
    for (const i of intervals) out.push(rootMidi + 12 * o + i);
  }
  return out;
}

export function isInScale(midi, rootMidi, scaleName) {
  const intervals = getScale(scaleName);
  const pc = pitchClass(midi - rootMidi);
  return intervals.includes(pc);
}

export function degreeOf(midi, rootMidi, scaleName) {
  const intervals = getScale(scaleName);
  const pc = pitchClass(midi - rootMidi);
  const idx = intervals.indexOf(pc);
  return idx === -1 ? null : idx;
}
