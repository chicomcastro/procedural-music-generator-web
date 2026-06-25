// Deep-coverage tests for ComposeView. The existing
// compose-explore-smoke + compose-pra files cover the most common
// paths; this file hammers the rest — section editing, undo/redo,
// keyboard shortcuts, drag-and-drop, file save/load, action menu.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

function scaffoldComposeDom() {
  document.body.innerHTML = `
    <section id="view-compose">
      <button id="compose-play" disabled>
        <span class="compose-play-icon">▶</span>
        <span id="compose-play-label"></span>
      </button>
      <button id="compose-add"></button>
      <button id="compose-undo" disabled></button>
      <button id="compose-redo" disabled></button>
      <button id="compose-save-file" disabled></button>
      <input id="compose-load-file" type="file" />
      <button id="compose-export-stems" disabled></button>
      <button id="compose-export-mix" disabled></button>
      <button id="compose-clear"></button>
      <div id="compose-status" hidden>
        <span id="compose-status-text"></span>
        <span id="compose-status-time"></span>
        <span id="compose-status-total"></span>
        <div class="compose-status-progress">
          <div id="compose-status-progress-fill"></div>
        </div>
      </div>
      <div id="compose-timeline" role="list"></div>
      <p id="compose-empty"></p>
    </section>
  `;
}

const audioMock = () => ({
  ensureInit: vi.fn().mockResolvedValue(undefined),
  getContext: vi.fn().mockReturnValue(null),
  getTrackDest: vi.fn().mockReturnValue(null),
  getMasterGain: vi.fn().mockReturnValue(null),
});

beforeEach(() => {
  scaffoldComposeDom();
  localStorage.clear();
  vi.resetModules();
  location.hash = '';
});

afterEach(() => {
  globalThis.confirm = undefined;
});

describe('ComposeView — section editor flow', () => {
  it('toggle-edit reveals the per-section editor form', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    // Editor starts hidden.
    expect(document.querySelector('.section-block-editor').hasAttribute('hidden')).toBe(true);
    document.querySelector('[data-action="toggle-edit"]').click();
    expect(document.querySelector('.section-block-editor').hasAttribute('hidden')).toBe(false);
    // Clicking again hides it.
    document.querySelector('[data-action="toggle-edit"]').click();
    expect(document.querySelector('.section-block-editor').hasAttribute('hidden')).toBe(true);
  });

  it('changing tonic, scale, bars, bpm, density, voice all persist', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.querySelector('[data-action="toggle-edit"]').click();

    function fire(field, value) {
      const el = document.querySelector(`[data-edit="${field}"]`);
      el.value = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    fire('tonic', '7');
    fire('scale', 'natural_minor');
    fire('bars', '8');
    fire('bpm', '128');
    fire('density', '0.85');
    fire('voice', 'pluck');

    const saved = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(saved[0].tonic).toBe(7);
    expect(saved[0].scale).toBe('natural_minor');
    expect(saved[0].bars).toBe(8);
    expect(saved[0].bpm).toBe(128);
    expect(saved[0].density).toBeCloseTo(0.85, 2);
    expect(saved[0].voice).toBe('pluck');
  });

  it('bpm slider input event updates the inline em label live', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.querySelector('[data-action="toggle-edit"]').click();
    const bpmInput = document.querySelector('[data-edit="bpm"]');
    bpmInput.value = '142';
    bpmInput.dispatchEvent(new Event('input', { bubbles: true }));
    // The label's <em> reflects the live drag value.
    const em = bpmInput.closest('label').querySelector('em');
    expect(em.textContent).toBe('142');
  });

  it('changing the section name input persists the name', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    const nameInput = document.querySelector('.section-block-name');
    nameInput.value = 'My new name';
    nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    const saved = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(saved[0].name).toBe('My new name');
  });

  it('extremely long name gets truncated to 32 chars', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    const nameInput = document.querySelector('.section-block-name');
    nameInput.value = 'a'.repeat(80);
    nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    const saved = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(saved[0].name.length).toBeLessThanOrEqual(32);
  });
});

describe('ComposeView — section actions', () => {
  it('reseed mints a new seed for the section + re-renders', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    const before = JSON.parse(localStorage.getItem('seedsong-compose-project'))[0].seed;
    document.querySelector('[data-action="reseed"]').click();
    const after = JSON.parse(localStorage.getItem('seedsong-compose-project'))[0].seed;
    expect(after).not.toBe(before);
  });

  it('remove drops the section', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-add').click();
    document.querySelector('[data-action="remove"]').click();
    expect(JSON.parse(localStorage.getItem('seedsong-compose-project'))).toHaveLength(1);
  });

  it('"open in generator" fires onLoadSeed with the section params + sets hash', async () => {
    const onLoad = vi.fn();
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: onLoad, audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.querySelector('[data-action="open"]').click();
    expect(onLoad).toHaveBeenCalled();
    expect(onLoad.mock.calls[0][0]).toMatchObject({
      seed: expect.any(Number),
      scale: 'major',
    });
    expect(window.location.hash).toBe('#/generator');
  });
});

describe('ComposeView — undo / redo', () => {
  it('undo restores the previous state, redo re-applies it', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-add').click();
    expect(JSON.parse(localStorage.getItem('seedsong-compose-project'))).toHaveLength(2);

    document.getElementById('compose-undo').click();
    expect(JSON.parse(localStorage.getItem('seedsong-compose-project'))).toHaveLength(1);

    document.getElementById('compose-redo').click();
    expect(JSON.parse(localStorage.getItem('seedsong-compose-project'))).toHaveLength(2);
  });

  it('undo button is disabled when the stack is empty', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    expect(document.getElementById('compose-undo').disabled).toBe(true);
    document.getElementById('compose-add').click();
    expect(document.getElementById('compose-undo').disabled).toBe(false);
  });

  it('Ctrl+Z keyboard shortcut undoes the last action', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(JSON.parse(localStorage.getItem('seedsong-compose-project'))).toHaveLength(0);
  });

  it('Ctrl+Shift+Z and Ctrl+Y both redo', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }));
    expect(JSON.parse(localStorage.getItem('seedsong-compose-project'))).toHaveLength(1);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }));
    expect(JSON.parse(localStorage.getItem('seedsong-compose-project'))).toHaveLength(1);
  });

  it('keyboard shortcuts are ignored when the compose view is hidden', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('view-compose').classList.add('hidden');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    // Section count unchanged.
    expect(JSON.parse(localStorage.getItem('seedsong-compose-project'))).toHaveLength(1);
  });
});

describe('ComposeView — clear with confirmation', () => {
  it('clear button is no-op without sections', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    expect(() => document.getElementById('compose-clear').click()).not.toThrow();
    expect(localStorage.getItem('seedsong-compose-project')).toBeNull();
  });

  it('clear with confirm() cancelled does NOT clear', async () => {
    globalThis.confirm = () => false;
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-clear').click();
    expect(JSON.parse(localStorage.getItem('seedsong-compose-project'))).toHaveLength(1);
  });
});

describe('ComposeView — drag-to-reorder', () => {
  // Helper — jsdom doesn't ship DragEvent, fake it as a plain Event
  // with a dataTransfer stub attached. The production code accesses
  // event.dataTransfer + event.clientY + event.currentTarget only.
  function fakeDrag(type, target, opts = {}) {
    const dataTransfer = {
      effectAllowed: '', dropEffect: '',
      setData() {}, getData() { return opts.id || ''; },
    };
    const ev = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dataTransfer });
    if ('clientY' in opts) Object.defineProperty(ev, 'clientY', { value: opts.clientY });
    target.dispatchEvent(ev);
  }

  it('drag from index 1 to drop-before index 0 reorders the sections', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-add').click();
    const blocks = document.querySelectorAll('.section-block');
    const initialIds = JSON.parse(localStorage.getItem('seedsong-compose-project')).map(s => s.id);

    // Negative clientY forces "before half" — jsdom returns a zero rect
    // so the geometry comparison would otherwise default to "after".
    fakeDrag('dragstart', blocks[1], { id: blocks[1].dataset.id });
    fakeDrag('dragover',  blocks[0], { id: blocks[1].dataset.id, clientY: -100 });
    fakeDrag('drop',      blocks[0], { id: blocks[1].dataset.id, clientY: -100 });
    fakeDrag('dragend',   blocks[1], { id: blocks[1].dataset.id });

    const afterIds = JSON.parse(localStorage.getItem('seedsong-compose-project')).map(s => s.id);
    expect(afterIds).toEqual([initialIds[1], initialIds[0]]);
  });

  it('dragleave clears the drop-target classes', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-add').click();
    const blocks = document.querySelectorAll('.section-block');
    fakeDrag('dragstart', blocks[1], { id: blocks[1].dataset.id });
    fakeDrag('dragover',  blocks[0], { id: blocks[1].dataset.id, clientY: -100 });
    // Either drop-before or drop-after is set after dragover.
    const beforeLeave = blocks[0].classList.contains('drop-before')
      || blocks[0].classList.contains('drop-after');
    expect(beforeLeave).toBe(true);
    fakeDrag('dragleave', blocks[0], { id: blocks[1].dataset.id });
    expect(blocks[0].classList.contains('drop-before')).toBe(false);
    expect(blocks[0].classList.contains('drop-after')).toBe(false);
  });
});

describe('ComposeView — file save / load', () => {
  it('save-file builds a JSON blob with the seedsong-compose format', async () => {
    let captured = null;
    URL.createObjectURL = vi.fn((blob) => { captured = blob; return 'blob:fake'; });
    URL.revokeObjectURL = vi.fn();
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};

    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-save-file').click();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(captured).toBeInstanceOf(Blob);
    expect(captured.type).toMatch(/json/);

    HTMLAnchorElement.prototype.click = origClick;
  });

  // Helper — jsdom's File doesn't always expose .text(), so we attach
  // it explicitly.
  function fakeFile(text, name = 'test.json') {
    const f = new File([text], name, { type: 'application/json' });
    Object.defineProperty(f, 'text', { value: async () => text, configurable: true });
    return f;
  }

  it('load-file replaces sections with the file contents on a valid payload', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });

    const payload = {
      format: 'seedsong-compose',
      version: 1,
      sections: [
        { id: 'loaded1', name: 'From file', seed: 123, scale: 'major', tonic: 0, bpm: 120, bars: 4, density: 0.5, voice: 'piano', tracks: ['melody'] },
      ],
    };
    const file = fakeFile(JSON.stringify(payload));
    const input = document.getElementById('compose-load-file');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    // loadProjectFile is async — let microtasks settle.
    await new Promise(r => setTimeout(r, 50));
    const saved = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('From file');
  });

  it('load-file with a bad payload is a no-op (does not corrupt state)', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    const sectionsBefore = JSON.parse(localStorage.getItem('seedsong-compose-project'));

    const file = fakeFile('not json at all');
    const input = document.getElementById('compose-load-file');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    const sectionsAfter = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(sectionsAfter).toEqual(sectionsBefore);
  });

  it('restores legacy projects from localStorage that lack the drum track', async () => {
    localStorage.setItem('seedsong-compose-project', JSON.stringify([
      { id: 'legacy1', name: 'Old', seed: 7, scale: 'major', tonic: 0, bpm: 110, bars: 4, density: 0.5, voice: 'piano', tracks: ['melody', 'chord', 'bass'] },
    ]));
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    // Section is rendered with its original 3 tracks (drum stays off).
    const chips = document.querySelectorAll('.section-track-chip');
    expect(chips.length).toBe(4);
    expect(document.querySelector('.section-track-chip[data-track="drum"]').classList.contains('active')).toBe(false);
  });
});

describe('ComposeView — playback wiring', () => {
  it('Play composition toggles the play button state', async () => {
    // Mock the audio API so playComposition can run end-to-end. The
    // playback path calls into DrumSynth, which uses bufferSources +
    // oscillators with full AudioParam APIs — so the mock has to spell
    // out every method it touches.
    function audioParam() {
      return {
        value: 0,
        setValueAtTime() { return this; },
        linearRampToValueAtTime() { return this; },
        exponentialRampToValueAtTime() { return this; },
        cancelScheduledValues() { return this; },
      };
    }
    function audioNode() {
      const node = {
        gain: audioParam(),
        frequency: audioParam(),
        Q: audioParam(),
        type: 'sine',
        buffer: null,
        connect() { return node; },
        disconnect() {},
        start() {}, stop() {},
        getChannelData() { return new Float32Array(100); },
      };
      return node;
    }
    const ctx = {
      currentTime: 0,
      sampleRate: 44100,
      createOscillator: () => audioNode(),
      createGain: () => audioNode(),
      createBuffer: () => audioNode(),
      createBufferSource: () => audioNode(),
      createBiquadFilter: () => audioNode(),
    };
    const audio = {
      ensureInit: vi.fn().mockResolvedValue(undefined),
      getContext: () => ctx,
      getTrackDest: () => ({ connect() {} }),
      getMasterGain: () => ({ connect() {} }),
    };

    const { initComposeView, stopComposePlayback } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audio });
    document.getElementById('compose-add').click();

    // Play button enabled with at least one section.
    expect(document.getElementById('compose-play').disabled).toBe(false);
    document.getElementById('compose-play').click();
    // Give the async init a microtask to settle.
    await new Promise(r => setTimeout(r, 20));
    // Status row becomes visible.
    expect(document.getElementById('compose-status').hidden).toBe(false);

    stopComposePlayback();
    expect(document.getElementById('compose-status').hidden).toBe(true);
  });
});
