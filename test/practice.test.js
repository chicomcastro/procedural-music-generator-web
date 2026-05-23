import { describe, it, expect } from 'vitest';
import { STUDIES, scaleParams, tonicName } from '../src/js/ui/practice-studies.js';
import { __test } from '../src/js/ui/PracticeView.js';

const { buildSong } = __test;

describe('practice-studies catalog', () => {
  it('ships at least the two PR-1 studies', () => {
    expect(STUDIES.find(s => s.id === 'two-voice-invention')).toBeTruthy();
    expect(STUDIES.find(s => s.id === 'walking-bass-workout')).toBeTruthy();
  });

  it('every study has a non-empty acts array and a recognised kind', () => {
    for (const s of STUDIES) {
      expect(s.acts.length).toBeGreaterThan(0);
      expect(['two-voice-counterpoint', 'walking-bass-workout']).toContain(s.kind);
    }
  });
});

describe('scaleParams', () => {
  const base = { density: 0.5, chromaticPct: 0.1, tempo: 90, independence: 0.5 };

  it('returns the baseline when difficulty == 0.5', () => {
    const out = scaleParams(base, 0.5);
    expect(out.density).toBeCloseTo(0.5, 5);
    expect(out.chromaticPct).toBeCloseTo(0.1, 5);
    expect(out.tempo).toBe(90);
  });

  it('eases parameters when difficulty == 0', () => {
    const easy = scaleParams(base, 0);
    expect(easy.density).toBeLessThan(base.density);
    expect(easy.chromaticPct).toBeLessThan(base.chromaticPct);
    expect(easy.tempo).toBeLessThan(base.tempo);
  });

  it('pushes parameters when difficulty == 1', () => {
    const hard = scaleParams(base, 1);
    expect(hard.density).toBeGreaterThan(base.density);
    expect(hard.chromaticPct).toBeGreaterThan(base.chromaticPct);
    expect(hard.tempo).toBeGreaterThan(base.tempo);
  });

  it('clamps density and chromaticPct into safe bounds', () => {
    const extreme = scaleParams({ density: 0.9, chromaticPct: 0.4 }, 1);
    expect(extreme.density).toBeLessThanOrEqual(0.95);
    expect(extreme.chromaticPct).toBeLessThanOrEqual(0.5);
  });

  it('leaves undefined params undefined (no NaN bleeding through)', () => {
    const out = scaleParams({ tempo: 100 }, 0.5);
    expect(out.density).toBeUndefined();
    expect(out.chromaticPct).toBeUndefined();
    expect(out.tempo).toBe(100);
  });
});

describe('tonicName', () => {
  it('round-trips standard pitch classes', () => {
    expect(tonicName(0)).toBe('C');
    expect(tonicName(2)).toBe('D');
    expect(tonicName(5)).toBe('F');
    expect(tonicName(9)).toBe('A');
  });
  it('normalises out-of-range and negative pcs', () => {
    expect(tonicName(12)).toBe('C');
    expect(tonicName(-1)).toBe('B');
  });
});

describe('buildSong — two-voice-invention', () => {
  const study = STUDIES.find(s => s.id === 'two-voice-invention');

  it('returns a song with events for both voices', () => {
    const song = buildSong(study, { keyPc: 0, seed: 42, difficulty: 50 });
    expect(song.events.some(e => e.type === 'melody')).toBe(true);
    expect(song.events.some(e => e.type === 'melody2')).toBe(true);
  });

  it('is deterministic across calls with the same inputs', () => {
    const a = buildSong(study, { keyPc: 0, seed: 7, difficulty: 50 });
    const b = buildSong(study, { keyPc: 0, seed: 7, difficulty: 50 });
    expect(a.events).toEqual(b.events);
    expect(a.bpm).toBe(b.bpm);
  });

  it('produces different lines for different seeds', () => {
    const a = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50 });
    const b = buildSong(study, { keyPc: 0, seed: 999, difficulty: 50 });
    const aSig = a.events.slice(0, 8).map(e => e.midi).join(',');
    const bSig = b.events.slice(0, 8).map(e => e.midi).join(',');
    expect(aSig).not.toBe(bSig);
  });

  it('bpm climbs with difficulty (first-act tempo wins)', () => {
    const easy = buildSong(study, { keyPc: 0, seed: 1, difficulty: 0 });
    const hard = buildSong(study, { keyPc: 0, seed: 1, difficulty: 100 });
    expect(hard.bpm).toBeGreaterThan(easy.bpm);
  });

  it('total bars equals the sum of act bars', () => {
    const song = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50 });
    const expected = study.acts.reduce((s, a) => s + a.bars, 0);
    expect(song.bars).toBe(expected);
  });
});

describe('buildSong — walking-bass-workout', () => {
  const study = STUDIES.find(s => s.id === 'walking-bass-workout');

  it('emits one bass event per beat', () => {
    const song = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50 });
    const expected = study.acts.reduce((s, a) => s + a.bars * 4, 0);
    expect(song.events.filter(e => e.type === 'bass')).toHaveLength(expected);
  });

  it('is deterministic across calls with the same inputs', () => {
    const a = buildSong(study, { keyPc: 0, seed: 11, difficulty: 50 });
    const b = buildSong(study, { keyPc: 0, seed: 11, difficulty: 50 });
    expect(a.events).toEqual(b.events);
  });

  it('respects the key picker — root pitch class of beat 1 matches the key', () => {
    const songC = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50 });
    const songF = buildSong(study, { keyPc: 5, seed: 1, difficulty: 50 });
    expect(((songC.events[0].midi % 12) + 12) % 12).toBe(0);
    expect(((songF.events[0].midi % 12) + 12) % 12).toBe(5);
  });
});
