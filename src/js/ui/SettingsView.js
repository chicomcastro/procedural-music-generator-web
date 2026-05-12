import { getLang, setLang, getSupportedLanguages } from '../i18n/i18n.js';
import { applyTheme } from './Theme.js';

const ALL_KEYS = [
  'seedsong-history',
  'seedsong-settings',
  'seedsong-compose-project',
  'seedsong-learn-progress',
  'seedsong-learn-streak',
  'seedsong-learn-recordings',
  'seedsong-explore-feedback',
  'seedsong-onboarding-done',
  'seedsong-install-dismissed',
  'seedsong-theme',
  'seedsong-lang',
];

function refreshLanguageButtons() {
  const cur = getLang();
  document.querySelectorAll('#settings-language .settings-lang').forEach(btn => {
    const active = btn.dataset.lang === cur;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', active ? 'true' : 'false');
  });
}

function refreshThemeButtons() {
  const stored = localStorage.getItem('seedsong-theme') || 'dark';
  document.querySelectorAll('#settings-theme .settings-theme-btn').forEach(btn => {
    const active = btn.dataset.theme === stored;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', active ? 'true' : 'false');
  });
}

function setTheme(theme) {
  applyTheme(theme === 'light' ? 'light' : 'dark');
  refreshThemeButtons();
}

function downloadAllData() {
  const data = {};
  for (const key of ALL_KEYS) {
    const v = localStorage.getItem(key);
    if (v == null) continue;
    try { data[key] = JSON.parse(v); }
    catch { data[key] = v; }
  }
  data._exportedAt = new Date().toISOString();
  data._app = 'SeedSong';
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `seedsong-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

function resetAllData() {
  if (!window.confirm('Reset all SeedSong data? This cannot be undone.')) return;
  for (const key of ALL_KEYS) localStorage.removeItem(key);
  window.location.reload();
}

export function initSettingsView() {
  const langWrap = document.getElementById('settings-language');
  if (langWrap) {
    refreshLanguageButtons();
    langWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.settings-lang');
      if (!btn) return;
      setLang(btn.dataset.lang);
      refreshLanguageButtons();
    });
    getSupportedLanguages();
  }

  const themeWrap = document.getElementById('settings-theme');
  if (themeWrap) {
    refreshThemeButtons();
    themeWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.settings-theme-btn');
      if (!btn) return;
      setTheme(btn.dataset.theme);
    });
  }

  document.getElementById('settings-download')?.addEventListener('click', downloadAllData);
  document.getElementById('settings-reset')?.addEventListener('click', resetAllData);
}
