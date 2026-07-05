// Tests for music-stand mode (ADR 0006, PR P).
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
        <button id="practice-stand-prev">‹</button>
        <span id="practice-stand-page">1 / 1</span>
        <button id="practice-stand-next">›</button>
        <button id="practice-stand-zoom-out">−</button>
        <button id="practice-stand-zoom-in">+</button>
        <button id="practice-stand-play">▶</button>
        <button id="practice-stand-exit">✕</button>
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

// Give the sheet a fake geometry: 3 pages tall.
function stubSheetGeometry({ pageH = 600, pages = 3 } = {}) {
  const el = document.getElementById('practice-sheet');
  Object.defineProperty(el, 'clientHeight', { value: pageH, configurable: true });
  Object.defineProperty(el, 'scrollHeight', { value: pageH * pages, configurable: true });
  // scrollTop must be writable in jsdom
  let top = 0;
  Object.defineProperty(el, 'scrollTop', {
    get() { return top; },
    set(v) { top = v; },
    configurable: true,
  });
  return el;
}

async function openStudyInStand() {
  const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
  initPracticeView({ audioApi: audioMock() });
  document.querySelector('.practice-card[data-id="duet-workshop"]').click();
  stubSheetGeometry();
  document.getElementById('practice-study-stand').click();
}

beforeEach(() => {
  // Tear down any stand mode left active by the previous test — its module
  // instance still has keydown handlers on the (persistent) document, and
  // Escape makes them exit + self-detach.
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  scaffold();
  localStorage.clear();
  vi.resetModules();
  window.location.hash = '';
  document.body.className = '';
});

describe('Stand mode — enter / exit', () => {
  it('stand button adds the body class + resets scroll', async () => {
    await openStudyInStand();
    expect(document.body.classList.contains('practice-stand-mode')).toBe(true);
    expect(document.getElementById('practice-sheet').scrollTop).toBe(0);
  });

  it('exit button removes the body class', async () => {
    await openStudyInStand();
    document.getElementById('practice-stand-exit').click();
    expect(document.body.classList.contains('practice-stand-mode')).toBe(false);
  });

  it('Escape exits stand mode', async () => {
    await openStudyInStand();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(document.body.classList.contains('practice-stand-mode')).toBe(false);
  });

  it('closing the study exits stand mode too', async () => {
    await openStudyInStand();
    document.getElementById('practice-study-close').click();
    expect(document.body.classList.contains('practice-stand-mode')).toBe(false);
  });

  it('stand button without an open study is a no-op', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.getElementById('practice-study-stand').click();
    expect(document.body.classList.contains('practice-stand-mode')).toBe(false);
  });
});

describe('Stand mode — page turning', () => {
  it('shows the page indicator with the computed total', async () => {
    await openStudyInStand();
    expect(document.getElementById('practice-stand-page').textContent).toBe('1 / 3');
  });

  it('next / prev buttons step one viewport height', async () => {
    await openStudyInStand();
    const el = document.getElementById('practice-sheet');
    document.getElementById('practice-stand-next').click();
    expect(el.scrollTop).toBe(600);
    expect(document.getElementById('practice-stand-page').textContent).toBe('2 / 3');
    document.getElementById('practice-stand-prev').click();
    expect(el.scrollTop).toBe(0);
    expect(document.getElementById('practice-stand-page').textContent).toBe('1 / 3');
  });

  it('clamps at the last page', async () => {
    await openStudyInStand();
    const el = document.getElementById('practice-sheet');
    for (let i = 0; i < 10; i++) document.getElementById('practice-stand-next').click();
    expect(el.scrollTop).toBe(1200);   // (3 - 1) * 600
    expect(document.getElementById('practice-stand-page').textContent).toBe('3 / 3');
    expect(document.getElementById('practice-stand-next').disabled).toBe(true);
  });

  it('keyboard: ArrowRight / PageDown / Space forward; ArrowLeft / PageUp back', async () => {
    await openStudyInStand();
    const el = document.getElementById('practice-sheet');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(el.scrollTop).toBe(600);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true }));
    expect(el.scrollTop).toBe(1200);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true, cancelable: true }));
    expect(el.scrollTop).toBe(600);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    expect(el.scrollTop).toBe(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(el.scrollTop).toBe(600);
  });

  it('keyboard is inert when stand mode is off', async () => {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: audioMock() });
    document.querySelector('.practice-card[data-id="duet-workshop"]').click();
    const el = stubSheetGeometry();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(el.scrollTop).toBe(0);
  });

  it('tap on the right/left third of the sheet turns the page', async () => {
    await openStudyInStand();
    const el = document.getElementById('practice-sheet');
    Object.defineProperty(window, 'innerWidth', { value: 900, configurable: true });
    el.dispatchEvent(new MouseEvent('click', { clientX: 800, bubbles: true }));
    expect(el.scrollTop).toBe(600);
    el.dispatchEvent(new MouseEvent('click', { clientX: 100, bubbles: true }));
    expect(el.scrollTop).toBe(0);
    // middle third does nothing
    el.dispatchEvent(new MouseEvent('click', { clientX: 450, bubbles: true }));
    expect(el.scrollTop).toBe(0);
  });
});

describe('Stand mode — zoom + wake lock', () => {
  it('zoom buttons persist prefs.standZoom within [0.5, 2.5]', async () => {
    await openStudyInStand();
    document.getElementById('practice-stand-zoom-in').click();
    let prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    expect(prefs.standZoom).toBeCloseTo(1.4, 5);
    for (let i = 0; i < 30; i++) document.getElementById('practice-stand-zoom-in').click();
    prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    expect(prefs.standZoom).toBe(2.5);
    for (let i = 0; i < 40; i++) document.getElementById('practice-stand-zoom-out').click();
    prefs = JSON.parse(localStorage.getItem('seedsong-practice-prefs-v1'));
    expect(prefs.standZoom).toBe(0.5);
  });

  it('acquires a screen wake lock on enter and releases on exit', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    navigator.wakeLock = { request };
    await openStudyInStand();
    await new Promise(r => setTimeout(r, 10));
    expect(request).toHaveBeenCalledWith('screen');
    document.getElementById('practice-stand-exit').click();
    await new Promise(r => setTimeout(r, 10));
    expect(release).toHaveBeenCalled();
    delete navigator.wakeLock;
  });

  it('missing wakeLock API degrades silently', async () => {
    delete navigator.wakeLock;
    await openStudyInStand();
    expect(document.body.classList.contains('practice-stand-mode')).toBe(true);
  });
});
