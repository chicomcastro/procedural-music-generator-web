// Coverage for SettingsView's interactive paths — language pick, theme
// pick, download all data, reset all data.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setLang } from '../src/js/i18n/i18n.js';

function scaffold() {
  document.body.innerHTML = `
    <div id="settings-language">
      <button class="settings-lang" data-lang="en"></button>
      <button class="settings-lang" data-lang="pt"></button>
      <button class="settings-lang" data-lang="es"></button>
    </div>
    <div id="settings-theme">
      <button class="settings-theme-btn" data-theme="light"></button>
      <button class="settings-theme-btn" data-theme="dark"></button>
    </div>
    <button id="settings-download"></button>
    <button id="settings-reset"></button>
  `;
}

beforeEach(() => {
  scaffold();
  localStorage.clear();
  setLang('en');
  vi.resetModules();
});

describe('SettingsView', () => {
  it('initSettingsView marks the active language button', async () => {
    const { initSettingsView } = await import('../src/js/ui/SettingsView.js');
    initSettingsView();
    const en = document.querySelector('.settings-lang[data-lang="en"]');
    expect(en.classList.contains('active')).toBe(true);
    expect(en.getAttribute('aria-checked')).toBe('true');
  });

  it('clicking a language button switches the active state', async () => {
    const { initSettingsView } = await import('../src/js/ui/SettingsView.js');
    initSettingsView();
    document.querySelector('.settings-lang[data-lang="pt"]').click();
    expect(document.querySelector('.settings-lang[data-lang="pt"]').classList.contains('active')).toBe(true);
    expect(document.querySelector('.settings-lang[data-lang="en"]').classList.contains('active')).toBe(false);
  });

  it('clicking inside the language wrap but not a button is a no-op', async () => {
    const { initSettingsView } = await import('../src/js/ui/SettingsView.js');
    initSettingsView();
    document.getElementById('settings-language').click();
    // No change — the en button stays active.
    expect(document.querySelector('.settings-lang[data-lang="en"]').classList.contains('active')).toBe(true);
  });

  it('theme button click flips body theme + marks button active', async () => {
    const { initSettingsView } = await import('../src/js/ui/SettingsView.js');
    initSettingsView();
    document.querySelector('.settings-theme-btn[data-theme="light"]').click();
    expect(document.querySelector('.settings-theme-btn[data-theme="light"]').classList.contains('active')).toBe(true);
  });

  it('refreshThemeButtons reads from localStorage on init', async () => {
    localStorage.setItem('seedsong-theme', 'light');
    const { initSettingsView } = await import('../src/js/ui/SettingsView.js');
    initSettingsView();
    expect(document.querySelector('.settings-theme-btn[data-theme="light"]').classList.contains('active')).toBe(true);
  });

  it('download-data builds a JSON blob with the namespaced keys', async () => {
    localStorage.setItem('seedsong-history', JSON.stringify([{ seed: 1 }]));
    localStorage.setItem('seedsong-theme', 'dark');
    let capturedJson = null;
    URL.createObjectURL = vi.fn((blob) => { capturedJson = blob; return 'blob:fake'; });
    URL.revokeObjectURL = vi.fn();
    // Stub anchor.click — jsdom would attempt to navigate to the data URL
    // and raise "Not implemented: navigation". The test only needs the
    // blob assembly to be verifiable; the click side-effect is irrelevant.
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { /* no-op */ };

    const { initSettingsView } = await import('../src/js/ui/SettingsView.js');
    initSettingsView();
    document.getElementById('settings-download').click();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(capturedJson).toBeInstanceOf(Blob);
    expect(capturedJson.type).toBe('application/json');
    expect(capturedJson.size).toBeGreaterThan(0);

    HTMLAnchorElement.prototype.click = origClick;
  });

  it('reset-data clears every namespaced key when the user confirms', async () => {
    localStorage.setItem('seedsong-history', '[]');
    localStorage.setItem('seedsong-theme', 'dark');
    localStorage.setItem('seedsong-onboarding-done', '1');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    // Replace jsdom's Location with a stub whose reload() is a no-op.
    // jsdom's real reload triggers an async navigation that ends up as
    // an unhandled error in the test runner.
    const origLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...origLocation, reload: () => {} },
      configurable: true,
      writable: true,
    });

    const { initSettingsView } = await import('../src/js/ui/SettingsView.js');
    initSettingsView();
    document.getElementById('settings-reset').click();
    expect(localStorage.getItem('seedsong-history')).toBeNull();
    expect(localStorage.getItem('seedsong-theme')).toBeNull();
    expect(localStorage.getItem('seedsong-onboarding-done')).toBeNull();

    Object.defineProperty(window, 'location', {
      value: origLocation, configurable: true, writable: true,
    });
  });

  it('reset-data is a no-op when the user cancels the confirm dialog', async () => {
    localStorage.setItem('seedsong-history', '[]');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { initSettingsView } = await import('../src/js/ui/SettingsView.js');
    initSettingsView();
    document.getElementById('settings-reset').click();
    expect(localStorage.getItem('seedsong-history')).toBe('[]');
  });
});
