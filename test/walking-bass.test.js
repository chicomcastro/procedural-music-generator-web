import { describe, it, expect } from 'vitest';
import {
  generateWalkingBass,
  chordSymbolFor,
  progressionToChords,
  PRESET_PROGRESSIONS,
} from '../src/js/generate/walking-bass.js';

describe('generateWalkingBass', () => {
  const baseOpts = (over = {}) => ({
    seed: 1234,
    tonicPc: 0,
    scale: 'major',
    chords: [
      { rootPc: 0, kind: 'maj' },
      { rootPc: 5, kind: 'maj' },
      { rootPc: 7, kind: 'maj' },
      { rootPc: 0, kind: 'maj' },
    ],
    bassMidi: 40,
    ...over,
  });

  it('produces 4 notes per chord (quarter-note walking line)', () => {
    const out = generateWalkingBass(baseOpts());
    expect(out.notes).toHaveLength(4 * 4);
    expect(out.chordSymbols).toHaveLength(4);
  });

  it('lands on the chord root at every bar', () => {
    const out = generateWalkingBass(baseOpts());
    // Beat 1 of each bar = the root pc reduced to a pitch class.
    const beat1Pcs = [out.notes[0], out.notes[4], out.notes[8], out.notes[12]].map(n => ((n % 12) + 12) % 12);
    expect(beat1Pcs).toEqual([0, 5, 7, 0]);
  });

  it('is deterministic — same seed yields identical notes', () => {
    const a = generateWalkingBass(baseOpts({ seed: 42 }));
    const b = generateWalkingBass(baseOpts({ seed: 42 }));
    expect(a.notes).toEqual(b.notes);
    expect(a.chordSymbols).toEqual(b.chordSymbols);
  });

  it('different seeds produce different lines (beat 2/3/4 vary)', () => {
    const a = generateWalkingBass(baseOpts({ seed: 1 }));
    const b = generateWalkingBass(baseOpts({ seed: 999 }));
    // Beat 1 of bar 1 should match (root); at least one of beats 2-4 must differ.
    expect(a.notes[0]).toBe(b.notes[0]);
    let differs = false;
    for (let i = 1; i < a.notes.length; i++) if (a.notes[i] !== b.notes[i]) { differs = true; break; }
    expect(differs).toBe(true);
  });

  it('respects the requested bass midi octave', () => {
    const high = generateWalkingBass(baseOpts({ bassMidi: 52, seed: 7 }));
    const low = generateWalkingBass(baseOpts({ bassMidi: 28, seed: 7 }));
    const avg = arr => arr.reduce((s, n) => s + n, 0) / arr.length;
    expect(avg(high.notes)).toBeGreaterThan(avg(low.notes));
  });

  it('handles minor-7 / dom7 chord kinds without crashing', () => {
    const out = generateWalkingBass({
      seed: 0,
      tonicPc: 0,
      scale: 'natural_minor',
      chords: [
        { rootPc: 0, kind: 'min7' },
        { rootPc: 5, kind: 'min7' },
        { rootPc: 7, kind: '7' },
        { rootPc: 0, kind: 'min7' },
      ],
    });
    expect(out.notes).toHaveLength(16);
    out.notes.forEach(n => expect(n).toBeGreaterThan(0));
  });

  it('uses an unknown chord kind via the maj fallback', () => {
    const out = generateWalkingBass({
      seed: 0,
      tonicPc: 0,
      chords: [{ rootPc: 0, kind: 'doesnotexist' }],
    });
    expect(out.notes).toHaveLength(4);
  });

  it('falls back to major when given an unknown scale', () => {
    const out = generateWalkingBass(baseOpts({ scale: 'definitely-not-a-scale' }));
    expect(out.notes).toHaveLength(16);
  });

  it('keeps the last bar without an "approach" target', () => {
    // Only one chord — there's no "next" root so beat 4 should fall back to a
    // chord tone (root or 5th).
    const out = generateWalkingBass(baseOpts({ chords: [{ rootPc: 0, kind: 'maj' }] }));
    const rootMidi = out.notes[0];
    const beat4 = out.notes[3];
    // beat 4 should be either the root, the 5th (rootMidi + 7), or one octave off.
    const candidates = [rootMidi, rootMidi + 7, rootMidi - 5, rootMidi - 12, rootMidi + 12];
    expect(candidates.some(c => c === beat4)).toBe(true);
  });
});

describe('chordSymbolFor', () => {
  it('renders major triads as the pitch-class name', () => {
    expect(chordSymbolFor({ rootPc: 0, kind: 'maj' })).toBe('C');
    expect(chordSymbolFor({ rootPc: 5, kind: 'maj' })).toBe('F');
  });
  it('appends m for minor', () => {
    expect(chordSymbolFor({ rootPc: 9, kind: 'min' })).toBe('Am');
  });
  it('emits 7 / maj7 / m7 / dim suffixes', () => {
    expect(chordSymbolFor({ rootPc: 7, kind: '7' })).toBe('G7');
    expect(chordSymbolFor({ rootPc: 0, kind: 'maj7' })).toBe('Cmaj7');
    expect(chordSymbolFor({ rootPc: 2, kind: 'min7' })).toBe('Dm7');
    expect(chordSymbolFor({ rootPc: 11, kind: 'dim' })).toBe('B°');
  });
  it('normalises out-of-range root pcs', () => {
    expect(chordSymbolFor({ rootPc: 12, kind: 'maj' })).toBe('C');
    expect(chordSymbolFor({ rootPc: 25, kind: 'maj' })).toBe('C#');
  });
});

describe('progressionToChords', () => {
  it('translates a Roman-numeral preset over a tonic', () => {
    const chords = progressionToChords('I-V-vi-IV', 0);
    expect(chords).toEqual([
      { rootPc: 0, kind: 'maj' },
      { rootPc: 7, kind: 'maj' },
      { rootPc: 9, kind: 'min' },
      { rootPc: 5, kind: 'maj' },
    ]);
  });
  it('translates ii-V-I with V7 spelled as dominant', () => {
    const chords = progressionToChords('ii-V-I', 0);
    expect(chords[0]).toEqual({ rootPc: 2, kind: 'min' });
    expect(chords[1]).toEqual({ rootPc: 7, kind: '7' });
    expect(chords[2]).toEqual({ rootPc: 0, kind: 'maj' });
  });
  it('respects non-C tonics', () => {
    const chords = progressionToChords('I-V-vi-IV', 5);  // F major
    expect(chords.map(c => c.rootPc)).toEqual([5, 0, 2, 10]);  // F, C, D, Bb
  });
  it('falls back to the default progression for unknown names', () => {
    const fallback = progressionToChords('not-a-progression', 0);
    const expected = progressionToChords('I-V-vi-IV', 0);
    expect(fallback).toEqual(expected);
  });
  it('exposes every preset progression', () => {
    expect(Object.keys(PRESET_PROGRESSIONS)).toContain('I-V-vi-IV');
    expect(Object.keys(PRESET_PROGRESSIONS)).toContain('12-bar-blues');
    expect(Object.keys(PRESET_PROGRESSIONS)).toContain('ii-V-I');
  });
});
