// AudioEngine smoke test. The default jsdom-stubbed AudioContext returned
// by test/setup/dom-setup.js is rich enough for init() to complete, so we
// can cover the bulk of the engine without hand-rolling each method.
import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  // Provide a stereo-panner factory (jsdom default fake lacks it).
  const baseCtx = globalThis.AudioContext;
  class WithPanner extends baseCtx {
    createStereoPanner() {
      return { pan: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
    }
    createBiquadFilter() {
      return {
        type: 'lowpass',
        frequency: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        Q: { value: 0 },
        gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }
    createDynamicsCompressor() {
      return {
        threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 },
        attack: { value: 0 }, release: { value: 0 },
        connect: vi.fn(), disconnect: vi.fn(),
      };
    }
    createConvolver() { return { buffer: null, connect: vi.fn(), disconnect: vi.fn() }; }
    createBuffer(channels, length, sampleRate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { length, sampleRate, numberOfChannels: channels, getChannelData: (i) => data[i] };
    }
    createBufferSource() {
      return {
        buffer: null,
        playbackRate: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
    }
  }
  globalThis.AudioContext = WithPanner;
  globalThis.webkitAudioContext = WithPanner;
});

describe('AudioEngine', () => {
  it('init creates a context and wires panners for every track', async () => {
    const engine = await import('../src/js/audio/AudioEngine.js');
    await engine.init();
    expect(engine.getContext()).not.toBeNull();
    expect(engine.getMasterGain()).not.toBeNull();
    for (const track of ['melody', 'melody2', 'chord', 'bass', 'drum', 'click']) {
      expect(engine.getTrackDest(track)).toBeTruthy();
    }
  });

  it('setMasterVolume + setTrackPan + setEQ mutate the graph without throwing', async () => {
    const engine = await import('../src/js/audio/AudioEngine.js');
    await engine.init();
    engine.setMasterVolume(0.5);
    engine.setTrackPan('melody', -0.4);
    engine.setTrackPan('not-a-track', 0);  // safe no-op
    engine.setEQ('low', 3);
    engine.setEQ('mid', 0);
    engine.setEQ('high', -2);
    engine.setReverbAmount(0.3);
    engine.setDelayAmount(0.2);
    engine.setChorusAmount(0.1);
    expect(true).toBe(true);
  });

  it('getTrackDest falls back to master for unknown tracks', async () => {
    const engine = await import('../src/js/audio/AudioEngine.js');
    await engine.init();
    expect(engine.getTrackDest('not-a-track')).toBe(engine.getMasterGain());
  });

  it('init is idempotent — second call resumes the existing context', async () => {
    const engine = await import('../src/js/audio/AudioEngine.js');
    const a = await engine.init();
    const b = await engine.init();
    expect(a).toBe(b);
  });
});
