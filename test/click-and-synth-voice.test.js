// Coverage push (PR K): Click.js + SynthVoice.js.
// Both require an AudioContext-shape; we use a fake recording stub so we
// can assert against the calls made.
import { describe, it, expect, vi } from 'vitest';
import { playClick } from '../src/js/audio/Click.js';
import { createSynthVoice, getSynthPresetNames } from '../src/js/audio/SynthVoice.js';

function makeCtx() {
  const oscillators = [];
  const gains = [];
  const filters = [];
  function makeOsc() {
    const o = {
      type: 'sine',
      frequency: { value: 0, setValueAtTime: vi.fn() },
      detune: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn(function () { return this; }),
      disconnect: vi.fn(),
      start: vi.fn(), stop: vi.fn(),
      onended: null,
    };
    oscillators.push(o);
    return o;
  }
  function makeGain() {
    const g = {
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      },
      connect: vi.fn(function () { return this; }),
      disconnect: vi.fn(),
    };
    gains.push(g);
    return g;
  }
  function makeFilter() {
    const f = {
      type: 'lowpass',
      frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      Q: { value: 0 },
      connect: vi.fn(function () { return this; }),
      disconnect: vi.fn(),
    };
    filters.push(f);
    return f;
  }
  return {
    currentTime: 0,
    createOscillator: makeOsc,
    createGain: makeGain,
    createBiquadFilter: makeFilter,
    _oscillators: oscillators,
    _gains: gains,
    _filters: filters,
  };
}

describe('Click — playClick', () => {
  it('schedules a 50ms beep on default settings', () => {
    const ctx = makeCtx();
    const dest = { connect: vi.fn() };
    playClick(ctx, dest, 0);
    expect(ctx._oscillators.length).toBe(1);
    expect(ctx._oscillators[0].frequency.setValueAtTime).toHaveBeenCalled();
    expect(ctx._oscillators[0].start).toHaveBeenCalledWith(0);
    expect(ctx._oscillators[0].stop).toHaveBeenCalledWith(0.06);
  });

  it('accent=true uses a higher frequency + louder peak', () => {
    const ctx = makeCtx();
    const dest = { connect: vi.fn() };
    playClick(ctx, dest, 1, { accent: true });
    const osc = ctx._oscillators[0];
    expect(osc.frequency.setValueAtTime.mock.calls[0][0]).toBe(1500);
    const gain = ctx._gains[0];
    // linearRampToValueAtTime was called with peak = 0.5 * volume(1)
    expect(gain.gain.linearRampToValueAtTime.mock.calls[0][0]).toBe(0.5);
  });

  it('volume multiplier scales the peak', () => {
    const ctx = makeCtx();
    playClick(ctx, { connect: vi.fn() }, 0, { volume: 0.5 });
    const peak = ctx._gains[0].gain.linearRampToValueAtTime.mock.calls[0][0];
    expect(peak).toBe(0.125);   // 0.25 * 0.5
  });

  it('onended disconnects both nodes', () => {
    const ctx = makeCtx();
    playClick(ctx, { connect: vi.fn() }, 0);
    const osc = ctx._oscillators[0];
    const gain = ctx._gains[0];
    expect(typeof osc.onended).toBe('function');
    osc.onended();
    expect(osc.disconnect).toHaveBeenCalled();
    expect(gain.disconnect).toHaveBeenCalled();
  });

  it('disconnect errors are swallowed', () => {
    const ctx = makeCtx();
    playClick(ctx, { connect: vi.fn() }, 0);
    const osc = ctx._oscillators[0];
    osc.disconnect = () => { throw new Error('boom'); };
    ctx._gains[0].disconnect = () => { throw new Error('boom2'); };
    expect(() => osc.onended()).not.toThrow();
  });
});

describe('SynthVoice — getSynthPresetNames', () => {
  it('returns all preset keys', () => {
    const names = getSynthPresetNames();
    expect(names).toEqual(expect.arrayContaining(['pad', 'pluck', 'bass', 'organ', 'strings', 'marimba', 'bell', 'epiano', 'lead']));
  });
});

describe('SynthVoice — createSynthVoice', () => {
  it('builds oscillators per preset osc count (pad: 2)', () => {
    const ctx = makeCtx();
    const dest = { connect: vi.fn() };
    createSynthVoice(ctx, dest, { midi: 60, preset: 'pad' });
    // pad has 2 oscillators + 1 vibrato LFO = 3
    expect(ctx._oscillators.length).toBe(3);
  });

  it('uses pad preset when the requested preset is unknown', () => {
    const ctx = makeCtx();
    createSynthVoice(ctx, { connect: vi.fn() }, { midi: 60, preset: 'doesnotexist' });
    expect(ctx._oscillators.length).toBeGreaterThan(0);   // fell back to pad
  });

  it('schedules a release envelope when duration is given', () => {
    const ctx = makeCtx();
    createSynthVoice(ctx, { connect: vi.fn() }, { midi: 60, preset: 'pluck', duration: 0.5 });
    // pluck has 1 osc; stop should be called with a stopTime > 0
    expect(ctx._oscillators[0].stop).toHaveBeenCalled();
    const stopTime = ctx._oscillators[0].stop.mock.calls[0][0];
    expect(stopTime).toBeGreaterThan(0.5);
  });

  it('release() method ramps down + stops', () => {
    const ctx = makeCtx();
    const v = createSynthVoice(ctx, { connect: vi.fn() }, { midi: 60, preset: 'pluck' });
    v.release();
    expect(ctx._gains[0].gain.linearRampToValueAtTime).toHaveBeenCalled();
    expect(ctx._oscillators[0].stop).toHaveBeenCalled();
  });

  it('release() twice does nothing on the second call', () => {
    const ctx = makeCtx();
    const v = createSynthVoice(ctx, { connect: vi.fn() }, { midi: 60, preset: 'lead' });
    v.release();
    const stopCallCountAfterFirst = ctx._oscillators[0].stop.mock.calls.length;
    v.release();
    expect(ctx._oscillators[0].stop.mock.calls.length).toBe(stopCallCountAfterFirst);
  });

  it('filter decay branch fires for pluck preset', () => {
    const ctx = makeCtx();
    createSynthVoice(ctx, { connect: vi.fn() }, { midi: 60, preset: 'pluck' });
    expect(ctx._filters[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalled();
  });

  it('preset without filter decay does not call exponential ramp', () => {
    const ctx = makeCtx();
    createSynthVoice(ctx, { connect: vi.fn() }, { midi: 60, preset: 'pad' });
    expect(ctx._filters[0].frequency.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  });

  it('release after a duration-scheduled note is a no-op', () => {
    const ctx = makeCtx();
    const v = createSynthVoice(ctx, { connect: vi.fn() }, { midi: 60, preset: 'pluck', duration: 0.1 });
    const before = ctx._oscillators[0].stop.mock.calls.length;
    v.release();
    expect(ctx._oscillators[0].stop.mock.calls.length).toBe(before);
  });
});
