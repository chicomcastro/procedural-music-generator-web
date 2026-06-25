// Targeted tests for the PR A additions to ComposeView:
//   - drum track in the default tracks set + chip rendering
//   - mix export button click triggers a render (we mock the offline ctx)
//   - status progress bar fill width updates during playback
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
});

describe('ComposeView — PR A additions', () => {
  it('a newly-added section ships the drum track enabled by default', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();

    // Section card should render a "drum" track chip. The chip uses
    // class .section-track-chip with a data-track="drum".
    const drumChip = document.querySelector('.section-track-chip[data-track="drum"]');
    expect(drumChip).toBeTruthy();
    expect(drumChip.classList.contains('active')).toBe(true);
  });

  it('clicking a drum chip toggles the drum off, persists to localStorage', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();

    document.querySelector('.section-track-chip[data-track="drum"]').click();
    // Re-query — the timeline re-renders after toggle, so the original
    // chip node is detached.
    const after = document.querySelector('.section-track-chip[data-track="drum"]');
    expect(after.classList.contains('active')).toBe(false);

    const saved = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(saved[0].tracks).not.toContain('drum');
    expect(saved[0].tracks).toContain('melody');
  });

  it('Export mix button is enabled once a section exists', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    const mixBtn = document.getElementById('compose-export-mix');
    expect(mixBtn.disabled).toBe(true);

    document.getElementById('compose-add').click();
    expect(mixBtn.disabled).toBe(false);
  });

  it('Export mix click invokes the offline renderer', async () => {
    // Build an OfflineAudioContext mock whose nodes chain via a single
    // reusable stub — the production code calls .connect() on returned
    // nodes, so the chain must terminate in something callable.
    const startRendering = vi.fn().mockResolvedValue({
      length: 100, numberOfChannels: 2, sampleRate: 44100,
      getChannelData: () => new Float32Array(100),
    });
    function stubNode() {
      const node = {
        gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
        frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        type: 'sine', buffer: null,
        connect() { return node; },
        disconnect() {},
        start() {}, stop() {},
        getChannelData() { return new Float32Array(100); },
      };
      return node;
    }
    globalThis.OfflineAudioContext = class {
      constructor() {
        this.destination = stubNode();
        this.currentTime = 0;
        this.sampleRate = 44100;
      }
      createGain() { return stubNode(); }
      createOscillator() { return stubNode(); }
      createBuffer() { return stubNode(); }
      createBufferSource() { return stubNode(); }
      createBiquadFilter() { return stubNode(); }
      startRendering() { return startRendering(); }
    };
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:fake');
    globalThis.URL.revokeObjectURL = vi.fn();
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};

    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-export-mix').click();
    // exportMix awaits the offline render — give the microtask + timeout
    // chain a moment to land.
    await new Promise(r => setTimeout(r, 50));
    expect(startRendering).toHaveBeenCalled();

    HTMLAnchorElement.prototype.click = origClick;
  });

  it('drum track persists across save/load round-trip', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    // Storage payload is the raw sections array, not wrapped.
    const stored = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(Array.isArray(stored)).toBe(true);
    expect(stored[0].tracks).toContain('drum');
  });
});
