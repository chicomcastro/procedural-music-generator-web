// Tests for pivot/pilot notes at section boundaries (ADR 0003).
import { describe, it, expect, beforeEach, vi } from 'vitest';

function scaffold() {
  document.body.innerHTML = `
    <section id="view-compose">
      <button id="compose-play" disabled>
        <span class="compose-play-icon">▶</span>
        <span id="compose-play-label"></span>
      </button>
      <div class="compose-add-group">
        <button id="compose-add" class="compose-add-main"></button>
        <button id="compose-add-menu-btn" aria-expanded="false">▾</button>
        <div id="compose-add-menu" role="menu" hidden></div>
      </div>
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
  scaffold();
  localStorage.clear();
  vi.resetModules();
});

describe('Compose — pivot notes (ADR 0003)', () => {
  it('pivot-note checkbox appears on sections from index 2 on', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-add').click();
    const blocks = document.querySelectorAll('.section-block');
    // First section's editor markup never has the checkbox
    expect(blocks[0].querySelector('[data-edit="pivotNote"]')).toBeNull();
    // Second section's does
    expect(blocks[1].querySelector('[data-edit="pivotNote"]')).not.toBeNull();
  });

  it('toggling pivot note persists to localStorage and renders chip', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-add').click();
    document.querySelectorAll('[data-action="toggle-edit"]')[1].click();
    const cb = document.querySelector('[data-edit="pivotNote"]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    const saved = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(saved[1].pivotNote).toBe(true);
    expect(document.querySelector('.section-meta-chip-pivot')).not.toBeNull();
  });

  it('toggling pivot OFF clears the chip', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-add').click();
    document.querySelectorAll('[data-action="toggle-edit"]')[1].click();
    const cb = document.querySelector('[data-edit="pivotNote"]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.querySelector('.section-meta-chip-pivot')).not.toBeNull();
    document.querySelectorAll('[data-action="toggle-edit"]')[1].click();
    const cb2 = document.querySelector('[data-edit="pivotNote"]');
    cb2.checked = false;
    cb2.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.querySelector('.section-meta-chip-pivot')).toBeNull();
    const saved = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(saved[1].pivotNote).toBe(false);
  });

  it('pivotNote in file load is preserved; invalid values coerce to false', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    const payload = {
      format: 'seedsong-compose',
      version: 1,
      sections: [
        { id: 'a', name: 'A', seed: 1, scale: 'major', tonic: 0, bpm: 120, bars: 4, density: 0.5, voice: 'piano', tracks: ['melody'], transitionIn: 'hard', transitionBars: 1 },
        { id: 'b', name: 'B', seed: 2, scale: 'major', tonic: 7, bpm: 120, bars: 4, density: 0.5, voice: 'piano', tracks: ['melody'], transitionIn: 'hard', transitionBars: 1, pivotNote: true },
        { id: 'c', name: 'C', seed: 3, scale: 'major', tonic: 5, bpm: 120, bars: 4, density: 0.5, voice: 'piano', tracks: ['melody'], transitionIn: 'hard', transitionBars: 1, pivotNote: 'yes' },
      ],
    };
    const file = new File([JSON.stringify(payload)], 'p.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(payload), configurable: true });
    const input = document.getElementById('compose-load-file');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const saved = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(saved[1].pivotNote).toBe(true);
    expect(saved[2].pivotNote).toBe(false);     // non-boolean → false
  });

  it('older projects (no pivotNote field) backfill to false on load', async () => {
    localStorage.setItem('seedsong-compose-project', JSON.stringify([
      { id: 'a', name: 'A', seed: 1, scale: 'major', tonic: 0, bpm: 120, bars: 4, density: 0.5, voice: 'piano', tracks: ['melody'], transitionIn: 'hard', transitionBars: 1 },
      { id: 'b', name: 'B', seed: 2, scale: 'major', tonic: 7, bpm: 120, bars: 4, density: 0.5, voice: 'piano', tracks: ['melody'], transitionIn: 'hard', transitionBars: 1 },
    ]));
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.querySelectorAll('[data-action="toggle-edit"]')[1].click();
    const cb = document.querySelector('[data-edit="pivotNote"]');
    expect(cb.checked).toBe(false);
  });

  it('templates carry pivotNote when re-applied via the menu', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Pivot Bridge');
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-add').click();
    document.querySelectorAll('[data-action="toggle-edit"]')[1].click();
    const cb = document.querySelector('[data-edit="pivotNote"]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelectorAll('[data-action="save-template"]')[1].click();
    const savedTemplates = JSON.parse(localStorage.getItem('seedsong-compose-templates'));
    expect(savedTemplates[0].pivotNote).toBe(true);

    // Click the Pivot Bridge in the menu — new section should be created
    // with pivotNote = true.
    document.getElementById('compose-add-menu-btn').click();
    const btn = Array.from(document.querySelectorAll('.compose-add-menu-item'))
      .find(b => b.textContent === 'Pivot Bridge');
    btn.click();
    const proj = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(proj).toHaveLength(3);
    expect(proj[2].pivotNote).toBe(true);
  });
});

describe('Compose — pivot pitch selection', () => {
  it('C major → G major picks G (perfect fifth of incoming, common to both)', async () => {
    // C major:  C D E F G A B  → PCs {0,2,4,5,7,9,11}
    // G major:  G A B C D E F#  → PCs {7,9,11,0,2,4,6}
    // Common:  {0,2,4,7,9,11}
    // Score against tonic=7 (G):
    //   PC=7 → rel 0 → 100 (tonic)  ← wins
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    const payload = {
      format: 'seedsong-compose',
      version: 1,
      sections: [
        { id: 'a', name: 'A', seed: 1, scale: 'major', tonic: 0, bpm: 60, bars: 1, density: 0.5, voice: 'piano', tracks: ['melody'], transitionIn: 'hard', transitionBars: 1 },
        { id: 'b', name: 'B', seed: 2, scale: 'major', tonic: 7, bpm: 60, bars: 1, density: 0.5, voice: 'piano', tracks: ['melody'], transitionIn: 'hard', transitionBars: 1, pivotNote: true },
      ],
    };
    const file = new File([JSON.stringify(payload)], 't.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(payload), configurable: true });
    const input = document.getElementById('compose-load-file');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));

    const frequencies = [];
    function stub() {
      const n = {
        gain: {
          value: 1,
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        frequency: {
          _val: 0,
          set value(v) { frequencies.push(v); this._val = v; },
          get value() { return this._val; },
          setValueAtTime() {}, exponentialRampToValueAtTime() {},
        },
        type: 'sine', buffer: null,
        connect() { return n; }, disconnect() {},
        start() {}, stop() {},
        getChannelData() { return new Float32Array(100); },
      };
      return n;
    }
    globalThis.OfflineAudioContext = class {
      constructor(_ch, length, sampleRate) {
        this.destination = stub();
        this.currentTime = 0;
        this.sampleRate = sampleRate;
        this._length = length;
      }
      createGain() { return stub(); }
      createOscillator() { return stub(); }
      createBuffer() { return stub(); }
      createBufferSource() { return stub(); }
      createBiquadFilter() { return stub(); }
      startRendering() { return Promise.resolve({ length: 0, numberOfChannels: 2, sampleRate: 44100, getChannelData: () => new Float32Array(0) }); }
    };
    URL.createObjectURL = vi.fn().mockReturnValue('blob:fake');
    URL.revokeObjectURL = vi.fn();
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};

    document.getElementById('compose-export-mix').click();
    await new Promise(r => setTimeout(r, 80));

    // The pivot oscillator was given frequency = midiToFreq(60 + 7 + 12) = midiToFreq(79) = G5
    // midiToFreq(79) = 440 * 2^((79-69)/12) = 440 * 2^(10/12) ≈ 783.99 Hz
    const pivotFreq = frequencies.find(f => Math.abs(f - 783.99) < 1);
    expect(pivotFreq).toBeDefined();

    HTMLAnchorElement.prototype.click = origClick;
  });
});
