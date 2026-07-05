// Regression tests: play/pause toggle + catalog order (PR V).
// Bug: playbackTimer was only set AFTER playSong's awaits (ensureInit +
// piano-sample loading), so during that window the toggle thought
// playback was stopped — a second click layered ANOTHER playback on top
// instead of pausing.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STUDIES } from '../src/js/ui/practice-studies.js';

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
      <div id="practice-etude-bar" style="display:none">
        <div id="practice-etude-pattern-field"><select id="practice-etude-pattern"></select></div>
        <div id="practice-etude-octaves-field"><select id="practice-etude-octaves"></select></div>
        <div id="practice-etude-rhythm-field"><select id="practice-etude-rhythm"></select></div>
      </div>
      <div id="practice-sheet"></div>
      <div id="practice-stand-toolbar"><button id="practice-stand-play"></button><button id="practice-stand-exit"></button></div>
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

// Fake Web Audio surface that records oscillator lifecycles.
function makeAudioApi({ deferInit = false } = {}) {
  const oscillators = [];
  function makeOsc() {
    const o = {
      type: 'sine',
      frequency: { value: 0, setValueAtTime: vi.fn() },
      detune: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn(function () { return this; }),
      disconnect: vi.fn(),
      start: vi.fn(), stop: vi.fn(),
      onended: null,
    };
    oscillators.push(o);
    return o;
  }
  const ctx = {
    currentTime: 0,
    createOscillator: makeOsc,
    createGain: () => ({
      gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
      connect: vi.fn(function () { return this; }),
      disconnect: vi.fn(),
    }),
    createBiquadFilter: () => ({
      type: 'lowpass',
      frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      Q: { value: 0 },
      connect: vi.fn(function () { return this; }),
      disconnect: vi.fn(),
    }),
  };
  let resolveInit;
  const initPromise = deferInit
    ? new Promise((r) => { resolveInit = r; })
    : Promise.resolve();
  return {
    ensureInit: vi.fn().mockReturnValue(initPromise),
    resolveInit: () => resolveInit?.(),
    getContext: vi.fn().mockReturnValue(ctx),
    getTrackDest: vi.fn().mockReturnValue({ connect: vi.fn() }),
    getMasterGain: vi.fn().mockReturnValue({ connect: vi.fn() }),
    _oscillators: oscillators,
  };
}

beforeEach(() => {
  scaffold();
  localStorage.clear();
  vi.resetModules();
  window.location.hash = '';
});

const settle = () => new Promise((r) => setTimeout(r, 20));

describe('Catalog order', () => {
  it('Scale Etude comes first in STUDIES and in the rendered catalog', async () => {
    expect(STUDIES[0].id).toBe('scale-etude');
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: makeAudioApi() });
    const firstCard = document.querySelector('#practice-catalog .practice-card');
    expect(firstCard.dataset.id).toBe('scale-etude');
  });
});

describe('Play / pause toggle', () => {
  // Walking-bass uses the synth bass voice — no sample loading needed.
  async function openWalkingBass(api) {
    const { initPracticeView } = await import('../src/js/ui/PracticeView.js');
    initPracticeView({ audioApi: api });
    document.querySelector('.practice-card[data-id="walking-bass-workout"]').click();
    await settle();
  }

  it('play schedules voices and flags the button as playing', async () => {
    const api = makeAudioApi();
    await openWalkingBass(api);
    document.getElementById('practice-play').click();
    await settle();
    expect(api._oscillators.length).toBeGreaterThan(0);
    expect(document.getElementById('practice-play').classList.contains('is-playing')).toBe(true);
  });

  it('second click PAUSES instead of layering a second playback (the bug)', async () => {
    const api = makeAudioApi();
    await openWalkingBass(api);
    document.getElementById('practice-play').click();
    await settle();
    const scheduled = api._oscillators.length;
    // The bug: this second click used to call playSong again.
    document.getElementById('practice-play').click();
    await settle();
    expect(api._oscillators.length).toBe(scheduled);   // nothing new scheduled
    expect(document.getElementById('practice-play').classList.contains('is-playing')).toBe(false);
    // Every scheduled oscillator got stopped by the release path.
    expect(api._oscillators.every(o => o.stop.mock.calls.length > 0)).toBe(true);
  });

  it('pause during the async init window aborts the pending run (no audio ever)', async () => {
    const api = makeAudioApi({ deferInit: true });
    await openWalkingBass(api);
    document.getElementById('practice-play').click();       // starts, awaits ensureInit
    expect(document.getElementById('practice-play').classList.contains('is-playing')).toBe(true);
    document.getElementById('practice-play').click();       // pause while still loading
    expect(document.getElementById('practice-play').classList.contains('is-playing')).toBe(false);
    api.resolveInit();                                      // init finally completes
    await settle();
    expect(api._oscillators.length).toBe(0);                // aborted — nothing scheduled
  });

  it('play → pause → play works as a clean restart', async () => {
    const api = makeAudioApi();
    await openWalkingBass(api);
    document.getElementById('practice-play').click();
    await settle();
    const first = api._oscillators.length;
    document.getElementById('practice-play').click();       // pause
    await settle();
    document.getElementById('practice-play').click();       // play again
    await settle();
    expect(api._oscillators.length).toBe(first * 2);        // a fresh full schedule
    expect(document.getElementById('practice-play').classList.contains('is-playing')).toBe(true);
  });

  it('the stand-mode play button shares the same toggle', async () => {
    const api = makeAudioApi();
    await openWalkingBass(api);
    document.getElementById('practice-stand-play').click();
    await settle();
    const scheduled = api._oscillators.length;
    expect(scheduled).toBeGreaterThan(0);
    document.getElementById('practice-stand-play').click(); // pause, not layer
    await settle();
    expect(api._oscillators.length).toBe(scheduled);
  });
});
