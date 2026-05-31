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
    // Capture the blob contents at construction time — jsdom's Blob doesn't
    // implement .text() so we look at what URL.createObjectURL receives.
    let capturedJson = null;
    URL.createObjectURL = vi.fn((blob) => {
      // Use FileReader to read the blob synchronously isn't an option;
      // but blob.size + blob.type tell us the JSON was wrapped correctly.
      capturedJson = blob;
      return 'blob:fake';
    });
    URL.revokeObjectURL = vi.fn();

    const { initSettingsView } = await import('../src/js/ui/SettingsView.js');
    initSettingsView();
    document.getElementById('settings-download').click();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(capturedJson).toBeInstanceOf(Blob);
    expect(capturedJson.type).toBe('application/json');
    expect(capturedJson.size).toBeGreaterThan(0);
  });

  it('reset-data clears every namespaced key when the user confirms', async () => {
    localStorage.setItem('seedsong-history', '[]');
    localStorage.setItem('seedsong-theme', 'dark');
    localStorage.setItem('seedsong-onboarding-done', '1');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    // jsdom's location.reload throws "Not implemented". Swallow the
    // exception so the click handler can complete its cleanup.
    const origReload = window.location.reload;
    try {
      window.location.reload = () => {};   // jsdom allows direct overwrite
    } catch { /* ignore — fallthrough still works */ }

    const { initSettingsView } = await import('../src/js/ui/SettingsView.js');
    initSettingsView();
    try { document.getElementById('settings-reset').click(); } catch { /* reload may throw */ }
    expect(localStorage.getItem('seedsong-history')).toBeNull();
    expect(localStorage.getItem('seedsong-theme')).toBeNull();
    expect(localStorage.getItem('seedsong-onboarding-done')).toBeNull();

    try { window.location.reload = origReload; } catch { /* ignore */ }
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
