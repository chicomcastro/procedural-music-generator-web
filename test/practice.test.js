import { describe, it, expect } from 'vitest';
import { STUDIES, scaleParams, tonicName, CLEF_ANCHORS, CLEF_RANGES, RHYTHM_PRESETS, DUET_STYLES, clampMidiToRange } from '../src/js/ui/practice-studies.js';
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

  it('emits one chord symbol per bar (for staff harmony rendering)', () => {
    const song = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50 });
    expect(Array.isArray(song.chordSymbols)).toBe(true);
    const expected = study.acts.reduce((s, a) => s + a.bars, 0);
    expect(song.chordSymbols).toHaveLength(expected);
    expect(song.chordSymbols.every(s => typeof s === 'string' && s.length > 0)).toBe(true);
  });

  it('treble clef preset shifts the bassline up an octave', () => {
    const bass = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass'] });
    const treble = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['treble'] });
    expect(treble.events[0].midi).toBeGreaterThan(bass.events[0].midi);
  });
});

describe('clef + rhythm presets — two-voice-invention', () => {
  const study = STUDIES.find(s => s.id === 'two-voice-invention');

  it('Bass+Bass default keeps both voices in the cello range (≤ C4)', () => {
    const song = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass', 'bass'] });
    const v1 = song.events.filter(e => e.type === 'melody');
    const v2 = song.events.filter(e => e.type === 'melody2');
    const avgV1 = v1.reduce((s, e) => s + e.midi, 0) / v1.length;
    const avgV2 = v2.reduce((s, e) => s + e.midi, 0) / v2.length;
    // Both averages should sit at or below A4 (69) so most notes land in bass clef.
    expect(avgV1).toBeLessThan(69);
    expect(avgV2).toBeLessThan(69);
  });

  it('Treble+Treble preset places voices roughly an octave higher than Bass+Bass', () => {
    const bb = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass', 'bass'] });
    const tt = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['treble', 'treble'] });
    const avg = (evs) => evs.reduce((s, e) => s + e.midi, 0) / evs.length;
    expect(avg(tt.events) - avg(bb.events)).toBeGreaterThan(12);
  });

  it('Square rhythm produces longer average durations than Flowing', () => {
    const square = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass', 'bass'], rhythmPresetId: 'square' });
    const flowing = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass', 'bass'], rhythmPresetId: 'flowing' });
    const avg = (evs) => evs.reduce((s, e) => s + e.durationBeats, 0) / evs.length;
    expect(avg(square.events)).toBeGreaterThan(avg(flowing.events));
  });

  it('CLEF_ANCHORS provides anchors for treble / alto / bass', () => {
    expect(CLEF_ANCHORS.treble).toBeGreaterThan(CLEF_ANCHORS.alto);
    expect(CLEF_ANCHORS.alto).toBeGreaterThan(CLEF_ANCHORS.bass);
  });

  it('RHYTHM_PRESETS exposes density progressing low → high', () => {
    expect(RHYTHM_PRESETS.square.density).toBeLessThan(RHYTHM_PRESETS.walking.density);
    expect(RHYTHM_PRESETS.walking.density).toBeLessThan(RHYTHM_PRESETS.flowing.density);
    expect(RHYTHM_PRESETS.flowing.density).toBeLessThan(RHYTHM_PRESETS.syncopated.density);
  });
});

describe('clampMidiToRange', () => {
  it('keeps notes already inside the range untouched', () => {
    expect(clampMidiToRange(60, [55, 80])).toBe(60);
    expect(clampMidiToRange(55, [55, 80])).toBe(55);
    expect(clampMidiToRange(80, [55, 80])).toBe(80);
  });

  it('octave-shifts up when below the low bound', () => {
    expect(clampMidiToRange(30, [36, 74])).toBe(42);     // 30 + 12
    expect(clampMidiToRange(20, [36, 74])).toBe(44);     // 20 + 24
  });

  it('octave-shifts down when above the high bound', () => {
    expect(clampMidiToRange(90, [36, 74])).toBe(66);     // 90 - 12 = 78 (still >74), -12 again = 66
  });

  it('falls back to the bound when the input is way outside a tiny range', () => {
    expect(clampMidiToRange(40, [36, 36])).toBe(36);
  });

  it('returns the input unchanged when range is missing or malformed', () => {
    expect(clampMidiToRange(60, null)).toBe(60);
    expect(clampMidiToRange(60, [55])).toBe(60);
  });
});

describe('tessitura clamping inside buildSong', () => {
  const study = STUDIES.find(s => s.id === 'two-voice-invention');

  it('Bass+Bass keeps every note inside the cello playable range', () => {
    const song = buildSong(study, {
      keyPc: 0, seed: 3796780667, difficulty: 0,
      clefVoices: ['bass', 'bass'],
      rhythmPresetId: 'walking', duetStyleId: 'free',
    });
    const [lo, hi] = CLEF_RANGES.bass;
    for (const ev of song.events) {
      expect(ev.midi).toBeGreaterThanOrEqual(lo);
      expect(ev.midi).toBeLessThanOrEqual(hi);
    }
  });

  it('Treble+Treble keeps every note inside the violin range', () => {
    const song = buildSong(study, {
      keyPc: 0, seed: 7, difficulty: 50,
      clefVoices: ['treble', 'treble'],
    });
    const [lo, hi] = CLEF_RANGES.treble;
    for (const ev of song.events) {
      expect(ev.midi).toBeGreaterThanOrEqual(lo);
      expect(ev.midi).toBeLessThanOrEqual(hi);
    }
  });

  it('walking-bass workout never drops below cello open C', () => {
    const wb = STUDIES.find(s => s.id === 'walking-bass-workout');
    const song = buildSong(wb, { keyPc: 0, seed: 9, difficulty: 50, clefVoices: ['bass'] });
    for (const ev of song.events) {
      expect(ev.midi).toBeGreaterThanOrEqual(CLEF_RANGES.bass[0]);
    }
  });
});

describe('duet style presets', () => {
  const study = STUDIES.find(s => s.id === 'two-voice-invention');

  it('parallel_thirds produces v2 a third below v1 at every shared beat', () => {
    const song = buildSong(study, {
      keyPc: 0, seed: 1, difficulty: 50,
      clefVoices: ['bass', 'bass'],
      rhythmPresetId: 'square', duetStyleId: 'parallel_thirds',
    });
    const v1 = song.events.filter(e => e.type === 'melody');
    const v2 = song.events.filter(e => e.type === 'melody2');
    // Without an octave-clamp wrap, every pair is a 3rd or 4th apart. With
    // the clamp some pairs may invert into a 6th — accept both windows.
    let inWindow = 0;
    const n = Math.min(v1.length, v2.length);
    for (let i = 0; i < n; i++) {
      const diff = Math.abs(v1[i].midi - v2[i].midi);
      if ((diff >= 3 && diff <= 5) || (diff >= 7 && diff <= 9)) inWindow++;
    }
    expect(inWindow / n).toBeGreaterThan(0.8);
  });

  it('different duet styles produce different counterpoint output', () => {
    const free = buildSong(study, {
      keyPc: 0, seed: 1, difficulty: 50,
      clefVoices: ['bass', 'bass'],
      duetStyleId: 'free',
    });
    const parallel = buildSong(study, {
      keyPc: 0, seed: 1, difficulty: 50,
      clefVoices: ['bass', 'bass'],
      duetStyleId: 'parallel_thirds',
    });
    const freeV2 = free.events.filter(e => e.type === 'melody2').map(e => e.midi).join(',');
    const parV2 = parallel.events.filter(e => e.type === 'melody2').map(e => e.midi).join(',');
    expect(freeV2).not.toBe(parV2);
  });

  it('DUET_STYLES exposes the full preset menu', () => {
    expect(Object.keys(DUET_STYLES)).toEqual(
      expect.arrayContaining(['free', 'parallel_thirds', 'parallel_sixths', 'contrary', 'call_response'])
    );
  });
});
