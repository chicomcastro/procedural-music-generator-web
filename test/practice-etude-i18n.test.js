import { describe, it, expect, afterEach } from 'vitest';
import { setLang } from '../src/js/i18n/i18n.js';
import { etudeLabel } from '../src/js/ui/practice-translations.js';
import { ETUDE_PATTERNS, ETUDE_RHYTHMS, ETUDE_OCTAVE_OPTIONS } from '../src/js/ui/practice-studies.js';

afterEach(() => setLang('en'));

describe('etudeLabel', () => {
  it('returns the English fallback verbatim in English', () => {
    setLang('en');
    for (const pt of ETUDE_PATTERNS) {
      expect(etudeLabel('patterns', pt.id, pt.label)).toBe(pt.label);
    }
  });

  it('localizes note-value labels to Portuguese', () => {
    setLang('pt');
    expect(etudeLabel('rhythms', 'quarter', 'Quarter notes')).toBe('Semínimas');
    expect(etudeLabel('rhythms', 'eighth', 'Eighth notes')).toBe('Colcheias');
    expect(etudeLabel('rhythms', 'sixteenth', 'Sixteenth notes')).toBe('Semicolcheias');
    expect(etudeLabel('rhythms', 'dotted8-16', 'Dotted 8th + 16th'))
      .toBe('Colcheia pontuada + semicolcheia');
  });

  it('localizes pattern and octave labels to Portuguese', () => {
    setLang('pt');
    expect(etudeLabel('patterns', 'scale', 'Scale (up + down)')).toBe('Escala (sobe + desce)');
    expect(etudeLabel('patterns', 'thirds', 'Broken thirds')).toBe('Terças quebradas');
    expect(etudeLabel('octaves', 1, '1 octave')).toBe('1 oitava');
    expect(etudeLabel('octaves', 2, '2 octaves')).toBe('2 oitavas');
  });

  it('localizes to Spanish', () => {
    setLang('es');
    expect(etudeLabel('rhythms', 'quarter', 'Quarter notes')).toBe('Negras');
    expect(etudeLabel('patterns', 'scale', 'Scale (up + down)')).toBe('Escala (sube + baja)');
    expect(etudeLabel('octaves', 2, '2 octaves')).toBe('2 octavas');
  });

  it('has a PT + ES translation for every pattern, rhythm, and octave option', () => {
    for (const lang of ['pt', 'es']) {
      setLang(lang);
      for (const pt of ETUDE_PATTERNS) {
        expect(etudeLabel('patterns', pt.id, pt.label)).not.toBe(pt.label);
      }
      for (const r of ETUDE_RHYTHMS) {
        expect(etudeLabel('rhythms', r.id, r.label)).not.toBe(r.label);
      }
      for (const o of ETUDE_OCTAVE_OPTIONS) {
        const fallback = o === 1 ? '1 octave' : `${o} octaves`;
        expect(etudeLabel('octaves', o, fallback)).not.toBe(fallback);
      }
    }
  });

  it('falls back to the given label for an unknown id', () => {
    setLang('pt');
    expect(etudeLabel('rhythms', 'nope', 'Fallback')).toBe('Fallback');
  });
});
