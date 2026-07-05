// Tests for the Learn → Practice bridge (ADR 0005, PR O).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { practiceLinkForModule } from '../src/js/ui/learn-practice-bridge.js';
import { MODULES } from '../src/js/ui/learn-modules.js';
import { STUDIES } from '../src/js/ui/practice-studies.js';
import { PROGRESSIONS } from '../src/js/theory/chords.js';

describe('practiceLinkForModule — mapping', () => {
  it('maps every Learn module to a practice link (full catalog coverage)', () => {
    for (const mod of MODULES) {
      const link = practiceLinkForModule(mod);
      expect(link, `module ${mod.id} has no practice link`).toBeTruthy();
      expect(link).toMatch(/^#\/practice\?/);
    }
  });

  it('every mapped study id exists in the Practice catalog', () => {
    const studyIds = new Set(STUDIES.map(s => s.id));
    for (const mod of MODULES) {
      const link = practiceLinkForModule(mod);
      const study = new URLSearchParams(link.split('?')[1]).get('study');
      expect(studyIds.has(study), `module ${mod.id} → unknown study ${study}`).toBe(true);
    }
  });

  it('every mapped progression id exists in PROGRESSIONS', () => {
    for (const mod of MODULES) {
      const link = practiceLinkForModule(mod);
      const prog = new URLSearchParams(link.split('?')[1]).get('prog');
      if (prog) {
        expect(PROGRESSIONS[prog], `module ${mod.id} → unknown progression ${prog}`).toBeTruthy();
      }
    }
  });

  it('scale modules carry their scale into the etude', () => {
    expect(practiceLinkForModule({ id: 'major-scale', group: 'Scales' }))
      .toBe('#/practice?study=scale-etude&scale=major');
    expect(practiceLinkForModule({ id: 'natural-minor', group: 'Scales' }))
      .toBe('#/practice?study=scale-etude&scale=natural_minor');
    expect(practiceLinkForModule({ id: 'harmonic-minor', group: 'Scales' }))
      .toBe('#/practice?study=scale-etude&scale=harmonic_minor');
  });

  it('progression modules carry the matching PROGRESSIONS preset', () => {
    expect(practiceLinkForModule({ id: 'prog-ii-v-i', group: 'Progressions' }))
      .toBe('#/practice?study=duet-workshop&prog=jazz_ii_V_I');
    expect(practiceLinkForModule({ id: 'prog-12-bar-blues', group: 'Progressions' }))
      .toBe('#/practice?study=duet-workshop&prog=twelve_bar');
  });

  it('unmapped progression modules fall back to the group default', () => {
    expect(practiceLinkForModule({ id: 'prog-royal-road', group: 'Progressions' }))
      .toBe('#/practice?study=duet-workshop');
  });

  it('walking-bass modules land on the walking-bass workout', () => {
    expect(practiceLinkForModule({ id: 'walking-bass-triplets', group: 'Walking Bass' }))
      .toBe('#/practice?study=walking-bass-workout');
  });

  it('counterpoint imitation maps to call & response duet style', () => {
    expect(practiceLinkForModule({ id: 'counterpoint-imitation', group: 'Counterpoint' }))
      .toBe('#/practice?study=duet-workshop&duet=call_response');
  });

  it('returns null for unknown module + group', () => {
    expect(practiceLinkForModule({ id: 'nope', group: 'Nope' })).toBeNull();
    expect(practiceLinkForModule(null)).toBeNull();
  });
});

describe('Learn view — "Practice this" CTA', () => {
  const audioMock = () => ({
    ensureInit: vi.fn().mockResolvedValue(undefined),
    getContext: vi.fn().mockReturnValue(null),
    getTrackDest: vi.fn().mockReturnValue(null),
    getMasterGain: vi.fn().mockReturnValue(null),
  });

  function scaffoldLearnDom() {
    document.body.innerHTML = `
      <div id="learn-modules"></div>
      <div id="learn-continue" hidden>
        <span id="learn-continue-eyebrow"></span>
        <h3 id="learn-continue-title"></h3>
        <p id="learn-continue-desc"></p>
        <button id="learn-continue-btn"></button>
      </div>
      <button id="learn-map-btn"></button>
      <div id="learn-map-overlay" class="hidden">
        <button id="learn-map-close"></button>
        <div id="learn-map-body"></div>
      </div>
      <div id="learn-exercise-overlay" class="hidden">
        <button id="exercise-back-arrow"></button>
        <button id="exercise-close"></button>
        <button id="exercise-favorite" aria-pressed="false"></button>
        <button id="exercise-practice-link" hidden><span>Practice this</span></button>
        <span id="exercise-module-name"></span>
        <span id="exercise-tag"></span>
        <div id="exercise-step-rail"></div>
        <div id="exercise-content">
          <div id="exercise-module-hero" hidden>
            <span id="exercise-module-hero-eyebrow"></span>
            <h1 id="exercise-module-hero-title"></h1>
            <p id="exercise-module-hero-summary"></p>
          </div>
          <h2 id="exercise-title"></h2>
          <div id="exercise-desc"></div>
          <details id="exercise-controls-disclosure"><summary><span id="exercise-controls-info"></span></summary>
            <button id="exercise-transpose-up"></button>
            <button id="exercise-transpose-down"></button>
            <button id="exercise-octave-up"></button>
            <button id="exercise-octave-down"></button>
            <span id="exercise-key-label">C</span>
            <span id="exercise-octave-label">0</span>
            <div id="exercise-clef">
              <button class="exercise-pill" data-clef="treble"></button>
              <button class="exercise-pill" data-clef="bass"></button>
            </div>
            <input id="exercise-tempo" type="range" value="110" />
            <span id="exercise-tempo-display">110</span>
            <input id="exercise-repeat" type="checkbox" />
            <input id="exercise-record-mode" type="checkbox" />
          </details>
          <div id="exercise-sheet"></div>
          <div id="exercise-playback-progress" hidden><div class="exercise-playback-fill"></div></div>
          <button id="exercise-play"></button>
          <audio id="exercise-recording"></audio>
        </div>
        <button id="exercise-next"></button>
        <div id="module-intro-flash" class="hidden"><span id="module-intro-eyebrow"></span><h3 id="module-intro-title"></h3></div>
        <div id="module-complete-flash" class="hidden"><div class="confetti-shower"></div><p id="module-complete-sub"></p></div>
      </div>
      <span id="learn-progress-pct">0%</span>
      <div id="learn-progress-fill"></div>
      <span id="learn-streak-current">0</span>
      <span id="learn-streak-best">0</span>
      <span id="learn-streak-label"></span>
    `;
  }

  beforeEach(() => {
    scaffoldLearnDom();
    localStorage.clear();
    vi.resetModules();
    window.location.hash = '';
  });

  it('opening a module reveals the CTA with the mapped hash', async () => {
    const { initLearnView } = await import('../src/js/ui/LearnView.js');
    initLearnView({ audioApi: audioMock() });
    document.querySelector('#learn-modules .learn-card').click();
    const btn = document.getElementById('exercise-practice-link');
    expect(btn.hidden).toBe(false);
    expect(btn.dataset.practiceHash).toMatch(/^#\/practice\?study=/);
  });

  it('clicking the CTA closes the overlay and navigates to the practice deep link', async () => {
    const { initLearnView } = await import('../src/js/ui/LearnView.js');
    initLearnView({ audioApi: audioMock() });
    document.querySelector('#learn-modules .learn-card').click();
    const btn = document.getElementById('exercise-practice-link');
    const expected = btn.dataset.practiceHash;
    btn.click();
    expect(document.getElementById('learn-exercise-overlay').classList.contains('hidden')).toBe(true);
    expect(window.location.hash).toBe(expected);
  });
});

describe('Practice view — in-app deep-link hydration (hashchange)', () => {
  const audioMock = () => ({
    ensureInit: vi.fn().mockResolvedValue(undefined),
    getContext: vi.fn().mockReturnValue(null),
    getTrackDest: vi.fn().mockReturnValue(null),
    getMasterGain: vi.fn().mockReturnValue(null),
  });

  function scaffoldPracticeDom() {
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
    scaffoldPracticeDom();
    localStorage.clear();
    vi.resetModules();
    window.location.hash = '';
  });

  it('hashchange to a practice deep link opens the study with hydrated params', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    // Overlay starts closed.
    expect(document.getElementById('practice-study-overlay').classList.contains('hidden')).toBe(true);
    // Simulate the Learn bridge navigation.
    window.location.hash = '#/practice?study=scale-etude&scale=natural_minor';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await new Promise(r => setTimeout(r, 30));
    expect(document.getElementById('practice-study-overlay').classList.contains('hidden')).toBe(false);
    const prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    expect(prefs.byStudy['scale-etude'].scaleId).toBe('natural_minor');
  });

  it('hashchange to a plain view hash is a no-op for the overlay', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    window.location.hash = '#/learn';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await new Promise(r => setTimeout(r, 30));
    expect(document.getElementById('practice-study-overlay').classList.contains('hidden')).toBe(true);
  });
});
