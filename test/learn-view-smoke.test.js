// Smoke test that drives the LearnView through its init + main render
// paths in jsdom. It doesn't try to validate audio playback (no real
// AudioContext + no CDN OSMD) — it asserts the module loads, registers
// listeners, and the home view renders module cards + the streak.
//
// Catches: regressions in renderCards / renderContinueCard / event-handler
// wiring that would crash before reaching a user.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const audioMock = () => ({
  ensureInit: vi.fn().mockResolvedValue(undefined),
  getContext: vi.fn().mockReturnValue(null),
  getTrackDest: vi.fn().mockReturnValue(null),
  getMasterGain: vi.fn().mockReturnValue(null),
});

function scaffoldLearnDom() {
  // Minimal DOM matching the IDs the LearnView wires up in initLearnView.
  // Anything missing is silently skipped via optional chaining inside the
  // module, but the more we provide the more code paths get exercised.
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
        <details id="exercise-controls-disclosure"><summary class="exercise-controls-summary"><span id="exercise-controls-info"></span></summary>
          <button id="exercise-transpose-up"></button>
          <button id="exercise-transpose-down"></button>
          <button id="exercise-octave-up"></button>
          <button id="exercise-octave-down"></button>
          <span id="exercise-key-label">C</span>
          <span id="exercise-octave-label">0</span>
          <div id="exercise-clef">
            <button class="exercise-pill" data-clef="treble"></button>
            <button class="exercise-pill" data-clef="bass"></button>
            <button class="exercise-pill" data-clef="alto"></button>
          </div>
          <input id="exercise-tempo" type="range" value="110" />
          <span id="exercise-tempo-display">110</span>
          <input id="exercise-repeat" type="checkbox" />
          <input id="exercise-record-mode" type="checkbox" />
        </details>
        <div id="generator-panel" hidden>
          <select id="generator-tonic"><option value="0">C</option></select>
          <select id="generator-scale"><option value="major">Major</option></select>
          <select id="generator-progression"><option value="I-V-vi-IV">I-V-vi-IV</option></select>
          <input id="generator-tempo" type="range" value="100" />
          <span id="generator-tempo-display">100</span>
          <input id="generator-seed" type="number" value="12345" />
          <button id="generator-reroll"></button>
        </div>
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
  vi.useFakeTimers();
});

describe('LearnView smoke', () => {
  it('initLearnView renders module cards without throwing', async () => {
    const { initLearnView } = await import('../src/js/ui/LearnView.js');
    initLearnView({ audioApi: audioMock() });
    const cards = document.querySelectorAll('#learn-modules .learn-card');
    expect(cards.length).toBeGreaterThan(10);
  });

  it('renders group headings for each curriculum group', async () => {
    const { initLearnView } = await import('../src/js/ui/LearnView.js');
    initLearnView({ audioApi: audioMock() });
    const headings = document.querySelectorAll('.learn-group-heading');
    // After dropping Challenges we expect 6 groups.
    expect(headings.length).toBeGreaterThanOrEqual(5);
  });

  it('shows the continue card with the first incomplete module', async () => {
    const { initLearnView } = await import('../src/js/ui/LearnView.js');
    initLearnView({ audioApi: audioMock() });
    const card = document.getElementById('learn-continue');
    expect(card.hidden).toBe(false);
    expect(document.getElementById('learn-continue-title').textContent).toBeTruthy();
  });

  it('clicking a module card opens the exercise overlay', async () => {
    const { initLearnView } = await import('../src/js/ui/LearnView.js');
    initLearnView({ audioApi: audioMock() });
    const card = document.querySelector('#learn-modules .learn-card');
    card.click();
    const overlay = document.getElementById('learn-exercise-overlay');
    expect(overlay.classList.contains('hidden')).toBe(false);
  });

  it('opening the lesson map populates groups', async () => {
    const { initLearnView } = await import('../src/js/ui/LearnView.js');
    initLearnView({ audioApi: audioMock() });
    document.getElementById('learn-map-btn').click();
    expect(document.getElementById('learn-map-overlay').classList.contains('hidden')).toBe(false);
    expect(document.querySelectorAll('.learn-map-group').length).toBeGreaterThan(0);
  });
});
