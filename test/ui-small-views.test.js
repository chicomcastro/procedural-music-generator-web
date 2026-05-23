// Aggregate smoke tests for the small UI helpers: Theme, Shortcuts,
// Gallery, History, SettingsView, Onboarding. Each is small enough that
// a few flows cover ~all of its branches.
//
// We use `vi.resetModules()` between tests so each one gets a fresh module
// instance — important for files like Theme.js that capture a DOM ref at
// top-level import.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setLang } from '../src/js/i18n/i18n.js';

beforeEach(() => {
  document.documentElement.innerHTML = '<head><meta name="theme-color"></head><body></body>';
  localStorage.clear();
  setLang('en');
  vi.resetModules();
});

describe('Theme', () => {
  it('initTheme applies the saved theme and toggle flips it', async () => {
    document.body.innerHTML = '<button id="theme-toggle">☾</button>';
    localStorage.setItem('seedsong-theme', 'light');
    const { initTheme } = await import('../src/js/ui/Theme.js');
    const onToggle = vi.fn();
    initTheme(onToggle);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]').content).toBe('#f6f8fa');
    document.getElementById('theme-toggle').click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(onToggle).toHaveBeenCalled();
  });

  it('applyTheme persists the theme name', async () => {
    document.body.innerHTML = '<button id="theme-toggle"></button>';
    const { applyTheme } = await import('../src/js/ui/Theme.js');
    applyTheme('light');
    expect(localStorage.getItem('seedsong-theme')).toBe('light');
    applyTheme('dark');
    expect(localStorage.getItem('seedsong-theme')).toBe('dark');
  });
});

describe('Shortcuts', () => {
  function scaffold() {
    document.body.innerHTML = `
      <button id="shortcuts-btn"></button>
      <div id="shortcuts-overlay" class="hidden">
        <button id="close-shortcuts"></button>
      </div>
    `;
  }

  it('initShortcuts maps Space → onPlay, Escape → onStop, r → onRandomize', async () => {
    scaffold();
    const { initShortcuts } = await import('../src/js/ui/Shortcuts.js');
    const handlers = { onPlay: vi.fn(), onStop: vi.fn(), onRandomize: vi.fn() };
    initShortcuts(handlers);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(handlers.onPlay).toHaveBeenCalled();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(handlers.onStop).toHaveBeenCalled();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    expect(handlers.onRandomize).toHaveBeenCalled();
  });

  it('? toggles the shortcuts overlay', async () => {
    scaffold();
    const { initShortcuts } = await import('../src/js/ui/Shortcuts.js');
    initShortcuts({ onPlay: vi.fn(), onStop: vi.fn(), onRandomize: vi.fn() });
    const overlay = document.getElementById('shortcuts-overlay');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    expect(overlay.classList.contains('hidden')).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(overlay.classList.contains('hidden')).toBe(true);
  });

  it('ignores shortcut keys when focus is inside an input', async () => {
    scaffold();
    const { initShortcuts } = await import('../src/js/ui/Shortcuts.js');
    const onPlay = vi.fn();
    initShortcuts({ onPlay, onStop: vi.fn(), onRandomize: vi.fn() });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(onPlay).not.toHaveBeenCalled();
  });
});

describe('Gallery', () => {
  it('initGallery renders one card per gallery entry and dispatches on click', async () => {
    document.body.innerHTML = '<div id="gallery-list"></div>';
    const { initGallery } = await import('../src/js/ui/Gallery.js');
    const onLoadSeed = vi.fn();
    initGallery({ onLoadSeed });
    const cards = document.querySelectorAll('.gallery-card');
    expect(cards.length).toBeGreaterThanOrEqual(10);
    cards[0].click();
    expect(onLoadSeed).toHaveBeenCalledOnce();
    expect(onLoadSeed.mock.calls[0][0]).toHaveProperty('seed');
  });
});

describe('History', () => {
  it('saveHistory + getHistory round-trip', async () => {
    const { saveHistory, getHistory } = await import('../src/js/ui/History.js');
    const entries = [{ id: 1, label: 'one' }, { id: 2, label: 'two' }];
    saveHistory(entries);
    expect(getHistory()).toEqual(entries);
  });

  it('setLastSaved feeds checkUnsaved (DOM-driven; just smoke-cover the branches)', async () => {
    document.body.innerHTML = `
      <div id="history-list"></div>
      <div id="history-empty"></div>
      <button id="clear-history"></button>
      <input id="song-name" />
      <button id="save-btn"></button>
      <span id="save-hint"></span>
      <span id="unsaved-dot" hidden></span>
    `;
    const { setLastSaved, checkUnsaved, initHistory } = await import('../src/js/ui/History.js');
    initHistory({ onLoadEntry: vi.fn(), snapshotFn: () => ({ seed: 1, scale: 'major' }), labelsFn: () => ({}) });
    setLastSaved({ seed: 1, scale: 'major' });
    checkUnsaved();
    expect(document.getElementById('save-hint').classList.contains('unsaved')).toBe(false);
    setLastSaved({ seed: 9, scale: 'major' });
    checkUnsaved();
    expect(document.getElementById('save-hint').classList.contains('unsaved')).toBe(true);
  });

  it('initHistory wires up its containers without throwing', async () => {
    document.body.innerHTML = `
      <div id="history-list"></div>
      <div id="history-empty"></div>
      <button id="clear-history"></button>
      <input id="song-name" />
      <button id="save-btn"></button>
      <span id="save-hint"></span>
      <span id="unsaved-dot"></span>
    `;
    const { initHistory } = await import('../src/js/ui/History.js');
    const onLoadEntry = vi.fn();
    initHistory({ onLoadEntry, snapshotFn: () => ({ seed: 1 }), labelsFn: () => ({ subtitle: 'lbl' }) });
    // initHistory should have wired listeners on the inputs without throwing.
    expect(document.getElementById('song-name')).toBeTruthy();
  });
});

describe('SettingsView', () => {
  it('initSettingsView wires the controls without throwing', async () => {
    document.body.innerHTML = `
      <div id="view-settings">
        <select id="settings-language">
          <option value="en">EN</option>
          <option value="pt">PT</option>
          <option value="es">ES</option>
        </select>
        <button id="settings-theme-dark"></button>
        <button id="settings-theme-light"></button>
        <button id="settings-download"></button>
        <button id="settings-reset"></button>
      </div>
    `;
    const { initSettingsView } = await import('../src/js/ui/SettingsView.js');
    initSettingsView();
    expect(document.getElementById('settings-language')).toBeTruthy();
  });
});

describe('Onboarding', () => {
  it('shouldShowOnboarding reads the localStorage marker', async () => {
    const { shouldShowOnboarding } = await import('../src/js/ui/Onboarding.js');
    expect(shouldShowOnboarding()).toBe(true);
    localStorage.setItem('seedsong-onboarding-done', '1');
    expect(shouldShowOnboarding()).toBe(false);
  });

  it('startOnboarding mounts a backdrop + card without throwing', async () => {
    const { startOnboarding } = await import('../src/js/ui/Onboarding.js');
    const onFinish = vi.fn();
    startOnboarding({ onFinish });
    expect(document.querySelector('.onboarding-backdrop')).toBeTruthy();
    expect(document.querySelector('.onboarding-card')).toBeTruthy();
  });
});
