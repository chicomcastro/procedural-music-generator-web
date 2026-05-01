const SHARP_NAMES  = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES   = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** @param {number} midi @returns {number} */
export function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** @param {number} midi @returns {number} 0–11 */
export function pitchClass(midi) {
  return ((midi % 12) + 12) % 12;
}

/** @param {number} midi @param {{ flats?: boolean }} [opts] @returns {string} */
export function midiToName(midi, { flats = false } = {}) {
  const names = flats ? FLAT_NAMES : SHARP_NAMES;
  const octave = Math.floor(midi / 12) - 1;
  return `${names[pitchClass(midi)]}${octave}`;
}

/** @param {string} name e.g. "C#4" @returns {number} */
export function nameToMidi(name) {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name.trim());
  if (!m) throw new Error(`Invalid note name: ${name}`);
  const [, letter, accidental, octStr] = m;
  let pc = LETTER_PC[letter.toUpperCase()];
  if (accidental === '#') pc += 1;
  else if (accidental === 'b') pc -= 1;
  const octave = parseInt(octStr, 10);
  return (octave + 1) * 12 + pc;
}

/** @param {number} midi @param {number} semitones @returns {number} */
export function transpose(midi, semitones) {
  return midi + semitones;
}
