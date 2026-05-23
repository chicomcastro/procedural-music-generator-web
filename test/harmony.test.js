import { describe, it, expect } from 'vitest';
import { harmonyTagFor, transposeChordSymbol, escapeText } from '../src/js/export/harmony.js';

describe('harmonyTagFor', () => {
  it('renders a major chord', () => {
    const x = harmonyTagFor('C');
    expect(x).toContain('<root-step>C</root-step>');
    expect(x).toContain('<kind text="C">major</kind>');
  });

  it('renders a minor seventh', () => {
    const x = harmonyTagFor('Dm7');
    expect(x).toContain('<root-step>D</root-step>');
    expect(x).toContain('minor-seventh');
  });

  it('renders sharp accidentals', () => {
    const x = harmonyTagFor('F#');
    expect(x).toContain('<root-step>F</root-step>');
    expect(x).toContain('<root-alter>1</root-alter>');
  });

  it('renders slash chords with a bass note', () => {
    const x = harmonyTagFor('C/E');
    expect(x).toContain('<bass-step>E</bass-step>');
  });

  it('returns empty string for unparseable input', () => {
    expect(harmonyTagFor('')).toBe('');
    expect(harmonyTagFor('xyz')).toBe('');
    expect(harmonyTagFor(null)).toBe('');
  });

  it('escapes special chars in the symbol text', () => {
    const x = harmonyTagFor('Cmaj7');
    expect(x).toContain('text="Cmaj7"');
    expect(escapeText('<&>')).toBe('&lt;&amp;&gt;');
  });
});

describe('transposeChordSymbol', () => {
  it('shifts a major chord up a fifth', () => {
    expect(transposeChordSymbol('C', 7)).toBe('G');
  });

  it('preserves the suffix', () => {
    expect(transposeChordSymbol('Dm7', 5)).toBe('Gm7');
  });

  it('preserves flats as flats on negative shifts', () => {
    expect(transposeChordSymbol('Bb', -2)).toBe('Ab');
  });

  it('shifts slash chords on both sides', () => {
    expect(transposeChordSymbol('C/E', 7)).toBe('G/B');
  });

  it('returns the input unchanged on garbage', () => {
    expect(transposeChordSymbol('', 5)).toBe('');
    expect(transposeChordSymbol('xyz', 5)).toBe('xyz');
  });
});
