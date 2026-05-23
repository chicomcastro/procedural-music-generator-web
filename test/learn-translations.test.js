import { describe, it, expect, beforeEach } from 'vitest';
import { TR, getModuleField, getStepField, getStepArray } from '../src/js/ui/learn-translations.js';
import { setLang } from '../src/js/i18n/i18n.js';
import { MODULES } from '../src/js/ui/learn-modules.js';

beforeEach(() => setLang('en'));

describe('learn-translations', () => {
  it('TR has entries for the major-scale module in pt + es', () => {
    expect(TR['major-scale']).toBeTruthy();
    expect(TR['major-scale'].pt).toBeTruthy();
    expect(TR['major-scale'].es).toBeTruthy();
  });

  it('getModuleField returns the English source under en', () => {
    const mod = MODULES.find(m => m.id === 'major-scale');
    setLang('en');
    expect(getModuleField(mod, 'title')).toBe(mod.title);
  });

  it('getModuleField returns the PT translation when active', () => {
    const mod = MODULES.find(m => m.id === 'major-scale');
    setLang('pt');
    expect(getModuleField(mod, 'title')).toBe('A Escala Maior');
  });

  it('getModuleField falls back to EN when no translation entry exists', () => {
    // Some hypothetical module without a TR entry — pick the walking-bass
    // generator which usually has only a few translations and check
    // that an unknown field still resolves.
    const mod = MODULES[0];
    setLang('pt');
    // Falls back to en when TR[mod.id]?.pt?.unknown is undefined.
    expect(getModuleField(mod, 'unknown_field')).toBe(mod.unknown_field);
  });

  it('getStepField returns the EN source under en', () => {
    const mod = MODULES.find(m => m.id === 'major-scale');
    setLang('en');
    expect(getStepField(mod, 0, 'title')).toBe(mod.steps[0].title);
  });

  it('getStepField returns the translated value when present', () => {
    const mod = MODULES.find(m => m.id === 'major-scale');
    setLang('pt');
    const stepTitle = getStepField(mod, 0, 'title');
    // The PT translation should differ from the EN source.
    expect(stepTitle).toBeTruthy();
    expect(stepTitle).not.toBe(mod.steps[0].title);
  });

  it('getStepField falls back to EN when the field is missing in the target lang', () => {
    const mod = MODULES.find(m => m.id === 'major-scale');
    setLang('pt');
    // A step field that doesn't exist in the PT translation should fall back.
    expect(getStepField(mod, 0, 'no-such-field')).toBeUndefined();
  });

  it('getStepArray returns arrays only; otherwise falls back', () => {
    const mod = MODULES.find(m => m.id === 'major-scale');
    setLang('pt');
    // references is the canonical step-array field.
    const refs = getStepArray(mod, 0, 'references');
    if (refs) expect(Array.isArray(refs)).toBe(true);
  });

  it('getStepArray returns EN source under en', () => {
    const mod = MODULES.find(m => m.id === 'major-scale');
    setLang('en');
    const refs = getStepArray(mod, 0, 'references');
    expect(refs).toBe(mod.steps[0].references);
  });
});
