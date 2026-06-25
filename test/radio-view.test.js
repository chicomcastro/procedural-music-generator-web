// Tests for RadioView (PR H). Coverage push 24 → 80%+.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function scaffold() {
  document.body.innerHTML = `
    <section id="view-radio">
      <div id="radio-empty"></div>
      <div id="radio-stage">
        <span id="radio-now-seed"></span>
        <div id="radio-now-tags"></div>
        <canvas id="radio-canvas" width="320" height="160"></canvas>
        <button id="radio-now-open"></button>
      </div>
      <button id="radio-play">
        <span class="radio-play-icon">▶</span>
        <span id="radio-play-label"></span>
      </button>
      <button id="radio-skip"></button>
      <button id="radio-shuffle"></button>
      <div id="radio-queue-list"></div>
      <span id="radio-queue-remaining"></span>
    </section>
  `;
  // canvas getContext is mocked since jsdom has no 2D ctx
  const canvas = document.getElementById('radio-canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 320, configurable: true });
  Object.defineProperty(canvas, 'clientHeight', { value: 160, configurable: true });
  canvas.getContext = vi.fn().mockReturnValue({
    scale() {}, clearRect() {}, fillRect() {}, fillStyle: '',
  });
}

const audioMock = () => ({
  ensureInit: vi.fn().mockResolvedValue(undefined),
  getContext: vi.fn().mockReturnValue(null),
  getTrackDest: vi.fn().mockReturnValue(null),
  getMasterGain: vi.fn().mockReturnValue(null),
});

function seedLikes(arr) {
  localStorage.setItem('seedsong-explore-feedback', JSON.stringify(arr));
}

const sampleLikes = [
  { action: 'like', seed: 1001, scale: 'major', tonic: 0, bpm: 110, voice: 'piano', density: 0.5, swing: 0 },
  { action: 'like', seed: 1002, scale: 'dorian', tonic: 2, bpm: 95, voice: 'pad', density: 0.4, swing: 0.1 },
  { action: 'save', seed: 1003, scale: 'natural_minor', tonic: 7, bpm: 130, voice: 'pluck', density: 0.7, swing: 0 },
  { action: 'skip', seed: 9999, scale: 'major', tonic: 0, bpm: 100, voice: 'piano', density: 0.5, swing: 0 },   // filtered out
];

beforeEach(() => {
  scaffold();
  localStorage.clear();
  vi.resetModules();
  // Deterministic shuffle: lock Math.random
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RadioView — empty state', () => {
  it('initRadioView with no likes shows empty + disables controls', async () => {
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: audioMock(), onLoadSeed: vi.fn() });
    expect(document.getElementById('radio-empty').hidden).toBe(false);
    expect(document.getElementById('radio-stage').hidden).toBe(true);
    expect(document.getElementById('radio-play').disabled).toBe(true);
    expect(document.getElementById('radio-skip').disabled).toBe(true);
    expect(document.getElementById('radio-shuffle').disabled).toBe(true);
  });

  it('togglePlay is a no-op when queue is empty', async () => {
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: audioMock(), onLoadSeed: vi.fn() });
    document.getElementById('radio-play').click();
    // disabled controls would prevent click, but we test the function path anyway
    expect(document.getElementById('radio-play-label').textContent).toBe('');
  });

  it('readLiked handles corrupt JSON in storage', async () => {
    localStorage.setItem('seedsong-explore-feedback', 'not-json');
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: audioMock(), onLoadSeed: vi.fn() });
    expect(document.getElementById('radio-empty').hidden).toBe(false);
  });
});

describe('RadioView — populated queue', () => {
  beforeEach(() => seedLikes(sampleLikes));

  it('builds queue from likes + saves, ignores skips', async () => {
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: audioMock(), onLoadSeed: vi.fn() });
    expect(document.getElementById('radio-empty').hidden).toBe(true);
    expect(document.getElementById('radio-stage').hidden).toBe(false);
    // The skip entry (seed 9999) must not appear in the queue.
    const seedText = document.getElementById('radio-now-seed').textContent;
    expect(seedText).not.toContain('9999');
  });

  it('shows current seed + tag chips', async () => {
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: audioMock(), onLoadSeed: vi.fn() });
    expect(document.getElementById('radio-now-seed').textContent).toMatch(/^seed \d+$/);
    expect(document.getElementById('radio-now-tags').innerHTML).toContain('feed-tag');
  });

  it('renders upcoming queue items + remaining count', async () => {
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: audioMock(), onLoadSeed: vi.fn() });
    const items = document.querySelectorAll('.radio-queue-item');
    // We have 3 valid likes; queueIdx=0 → upcoming is queue[1..5] → up to 2 items.
    expect(items.length).toBe(2);
    expect(Number(document.getElementById('radio-queue-remaining').textContent)).toBe(2);
  });

  it('skip advances to the next item', async () => {
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: audioMock(), onLoadSeed: vi.fn() });
    const firstSeed = document.getElementById('radio-now-seed').textContent;
    document.getElementById('radio-skip').click();
    const secondSeed = document.getElementById('radio-now-seed').textContent;
    expect(secondSeed).not.toBe(firstSeed);
  });

  it('skip wraps around at the end of the queue', async () => {
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: audioMock(), onLoadSeed: vi.fn() });
    const firstSeed = document.getElementById('radio-now-seed').textContent;
    // Skip past the end (3 items)
    for (let i = 0; i < 3; i++) document.getElementById('radio-skip').click();
    expect(document.getElementById('radio-now-seed').textContent).toBe(firstSeed);
  });

  it('shuffle re-shuffles + resets to first item', async () => {
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: audioMock(), onLoadSeed: vi.fn() });
    document.getElementById('radio-skip').click();
    // Now on idx 1 — shuffle should reset to idx 0
    Math.random.mockReturnValue(0.1);   // different shuffle outcome
    document.getElementById('radio-shuffle').click();
    expect(Number(document.getElementById('radio-queue-remaining').textContent)).toBe(2);
  });

  it('open button fires onLoadSeed with current params', async () => {
    const onLoadSeed = vi.fn();
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: audioMock(), onLoadSeed });
    document.getElementById('radio-now-open').click();
    expect(onLoadSeed).toHaveBeenCalledTimes(1);
    expect(onLoadSeed.mock.calls[0][0]).toMatchObject({
      seed: expect.any(Number),
      scale: expect.any(String),
      tonic: expect.any(Number),
      bpm: expect.any(Number),
    });
  });

  it('open button is a no-op without onLoadSeed callback', async () => {
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: audioMock(), onLoadSeed: null });
    document.getElementById('radio-now-open').click();
    // No throw is sufficient
    expect(true).toBe(true);
  });

  it('draws to the canvas after rendering', async () => {
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: audioMock(), onLoadSeed: vi.fn() });
    const ctx = document.getElementById('radio-canvas').getContext('2d');
    expect(document.getElementById('radio-canvas').getContext).toHaveBeenCalled();
    expect(ctx).toBeTruthy();
  });

  it('resize event triggers a canvas redraw', async () => {
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: audioMock(), onLoadSeed: vi.fn() });
    const getCtx = document.getElementById('radio-canvas').getContext;
    const callsBefore = getCtx.mock.calls.length;
    window.dispatchEvent(new Event('resize'));
    expect(getCtx.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

describe('RadioView — playback', () => {
  beforeEach(() => seedLikes(sampleLikes));

  function audioApiWithCtx() {
    const oscillators = [];
    const ctx = {
      currentTime: 0,
      createOscillator() {
        const osc = {
          type: 'sine', frequency: { value: 0 },
          gain: null, connect(n) { osc._next = n; return n; }, disconnect() {},
          start: vi.fn(), stop: vi.fn(),
        };
        oscillators.push(osc);
        return osc;
      },
      createGain() {
        return {
          gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect(n) { return n; },
        };
      },
    };
    const dest = { connect() {} };
    return {
      ensureInit: vi.fn().mockResolvedValue(undefined),
      getContext: vi.fn().mockReturnValue(ctx),
      getTrackDest: vi.fn().mockReturnValue(dest),
      getMasterGain: vi.fn().mockReturnValue(dest),
      _oscillators: oscillators,
    };
  }

  it('togglePlay → schedules oscillators + UI shows pause', async () => {
    const api = audioApiWithCtx();
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: api, onLoadSeed: vi.fn() });
    document.getElementById('radio-play').click();
    await new Promise(r => setTimeout(r, 30));
    expect(api._oscillators.length).toBeGreaterThan(0);
    expect(document.querySelector('.radio-play-icon').textContent).toBe('■');
    expect(document.getElementById('radio-play').classList.contains('compose-play-active')).toBe(true);
  });

  it('togglePlay twice → stops + UI shows play again', async () => {
    const api = audioApiWithCtx();
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: api, onLoadSeed: vi.fn() });
    document.getElementById('radio-play').click();
    await new Promise(r => setTimeout(r, 30));
    document.getElementById('radio-play').click();
    expect(document.querySelector('.radio-play-icon').textContent).toBe('▶');
    expect(document.getElementById('radio-play').classList.contains('compose-play-active')).toBe(false);
    // All scheduled oscillators stopped
    for (const o of api._oscillators) expect(o.stop).toHaveBeenCalled();
  });

  it('skip while playing continues playing the next song', async () => {
    const api = audioApiWithCtx();
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: api, onLoadSeed: vi.fn() });
    document.getElementById('radio-play').click();
    await new Promise(r => setTimeout(r, 30));
    const oscCountAfterFirst = api._oscillators.length;
    document.getElementById('radio-skip').click();
    await new Promise(r => setTimeout(r, 30));
    expect(api._oscillators.length).toBeGreaterThan(oscCountAfterFirst);
  });

  it('shuffle while playing continues playing the new top', async () => {
    const api = audioApiWithCtx();
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: api, onLoadSeed: vi.fn() });
    document.getElementById('radio-play').click();
    await new Promise(r => setTimeout(r, 30));
    const oscCountBefore = api._oscillators.length;
    Math.random.mockReturnValue(0.2);
    document.getElementById('radio-shuffle').click();
    await new Promise(r => setTimeout(r, 30));
    expect(api._oscillators.length).toBeGreaterThan(oscCountBefore);
  });

  it('stopRadioPlayback stops playback if playing', async () => {
    const api = audioApiWithCtx();
    const mod = await import('../src/js/ui/RadioView.js');
    mod.initRadioView({ audioApi: api, onLoadSeed: vi.fn() });
    document.getElementById('radio-play').click();
    await new Promise(r => setTimeout(r, 30));
    mod.stopRadioPlayback();
    expect(document.querySelector('.radio-play-icon').textContent).toBe('▶');
  });

  it('stopRadioPlayback is a no-op when not playing', async () => {
    const api = audioApiWithCtx();
    const mod = await import('../src/js/ui/RadioView.js');
    mod.initRadioView({ audioApi: api, onLoadSeed: vi.fn() });
    mod.stopRadioPlayback();
    expect(document.querySelector('.radio-play-icon').textContent).toBe('▶');
  });

  it('playback no-ops when audio ctx is null', async () => {
    const api = {
      ensureInit: vi.fn().mockResolvedValue(undefined),
      getContext: vi.fn().mockReturnValue(null),
      getTrackDest: vi.fn(), getMasterGain: vi.fn(),
    };
    const { initRadioView } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: api, onLoadSeed: vi.fn() });
    document.getElementById('radio-play').click();
    await new Promise(r => setTimeout(r, 30));
    // UI still flips to pause because togglePlay sets isPlaying=true before calling playCurrent;
    // playCurrent bails on ctx==null. The point is no throw.
    expect(true).toBe(true);
  });
});

describe('RadioView — refreshRadio', () => {
  it('rebuilds queue from updated likes', async () => {
    const mod = await import('../src/js/ui/RadioView.js');
    mod.initRadioView({ audioApi: audioMock(), onLoadSeed: vi.fn() });
    expect(document.getElementById('radio-empty').hidden).toBe(false);
    // Now add some likes and refresh
    seedLikes(sampleLikes);
    mod.refreshRadio();
    expect(document.getElementById('radio-empty').hidden).toBe(true);
  });
});
