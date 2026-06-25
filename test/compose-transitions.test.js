// Tests for the section-transition feature (ADR 0001).
import { describe, it, expect, beforeEach, vi } from 'vitest';

function scaffold() {
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
  scaffold();
  localStorage.clear();
  vi.resetModules();
});

describe('ComposeView — transitions (ADR 0001)', () => {
  it('newly-added section defaults to transitionIn: hard, transitionBars: 1', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    const saved = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(saved[0].transitionIn).toBe('hard');
    expect(saved[0].transitionBars).toBe(1);
  });

  it('first section does NOT show a transition picker (nothing to join into)', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.querySelector('[data-action="toggle-edit"]').click();
    expect(document.querySelector('[data-edit="transitionIn"]')).toBeFalsy();
  });

  it('second section shows transition picker; selecting crossfade persists', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-add').click();
    // Open editor on the second section.
    const editBtns = document.querySelectorAll('[data-action="toggle-edit"]');
    editBtns[1].click();
    const sel = document.querySelectorAll('[data-edit="transitionIn"]')[0];
    expect(sel).toBeTruthy();
    sel.value = 'crossfade';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const saved = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(saved[1].transitionIn).toBe('crossfade');
  });

  it('transitionBars slider live-updates its em label', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-add').click();
    document.querySelectorAll('[data-action="toggle-edit"]')[1].click();
    // Set the transitionIn to crossfade so the length field shows.
    const inSel = document.querySelectorAll('[data-edit="transitionIn"]')[0];
    inSel.value = 'crossfade';
    inSel.dispatchEvent(new Event('change', { bubbles: true }));
    // Re-open the editor (render re-mounts).
    document.querySelectorAll('[data-action="toggle-edit"]')[1].click();
    const slider = document.querySelector('[data-edit="transitionBars"]');
    slider.value = '4';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    const em = slider.closest('label').querySelector('em');
    expect(em.textContent).toBe('4 beats');
  });

  it('chip shows on the section header when transition is non-hard', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-add').click();
    // Initially no chip — both sections default to hard.
    expect(document.querySelectorAll('.section-meta-chip-transition').length).toBe(0);
    // Set the second section's transition to crossfade.
    document.querySelectorAll('[data-action="toggle-edit"]')[1].click();
    const inSel = document.querySelectorAll('[data-edit="transitionIn"]')[0];
    inSel.value = 'crossfade';
    inSel.dispatchEvent(new Event('change', { bubbles: true }));
    // Chip now visible on section 2 only.
    const chips = document.querySelectorAll('.section-meta-chip-transition');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toMatch(/Crossfade/);
  });

  it('gap transition adds silence to the total duration', async () => {
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    // Build two sections: each 4 bars at 120 BPM (4*4=16 beats * 0.5s = 8s)
    document.getElementById('compose-add').click();
    document.getElementById('compose-add').click();
    // Apply 4-beat gap to section 2.
    document.querySelectorAll('[data-action="toggle-edit"]')[1].click();
    const inSel = document.querySelectorAll('[data-edit="transitionIn"]')[0];
    inSel.value = 'gap';
    inSel.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelectorAll('[data-action="toggle-edit"]')[1].click();
    const slider = document.querySelector('[data-edit="transitionBars"]');
    slider.value = '4';
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    const saved = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(saved[1].transitionIn).toBe('gap');
    expect(saved[1].transitionBars).toBe(4);
  });

  it('legacy projects (no transition fields) backfill to hard/1 in memory', async () => {
    localStorage.setItem('seedsong-compose-project', JSON.stringify([
      { id: 'legacy1', name: 'A', seed: 7, scale: 'major', tonic: 0, bpm: 110, bars: 4, density: 0.5, voice: 'piano', tracks: ['melody'] },
      { id: 'legacy2', name: 'B', seed: 8, scale: 'major', tonic: 0, bpm: 110, bars: 4, density: 0.5, voice: 'piano', tracks: ['melody'] },
    ]));
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    // Open the second section's editor; the transitionIn selector should
    // be present with 'hard' selected (legacy backfill default).
    document.querySelectorAll('[data-action="toggle-edit"]')[1].click();
    const sel = document.querySelector('[data-edit="transitionIn"]');
    expect(sel).toBeTruthy();
    expect(sel.value).toBe('hard');
    // No transition chip should appear for the legacy project.
    expect(document.querySelectorAll('.section-meta-chip-transition').length).toBe(0);
  });

  it('transition fields round-trip through the file save/load format', async () => {
    // Intercept the Blob's constructor source to capture the JSON
    // payload without depending on jsdom's Blob.text() implementation.
    let payloadJson = null;
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    URL.revokeObjectURL = vi.fn();
    const origBlob = globalThis.Blob;
    globalThis.Blob = class Blob extends origBlob {
      constructor(parts, opts) {
        super(parts, opts);
        // Compose's downloadProject builds a Blob from a single JSON string.
        if (Array.isArray(parts) && typeof parts[0] === 'string') payloadJson = parts[0];
      }
    };
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};

    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.getElementById('compose-add').click();
    document.querySelectorAll('[data-action="toggle-edit"]')[1].click();
    const inSel = document.querySelectorAll('[data-edit="transitionIn"]')[0];
    inSel.value = 'crossfade';
    inSel.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('compose-save-file').click();
    expect(payloadJson).toContain('"transitionIn"');
    expect(payloadJson).toContain('"crossfade"');

    globalThis.Blob = origBlob;
    HTMLAnchorElement.prototype.click = origClick;
  });
});
