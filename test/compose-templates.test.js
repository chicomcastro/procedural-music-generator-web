// Tests for custom user templates (PR D).
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

describe('Compose — custom templates', () => {
  it('save-template prompts for a name and persists to localStorage', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('My Bridge');
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.querySelector('[data-action="save-template"]').click();

    expect(promptSpy).toHaveBeenCalled();
    const saved = JSON.parse(localStorage.getItem('seedsong-compose-templates'));
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('My Bridge');
    expect(saved[0].id).toMatch(/^t/);
    // Seed should NOT be saved on the template — it's a fresh roll per use.
    expect(saved[0].seed).toBeUndefined();
    promptSpy.mockRestore();
  });

  it('cancelling the prompt leaves storage untouched', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.querySelector('[data-action="save-template"]').click();
    expect(localStorage.getItem('seedsong-compose-templates')).toBeNull();
  });

  it('clicking the ▾ menu shows built-ins + saved templates', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Funky Verse');
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.querySelector('[data-action="save-template"]').click();
    // Open menu
    document.getElementById('compose-add-menu-btn').click();
    const items = document.querySelectorAll('.compose-add-menu-item');
    const names = Array.from(items).map(b => b.textContent);
    expect(names).toEqual(expect.arrayContaining(['Intro', 'Verse', 'Chorus', 'Bridge', 'Outro', 'Funky Verse']));
  });

  it('clicking a custom template in the menu adds a section with those params', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Bass-only Outro');
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    // Build a section we'll save: tonic = 7 (G), tracks = ['bass'] only.
    document.getElementById('compose-add').click();
    document.querySelector('[data-action="toggle-edit"]').click();
    const tonic = document.querySelector('[data-edit="tonic"]');
    tonic.value = '7';
    tonic.dispatchEvent(new Event('change', { bubbles: true }));
    // Disable all tracks except bass via the chip clicks.
    document.querySelector('[data-track="melody"]').click();
    document.querySelector('[data-track="chord"]').click();
    document.querySelector('[data-track="drum"]').click();
    document.querySelector('[data-action="save-template"]').click();

    // Now open the menu and click "Bass-only Outro" to add a new section.
    document.getElementById('compose-add-menu-btn').click();
    const customBtn = Array.from(document.querySelectorAll('.compose-add-menu-item'))
      .find(b => b.textContent === 'Bass-only Outro');
    customBtn.click();

    const proj = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(proj).toHaveLength(2);
    expect(proj[1].name).toBe('Bass-only Outro');
    expect(proj[1].tonic).toBe(7);
    expect(proj[1].tracks).toEqual(['bass']);
    // Seed differs from the source section's seed — fresh roll.
    expect(proj[1].seed).not.toBe(proj[0].seed);
  });

  it('removing a custom template strips it from storage + menu', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Disposable');
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.querySelector('[data-action="save-template"]').click();
    document.getElementById('compose-add-menu-btn').click();
    expect(document.querySelectorAll('.compose-add-menu-remove').length).toBe(1);
    document.querySelector('.compose-add-menu-remove').click();
    expect(JSON.parse(localStorage.getItem('seedsong-compose-templates'))).toEqual([]);
    expect(document.querySelectorAll('.compose-add-menu-remove').length).toBe(0);
  });

  it('built-in template + custom template both produce new sections via the menu', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Quiet Bridge');
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add').click();
    document.querySelector('[data-action="save-template"]').click();

    document.getElementById('compose-add-menu-btn').click();
    // Click "Chorus" built-in.
    Array.from(document.querySelectorAll('.compose-add-menu-item'))
      .find(b => b.textContent === 'Chorus').click();
    // Re-open menu (it closes after a click).
    document.getElementById('compose-add-menu-btn').click();
    Array.from(document.querySelectorAll('.compose-add-menu-item'))
      .find(b => b.textContent === 'Quiet Bridge').click();

    const proj = JSON.parse(localStorage.getItem('seedsong-compose-project'));
    expect(proj).toHaveLength(3);
    expect(proj[1].name).toBe('Chorus');
    expect(proj[2].name).toBe('Quiet Bridge');
  });

  it('clicking outside the menu closes it', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Foo');
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add-menu-btn').click();
    expect(document.getElementById('compose-add-menu').hidden).toBe(false);
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('compose-add-menu').hidden).toBe(true);
  });

  it('templates persist across sessions (boot reads localStorage)', async () => {
    localStorage.setItem('seedsong-compose-templates', JSON.stringify([
      { id: 't_external', name: 'From file', scale: 'dorian', tonic: 5, bpm: 90, bars: 8, density: 0.5, voice: 'pad', tracks: ['melody'], transitionIn: 'crossfade', transitionBars: 2 },
    ]));
    const { initComposeView } = await import('../src/js/ui/ComposeView.js');
    initComposeView({ onLoadSeed: vi.fn(), audioApi: audioMock() });
    document.getElementById('compose-add-menu-btn').click();
    const names = Array.from(document.querySelectorAll('.compose-add-menu-item')).map(b => b.textContent);
    expect(names).toContain('From file');
  });
});
