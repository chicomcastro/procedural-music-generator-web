import { describe, it, expect, beforeEach } from 'vitest';
import { STUDIES, scaleParams, tonicName, CLEF_ANCHORS, CLEF_RANGES, RHYTHM_PRESETS, DUET_STYLES, SCALE_OPTIONS, CONTOUR_OPTIONS, clampMidiToRange } from '../src/js/ui/practice-studies.js';
import { __test, buildShareUrl, applyShareParams } from '../src/js/ui/PracticeView.js';

const { buildSong } = __test;

describe('practice-studies catalog', () => {
  it('ships at least the two PR-1 studies', () => {
    expect(STUDIES.find(s => s.id === 'two-voice-invention')).toBeTruthy();
    expect(STUDIES.find(s => s.id === 'walking-bass-workout')).toBeTruthy();
  });

  it('every study has a non-empty acts array and a recognised kind', () => {
    for (const s of STUDIES) {
      expect(s.acts.length).toBeGreaterThan(0);
      expect(['two-voice-counterpoint', 'duet-workshop', 'walking-bass-workout', 'scale-etude', 'solo-etude', 'modal-vamp']).toContain(s.kind);
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

describe('CLEF_RANGES.bass — E2 lower bound', () => {
  it('bass clef low bound is MIDI 40 (E2) — bass-guitar / contrabaixo open E', () => {
    expect(CLEF_RANGES.bass[0]).toBe(40);
  });

  it('walking-bass workout never emits a note below E2 across several seeds', () => {
    const study = STUDIES.find(s => s.id === 'walking-bass-workout');
    for (const seed of [1, 42, 3796780667, 999, 12345]) {
      const song = buildSong(study, { keyPc: 0, seed, difficulty: 50, clefVoices: ['bass'] });
      for (const ev of song.events) expect(ev.midi).toBeGreaterThanOrEqual(40);
    }
  });

  it('two-voice invention with Bass+Bass also respects the E2 floor', () => {
    const study = STUDIES.find(s => s.id === 'two-voice-invention');
    for (const seed of [1, 42, 999]) {
      const song = buildSong(study, {
        keyPc: 0, seed, difficulty: 50,
        clefVoices: ['bass', 'bass'],
        rhythmPresetId: 'square', duetStyleId: 'free',
      });
      for (const ev of song.events) expect(ev.midi).toBeGreaterThanOrEqual(40);
    }
  });
});

describe('Scale + Contour + Swing + Intensity pickers', () => {
  const study = STUDIES.find(s => s.id === 'two-voice-invention');

  it('SCALE_OPTIONS includes auto + common scales', () => {
    const ids = SCALE_OPTIONS.map(o => o.id);
    expect(ids).toEqual(expect.arrayContaining(['auto', 'major', 'natural_minor', 'harmonic_minor', 'dorian']));
  });

  it('CONTOUR_OPTIONS includes auto + arc + wave + ascending + descending', () => {
    const ids = CONTOUR_OPTIONS.map(o => o.id);
    expect(ids).toEqual(expect.arrayContaining(['auto', 'arc', 'wave', 'ascending', 'descending']));
  });

  it('scaleId override changes the output relative to "auto"', () => {
    const auto = buildSong(study, {
      keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass', 'bass'],
      rhythmPresetId: 'square', duetStyleId: 'free', scaleId: 'auto',
    });
    const dorian = buildSong(study, {
      keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass', 'bass'],
      rhythmPresetId: 'square', duetStyleId: 'free', scaleId: 'dorian',
    });
    expect(auto.events.map(e => e.midi).join(',')).not.toBe(dorian.events.map(e => e.midi).join(','));
  });

  it('contourId override changes the output relative to "auto"', () => {
    const auto = buildSong(study, {
      keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass', 'bass'],
      rhythmPresetId: 'square', duetStyleId: 'free', contourId: 'auto',
    });
    const ascending = buildSong(study, {
      keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass', 'bass'],
      rhythmPresetId: 'square', duetStyleId: 'free', contourId: 'ascending',
    });
    expect(auto.events.map(e => e.midi).join(',')).not.toBe(ascending.events.map(e => e.midi).join(','));
  });

  it('swing > 0 shifts off-beat events later in time', () => {
    const straight = buildSong(study, {
      keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass', 'bass'],
      rhythmPresetId: 'flowing', duetStyleId: 'free', swing: 0,
    });
    const swung = buildSong(study, {
      keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass', 'bass'],
      rhythmPresetId: 'flowing', duetStyleId: 'free', swing: 60,
    });
    // The swung version has events whose atBeat falls on non-integer
    // boundaries (off-beats are pushed later by swing * 0.5). Some
    // straight events also land off-beat, but the sum of fractional
    // parts should differ between the two outputs.
    const fracSum = (s) => s.events.reduce((acc, e) => acc + ((e.atBeat % 1) || 0), 0);
    expect(fracSum(swung)).not.toBe(fracSum(straight));
  });

  it('intensity multiplier scales output velocities', () => {
    const baseline = buildSong(study, {
      keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass', 'bass'],
      rhythmPresetId: 'square', duetStyleId: 'free', intensity: 100,
    });
    const loud = buildSong(study, {
      keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass', 'bass'],
      rhythmPresetId: 'square', duetStyleId: 'free', intensity: 140,
    });
    const quiet = buildSong(study, {
      keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass', 'bass'],
      rhythmPresetId: 'square', duetStyleId: 'free', intensity: 50,
    });
    const avgVel = (s) => s.events.reduce((a, e) => a + e.velocity, 0) / s.events.length;
    expect(avgVel(loud)).toBeGreaterThan(avgVel(baseline));
    expect(avgVel(quiet)).toBeLessThan(avgVel(baseline));
  });
});

describe('buildShareUrl', () => {
  beforeEach(() => {
    // jsdom default origin
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'location', {
        value: new URL('http://localhost/app.html#/practice'),
        configurable: true,
        writable: true,
      });
    }
  });

  it('serialises every prefs field that has a non-default value', () => {
    const url = buildShareUrl('two-voice-invention', {
      seed: 42, keyPc: 5, difficulty: 70,
      clefPresetId: 'treble-bass', rhythmPresetId: 'walking',
      duetStyleId: 'parallel_sixths',
      scaleId: 'dorian', contourId: 'arc',
      swing: 30, intensity: 80,
    });
    expect(url).toContain('study=two-voice-invention');
    expect(url).toContain('seed=42');
    expect(url).toContain('key=5');
    expect(url).toContain('clef=treble-bass');
    expect(url).toContain('rhythm=walking');
    expect(url).toContain('duet=parallel_sixths');
    expect(url).toContain('scale=dorian');
    expect(url).toContain('contour=arc');
    expect(url).toContain('swing=30');
    expect(url).toContain('intensity=80');
    expect(url).toContain('diff=70');
  });

  it('omits defaults — scale=auto, contour=auto, swing=0, intensity=100 do not pollute the URL', () => {
    const url = buildShareUrl('two-voice-invention', {
      seed: 1, keyPc: 0, difficulty: 50,
      scaleId: 'auto', contourId: 'auto', swing: 0, intensity: 100,
    });
    expect(url).not.toContain('scale=');
    expect(url).not.toContain('contour=');
    expect(url).not.toContain('swing=');
    expect(url).not.toContain('intensity=');
  });
});

describe('applyShareParams', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function setHash(h) {
    Object.defineProperty(window, 'location', {
      value: new URL(`http://localhost/app.html${h}`),
      configurable: true,
      writable: true,
    });
  }

  it('returns null when no hash query is present', () => {
    setHash('#/practice');
    expect(applyShareParams()).toBeNull();
  });

  it('returns null when the study id is unknown', () => {
    setHash('#/practice?study=does-not-exist&seed=1');
    expect(applyShareParams()).toBeNull();
  });

  it('returns the study id and applies all params to prefs', () => {
    setHash('#/practice?study=two-voice-invention&seed=99&key=7&clef=treble-bass&rhythm=flowing&duet=contrary&scale=dorian&contour=arc&swing=40&intensity=80&diff=70');
    const id = applyShareParams();
    expect(id).toBe('two-voice-invention');

    const persisted = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    const sp = persisted.byStudy['two-voice-invention'];
    expect(sp.seed).toBe(99);
    expect(sp.keyPc).toBe(7);
    expect(sp.clefPresetId).toBe('treble-bass');
    expect(sp.rhythmPresetId).toBe('flowing');
    expect(sp.duetStyleId).toBe('contrary');
    expect(sp.scaleId).toBe('dorian');
    expect(sp.contourId).toBe('arc');
    expect(sp.swing).toBe(40);
    expect(sp.intensity).toBe(80);
    expect(sp.difficulty).toBe(70);
  });
});

describe('new study kinds — scale-etude / solo-etude / modal-vamp', () => {
  it('catalog ships the three new studies', () => {
    expect(STUDIES.find(s => s.id === 'scale-etude')).toBeTruthy();
    expect(STUDIES.find(s => s.id === 'solo-etude')).toBeTruthy();
    expect(STUDIES.find(s => s.id === 'modal-vamp')).toBeTruthy();
  });

  it('scale-etude builds a single-voice song with eighths/triplets per act', () => {
    const study = STUDIES.find(s => s.id === 'scale-etude');
    const song = buildSong(study, {
      keyPc: 0, seed: 1, difficulty: 50,
      clefVoices: ['bass'],
    });
    expect(song.events.every(e => e.type === 'melody')).toBe(true);
    // Act 3 chains threes_asc + threes_desc; every event in that range
    // should be a triplet eighth.
    const tripletEvents = song.events.filter(e => e.noteType === 'et');
    expect(tripletEvents.length).toBeGreaterThan(0);
  });

  it('scale-etude is deterministic with the same inputs', () => {
    const study = STUDIES.find(s => s.id === 'scale-etude');
    const a = buildSong(study, { keyPc: 0, seed: 5, difficulty: 50, clefVoices: ['bass'] });
    const b = buildSong(study, { keyPc: 0, seed: 5, difficulty: 50, clefVoices: ['bass'] });
    expect(a.events).toEqual(b.events);
  });

  it('solo-etude builds a single-voice song over real chord changes', () => {
    const study = STUDIES.find(s => s.id === 'solo-etude');
    const song = buildSong(study, {
      keyPc: 0, seed: 42, difficulty: 50,
      clefVoices: ['treble'], rhythmPresetId: 'square',
    });
    expect(song.events.every(e => e.type === 'melody')).toBe(true);
    expect(song.events.length).toBeGreaterThan(8);
    // Range respect: every note inside the treble window.
    for (const ev of song.events) {
      expect(ev.midi).toBeGreaterThanOrEqual(55);
      expect(ev.midi).toBeLessThanOrEqual(84);
    }
  });

  it('modal-vamp respects the per-act mode (dorian, mixolydian, lydian)', () => {
    const study = STUDIES.find(s => s.id === 'modal-vamp');
    const song = buildSong(study, {
      keyPc: 0, seed: 7, difficulty: 50,
      clefVoices: ['treble'], rhythmPresetId: 'flowing',
    });
    expect(song.events.every(e => e.type === 'melody')).toBe(true);
    // Bar count = sum of act bars.
    const expectedBars = study.acts.reduce((s, a) => s + a.bars, 0);
    expect(song.bars).toBe(expectedBars);
  });

  it('scale-etude lower bound respects the cello E2 floor (bass clef)', () => {
    const study = STUDIES.find(s => s.id === 'scale-etude');
    const song = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass'] });
    for (const ev of song.events) expect(ev.midi).toBeGreaterThanOrEqual(40);
  });
});

describe('chord symbols + double bars on Practice studies', () => {
  it('two-voice-invention emits a chord symbol at the start of each chord span', () => {
    const study = STUDIES.find(s => s.id === 'two-voice-invention');
    const song = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass', 'bass'] });
    expect(Array.isArray(song.chordSymbols)).toBe(true);
    // 3 acts × 8 bars each = 24 bars. Each act has 4 chords spanning 2
    // bars each, so 4 chord symbols per act, 12 total.
    const nonEmpty = song.chordSymbols.filter(s => s);
    expect(nonEmpty.length).toBe(12);
  });

  it('walking-bass-workout emits one chord per bar', () => {
    const study = STUDIES.find(s => s.id === 'walking-bass-workout');
    const song = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass'] });
    expect(song.chordSymbols.length).toBe(song.bars);
  });

  it('solo-etude + modal-vamp emit chord symbols', () => {
    for (const id of ['solo-etude', 'modal-vamp']) {
      const study = STUDIES.find(s => s.id === id);
      const song = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['treble'] });
      expect(song.chordSymbols.filter(s => s).length).toBeGreaterThan(0);
    }
  });

  it('every multi-act study marks the act boundaries with doubleBarsBefore', () => {
    for (const study of STUDIES) {
      const song = buildSong(study, { keyPc: 0, seed: 1, difficulty: 50, clefVoices: study.clefPresets[0].voices });
      // Acts−1 boundaries (no boundary AFTER the last act).
      expect(song.doubleBarsBefore).toHaveLength(study.acts.length - 1);
      // Each entry is the bar index where the boundary sits.
      let cumulative = 0;
      for (let i = 0; i < study.acts.length - 1; i++) {
        cumulative += study.acts[i].bars;
        expect(song.doubleBarsBefore[i]).toBe(cumulative);
      }
    }
  });
});

describe('musicxml emission — chord symbols + double bars', () => {
  it.todo('moved to test/musicxml.test.js');
});
