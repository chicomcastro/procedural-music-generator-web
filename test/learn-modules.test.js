import { describe, it, expect } from 'vitest';
import { MODULES, GROUPS } from '../src/js/ui/learn-modules.js';

describe('Learn curriculum data', () => {
  it('every module has the required shape', () => {
    expect(MODULES.length).toBeGreaterThan(0);
    for (const mod of MODULES) {
      expect(mod.id, `module missing id`).toBeTypeOf('string');
      expect(mod.id.length).toBeGreaterThan(0);
      expect(mod.group, `${mod.id} missing group`).toBeTypeOf('string');
      expect(mod.tag).toBeTypeOf('string');
      expect(mod.title).toBeTypeOf('string');
      expect(mod.summary).toBeTypeOf('string');
      expect(Array.isArray(mod.steps), `${mod.id}.steps must be array`).toBe(true);
      expect(mod.steps.length, `${mod.id} has empty steps`).toBeGreaterThan(0);
    }
  });

  it('module ids are unique', () => {
    const ids = MODULES.map(m => m.id);
    const set = new Set(ids);
    expect(set.size).toBe(ids.length);
  });

  it('every step is theory, exercise or generator with the right shape', () => {
    for (const mod of MODULES) {
      for (const [i, step] of mod.steps.entries()) {
        const ctx = `${mod.id} step ${i}`;
        expect(['theory', 'exercise', 'generator'], `${ctx} type`).toContain(step.type);
        expect(step.title, `${ctx} title`).toBeTypeOf('string');
        if (step.type === 'theory') {
          expect(step.text, `${ctx} text`).toBeTypeOf('string');
        } else if (step.type === 'exercise') {
          expect(['melody', 'chord', 'progression', 'rhythm']).toContain(step.style);
          expect(Array.isArray(step.notes), `${ctx} notes`).toBe(true);
        }
        // Generator steps build their notes at runtime — no static shape needed.
      }
    }
  });

  it('every group referenced by a module is in GROUPS', () => {
    for (const mod of MODULES) {
      expect(GROUPS, `${mod.id} group "${mod.group}"`).toContain(mod.group);
    }
  });

  it('non-challenge modules have at least 2 melodic exercises (or are generator modules)', () => {
    for (const mod of MODULES) {
      if (mod.group === 'Challenges') continue;
      // Generator modules build their melody at runtime — skip the static count.
      if (mod.steps.some(s => s.type === 'generator')) continue;
      const melodyCount = mod.steps.filter(s => s.type === 'exercise' && s.style === 'melody').length;
      expect(melodyCount, `${mod.id} should have ≥ 2 melodic exercises (has ${melodyCount})`).toBeGreaterThanOrEqual(2);
    }
  });

  it('every theory step that ships audio has a valid notes array', () => {
    for (const mod of MODULES) {
      for (const step of mod.steps) {
        if (step.type === 'theory' && step.audio) {
          expect(Array.isArray(step.audio)).toBe(true);
          expect(step.audio.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('exercises produce midi values inside a sane range', () => {
    // Walks every supported note shape (number, null, number array, object
    // { m, t, r }) and asserts each pitch lives in piano range.
    const collect = (note, out) => {
      if (note == null) return;
      if (typeof note === 'number') { out.push(note); return; }
      if (Array.isArray(note)) { note.forEach(n => collect(n, out)); return; }
      if (note.r) return;
      if (Array.isArray(note.m)) note.m.forEach(n => collect(n, out));
      else if (typeof note.m === 'number') out.push(note.m);
    };
    for (const mod of MODULES) {
      for (const step of mod.steps) {
        if (step.type !== 'exercise') continue;
        const out = [];
        for (const n of step.notes) collect(n, out);
        for (const m of out) {
          expect(m, `${mod.id} ${step.title}`).toBeGreaterThanOrEqual(21);
          expect(m).toBeLessThanOrEqual(108);
        }
      }
    }
  });

  it('all 7 expected groups exist', () => {
    const expected = ['Scales', 'Challenges', 'Chords', 'Progressions', 'Walking Bass', 'Reading', 'Duets'];
    expect(GROUPS).toEqual(expected);
  });

  it('Walking Bass group has at least 8 modules (deep dive course)', () => {
    const wb = MODULES.filter(m => m.group === 'Walking Bass');
    expect(wb.length).toBeGreaterThanOrEqual(8);
  });

  it('Progressions group has at least 10 modules', () => {
    const p = MODULES.filter(m => m.group === 'Progressions');
    expect(p.length).toBeGreaterThanOrEqual(10);
  });
});
