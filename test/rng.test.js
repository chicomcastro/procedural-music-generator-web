import { describe, it, expect } from 'vitest';
import { mulberry32, pick, weighted } from '../src/js/generate/rng.js';

describe('mulberry32', () => {
  it('same seed produces same sequence', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('different seeds produce different sequences', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(99);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });

  it('output is in [0, 1)', () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});

describe('pick', () => {
  it('returns undefined for empty array', () => {
    const rng = mulberry32(1);
    expect(pick(rng, [])).toBeUndefined();
  });

  it('returns element from the array', () => {
    const rng = mulberry32(1);
    const arr = ['a', 'b', 'c'];
    const result = pick(rng, arr);
    expect(arr).toContain(result);
  });
});

describe('weighted', () => {
  it('returns item from items array', () => {
    const rng = mulberry32(1);
    const items = ['x', 'y', 'z'];
    const weights = [1, 2, 3];
    const result = weighted(rng, items, weights);
    expect(items).toContain(result);
  });
});
