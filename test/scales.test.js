import { describe, it, expect } from 'vitest';
import { SCALES, getScale, scaleNotes, isInScale } from '../src/js/theory/scales.js';

describe('SCALES', () => {
  it('major scale has correct intervals', () => {
    expect(SCALES.major).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('natural minor scale has correct intervals', () => {
    expect(SCALES.natural_minor).toEqual([0, 2, 3, 5, 7, 8, 10]);
  });

  it('harmonic minor scale has correct intervals', () => {
    expect(SCALES.harmonic_minor).toEqual([0, 2, 3, 5, 7, 8, 11]);
  });

  it('dorian scale has correct intervals', () => {
    expect(SCALES.dorian).toEqual([0, 2, 3, 5, 7, 9, 10]);
  });

  it('pentatonic major has 5 notes', () => {
    expect(SCALES.pentatonic_major).toHaveLength(5);
  });

  it('blues scale has 6 notes', () => {
    expect(SCALES.blues).toHaveLength(6);
  });
});

describe('getScale', () => {
  it('returns intervals for known scale', () => {
    expect(getScale('major')).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('throws for unknown scale', () => {
    expect(() => getScale('nonexistent')).toThrow('Unknown scale');
  });
});

describe('scaleNotes', () => {
  it('returns correct MIDI notes for C major one octave', () => {
    const notes = scaleNotes(60, 'major', 1);
    expect(notes).toEqual([60, 62, 64, 65, 67, 69, 71]);
  });

  it('returns two octaves worth of notes', () => {
    const notes = scaleNotes(60, 'major', 2);
    expect(notes).toHaveLength(14);
  });
});

describe('isInScale', () => {
  it('C is in C major', () => {
    expect(isInScale(60, 60, 'major')).toBe(true);
  });

  it('C# is not in C major', () => {
    expect(isInScale(61, 60, 'major')).toBe(false);
  });
});
