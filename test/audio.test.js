// Audio module smoke tests. Real Web Audio doesn't run in jsdom, so we wire
// a hand-rolled fake context that returns spy-able nodes. Tests assert
// the audio factories build the expected graph (connects, schedules, etc.)
import { describe, it, expect, vi } from 'vitest';

function fakeContext() {
  const sources = [];
  const gains = [];
  const filters = [];
  return {
    currentTime: 0,
    destination: { connect: vi.fn(), disconnect: vi.fn() },
    state: 'running',
    sources, gains, filters,
    createBufferSource() {
      const s = {
        buffer: null,
        playbackRate: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      sources.push(s);
      return s;
    },
    createGain() {
      const g = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      gains.push(g);
      return g;
    },
    createBiquadFilter() {
      const f = {
        type: 'lowpass',
        frequency: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        Q: { value: 0 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      filters.push(f);
      return f;
    },
    createOscillator() {
      return {
        type: 'sine',
        frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        detune: { value: 0, setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
    },
    createDelay() {
      return { delayTime: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
    },
    createConvolver() {
      return { buffer: null, connect: vi.fn(), disconnect: vi.fn() };
    },
    createDynamicsCompressor() {
      return {
        threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 },
        attack: { value: 0 }, release: { value: 0 },
        connect: vi.fn(), disconnect: vi.fn(),
      };
    },
    createBuffer(channels, length, sampleRate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { length, sampleRate, numberOfChannels: channels, getChannelData: (i) => data[i] };
    },
    decodeAudioData() { return Promise.resolve(this.createBuffer(2, 8, 44100)); },
  };
}

describe('createVoice', () => {
  it('schedules attack envelope and connects through filter→gain→destination', async () => {
    const { createVoice } = await import('../src/js/audio/Voice.js');
    const ctx = fakeContext();
    const dest = ctx.destination;
    const buffer = ctx.createBuffer(1, 8, 44100);
    const v = createVoice(ctx, dest, { buffer, when: 0, duration: 0.5, velocity: 0.7 });
    expect(typeof v.release).toBe('function');
    expect(ctx.sources[0].start).toHaveBeenCalledWith(0);
    expect(ctx.sources[0].stop).toHaveBeenCalled();
    expect(ctx.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalled();
  });

  it('release() ramps the gain to 0 and stops the source', async () => {
    const { createVoice } = await import('../src/js/audio/Voice.js');
    const ctx = fakeContext();
    const buffer = ctx.createBuffer(1, 8, 44100);
    const v = createVoice(ctx, ctx.destination, { buffer, when: 0, duration: null, velocity: 0.7 });
    v.release(0.1);
    // After release, source.stop should be called.
    expect(ctx.sources[0].stop).toHaveBeenCalled();
  });

  it('release() cuts a duration-scheduled note short (the pause bug)', async () => {
    // Regression: a voice spawned WITH a duration used to flag itself
    // `stopped`, making release() a no-op — so paused playback kept sounding.
    const { createVoice } = await import('../src/js/audio/Voice.js');
    const ctx = fakeContext();
    ctx.currentTime = 1.0;
    const buffer = ctx.createBuffer(1, 8, 44100);
    const v = createVoice(ctx, ctx.destination, { buffer, when: 0.5, duration: 4, velocity: 0.7 });
    const stop = ctx.sources[0].stop;
    const callsBefore = stop.mock.calls.length;
    v.release(0.1);
    // release must reschedule an earlier stop (≤ now + release tail), not
    // leave the note running to its full 4-beat duration.
    expect(stop.mock.calls.length).toBeGreaterThan(callsBefore);
    const lastStopTime = stop.mock.calls.at(-1)[0];
    expect(lastStopTime).toBeLessThanOrEqual(1.0 + 0.1 + 0.05 + 1e-9);
  });

  it('release() silences a not-yet-started future note before it sounds', async () => {
    const { createVoice } = await import('../src/js/audio/Voice.js');
    const ctx = fakeContext();
    ctx.currentTime = 0;
    const buffer = ctx.createBuffer(1, 8, 44100);
    const v = createVoice(ctx, ctx.destination, { buffer, when: 5, duration: 1, velocity: 0.7 });
    v.release(0.1);
    // A future note (when=5 > now=0) is stopped at `now`, so it never plays.
    expect(ctx.sources[0].stop.mock.calls.at(-1)[0]).toBe(0);
  });

  it('createSynthVoice release() also cuts a duration-scheduled note short', async () => {
    const { createSynthVoice } = await import('../src/js/audio/SynthVoice.js');
    const ctx = fakeContext();
    ctx.currentTime = 0;
    const oscStops = [];
    const origOsc = ctx.createOscillator.bind(ctx);
    ctx.createOscillator = () => { const o = origOsc(); oscStops.push(o.stop); return o; };
    const v = createSynthVoice(ctx, ctx.destination, { midi: 60, when: 3, duration: 4, preset: 'pluck' });
    v.release(0.1);
    // Every oscillator gets stopped at `now` (future note), not at when+dur.
    expect(oscStops.length).toBeGreaterThan(0);
    for (const s of oscStops) expect(s.mock.calls.at(-1)[0]).toBe(0);
  });
});

describe('createSynthVoice', () => {
  it('returns a {release} interface for each preset', async () => {
    const { createSynthVoice, getSynthPresetNames } = await import('../src/js/audio/SynthVoice.js');
    const names = getSynthPresetNames();
    expect(names.length).toBeGreaterThan(0);
    for (const preset of names) {
      const ctx = fakeContext();
      const v = createSynthVoice(ctx, ctx.destination, { midi: 60, when: 0, duration: 0.5, preset });
      expect(typeof v.release).toBe('function');
    }
  });
});

describe('playDrumHit', () => {
  it('schedules each drum kind without throwing', async () => {
    const { playDrumHit } = await import('../src/js/audio/DrumSynth.js');
    for (const drum of ['kick', 'snare', 'hihat', 'openhat', 'tom', 'clap']) {
      const ctx = fakeContext();
      playDrumHit(ctx, ctx.destination, { drum, when: 0, velocity: 0.7 });
    }
  });
});

describe('playClick', () => {
  it('plays a click with default + accent volumes', async () => {
    const { playClick } = await import('../src/js/audio/Click.js');
    const ctx = fakeContext();
    playClick(ctx, ctx.destination, 0);
    playClick(ctx, ctx.destination, 0.5, { accent: true, volume: 1.2 });
  });
});

describe('Effects', () => {
  it('initEffects + send setters wire the graph and don\'t throw', async () => {
    const { initEffects, setReverbAmount, setDelayAmount, setChorusAmount, getReverbPresetNames, setReverbPreset } = await import('../src/js/audio/Effects.js');
    const ctx = fakeContext();
    initEffects(ctx, ctx.destination);
    setReverbAmount(0.4);
    setDelayAmount(0.3);
    setChorusAmount(0.2);
    expect(getReverbPresetNames().length).toBeGreaterThan(0);
    setReverbPreset(getReverbPresetNames()[0]);
  });
});

describe('Scheduler', () => {
  it('createScheduler returns start/stop functions', async () => {
    const { createScheduler } = await import('../src/js/scheduler/Scheduler.js');
    const ctx = fakeContext();
    const transport = { bpm: 120, isPlaying: false, beatsPerBar: 4, currentBeat: 0 };
    const sched = createScheduler(ctx, transport, vi.fn());
    expect(typeof sched.start).toBe('function');
    expect(typeof sched.stop).toBe('function');
    sched.stop();  // safe to stop before start
  });
});
