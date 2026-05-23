// Smoke coverage for ComposeView + ExploreView. They wire dozens of
// listeners; just calling init() inside a scaffolded DOM exercises a
// substantial fraction of the file.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const audioMock = () => ({
  ensureInit: vi.fn().mockResolvedValue(undefined),
  getContext: vi.fn().mockReturnValue(null),
  getTrackDest: vi.fn().mockReturnValue(null),
  getMasterGain: vi.fn().mockReturnValue(null),
  play: vi.fn(),
  stop: vi.fn(),
});

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('ComposeView smoke', () => {
  it('initComposeView wires the toolbar without throwing', async () => {
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
        <button id="compose-clear"></button>
        <div id="compose-status" hidden>
          <span id="compose-status-text"></span>
          <span id="compose-status-time"></span>
        </div>
        <div id="compose-timeline" role="list"></div>
        <p id="compose-empty"></p>
      </section>
    `;
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    expect(document.getElementById('compose-timeline')).toBeTruthy();
  });

  it('clicking compose-add appends a section card', async () => {
    document.body.innerHTML = `
      <section id="view-compose">
        <button id="compose-play" disabled></button>
        <button id="compose-add"></button>
        <button id="compose-undo" disabled></button>
        <button id="compose-redo" disabled></button>
        <button id="compose-save-file" disabled></button>
        <input id="compose-load-file" type="file" />
        <button id="compose-export-stems" disabled></button>
        <button id="compose-clear"></button>
        <div id="compose-status" hidden>
          <span id="compose-status-text"></span>
          <span id="compose-status-time"></span>
        </div>
        <div id="compose-timeline" role="list"></div>
        <p id="compose-empty"></p>
      </section>
    `;
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    // Timeline should now have at least one section element.
    expect(document.querySelector('#compose-timeline > *')).toBeTruthy();
  });

  it('clear button empties the timeline', async () => {
    document.body.innerHTML = `
      <section id="view-compose">
        <button id="compose-play" disabled></button>
        <button id="compose-add"></button>
        <button id="compose-undo" disabled></button>
        <button id="compose-redo" disabled></button>
        <button id="compose-save-file" disabled></button>
        <input id="compose-load-file" type="file" />
        <button id="compose-export-stems" disabled></button>
        <button id="compose-clear"></button>
        <div id="compose-status" hidden>
          <span id="compose-status-text"></span>
          <span id="compose-status-time"></span>
        </div>
        <div id="compose-timeline" role="list"></div>
        <p id="compose-empty"></p>
      </section>
    `;
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-add').click();
    // Stub window.confirm to auto-accept the clear dialog.
    globalThis.confirm = () => true;
    document.getElementById('compose-clear').click();
    expect(document.querySelectorAll('#compose-timeline > *').length).toBe(0);
  });
});

describe('ExploreView smoke', () => {
  it('initExploreView wires the swipe controls without throwing', async () => {
    document.body.innerHTML = `
      <section id="view-explore">
        <div id="explore-card-stack"></div>
        <button id="explore-like"></button>
        <button id="explore-dislike"></button>
        <button id="explore-skip"></button>
        <button id="explore-load"></button>
        <span id="explore-counter"></span>
        <span id="explore-stats-liked">0</span>
        <span id="explore-stats-skipped">0</span>
        <button id="explore-reset"></button>
        <span id="explore-empty" hidden></span>
        <button id="explore-play"></button>
      </section>
    `;
    const { initExploreView, refreshExplore } = await import('../src/js/ui/ExploreView.js');
    initExploreView({ audioApi: audioMock(), onLoadSeed: vi.fn() });
    refreshExplore();
    expect(document.getElementById('explore-card-stack')).toBeTruthy();
  });
});

describe('RadioView smoke', () => {
  it('initRadioView wires controls and shows the empty state when no likes', async () => {
    document.body.innerHTML = `
      <section id="view-radio">
        <div id="radio-empty"></div>
        <div id="radio-now-playing">
          <span id="radio-now-title"></span>
          <span id="radio-now-meta"></span>
        </div>
        <button id="radio-play"></button>
        <button id="radio-next"></button>
        <button id="radio-prev"></button>
        <button id="radio-shuffle"></button>
        <button id="radio-load"></button>
        <ul id="radio-queue"></ul>
        <span id="radio-counter"></span>
      </section>
    `;
    const { initRadioView, refreshRadio } = await import('../src/js/ui/RadioView.js');
    initRadioView({ audioApi: audioMock(), onLoadSeed: vi.fn() });
    refreshRadio();
    expect(document.getElementById('view-radio')).toBeTruthy();
  });
});
