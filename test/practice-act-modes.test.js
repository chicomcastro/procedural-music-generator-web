// Tests for act modes — movements vs. exercises (ADR 0007, PR R).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STUDIES } from '../src/js/ui/practice-studies.js';

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
      <button id="practice-study-stand"></button>
      <span id="practice-share-toast" hidden></span>
      <span id="practice-study-eyebrow"></span>
      <h2 id="practice-study-title"></h2>
      <p id="practice-study-desc"></p>
      <div id="practice-act-rail"></div>
      <div id="practice-sheet"></div>
      <div id="practice-stand-toolbar">
        <button id="practice-stand-prev"></button>
        <span id="practice-stand-page"></span>
        <button id="practice-stand-next"></button>
        <button id="practice-stand-zoom-out"></button>
        <button id="practice-stand-zoom-in"></button>
        <button id="practice-stand-play"></button>
        <button id="practice-stand-exit"></button>
      </div>
      <details id="practice-controls">
        <summary><span id="practice-controls-info"></span></summary>
        <select id="practice-key"></select>
        <div id="practice-clef-field"><select id="practice-clef"></select></div>
        <div id="practice-rhythm-field"><select id="practice-rhythm"></select></div>
        <div id="practice-duet-field"><select id="practice-duet"></select></div>
        <div id="practice-scale-field"><select id="practice-scale"></select></div>
        <div id="practice-contour-field"><select id="practice-contour"></select></div>
        <div id="practice-rhythm-vocab-field" style="display:none"><div id="practice-rhythm-vocab-chips"></div></div>
        <div id="practice-progression-field" style="display:none"><select id="practice-progression"></select></div>
        <div id="practice-part-view-field" style="display:none"><div id="practice-part-view-chips"></div></div>
        <div id="practice-swing-field">
          <input id="practice-swing" type="range" value="0" />
          <span id="practice-swing-display"></span>
        </div>
        <div id="practice-intensity-field">
          <input id="practice-intensity" type="range" value="100" />
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

describe('Catalog — actMode declarations', () => {
  it('drill bundles are exercises; pieces stay movements (default)', () => {
    const modes = Object.fromEntries(STUDIES.map(s => [s.id, s.actMode]));
    expect(modes['walking-bass-workout']).toBe('exercises');
    // ADR 0008: scale-etude became a single-act parametric sandbox —
    // the pattern dropdown replaced the exercise tabs.
    expect(modes['scale-etude']).toBeUndefined();
    expect(modes['modal-vamp']).toBe('exercises');
    expect(modes['two-voice-invention']).toBeUndefined();
    expect(modes['solo-etude']).toBeUndefined();
    expect(modes['duet-workshop']).toBeUndefined();
  });
});

describe('buildSong — exercise selection', () => {
  it('walking-bass builds only the selected exercise, at its own tempo', async () => {
    const { __test } = await import('../src/js/ui/PracticeView.js');
    const study = STUDIES.find(s => s.id === 'walking-bass-workout');
    const base = { keyPc: 0, seed: 7, difficulty: 50, clefVoices: ['bass'] };

    const ex0 = __test.buildSong(study, { ...base, actIdx: 0 });
    expect(ex0.bars).toBe(study.acts[0].bars);
    expect(ex0.bpm).toBe(study.acts[0].params.tempo);   // 80 — no more act-I tempo lie

    const ex2 = __test.buildSong(study, { ...base, actIdx: 2 });
    expect(ex2.bars).toBe(study.acts[2].bars);          // 12-bar blues
    expect(ex2.bpm).toBe(study.acts[2].params.tempo);   // 130 for real now
    expect(ex2.doubleBarsBefore).toEqual([]);           // single exercise → no act dividers
    expect(ex2.keySignatures.length).toBe(1);
  });

  it('actIdx out of range clamps to the last exercise', async () => {
    const { __test } = await import('../src/js/ui/PracticeView.js');
    const study = STUDIES.find(s => s.id === 'modal-vamp');
    const song = __test.buildSong(study, { keyPc: 0, seed: 3, difficulty: 50, clefVoices: ['treble'], actIdx: 99 });
    expect(song.bars).toBe(study.acts[study.acts.length - 1].bars);
  });

  it('movements studies ignore actIdx and build the whole piece', async () => {
    const { __test } = await import('../src/js/ui/PracticeView.js');
    const study = STUDIES.find(s => s.id === 'two-voice-invention');
    const totalBars = study.acts.reduce((a, act) => a + act.bars, 0);
    const song = __test.buildSong(study, { keyPc: 0, seed: 5, difficulty: 50, clefVoices: ['bass', 'bass'], duetStyleId: 'free', actIdx: 2 });
    expect(song.bars).toBe(totalBars);
    expect(song.keySignatures.length).toBe(study.acts.length);
  });
});

describe('Act rail — tabs for exercises, passive for movements', () => {
  async function init() {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
  }

  it('exercise study renders the rail as buttons with the first tab active', async () => {
    await init();
    document.querySelector('.practice-card[data-id="walking-bass-workout"]').click();
    const tabs = document.querySelectorAll('#practice-act-rail button.practice-act-rail-tab');
    expect(tabs.length).toBe(3);
    expect(tabs[0].classList.contains('is-active')).toBe(true);
    expect(tabs[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking a tab switches the active exercise and persists actIdx', async () => {
    await init();
    document.querySelector('.practice-card[data-id="walking-bass-workout"]').click();
    const tabs = document.querySelectorAll('#practice-act-rail .practice-act-rail-tab');
    tabs[2].click();
    const after = document.querySelectorAll('#practice-act-rail .practice-act-rail-tab');
    expect(after[2].classList.contains('is-active')).toBe(true);
    expect(after[0].classList.contains('is-active')).toBe(false);
    const prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    expect(prefs.byStudy['walking-bass-workout'].actIdx).toBe(2);
  });

  it('selection survives close + reopen', async () => {
    await init();
    document.querySelector('.practice-card[data-id="walking-bass-workout"]').click();
    document.querySelectorAll('#practice-act-rail .practice-act-rail-tab')[1].click();
    document.getElementById('practice-study-close').click();
    document.querySelector('.practice-card[data-id="walking-bass-workout"]').click();
    const tabs = document.querySelectorAll('#practice-act-rail .practice-act-rail-tab');
    expect(tabs[1].classList.contains('is-active')).toBe(true);
  });

  it('movements study keeps the passive (non-button) rail', async () => {
    await init();
    document.querySelector('.practice-card[data-id="two-voice-invention"]').click();
    const items = document.querySelectorAll('#practice-act-rail .practice-act-rail-item');
    expect(items.length).toBe(3);
    expect(document.querySelectorAll('#practice-act-rail button').length).toBe(0);
  });
});

describe('Share URL + favorites carry the exercise', () => {
  it('buildShareUrl includes act= when a non-first exercise is selected', async () => {
    const mod = await import('../src/js/ui/PracticeView.js');
    mod.initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="walking-bass-workout"]').click();
    document.querySelectorAll('#practice-act-rail .practice-act-rail-tab')[2].click();
    const prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    const url = mod.buildShareUrl('walking-bass-workout', prefs.byStudy['walking-bass-workout']);
    expect(url).toContain('act=2');
  });

  it('applyShareParams hydrates actIdx from act=', async () => {
    window.location.hash = '#/practice?study=walking-bass-workout&act=1';
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    await new Promise(r => setTimeout(r, 30));
    const prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    expect(prefs.byStudy['walking-bass-workout'].actIdx).toBe(1);
    // The study opened on the right tab.
    const tabs = document.querySelectorAll('#practice-act-rail .practice-act-rail-tab');
    expect(tabs[1].classList.contains('is-active')).toBe(true);
  });

  it('the same seed favorited on two different exercises makes two favorites', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="walking-bass-workout"]').click();
    document.getElementById('practice-study-favorite').click();
    document.querySelectorAll('#practice-act-rail .practice-act-rail-tab')[2].click();
    document.getElementById('practice-study-favorite').click();
    const prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    expect(prefs.favorites.length).toBe(2);
    expect(prefs.favorites[0].actIdx).toBe(2);
    expect(prefs.favorites[1].actIdx).toBe(0);
  });
});
