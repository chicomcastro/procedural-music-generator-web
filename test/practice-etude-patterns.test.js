// Tests for the parametric Scale Etude (ADR 0008, PR T).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STUDIES, ETUDE_PATTERNS, ETUDE_RHYTHMS, ETUDE_OCTAVE_OPTIONS, extendShapeOctaves, SCALE_SHAPES } from '../src/js/ui/practice-studies.js';
import { __test } from '../src/js/ui/PracticeView.js';

const { buildSong } = __test;
const study = STUDIES.find(s => s.id === 'scale-etude');
const P = Object.fromEntries(ETUDE_PATTERNS.map(p => [p.id, p]));

describe('ETUDE_PATTERNS — sequence construction', () => {
  it('scale: straight up then down without repeating the top note', () => {
    // n = 4 → 0 1 2 3 | 2 1 0
    expect(P.scale.build(4)).toEqual([0, 1, 2, 3, 2, 1, 0]);
  });

  it('pairs: sliding window up, mirrored window down', () => {
    // n = 4 up: (0,1)(1,2)(2,3)  down: (3,2)(2,1)(1,0)
    expect(P.pairs.build(4)).toEqual([0, 1, 1, 2, 2, 3, 3, 2, 2, 1, 1, 0]);
  });

  it('threes: triple window up, mirrored down', () => {
    // n = 4 up: (0,1,2)(1,2,3)  down: (3,2,1)(2,1,0)
    expect(P.threes.build(4)).toEqual([0, 1, 2, 1, 2, 3, 3, 2, 1, 2, 1, 0]);
  });

  it('broken thirds: (i, i+2) up then (i, i-2) down', () => {
    // n = 5 up: (0,2)(1,3)(2,4)  down: (4,2)(3,1)(2,0)
    expect(P.thirds.build(5)).toEqual([0, 2, 1, 3, 2, 4, 4, 2, 3, 1, 2, 0]);
  });

  it('broken fourths and fifths use intervals 3 and 4', () => {
    expect(P.fourths.build(5)).toEqual([0, 3, 1, 4, 4, 1, 3, 0]);
    expect(P.fifths.build(6)).toEqual([0, 4, 1, 5, 5, 1, 4, 0]);
  });

  it('every pattern yields indices inside [0, n)', () => {
    for (const pat of ETUDE_PATTERNS) {
      for (const n of [6, 8, 15]) {
        const seq = pat.build(n);
        expect(seq.length).toBeGreaterThan(0);
        for (const idx of seq) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(n);
        }
      }
    }
  });
});

describe('extendShapeOctaves', () => {
  it('one octave returns the shape untouched', () => {
    expect(extendShapeOctaves(SCALE_SHAPES.major, 1)).toEqual(SCALE_SHAPES.major);
  });

  it('two octaves stack a second copy, sharing the octave note', () => {
    const two = extendShapeOctaves(SCALE_SHAPES.major, 2);
    // major shape has 8 entries (0..12); two octaves = 15 entries (0..24).
    expect(two.length).toBe(15);
    expect(two[0]).toBe(0);
    expect(two[7]).toBe(12);
    expect(two[14]).toBe(24);
  });
});

describe('buildScaleEtudeSong — parametric build', () => {
  const base = { keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass'], scaleId: 'major' };

  it('defaults: scale pattern, 1 octave, eighths', () => {
    const song = buildSong(study, base);
    // Scale up+down over 8 degrees = 15 notes of 0.5 beat = 7.5 beats → 2 bars.
    expect(song.events.length).toBe(15);
    expect(song.events.every(e => e.durationBeats === 0.5)).toBe(true);
    expect(song.bars).toBe(2);
    // Roots on C in bass clef (PR S regression holds).
    expect(((song.events[0].midi % 12) + 12) % 12).toBe(0);
  });

  it('note value drives duration: quarters, triplets, sixteenths', () => {
    const q = buildSong(study, { ...base, etudeRhythm: 'quarter' });
    expect(q.events.every(e => e.durationBeats === 1)).toBe(true);
    expect(q.events.every(e => e.noteType === 'q')).toBe(true);

    const t = buildSong(study, { ...base, etudeRhythm: 'triplet' });
    expect(t.events.every(e => Math.abs(e.durationBeats - 1 / 3) < 1e-9)).toBe(true);

    const s16 = buildSong(study, { ...base, etudeRhythm: 'sixteenth' });
    expect(s16.events.every(e => e.durationBeats === 0.25)).toBe(true);
  });

  it('two octaves spans two octaves of pitch', () => {
    const one = buildSong(study, { ...base, etudeOctaves: 1 });
    const two = buildSong(study, { ...base, etudeOctaves: 2 });
    const span = (song) => Math.max(...song.events.map(e => e.midi)) - Math.min(...song.events.map(e => e.midi));
    expect(span(one)).toBe(12);
    expect(span(two)).toBe(24);
    expect(two.events.length).toBeGreaterThan(one.events.length);
  });

  it('two octaves stays inside the clef range in every clef', () => {
    for (const clef of ['bass', 'treble', 'alto']) {
      const song = buildSong(study, { ...base, clefVoices: [clef], etudeOctaves: 2 });
      const ranges = { treble: [55, 84], alto: [48, 77], bass: [40, 74] };
      for (const ev of song.events) {
        expect(ev.midi).toBeGreaterThanOrEqual(ranges[clef][0]);
        expect(ev.midi).toBeLessThanOrEqual(ranges[clef][1]);
      }
    }
  });

  it('broken thirds pattern: first two notes are a diatonic third apart', () => {
    const song = buildSong(study, { ...base, etudePatternId: 'thirds' });
    // C major: degree 0 = C, degree 2 = E → 4 semitones.
    expect(song.events[1].midi - song.events[0].midi).toBe(4);
  });

  it('broken fifths pattern: first two notes are a fifth apart', () => {
    const song = buildSong(study, { ...base, etudePatternId: 'fifths' });
    // C → G = 7 semitones.
    expect(song.events[1].midi - song.events[0].midi).toBe(7);
  });

  it('bars derive from sequence length (padded final bar)', () => {
    const song = buildSong(study, { ...base, etudePatternId: 'pairs', etudeOctaves: 2, etudeRhythm: 'sixteenth' });
    const totalBeats = song.events.length * 0.25;
    expect(song.bars).toBe(Math.ceil(totalBeats / 4));
    expect(song.lengthBeats).toBe(song.bars * 4);
  });

  it('unknown pattern/rhythm ids fall back to defaults', () => {
    const song = buildSong(study, { ...base, etudePatternId: 'bogus', etudeRhythm: 'bogus' });
    expect(song.events.length).toBe(15);                 // scale pattern
    expect(song.events[0].durationBeats).toBe(0.5);      // eighths
  });

  it('keeps a single key signature from the selected scale', () => {
    const song = buildSong(study, { ...base, scaleId: 'natural_minor' });
    expect(song.keySignatures).toEqual([{ bar: 0, fifths: -3 }]);   // C minor → Eb signature
  });
});

describe('Scale etude UI — dropdowns', () => {
  const audioMock = () => ({
    ensureInit: vi.fn().mockResolvedValue(undefined),
    getContext: vi.fn().mockReturnValue(null),
    getTrackDest: vi.fn().mockReturnValue(null),
    getMasterGain: vi.fn().mockReturnValue(null),
  });

  function scaffold() {
    document.body.innerHTML = `
      <div id="practice-catalog"></div>
      <section id="practice-favorites-section" hidden><div id="practice-favorites"></div></section>
      <div id="practice-study-overlay" class="hidden">
        <button id="practice-study-close"></button>
        <button id="practice-study-favorite" aria-pressed="false"></button>
        <button id="practice-study-share"></button>
        <button id="practice-study-print"></button>
        <button id="practice-study-stand"></button>
        <span id="practice-share-toast" hidden></span>
        <span id="practice-study-eyebrow"></span>
        <h2 id="practice-study-title"></h2>
        <p id="practice-study-desc"></p>
        <div id="practice-act-rail"></div>
        <div id="practice-sheet"></div>
        <div id="practice-stand-toolbar"></div>
        <details id="practice-controls">
          <summary><span id="practice-controls-info"></span></summary>
          <select id="practice-key"></select>
          <div id="practice-clef-field"><select id="practice-clef"></select></div>
          <div id="practice-rhythm-field"><select id="practice-rhythm"></select></div>
          <div id="practice-duet-field"><select id="practice-duet"></select></div>
          <div id="practice-scale-field"><select id="practice-scale"></select></div>
          <div id="practice-contour-field"><select id="practice-contour"></select></div>
          <div id="practice-etude-pattern-field" style="display:none"><select id="practice-etude-pattern"></select></div>
          <div id="practice-etude-octaves-field" style="display:none"><select id="practice-etude-octaves"></select></div>
          <div id="practice-etude-rhythm-field" style="display:none"><select id="practice-etude-rhythm"></select></div>
          <div id="practice-rhythm-vocab-field" style="display:none"><div id="practice-rhythm-vocab-chips"></div></div>
          <div id="practice-progression-field" style="display:none"><select id="practice-progression"></select></div>
          <div id="practice-part-view-field" style="display:none"><div id="practice-part-view-chips"></div></div>
          <div id="practice-swing-field"><input id="practice-swing" type="range" value="0" /><span id="practice-swing-display"></span></div>
          <div id="practice-intensity-field"><input id="practice-intensity" type="range" value="100" /><span id="practice-intensity-display"></span></div>
          <select id="practice-voice"></select>
          <input id="practice-difficulty" type="range" value="50" />
          <span id="practice-difficulty-display"></span>
          <input id="practice-seed" type="number" />
          <button id="practice-reroll"></button>
        </details>
        <button id="practice-play"></button>
        <span id="practice-playback-time"></span>
      </div>
    `;
  }

  beforeEach(() => {
    scaffold();
    localStorage.clear();
    vi.resetModules();
    window.location.hash = '';
  });

  it('scale-etude reveals the three dropdowns with defaults selected', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="scale-etude"]').click();
    expect(document.getElementById('practice-etude-pattern-field').style.display).toBe('');
    expect(document.getElementById('practice-etude-pattern').value).toBe('scale');
    expect(document.getElementById('practice-etude-octaves').value).toBe('1');
    expect(document.getElementById('practice-etude-rhythm').value).toBe('eighth');
    // All six patterns listed.
    expect(document.querySelectorAll('#practice-etude-pattern option').length).toBe(ETUDE_PATTERNS.length);
    expect(document.querySelectorAll('#practice-etude-octaves option').length).toBe(ETUDE_OCTAVE_OPTIONS.length);
    expect(document.querySelectorAll('#practice-etude-rhythm option').length).toBe(ETUDE_RHYTHMS.length);
  });

  it('other studies keep the dropdowns hidden', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="two-voice-invention"]').click();
    expect(document.getElementById('practice-etude-pattern-field').style.display).toBe('none');
  });

  it('changing the pattern persists + survives reopen', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="scale-etude"]').click();
    const sel = document.getElementById('practice-etude-pattern');
    sel.value = 'thirds';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    expect(prefs.byStudy['scale-etude'].etudePatternId).toBe('thirds');
    document.getElementById('practice-study-close').click();
    document.querySelector('.practice-card[data-id="scale-etude"]').click();
    expect(document.getElementById('practice-etude-pattern').value).toBe('thirds');
  });

  it('share URL round-trips pattern + octaves + rhythm', async () => {
    window.location.hash = '#/practice?study=scale-etude&pattern=fifths&oct=2&rhy=sixteenth';
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    await new Promise(r => setTimeout(r, 30));
    const prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    const sp = prefs.byStudy['scale-etude'];
    expect(sp.etudePatternId).toBe('fifths');
    expect(sp.etudeOctaves).toBe(2);
    expect(sp.etudeRhythm).toBe('sixteenth');
  });

  it('legacy prefs (act-tab era) backfill to valid defaults', async () => {
    localStorage.setItem('seedsong-practice-prefs-v1', JSON.stringify({
      studyId: null, favorites: [],
      byStudy: { 'scale-etude': { keyPc: 0, difficulty: 50, seed: 1, actIdx: 2 } },
    }));
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="scale-etude"]').click();
    expect(document.getElementById('practice-etude-pattern').value).toBe('scale');
    // Single act now — no tabs.
    expect(document.querySelectorAll('#practice-act-rail button').length).toBe(0);
  });
});
