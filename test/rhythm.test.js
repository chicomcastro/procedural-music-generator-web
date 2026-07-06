import { describe, it, expect } from 'vitest';
import { generateRhythm } from '../src/js/generate/rhythm.js';
import { mulberry32 } from '../src/js/generate/rng.js';

const DOT_FREE = new Set([0.25, 0.5, 1, 2, 4]);
const onGrid = (b) => Math.abs(Math.round(b * 2) - b * 2) < 1e-9; // multiple of 0.5

describe('generateRhythm — straight family (dot-free, on-grid)', () => {
  for (const template of ['square-as-sparse', 'straight']) {
    const tpl = template === 'square-as-sparse' ? 'sparse' : 'straight';
    it(`${tpl}: at swing 0 uses only dot-free durations on the beat/half-beat`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        const r = generateRhythm(mulberry32(seed), { bars: 4, beatsPerBar: 4, density: 0.5, swing: 0, template: tpl });
        for (const o of r) {
          expect(DOT_FREE.has(o.durationBeats)).toBe(true);       // no augmentation dots
          expect(onGrid(o.atBeat)).toBe(true);                    // on beat or half-beat
        }
      }
    });
  }

  it('tiles the whole span continuously (no gaps, no overshoot)', () => {
    const total = 4 * 4;
    for (let seed = 1; seed <= 20; seed++) {
      const r = generateRhythm(mulberry32(seed), { bars: 4, beatsPerBar: 4, density: 0.6, swing: 0, template: 'straight' });
      // The first onset starts the span and durations sum to the total.
      expect(r[0].atBeat).toBe(0);
      const sum = r.reduce((s, o) => s + o.durationBeats, 0);
      expect(sum).toBeCloseTo(total, 6);
    }
  });

  it('every off-beat onset is the second half of an eighth-pair (no isolated syncopation)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = generateRhythm(mulberry32(seed), { bars: 4, beatsPerBar: 4, density: 0.7, swing: 0, template: 'straight' });
      for (let i = 0; i < r.length; i++) {
        if (r[i].onBeat) continue;
        // an off-beat onset must sit exactly a half-beat after an on-beat note
        const prev = r[i - 1];
        expect(prev && prev.onBeat && Math.abs(r[i].atBeat - (prev.atBeat + 0.5)) < 1e-9).toBe(true);
      }
    }
  });

  it('swing leans eighth-pairs long-short (introduces the swung ratio only when swing > 0)', () => {
    const straight = generateRhythm(mulberry32(4), { bars: 4, beatsPerBar: 4, density: 0.9, swing: 0, template: 'straight' });
    expect(straight.filter((o) => !o.onBeat).every((o) => o.durationBeats === 0.5)).toBe(true);
    const swung = generateRhythm(mulberry32(4), { bars: 4, beatsPerBar: 4, density: 0.9, swing: 1, template: 'straight' });
    // At least one on-beat eighth is now longer than its off-beat partner.
    const leaned = swung.some((o, i) => o.onBeat && swung[i + 1] && !swung[i + 1].onBeat && o.durationBeats > swung[i + 1].durationBeats + 1e-9);
    expect(leaned).toBe(true);
  });
});

describe('generateRhythm — syncopated family', () => {
  it('places off-beat onsets that are not just eighth-pair tails', () => {
    // The syncopated template deliberately fires off-beat slots on their own.
    let sawSyncopation = false;
    for (let seed = 1; seed <= 20 && !sawSyncopation; seed++) {
      const r = generateRhythm(mulberry32(seed), { bars: 4, beatsPerBar: 4, density: 0.85, swing: 0, template: 'syncopated' });
      sawSyncopation = r.some((o, i) => !o.onBeat && (i === 0 || !r[i - 1].onBeat || Math.abs(o.atBeat - (r[i - 1].atBeat + 0.5)) > 1e-9));
    }
    expect(sawSyncopation).toBe(true);
  });
});
