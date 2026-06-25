// Tests for PR L — Duet Workshop study (ADR 0004).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STUDIES, RHYTHM_VOCAB, RHYTHM_VOCAB_DEFAULTS, PROGRESSION_OPTIONS, PART_VIEW_OPTIONS } from '../src/js/ui/practice-studies.js';

const audioMock = () => ({
  ensureInit: vi.fn().mockResolvedValue(undefined),
  getContext: vi.fn().mockReturnValue(null),
  getTrackDest: vi.fn().mockReturnValue(null),
  getMasterGain: vi.fn().mockReturnValue(null),
});

function scaffold() {
  document.body.innerHTML = `
    <div id="practice-catalog"></div>
    <section id="practice-favorites-section" hidden>
      <div id="practice-favorites"></div>
    </section>
    <div id="practice-study-overlay" class="hidden">
      <button id="practice-study-close"></button>
      <button id="practice-study-favorite" aria-pressed="false"></button>
      <button id="practice-study-share"></button>
      <button id="practice-study-print"></button>
      <span id="practice-share-toast" hidden></span>
      <span id="practice-study-eyebrow"></span>
      <h2 id="practice-study-title"></h2>
      <p id="practice-study-desc"></p>
      <div id="practice-act-rail"></div>
      <div id="practice-sheet"></div>
      <details id="practice-controls">
        <summary><span id="practice-controls-info"></span></summary>
        <select id="practice-key"></select>
        <div id="practice-clef-field"><select id="practice-clef"></select></div>
        <div id="practice-rhythm-field"><select id="practice-rhythm"></select></div>
        <div id="practice-duet-field"><select id="practice-duet"></select></div>
        <div id="practice-scale-field"><select id="practice-scale"></select></div>
        <div id="practice-contour-field"><select id="practice-contour"></select></div>
        <div id="practice-rhythm-vocab-field" style="display:none">
          <div id="practice-rhythm-vocab-chips"></div>
        </div>
        <div id="practice-progression-field" style="display:none">
          <select id="practice-progression"></select>
        </div>
        <div id="practice-part-view-field" style="display:none">
          <div id="practice-part-view-chips"></div>
        </div>
        <div id="practice-swing-field">
          <input id="practice-swing" type="range" value="0" min="0" max="100" />
          <span id="practice-swing-display"></span>
        </div>
        <div id="practice-intensity-field">
          <input id="practice-intensity" type="range" value="50" min="0" max="100" />
          <span id="practice-intensity-display"></span>
        </div>
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

async function openWorkshop() {
  const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
  initPracticeView({ audioApi: audioMock() });
  document.querySelector('.practice-card[data-id="duet-workshop"]').click();
}

describe('Duet Workshop — catalog presence', () => {
  it('appears in the STUDIES catalog with kind="duet-workshop"', () => {
    const study = STUDIES.find(s => s.id === 'duet-workshop');
    expect(study).toBeTruthy();
    expect(study.kind).toBe('duet-workshop');
    expect(study.category).toBe('counterpoint');
    expect(study.acts.length).toBe(1);
  });

  it('exposes RHYTHM_VOCAB, PROGRESSION_OPTIONS, PART_VIEW_OPTIONS shapes', () => {
    expect(Object.keys(RHYTHM_VOCAB)).toEqual(expect.arrayContaining(['eighth', 'quarter', 'half', 'whole']));
    expect(RHYTHM_VOCAB.eighth.beats).toBe(0.5);
    expect(RHYTHM_VOCAB.whole.beats).toBe(4);
    expect(PROGRESSION_OPTIONS.find(o => o.id === 'pop')).toBeTruthy();
    expect(PART_VIEW_OPTIONS.map(o => o.id)).toEqual(['both', 'voice1', 'voice2']);
  });

  it('RHYTHM_VOCAB_DEFAULTS is non-empty + only contains valid ids', () => {
    expect(RHYTHM_VOCAB_DEFAULTS.length).toBeGreaterThan(0);
    for (const id of RHYTHM_VOCAB_DEFAULTS) expect(RHYTHM_VOCAB[id]).toBeTruthy();
  });
});

describe('Duet Workshop — populate controls', () => {
  it('clicking the workshop card reveals rhythm-vocab + progression + part-view fields', async () => {
    await openWorkshop();
    expect(document.getElementById('practice-rhythm-vocab-field').style.display).toBe('');
    expect(document.getElementById('practice-progression-field').style.display).toBe('');
    expect(document.getElementById('practice-part-view-field').style.display).toBe('');
  });

  it('rhythm-vocab chips render with default selection', async () => {
    await openWorkshop();
    const chips = document.querySelectorAll('#practice-rhythm-vocab-chips [data-vocab]');
    expect(chips.length).toBe(Object.keys(RHYTHM_VOCAB).length);
    const active = Array.from(chips).filter(c => c.classList.contains('is-active')).map(c => c.dataset.vocab);
    expect(active).toEqual(expect.arrayContaining(RHYTHM_VOCAB_DEFAULTS));
  });

  it('progression dropdown lists all PROGRESSION_OPTIONS', async () => {
    await openWorkshop();
    const opts = Array.from(document.querySelectorAll('#practice-progression option')).map(o => o.value);
    expect(opts).toEqual(PROGRESSION_OPTIONS.map(o => o.id));
  });

  it('part-view chips render with "both" default active', async () => {
    await openWorkshop();
    const active = document.querySelector('#practice-part-view-chips .is-active');
    expect(active.dataset.part).toBe('both');
  });

  it('clicking a vocab chip toggles + persists', async () => {
    await openWorkshop();
    const half = document.querySelector('[data-vocab="half"]');
    const wasActive = half.classList.contains('is-active');
    half.click();
    expect(half.classList.contains('is-active')).toBe(!wasActive);
    const prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    const sp = prefs.byStudy['duet-workshop'];
    expect(sp.rhythmVocab.includes('half')).toBe(!wasActive);
  });

  it('clicking the last-active vocab chip refuses to leave the set empty', async () => {
    await openWorkshop();
    // Click every active chip to turn them off until only one remains active.
    const chips = Array.from(document.querySelectorAll('[data-vocab]'));
    // Turn OFF every chip that is currently active except 'quarter'.
    for (const c of chips) {
      if (c.dataset.vocab === 'quarter') continue;
      if (c.classList.contains('is-active')) c.click();
    }
    // 'quarter' should still be active (default selection includes it).
    const quarter = document.querySelector('[data-vocab="quarter"]');
    expect(quarter.classList.contains('is-active')).toBe(true);
    // Now click the only active chip — should NOT turn it off.
    quarter.click();
    expect(quarter.classList.contains('is-active')).toBe(true);
    const prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    expect(prefs.byStudy['duet-workshop'].rhythmVocab).toEqual(['quarter']);
  });

  it('changing progression persists + triggers regen', async () => {
    await openWorkshop();
    const sel = document.getElementById('practice-progression');
    sel.value = 'jazz_ii_V_I';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    expect(prefs.byStudy['duet-workshop'].progressionId).toBe('jazz_ii_V_I');
  });

  it('part-view chip click switches the active state', async () => {
    await openWorkshop();
    const voice2 = document.querySelector('[data-part="voice2"]');
    voice2.click();
    expect(voice2.classList.contains('is-active')).toBe(true);
    expect(document.querySelector('[data-part="both"]').classList.contains('is-active')).toBe(false);
    const prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    expect(prefs.byStudy['duet-workshop'].partView).toBe('voice2');
  });

  it('two-voice-invention does NOT show duet-workshop controls', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="two-voice-invention"]').click();
    expect(document.getElementById('practice-rhythm-vocab-field').style.display).toBe('none');
    expect(document.getElementById('practice-progression-field').style.display).toBe('none');
    expect(document.getElementById('practice-part-view-field').style.display).toBe('none');
  });
});

describe('Duet Workshop — buildSong + part-view filter', () => {
  it('buildSong returns a song with both voices when partView=both', async () => {
    const { __test } = await import('../src/js/ui/PracticeView.js');
    const study = STUDIES.find(s => s.id === 'duet-workshop');
    const song = __test.buildSong(study, {
      keyPc: 0, seed: 42, difficulty: 50,
      clefVoices: ['bass', 'bass'],
      duetStyleId: 'free',
      rhythmVocab: ['quarter', 'half'],
      progressionId: 'pop',
    });
    expect(song.events.some(e => e.type === 'melody')).toBe(true);
    expect(song.events.some(e => e.type === 'melody2')).toBe(true);
  });

  it('progression override changes the harmonic content for the same seed', async () => {
    const { __test } = await import('../src/js/ui/PracticeView.js');
    const study = STUDIES.find(s => s.id === 'duet-workshop');
    const baseOpts = { keyPc: 0, seed: 7, difficulty: 50, clefVoices: ['bass', 'bass'], duetStyleId: 'free', rhythmVocab: ['quarter', 'half'] };
    const pop = __test.buildSong(study, { ...baseOpts, progressionId: 'pop' });
    const jazz = __test.buildSong(study, { ...baseOpts, progressionId: 'jazz_ii_V_I' });
    // Same seed, but different progression → at least one chord symbol differs.
    expect(pop.chordSymbols.join('|')).not.toBe(jazz.chordSymbols.join('|'));
  });

  it('rhythm vocab limited to quarter-only never produces sub-beat onsets', async () => {
    const { __test } = await import('../src/js/ui/PracticeView.js');
    const study = STUDIES.find(s => s.id === 'duet-workshop');
    const song = __test.buildSong(study, {
      keyPc: 0, seed: 19, difficulty: 50,
      clefVoices: ['bass', 'bass'],
      duetStyleId: 'free',
      rhythmVocab: ['quarter'],
      progressionId: 'pop',
    });
    const melody = song.events.filter(e => e.type === 'melody');
    for (const ev of melody) {
      expect(Number.isInteger(ev.atBeat)).toBe(true);
    }
  });
});

describe('Duet Workshop — share URL hydration', () => {
  it('vocab + prog + part query params persist into prefs', async () => {
    window.location.hash = '#/practice?study=duet-workshop&seed=5&vocab=quarter,half&prog=jazz_ii_V_I&part=voice1';
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    await new Promise(r => setTimeout(r, 30));
    const prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    const sp = prefs.byStudy['duet-workshop'];
    expect(sp.rhythmVocab).toEqual(['quarter', 'half']);
    expect(sp.progressionId).toBe('jazz_ii_V_I');
    expect(sp.partView).toBe('voice1');
  });

  it('invalid vocab ids are dropped silently', async () => {
    window.location.hash = '#/practice?study=duet-workshop&vocab=bogus,quarter';
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    await new Promise(r => setTimeout(r, 30));
    const prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    expect(prefs.byStudy['duet-workshop'].rhythmVocab).toEqual(['quarter']);
  });
});
