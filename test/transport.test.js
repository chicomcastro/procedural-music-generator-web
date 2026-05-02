import { describe, it, expect } from 'vitest';
import { createTransport } from '../src/js/scheduler/Transport.js';

describe('createTransport', () => {
  it('beat duration is 60/bpm', () => {
    const t = createTransport({ bpm: 120 });
    expect(t.beatDuration).toBeCloseTo(0.5);
  });

  it('default bpm is 120', () => {
    const t = createTransport();
    expect(t.bpm).toBe(120);
  });

  it('default beatsPerBar is 4', () => {
    const t = createTransport();
    expect(t.beatsPerBar).toBe(4);
  });

  it('setBpm updates bpm and beatDuration', () => {
    const t = createTransport({ bpm: 120 });
    t.setBpm(60);
    expect(t.bpm).toBe(60);
    expect(t.beatDuration).toBeCloseTo(1.0);
  });

  it('setBpm throws on invalid value', () => {
    const t = createTransport();
    expect(() => t.setBpm(0)).toThrow('Invalid bpm');
    expect(() => t.setBpm(-10)).toThrow('Invalid bpm');
    expect(() => t.setBpm(NaN)).toThrow('Invalid bpm');
  });

  it('setBeatsPerBar updates beatsPerBar', () => {
    const t = createTransport();
    t.setBeatsPerBar(3);
    expect(t.beatsPerBar).toBe(3);
  });

  it('setBeatsPerBar throws on invalid value', () => {
    const t = createTransport();
    expect(() => t.setBeatsPerBar(0)).toThrow('Invalid beatsPerBar');
    expect(() => t.setBeatsPerBar(2.5)).toThrow('Invalid beatsPerBar');
  });
});
