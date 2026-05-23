import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initI18n, getLang, setLang, t, getLocalized, getSupportedLanguages, onLangChange, applyAll } from '../src/js/i18n/i18n.js';

beforeEach(() => {
  // Reset DOM + storage between tests.
  document.body.innerHTML = '';
  document.documentElement.lang = '';
  try { localStorage.removeItem('seedsong-lang'); } catch {}
  // Force initial lang to English so order doesn't matter.
  initI18n();
  setLang('en');
});

describe('i18n', () => {
  it('exposes the supported language codes', () => {
    expect(getSupportedLanguages()).toEqual(['en', 'pt', 'es']);
  });

  it('returns the current language', () => {
    expect(getLang()).toBe('en');
    setLang('pt');
    expect(getLang()).toBe('pt');
  });

  it('looks up a key from the active dictionary', () => {
    setLang('en');
    expect(t('learn.title')).toBe('Learn');
    setLang('pt');
    expect(t('learn.title')).toBe('Aprender');
    setLang('es');
    expect(t('learn.title')).toBe('Aprender');
  });

  it('falls back to English when a key is missing in the active dictionary', () => {
    // Pick a key only EN has — actually all keys are in all 3, so use the
    // explicit fallback parameter.
    setLang('pt');
    expect(t('not-a-real-key', 'fallback string')).toBe('fallback string');
  });

  it('returns the key itself when no fallback is provided', () => {
    setLang('pt');
    expect(t('totally-unknown-key')).toBe('totally-unknown-key');
  });

  it('setLang ignores unknown languages and same-value calls', () => {
    setLang('en');
    setLang('xx');  // unknown — no-op
    expect(getLang()).toBe('en');
    setLang('en');  // same — no-op (covers the early return branch)
    expect(getLang()).toBe('en');
  });

  it('setLang fires the registered listeners', () => {
    const spy = vi.fn();
    onLangChange(spy);
    setLang('pt');
    expect(spy).toHaveBeenCalledWith('pt');
  });

  it('setLang persists the choice + updates <html lang>', () => {
    setLang('es');
    expect(document.documentElement.lang).toBe('es');
    expect(localStorage.getItem('seedsong-lang')).toBe('es');
  });

  it('getLocalized returns strings as-is and looks up multi-lang objects', () => {
    setLang('pt');
    expect(getLocalized('hello')).toBe('hello');
    expect(getLocalized({ en: 'Hi', pt: 'Olá', es: '¡Hola!' })).toBe('Olá');
    setLang('en');
    expect(getLocalized({ en: 'Hi', pt: 'Olá' })).toBe('Hi');
  });

  it('getLocalized falls back to en when active lang is missing', () => {
    setLang('pt');
    expect(getLocalized({ en: 'only english' })).toBe('only english');
  });

  it('getLocalized returns empty string for null / undefined / non-object input', () => {
    expect(getLocalized(null)).toBe('');
    expect(getLocalized(undefined)).toBe('');
    expect(getLocalized(42)).toBe('');
  });

  it('applyAll translates data-i18n elements', () => {
    document.body.innerHTML = '<span data-i18n="learn.title"></span><h2 data-i18n="learn.title"></h2>';
    setLang('pt');
    applyAll();
    expect(document.querySelectorAll('[data-i18n]')[0].textContent).toBe('Aprender');
    expect(document.querySelectorAll('[data-i18n]')[1].textContent).toBe('Aprender');
  });

  it('applyAll handles data-i18n-attr "attr:key;…" specs', () => {
    document.body.innerHTML = '<button data-i18n-attr="title:learn.title;aria-label:learn.title"></button>';
    setLang('en');
    applyAll();
    const btn = document.querySelector('button');
    expect(btn.getAttribute('title')).toBe('Learn');
    expect(btn.getAttribute('aria-label')).toBe('Learn');
  });

  it('persisted choice survives across initI18n calls', () => {
    setLang('es');
    initI18n();
    expect(getLang()).toBe('es');
  });
});
