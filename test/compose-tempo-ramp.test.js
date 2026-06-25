// Tests for tempo-ramp transitions (ADR 0002).
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

describe('Compose — tempo ramps (ADR 0002)', () => {
  it('tempo-ramp is offered as a transition option from section 2 on', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-add').click();
    document.querySelectorAll('[data-action="toggle-edit"]')[1].click();
    const select = document.querySelector('[data-edit="transitionIn"]');
    const values = Array.from(select.querySelectorAll('option')).map(o => o.value);
    expect(values).toEqual(['hard', 'crossfade', 'gap', 'tempo-ramp']);
  });

  it('selecting tempo-ramp persists + chip displays "Tempo ramp"', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-add').click();
    document.querySelectorAll('[data-action="toggle-edit"]')[1].click();
    const sel = document.querySelector('[data-edit="transitionIn"]');
    sel.value = 'tempo-ramp';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const saved = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(saved[1].transitionIn).toBe('tempo-ramp');
    const chip = document.querySelector('.section-meta-chip-transition');
    expect(chip.textContent).toMatch(/Tempo ramp/);
  });

  it('legacy invalid transitionIn falls back to hard on file load', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    // Synthesise a file-load with an unknown transition type.
    const payload = {
      format: 'seedsong-compose',
      version: 1,
      sections: [
        { id: 'a', name: 'A', seed: 1, scale: 'major', tonic: 0, bpm: 110, bars: 4, density: 0.5, voice: 'piano', tracks: ['melody'], transitionIn: 'hard', transitionBars: 1 },
        { id: 'b', name: 'B', seed: 2, scale: 'major', tonic: 0, bpm: 130, bars: 4, density: 0.5, voice: 'piano', tracks: ['melody'], transitionIn: 'gibberish', transitionBars: 4 },
      ],
    };
    const file = new File([JSON.stringify(payload)], 't.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(payload), configurable: true });
    const input = document.getElementById('compose-load-file');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const saved = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(saved[1].transitionIn).toBe('hard');
  });

  it('tempo-ramp transitionIn accepted via file load', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    const payload = {
      format: 'seedsong-compose',
      version: 1,
      sections: [
        { id: 'a', name: 'A', seed: 1, scale: 'major', tonic: 0, bpm: 110, bars: 4, density: 0.5, voice: 'piano', tracks: ['melody'], transitionIn: 'hard', transitionBars: 1 },
        { id: 'b', name: 'B', seed: 2, scale: 'major', tonic: 0, bpm: 130, bars: 4, density: 0.5, voice: 'piano', tracks: ['melody'], transitionIn: 'tempo-ramp', transitionBars: 4 },
      ],
    };
    const file = new File([JSON.stringify(payload)], 't.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(payload), configurable: true });
    const input = document.getElementById('compose-load-file');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const saved = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(saved[1].transitionIn).toBe('tempo-ramp');
    expect(saved[1].transitionBars).toBe(4);
  });
});

// Direct test of the math via a tiny module that re-exports the helpers
// is too invasive — they're internal. Instead, exercise the integral
// property: total duration should match (60K/Δbpm)*ln(bpm1/bpm0) when
// applicable. We approximate via the mix renderer's totalSec.
describe('Compose — tempo-ramp duration math', () => {
  it('a ramp from 120 → 60 over 4 beats extends the section length', async () => {
    // Section A at 120 bpm × 8 bars × 4 = 32 beats → 32 * 0.5 = 16s
    // Last 4 beats ramp from 120 (bd0=0.5) to 60 (bd1=1.0). Closed form:
    //   t(4) = 0.5*4 + (1.0-0.5)*16/(2*4) = 2 + 1 = 3s (vs 2s at constant 120)
    // So the section total is 16 - 2 + 3 = 17s.
    // Section B at 60 bpm × 4 bars × 4 = 16 beats → 16 * 1.0 = 16s
    // Total: 17 + 16 = 33s.
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    const payload = {
      format: 'seedsong-compose',
      version: 1,
      sections: [
        { id: 'a', name: 'A', seed: 1, scale: 'major', tonic: 0, bpm: 120, bars: 8, density: 0.5, voice: 'piano', tracks: ['melody'], transitionIn: 'hard', transitionBars: 1 },
        { id: 'b', name: 'B', seed: 2, scale: 'major', tonic: 0, bpm: 60, bars: 4, density: 0.5, voice: 'piano', tracks: ['melody'], transitionIn: 'tempo-ramp', transitionBars: 4 },
      ],
    };
    const file = new File([JSON.stringify(payload)], 't.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(payload), configurable: true });
    const input = document.getElementById('compose-load-file');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));

    // Mock OfflineAudioContext to capture the total length passed in.
    const lengths = [];
    function stub() {
      const n = { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: 'sine', buffer: null, connect() { return n; }, disconnect() {}, start() {}, stop() {}, getChannelData() { return new Float32Array(100); } };
      return n;
    }
    globalThis.OfflineAudioContext = class {
      constructor(_ch, length, sampleRate) {
        lengths.push({ length, sampleRate });
        this.destination = stub();
        this.currentTime = 0;
        this.sampleRate = sampleRate;
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

    // Total = 33s + 1.5s tail = 34.5s. sampleRate 44100. Expect ~34.5 * 44100.
    expect(lengths.length).toBeGreaterThan(0);
    const lengthSec = lengths[0].length / lengths[0].sampleRate;
    expect(lengthSec).toBeCloseTo(34.5, 0);   // within ±1s tolerance

    HTMLAnchorElement.prototype.click = origClick;
  });
});
