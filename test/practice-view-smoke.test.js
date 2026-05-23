// Smoke test for initPracticeView. Mirrors learn-view-smoke.test.js — scaffold
// the DOM the module touches, init it with a mocked audioApi, assert the
// catalog renders and the overlay opens on click.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const audioMock = () => ({
  ensureInit: vi.fn().mockResolvedValue(undefined),
  getContext: vi.fn().mockReturnValue(null),
  getTrackDest: vi.fn().mockReturnValue(null),
  getMasterGain: vi.fn().mockReturnValue(null),
});

function scaffoldPracticeDom() {
  document.body.innerHTML = `
    <div id="practice-catalog"></div>
    <div id="practice-study-overlay" class="hidden">
      <button id="practice-study-close"></button>
      <button id="practice-study-print"></button>
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
});

describe('PracticeView smoke', () => {
  it('initPracticeView renders the catalog with both studies', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    const cards = document.querySelectorAll('#practice-catalog .practice-card');
    expect(cards.length).toBeGreaterThanOrEqual(2);
    const ids = Array.from(cards).map(c => c.dataset.id);
    expect(ids).toContain('two-voice-invention');
    expect(ids).toContain('walking-bass-workout');
  });

  it('clicking a card opens the overlay and populates controls', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="walking-bass-workout"]').click();
    expect(document.getElementById('practice-study-overlay').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('practice-study-title').textContent).toContain('Walking');
    expect(document.querySelectorAll('#practice-key option').length).toBeGreaterThan(0);
  });

  it('roll-a-new-seed button mints a new seed value', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="two-voice-invention"]').click();
    const before = document.getElementById('practice-seed').value;
    document.getElementById('practice-reroll').click();
    const after = document.getElementById('practice-seed').value;
    expect(after).not.toBe(before);
  });

  it('difficulty slider updates the display + controls-info chip', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="two-voice-invention"]').click();
    const slider = document.getElementById('practice-difficulty');
    slider.value = '75';
    slider.dispatchEvent(new Event('input'));
    expect(document.getElementById('practice-difficulty-display').textContent).toBe('75%');
    expect(document.getElementById('practice-controls-info').textContent).toContain('75%');
  });

  it('close button hides the overlay', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="two-voice-invention"]').click();
    document.getElementById('practice-study-close').click();
    expect(document.getElementById('practice-study-overlay').classList.contains('hidden')).toBe(true);
  });

  it('populates clef + rhythm pickers for the invention; hides rhythm for walking-bass', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });

    document.querySelector('.practice-card[data-id="two-voice-invention"]').click();
    expect(document.querySelectorAll('#practice-clef option').length).toBeGreaterThan(1);
    expect(document.querySelectorAll('#practice-rhythm option').length).toBeGreaterThan(1);
    // Default = bass-bass + square.
    expect(document.getElementById('practice-clef').value).toBe('bass-bass');
    expect(document.getElementById('practice-rhythm').value).toBe('square');

    document.getElementById('practice-study-close').click();
    document.querySelector('.practice-card[data-id="walking-bass-workout"]').click();
    expect(document.querySelectorAll('#practice-clef option').length).toBeGreaterThan(0);
    expect(document.getElementById('practice-rhythm-field').style.display).toBe('none');
  });

  it('changing the rhythm picker updates the controls-info chip', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="two-voice-invention"]').click();
    const rhythm = document.getElementById('practice-rhythm');
    rhythm.value = 'flowing';
    rhythm.dispatchEvent(new Event('change'));
    expect(document.getElementById('practice-controls-info').textContent).toContain('Flowing');
  });
});
