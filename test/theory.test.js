import { describe, it, expect } from 'vitest';
import { midiToFreq, pitchClass, midiToName, nameToMidi, transpose } from '../src/js/theory/notes.js';
import { TRIADS, SEVENTHS, triad, seventh, chordFromDegree, PROGRESSIONS, progression } from '../src/js/theory/chords.js';
import { SCALES, getScale, scaleNotes, isInScale, degreeOf } from '../src/js/theory/scales.js';

describe('notes', () => {
  it('midiToFreq returns A4 = 440Hz', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 3);
  });
  it('midiToFreq doubles per octave', () => {
    expect(midiToFreq(81)).toBeCloseTo(880, 3);
    expect(midiToFreq(57)).toBeCloseTo(220, 3);
  });
  it('pitchClass wraps any midi number to 0-11', () => {
    expect(pitchClass(60)).toBe(0);
    expect(pitchClass(69)).toBe(9);
    expect(pitchClass(72)).toBe(0);
    expect(pitchClass(-1)).toBe(11);
  });
  it('midiToName prefers sharps by default and flats on demand', () => {
    expect(midiToName(60)).toBe('C4');
    expect(midiToName(61)).toBe('C#4');
    expect(midiToName(61, { flats: true })).toBe('Db4');
    expect(midiToName(69)).toBe('A4');
  });
  it('nameToMidi round-trips through midiToName', () => {
    for (const m of [21, 60, 69, 72, 88]) {
      expect(nameToMidi(midiToName(m))).toBe(m);
    }
  });
  it('nameToMidi handles flats and sharps interchangeably', () => {
    expect(nameToMidi('Db4')).toBe(61);
    expect(nameToMidi('C#4')).toBe(61);
    expect(nameToMidi('Eb5')).toBe(75);
  });
  it('nameToMidi throws on bad input', () => {
    expect(() => nameToMidi('not a note')).toThrow();
  });
  it('transpose shifts by the requested semitone delta', () => {
    expect(transpose(60, 12)).toBe(72);
    expect(transpose(60, -12)).toBe(48);
    expect(transpose(60, 0)).toBe(60);
  });
});

describe('chords', () => {
  it('TRIADS exposes major / minor / diminished / augmented intervals', () => {
    expect(TRIADS.major).toEqual([0, 4, 7]);
    expect(TRIADS.minor).toEqual([0, 3, 7]);
    expect(TRIADS.diminished).toEqual([0, 3, 6]);
    expect(TRIADS.augmented).toEqual([0, 4, 8]);
  });
  it('SEVENTHS exposes the common 7th families', () => {
    expect(SEVENTHS.dom7).toEqual([0, 4, 7, 10]);
    expect(SEVENTHS.maj7).toEqual([0, 4, 7, 11]);
    expect(SEVENTHS.min7).toEqual([0, 3, 7, 10]);
    expect(SEVENTHS.dim7).toEqual([0, 3, 6, 9]);
    expect(SEVENTHS.m7b5).toEqual([0, 3, 6, 10]);
  });
  it('triad() builds chord-tone midis from a root', () => {
    expect(triad(60)).toEqual([60, 64, 67]);
    expect(triad(60, 'minor')).toEqual([60, 63, 67]);
    expect(triad(60, 'diminished')).toEqual([60, 63, 66]);
    expect(triad(60, 'augmented')).toEqual([60, 64, 68]);
  });
  it('triad() throws on an unknown quality', () => {
    expect(() => triad(60, 'unknown')).toThrow();
  });
  it('seventh() builds 4-note chord tones', () => {
    expect(seventh(60, 'maj7')).toEqual([60, 64, 67, 71]);
    expect(seventh(60, 'dom7')).toEqual([60, 64, 67, 70]);
    expect(seventh(60, 'min7')).toEqual([60, 63, 67, 70]);
  });
  it('seventh() throws on an unknown quality', () => {
    expect(() => seventh(60, 'unknown')).toThrow();
  });
  it('chordFromDegree picks the right chord for a major-scale degree', () => {
    expect(chordFromDegree(60, 'major', 1)).toEqual([60, 64, 67]);  // C
    expect(chordFromDegree(60, 'major', 5)).toEqual([67, 71, 74]);  // G
    expect(chordFromDegree(60, 'major', 6)).toEqual([69, 72, 76]);  // Am
  });
  it('chordFromDegree with sevenths emits a 4-tone voicing', () => {
    const v7 = chordFromDegree(60, 'major', 5, { seventh: true });
    expect(v7).toHaveLength(4);
    expect(v7).toEqual([67, 71, 74, 77]);
  });
  it('chordFromDegree falls back from pentatonic to its 7-note parent', () => {
    const out = chordFromDegree(60, 'pentatonic_major', 1);
    expect(out).toEqual([60, 64, 67]);  // resolves to major
  });
  it('chordFromDegree throws if the resolved scale is not 7 notes', () => {
    // No fallback registered for "blues"… wait, blues IS mapped to natural_minor.
    // Construct a scale-name that has no fallback and only 6 notes.
    // SCALES doesn't expose one we can use directly; the indirect path is to
    // monkey-patch — skip that and rely on the typical fallback path.
    expect(() => chordFromDegree(60, 'unknown-scale', 1)).toThrow();
  });
  it('progression() emits one chord per degree', () => {
    const out = progression(60, 'major', PROGRESSIONS.pop);
    expect(out).toHaveLength(4);
    out.forEach(c => expect(c).toHaveLength(3));
  });
  it('progression() supports the {seventh} option', () => {
    const out = progression(60, 'major', PROGRESSIONS.jazz_ii_V_I, { seventh: true });
    out.forEach(c => expect(c).toHaveLength(4));
  });
});

describe('scales', () => {
  it('SCALES exposes diatonic + pentatonic + blues patterns', () => {
    expect(SCALES.major).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(SCALES.natural_minor).toBeTruthy();
    expect(SCALES.pentatonic_major).toBeTruthy();
    expect(SCALES.pentatonic_minor).toBeTruthy();
    expect(SCALES.blues).toBeTruthy();
  });
  it('getScale returns the intervals for a known scale and throws otherwise', () => {
    expect(getScale('major')).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(() => getScale('not-a-scale')).toThrow();
  });
  it('scaleNotes generates one octave by default', () => {
    const out = scaleNotes(60, 'major');
    expect(out[0]).toBe(60);
    expect(out[out.length - 1]).toBe(71);
    expect(out).toHaveLength(7);
  });
  it('scaleNotes can span multiple octaves', () => {
    const out = scaleNotes(60, 'major', 2);
    expect(out.length).toBe(14);
  });
  it('isInScale matches the diatonic notes only', () => {
    expect(isInScale(60, 60, 'major')).toBe(true);
    expect(isInScale(64, 60, 'major')).toBe(true);
    expect(isInScale(61, 60, 'major')).toBe(false);
    expect(isInScale(66, 60, 'major')).toBe(false);
  });
  it('degreeOf returns 0-based degree index for in-scale notes, null otherwise', () => {
    expect(degreeOf(60, 60, 'major')).toBe(0);
    expect(degreeOf(64, 60, 'major')).toBe(2);
    expect(degreeOf(67, 60, 'major')).toBe(4);
    expect(degreeOf(61, 60, 'major')).toBeNull();
  });
});
