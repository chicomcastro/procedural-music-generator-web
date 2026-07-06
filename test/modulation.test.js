import { describe, it, expect } from 'vitest';
import { generateModulationDrill, MODULATION_TARGETS, MODULATION_STRATEGIES } from '../src/js/generate/modulation.js';
import { mulberry32 } from '../src/js/generate/rng.js';
import { keyFifths } from '../src/js/theory/scales.js';

const norm = (pc) => ((pc % 12) + 12) % 12;

describe('generateModulationDrill', () => {
  it('produces a passage for every target × strategy, ending on the target tonic', () => {
    for (const t of MODULATION_TARGETS) {
      for (const s of MODULATION_STRATEGIES) {
        const d = generateModulationDrill(mulberry32(3), { startPc: 0, targetId: t.id, strategyId: s.id, clefAnchor: 48 });
        expect(d.bars).toBeGreaterThan(4);
        expect(d.chordSymbols.length).toBe(d.bars);
        // Establishes the home key first.
        expect(d.chordSymbols[0]).toBe('C');
        // The last melody note resolves to the target tonic.
        const mel = d.events.filter(e => e.type === 'melody').sort((a, b) => a.atBeat - b.atBeat);
        expect(norm(mel.at(-1).midi)).toBe(norm(t.semitones));
        // Both voices are present.
        expect(d.events.some(e => e.type === 'melody2')).toBe(true);
      }
    }
  });

  it('changes the key signature at the modulation point', () => {
    const d = generateModulationDrill(mulberry32(1), { startPc: 0, targetId: 'dominant', strategyId: 'pivot', clefAnchor: 48 });
    expect(d.keySignatures[0]).toEqual({ bar: 0, fifths: keyFifths(0, 'major') });
    expect(d.keySignatures[1].bar).toBe(d.modulationBar);
    expect(d.keySignatures[1].fifths).toBe(keyFifths(7, 'major')); // G major = 1 sharp
    expect(d.modulationBar).toBeGreaterThan(0);
  });

  it('the relative-minor target keeps one key signature (smoothest move)', () => {
    const d = generateModulationDrill(mulberry32(1), { startPc: 0, targetId: 'relative_minor', strategyId: 'pivot', clefAnchor: 48 });
    expect(d.keySignatures[0].fifths).toBe(d.keySignatures[1].fifths); // both 0 for C / Am
  });

  it('applied-dominant strategy inserts the target’s dominant 7th at the seam', () => {
    // C → G: the connector is D7 (V7 of G).
    const d = generateModulationDrill(mulberry32(1), { startPc: 0, targetId: 'dominant', strategyId: 'applied', clefAnchor: 48 });
    expect(d.chordSymbols[d.modulationBar]).toBe('D7');
  });

  it('is deterministic for the same seed + params', () => {
    const opts = { startPc: 2, targetId: 'subdominant', strategyId: 'pivot', clefAnchor: 48 };
    expect(generateModulationDrill(mulberry32(9), opts)).toEqual(generateModulationDrill(mulberry32(9), opts));
  });

  it('keeps pitches in a sane instrument range', () => {
    for (const anchor of [40, 48, 60]) {
      const d = generateModulationDrill(mulberry32(2), { startPc: 7, targetId: 'up_step', strategyId: 'direct', clefAnchor: anchor });
      for (const e of d.events) {
        expect(e.midi).toBeGreaterThanOrEqual(24);
        expect(e.midi).toBeLessThanOrEqual(96);
      }
    }
  });
});
