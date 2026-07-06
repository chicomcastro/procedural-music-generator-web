// Tests for the parametric Scale Etude (ADR 0008, PR T).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STUDIES, ETUDE_PATTERNS, ETUDE_RHYTHMS, ETUDE_OCTAVE_OPTIONS, extendShapeOctaves, SCALE_SHAPES, etudeStartOptions, ETUDE_CLEF_FLOOR } from '../src/js/ui/practice-studies.js';
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

  it('fours / fives / sixes: k-note sliding window up, mirrored down', () => {
    // n = 5, fours → (0,1,2,3)(1,2,3,4) up, (4,3,2,1)(3,2,1,0) down
    expect(P.fours.build(5)).toEqual([0, 1, 2, 3, 1, 2, 3, 4, 4, 3, 2, 1, 3, 2, 1, 0]);
    // n = 6, fives → (0..4)(1..5) up, mirrored down
    expect(P.fives.build(6)).toEqual([0, 1, 2, 3, 4, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 4, 3, 2, 1, 0]);
    // n = 7, sixes → (0..5)(1..6) up, mirrored down
    expect(P.sixes.build(7)).toEqual([0, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 1, 5, 4, 3, 2, 1, 0]);
  });

  it('a run longer than the scale degrades to a single up+down group (still non-empty)', () => {
    // sixes (k=6) on a 6-degree pentatonic: one ascending group, then its mirror.
    expect(P.sixes.build(6)).toEqual([0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0]);
  });

  it('broken thirds: (i, i+2) up then (i, i-2) down', () => {
    // n = 5 up: (0,2)(1,3)(2,4)  down: (4,2)(3,1)(2,0)
    expect(P.thirds.build(5)).toEqual([0, 2, 1, 3, 2, 4, 4, 2, 3, 1, 2, 0]);
  });

  it('broken fourths / fifths / sixths / sevenths use intervals 3–6', () => {
    expect(P.fourths.build(5)).toEqual([0, 3, 1, 4, 4, 1, 3, 0]);
    expect(P.fifths.build(6)).toEqual([0, 4, 1, 5, 5, 1, 4, 0]);
    // sevenths (k=6) over an 8-degree scale: (0,6)(1,7) up, (7,1)(6,0) down.
    expect(P.sevenths.build(8)).toEqual([0, 6, 1, 7, 7, 1, 6, 0]);
    // sixths (k=5) over 8: (0,5)(1,6)(2,7) up, mirrored down.
    expect(P.sixths.build(8)).toEqual([0, 5, 1, 6, 2, 7, 7, 2, 6, 1, 5, 0]);
  });

  it('a wide interval that does not fit a short scale yields an empty sequence (builder falls back)', () => {
    // Broken sevenths need >= 7 degrees; a 6-note pentatonic has none.
    expect(P.sevenths.build(6)).toEqual([]);
  });

  it('every pattern yields in-bounds indices, and is non-empty for a wide enough scale', () => {
    for (const pat of ETUDE_PATTERNS) {
      for (const n of [6, 8, 15]) {
        const seq = pat.build(n);
        for (const idx of seq) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(n);
        }
      }
      // With a two-octave-sized scale every pattern produces notes.
      expect(pat.build(15).length).toBeGreaterThan(0);
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

  it('broken sevenths on a pentatonic (1 octave) falls back to a non-empty scale drill', () => {
    const song = buildSong(study, { ...base, scaleId: 'pentatonic_major', etudePatternId: 'sevenths', etudeOctaves: 1 });
    expect(song.events.length).toBeGreaterThan(0);
  });

  it('broken sevenths on a full scale leaps a seventh (10–11 semitones)', () => {
    const song = buildSong(study, { ...base, etudePatternId: 'sevenths' });
    const leap = song.events[1].midi - song.events[0].midi;
    expect(leap).toBeGreaterThanOrEqual(10);
    expect(leap).toBeLessThanOrEqual(11);
  });

  it('composite rhythm cycles cell durations across the sequence', () => {
    // 16-8-16: durations repeat 0.25, 0.5, 0.25, ...
    const song = buildSong(study, { ...base, etudeRhythm: '16-8-16' });
    expect(song.events[0].durationBeats).toBe(0.25);
    expect(song.events[1].durationBeats).toBe(0.5);
    expect(song.events[2].durationBeats).toBe(0.25);
    expect(song.events[3].durationBeats).toBe(0.25);   // cycle restarts
    // Each 3-cell group sums to one beat → onsets land on beats.
    expect(song.events[3].atBeat).toBe(1);
  });

  it('dotted-eighth + sixteenth composite sums to a beat per pair', () => {
    const song = buildSong(study, { ...base, etudeRhythm: 'dotted8-16' });
    expect(song.events[0].durationBeats).toBe(0.75);
    expect(song.events[1].durationBeats).toBe(0.25);
    expect(song.events[2].atBeat).toBe(1);
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
          <div id="practice-key-field"><select id="practice-key"></select></div>
          <div id="practice-clef-field"><select id="practice-clef"></select></div>
          <div id="practice-rhythm-field"><select id="practice-rhythm"></select></div>
          <div id="practice-duet-field"><select id="practice-duet"></select></div>
          <div id="practice-scale-field"><select id="practice-scale"></select></div>
          <div id="practice-contour-field"><select id="practice-contour"></select></div>
          <div id="practice-etude-octaves-field" style="display:none"><select id="practice-etude-octaves"></select></div>
          <div id="practice-etude-start-field" style="display:none"><select id="practice-etude-start"></select></div>
          <div id="practice-etude-bar" style="display:none">
            <div id="practice-etude-pattern-field"><select id="practice-etude-pattern"></select></div>
            <div id="practice-etude-scale-field"><select id="practice-etude-scale"></select></div>
            <div id="practice-etude-key-field"><select id="practice-etude-key"></select></div>
            <div id="practice-etude-rhythm-field"><select id="practice-etude-rhythm"></select></div>
          </div>
          <div id="practice-rhythm-vocab-field" style="display:none"><div id="practice-rhythm-vocab-chips"></div></div>
          <div id="practice-progression-field" style="display:none"><select id="practice-progression"></select></div>
          <div id="practice-part-view-field" style="display:none"><div id="practice-part-view-chips"></div></div>
          <div id="practice-swing-field"><input id="practice-swing" type="range" value="0" /><span id="practice-swing-display"></span></div>
          <div id="practice-intensity-field"><input id="practice-intensity" type="range" value="100" /><span id="practice-intensity-display"></span></div>
          <select id="practice-voice"></select>
          <div id="practice-difficulty-wrap"><input id="practice-difficulty" type="range" value="50" /><span id="practice-difficulty-display"></span></div>
          <div id="practice-seed-field"><input id="practice-seed" type="number" /><button id="practice-reroll"></button></div>
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
    expect(document.getElementById('practice-etude-bar').style.display).toBe('none');
  });

  it('start-note dropdown lists octaves; seed + intensity hidden for the etude (ADR 0009)', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="scale-etude"]').click();
    // Start-note options present + labelled (default key C, bass clef → C2/C3/C4).
    const startOpts = Array.from(document.querySelectorAll('#practice-etude-start option')).map(o => o.textContent);
    expect(startOpts.length).toBeGreaterThanOrEqual(2);
    expect(startOpts).toContain('C2');
    // Seed + intensity hidden here; other studies show them.
    expect(document.getElementById('practice-seed-field').style.display).toBe('none');
    expect(document.getElementById('practice-intensity-field').style.display).toBe('none');
    document.getElementById('practice-study-close').click();
    document.querySelector('.practice-card[data-id="walking-bass-workout"]').click();
    expect(document.getElementById('practice-seed-field').style.display).toBe('');
    expect(document.getElementById('practice-intensity-field').style.display).toBe('');
  });

  it('picking a start note persists + rides the share URL', async () => {
    const mod = await import('../src/js/ui/PracticeView.js');
    mod.initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="scale-etude"]').click();
    const sel = document.getElementById('practice-etude-start');
    sel.value = '36';   // C2
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    expect(prefs.byStudy['scale-etude'].etudeStartMidi).toBe(36);
    const url = mod.buildShareUrl('scale-etude', prefs.byStudy['scale-etude']);
    expect(url).toContain('start=36');
  });

  it('changing the key resets the start note to default', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="scale-etude"]').click();
    const start = document.getElementById('practice-etude-start');
    start.value = '36';
    start.dispatchEvent(new Event('change', { bubbles: true }));
    // Change key via the params-bar Key control — C2 is no longer a valid
    // tonic for the new key, so the start note resets to default.
    const key = document.getElementById('practice-etude-key');
    key.value = String(key.options[1]?.value ?? '2');
    key.dispatchEvent(new Event('change', { bubbles: true }));
    const prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    expect(prefs.byStudy['scale-etude'].etudeStartMidi).toBeNull();
  });

  it('promotes scale + key to the bar and demotes octaves + start to Adjust (ADR 0011)', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="scale-etude"]').click();
    // Bar: pattern / scale / key / rhythm all shown + populated.
    expect(document.getElementById('practice-etude-scale-field').style.display).toBe('');
    expect(document.getElementById('practice-etude-key-field').style.display).toBe('');
    expect(document.querySelectorAll('#practice-etude-scale option').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('#practice-etude-key option').length).toBeGreaterThan(0);
    // Register knobs relocated to Adjust, still populated.
    expect(document.getElementById('practice-etude-octaves-field').style.display).toBe('');
    expect(document.getElementById('practice-etude-start-field').style.display).toBe('');
    expect(document.getElementById('practice-etude-octaves').value).toBe('1');
    // Duplicate Adjust Key + Scale rows hidden for the etude.
    expect(document.getElementById('practice-key-field').style.display).toBe('none');
    expect(document.getElementById('practice-scale-field').style.display).toBe('none');
    // Other studies keep the Adjust Key + Scale rows and hide the etude bar.
    document.getElementById('practice-study-close').click();
    document.querySelector('.practice-card[data-id="two-voice-invention"]').click();
    expect(document.getElementById('practice-key-field').style.display).toBe('');
    expect(document.getElementById('practice-scale-field').style.display).toBe('');
    expect(document.getElementById('practice-etude-octaves-field').style.display).toBe('none');
  });

  it('changing scale or key in the bar persists to prefs', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="scale-etude"]').click();
    const scale = document.getElementById('practice-etude-scale');
    scale.value = 'dorian';
    scale.dispatchEvent(new Event('change', { bubbles: true }));
    const key = document.getElementById('practice-etude-key');
    const newKey = key.options[1]?.value ?? '2';
    key.value = newKey;
    key.dispatchEvent(new Event('change', { bubbles: true }));
    const prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    expect(prefs.byStudy['scale-etude'].scaleId).toBe('dorian');
    expect(prefs.byStudy['scale-etude'].keyPc).toBe(Number(newKey));
  });

  it('the etude bar takes the rail slot: bar shown, act rail hidden', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="scale-etude"]').click();
    expect(document.getElementById('practice-etude-bar').style.display).toBe('');
    expect(document.getElementById('practice-act-rail').style.display).toBe('none');
    // Other studies get the rail back.
    document.getElementById('practice-study-close').click();
    document.querySelector('.practice-card[data-id="walking-bass-workout"]').click();
    expect(document.getElementById('practice-act-rail').style.display).toBe('');
    expect(document.getElementById('practice-etude-bar').style.display).toBe('none');
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

describe('etudeStartOptions — start-note candidates (ADR 0009)', () => {
  it('bass clef key C offers C2 (cello low string) up through two octaves', () => {
    const opts = etudeStartOptions('bass', 0);
    expect(opts[0]).toEqual({ midi: 36, octave: 2 });   // C2 = cello C string
    expect(opts.map(o => o.midi)).toEqual([36, 48, 60]);
  });

  it('treble clef key C starts at C4 (violin floor is G3, first C above)', () => {
    const opts = etudeStartOptions('treble', 0);
    // floor 55 (G3); first C at/above is C4 = 60.
    expect(opts[0].midi).toBe(60);
    expect(opts.every(o => o.midi >= ETUDE_CLEF_FLOOR.treble)).toBe(true);
  });

  it('alto clef key D offers D3 first (viola floor C3)', () => {
    const opts = etudeStartOptions('alto', 2);
    expect(opts[0]).toEqual({ midi: 50, octave: 3 });    // D3
  });

  it('every option matches the requested pitch class', () => {
    for (const clef of ['bass', 'alto', 'treble']) {
      for (let pc = 0; pc < 12; pc++) {
        for (const o of etudeStartOptions(clef, pc)) {
          expect(((o.midi % 12) + 12) % 12).toBe(pc);
          expect(o.midi).toBeGreaterThanOrEqual(ETUDE_CLEF_FLOOR[clef]);
        }
      }
    }
  });
});

describe('buildScaleEtudeSong — start note (ADR 0009)', () => {
  const base = { keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass'], scaleId: 'major' };

  it('honours etudeStartMidi: C2 drill starts on the cello low string', () => {
    const song = buildSong(study, { ...base, etudeStartMidi: 36 });
    expect(song.events[0].midi).toBe(36);   // C2, not the default C3
  });

  it('a low start + two octaves is not clamped back up', () => {
    const song = buildSong(study, { ...base, etudeStartMidi: 36, etudeOctaves: 2 });
    const lo = Math.min(...song.events.map(e => e.midi));
    const hi = Math.max(...song.events.map(e => e.midi));
    expect(lo).toBe(36);          // C2
    expect(hi).toBe(60);          // C4 — full two octaves, nothing pulled in
  });

  it('an invalid start midi falls back to the default register', () => {
    const dflt = buildSong(study, base);
    const bogus = buildSong(study, { ...base, etudeStartMidi: 999 });
    expect(bogus.events[0].midi).toBe(dflt.events[0].midi);
  });

  it('default (no start) is unchanged from pre-0009 behaviour: C3 in bass clef', () => {
    const song = buildSong(study, base);
    expect(song.events[0].midi).toBe(48);   // C3
  });
});
