import { describe, it, expect } from 'vitest';
import { generateMelody } from '../src/js/generate/melody.js';
import { mulberry32 } from '../src/js/generate/rng.js';

const baseRhythm = () => [
  { atBeat: 0, durationBeats: 1, isDownbeat: true,  onBeat: true },
  { atBeat: 1, durationBeats: 1, isDownbeat: false, onBeat: true },
  { atBeat: 2, durationBeats: 1, isDownbeat: false, onBeat: true },
  { atBeat: 3, durationBeats: 1, isDownbeat: false, onBeat: true },
];

const baseProgression = () => [
  { startBeat: 0, durationBeats: 2, notes: [60, 64, 67] },  // C
  { startBeat: 2, durationBeats: 2, notes: [67, 71, 74] },  // G
];

describe('generateMelody', () => {
  const baseOpts = (over = {}) => ({
    progression: baseProgression(),
    rhythm: baseRhythm(),
    scale: 'major',
    tonic: 60,
    ...over,
  });

  it('emits one event per rhythm onset', () => {
    const out = generateMelody(mulberry32(1), baseOpts());
    expect(out).toHaveLength(baseRhythm().length);
  });

  it('every event keeps the rhythm onset metadata', () => {
    const out = generateMelody(mulberry32(1), baseOpts());
    const rh = baseRhythm();
    out.forEach((ev, i) => {
      expect(ev.atBeat).toBe(rh[i].atBeat);
      expect(ev.durationBeats).toBe(rh[i].durationBeats);
      expect(typeof ev.midi).toBe('number');
    });
  });

  it('resolves the last note to the tonic pitch class', () => {
    const out = generateMelody(mulberry32(1), baseOpts());
    expect(out[out.length - 1].midi % 12).toBe(0);  // C
  });

  it('deterministic per seed', () => {
    const a = generateMelody(mulberry32(99), baseOpts());
    const b = generateMelody(mulberry32(99), baseOpts());
    expect(a).toEqual(b);
  });

  it('honours an ascending contour by trending upward overall', () => {
    const upFirst = generateMelody(mulberry32(7), baseOpts({ contour: 'ascending' }));
    expect(upFirst[upFirst.length - 1].midi).toBeGreaterThanOrEqual(upFirst[0].midi);
  });

  it('handles descending / arc / wave / flat contours without throwing', () => {
    for (const c of ['descending', 'arc', 'wave', 'flat', 'auto', 'no-such-contour']) {
      const out = generateMelody(mulberry32(3), baseOpts({ contour: c }));
      expect(out).toHaveLength(baseRhythm().length);
    }
  });

  it('keeps notes inside the requested range', () => {
    const range = [60, 71];
    const out = generateMelody(mulberry32(7), baseOpts({ range }));
    out.forEach(ev => {
      expect(ev.midi).toBeGreaterThanOrEqual(range[0]);
      expect(ev.midi).toBeLessThanOrEqual(range[1]);
    });
  });

  it('throws if the range admits no scale notes', () => {
    // Pick a range that holds zero scale tones: between C and C# isn't enough.
    expect(() => generateMelody(mulberry32(1), baseOpts({ range: [61, 61] }))).toThrow();
  });

  it('handles a 1-onset rhythm (no progress div-by-zero)', () => {
    const out = generateMelody(mulberry32(1), baseOpts({
      rhythm: [{ atBeat: 0, durationBeats: 1, isDownbeat: true, onBeat: true }],
    }));
    expect(out).toHaveLength(1);
  });

  it('handles onset on an off-beat (no chord progression match)', () => {
    const out = generateMelody(mulberry32(1), baseOpts({
      rhythm: [
        { atBeat: 0.5, durationBeats: 0.5, isDownbeat: false, onBeat: false },
        { atBeat: 1, durationBeats: 1, isDownbeat: false, onBeat: true },
        { atBeat: 2, durationBeats: 1, isDownbeat: false, onBeat: true },
        { atBeat: 3, durationBeats: 1, isDownbeat: true,  onBeat: true },
      ],
    }));
    expect(out).toHaveLength(4);
  });
});
