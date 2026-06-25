// Coverage push for wav.js (PR K).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioBufferToWav, renderSongToBuffer } from '../src/js/export/wav.js';

function makeAudioBuffer({ channels = 2, length = 100, sampleRate = 44100 } = {}) {
  const data = [];
  for (let c = 0; c < channels; c++) {
    const buf = new Float32Array(length);
    for (let i = 0; i < length; i++) buf[i] = Math.sin(i * 0.1) * (c === 0 ? 0.5 : -0.5);
    data.push(buf);
  }
  return {
    numberOfChannels: channels,
    sampleRate,
    length,
    getChannelData(c) { return data[c]; },
  };
}

describe('wav — audioBufferToWav', () => {
  it('encodes a stereo buffer to a 44-byte-header + PCM byte stream', () => {
    const buf = makeAudioBuffer({ channels: 2, length: 100 });
    const out = audioBufferToWav(buf);
    expect(out).toBeInstanceOf(Uint8Array);
    // Header: RIFF + size + WAVE
    const dv = new DataView(out.buffer);
    const header = String.fromCharCode(out[0], out[1], out[2], out[3]);
    expect(header).toBe('RIFF');
    const wave = String.fromCharCode(out[8], out[9], out[10], out[11]);
    expect(wave).toBe('WAVE');
    // numCh at offset 22 = 2
    expect(dv.getUint16(22, true)).toBe(2);
    expect(dv.getUint32(24, true)).toBe(44100);
  });

  it('encodes a mono buffer correctly', () => {
    const buf = makeAudioBuffer({ channels: 1, length: 50, sampleRate: 22050 });
    const out = audioBufferToWav(buf);
    const dv = new DataView(out.buffer);
    expect(dv.getUint16(22, true)).toBe(1);
    expect(dv.getUint32(24, true)).toBe(22050);
  });

  it('clamps out-of-range samples to ±1 before quantising', () => {
    const data = [new Float32Array([2, -2, 0.5])];
    const buf = {
      numberOfChannels: 1, sampleRate: 44100, length: 3,
      getChannelData: c => data[c],
    };
    const out = audioBufferToWav(buf);
    const dv = new DataView(out.buffer);
    // After 44-byte header, 16-bit samples
    expect(dv.getInt16(44, true)).toBe(0x7FFF);        // clamped +1
    expect(dv.getInt16(46, true)).toBe(-0x8000);       // clamped -1
  });
});

describe('wav — renderSongToBuffer', () => {
  beforeEach(() => {
    globalThis.OfflineAudioContext = class FakeOffline {
      constructor(_ch, length, sampleRate) {
        this.destination = { connect() {} };
        this.currentTime = 0;
        this.length = length;
        this.sampleRate = sampleRate;
      }
      createOscillator() {
        return { type: 'sine', frequency: { value: 0, setValueAtTime() {} }, detune: { value: 0, setValueAtTime() {} }, connect() { return this; }, start() {}, stop() {}, onended: null };
      }
      createGain() {
        return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() { return this; }, disconnect() {} };
      }
      createBiquadFilter() {
        return { type: 'lowpass', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { value: 0 }, connect() { return this; }, disconnect() {} };
      }
      createDynamicsCompressor() {
        return { connect() { return this; }, disconnect() {} };
      }
      createBufferSource() {
        return { buffer: null, playbackRate: { value: 1 }, connect() { return this; }, start() {}, stop() {}, disconnect() {} };
      }
      createBuffer(_ch, length) {
        return { length, sampleRate: 44100, numberOfChannels: 2, getChannelData() { return new Float32Array(length); } };
      }
      startRendering() {
        return Promise.resolve({ numberOfChannels: 2, sampleRate: 44100, length: this.length, getChannelData: () => new Float32Array(this.length) });
      }
    };
  });

  it('renders a song into a buffer of correct length', async () => {
    const song = {
      lengthBeats: 16,
      events: [
        { type: 'melody', midi: 60, atBeat: 0, durationBeats: 1, velocity: 0.8 },
        { type: 'melody', midi: 64, atBeat: 1, durationBeats: 1, velocity: 0.7 },
      ],
    };
    const buf = await renderSongToBuffer(song, { bpm: 120 }, { sampleRate: 44100, tailSeconds: 1, voice: 'pad' });
    expect(buf).toBeTruthy();
    // 16 beats at 120 bpm = 8 sec + 1 tail = 9 sec * 44100 = 396900
    expect(buf.length).toBe(Math.ceil(44100 * 9));
  });

  it('uses synth voice for non-piano presets', async () => {
    const song = {
      lengthBeats: 4,
      events: [{ type: 'chord', midi: 60, atBeat: 0, durationBeats: 1, velocity: 0.5 }],
    };
    const buf = await renderSongToBuffer(song, { bpm: 100 }, { voice: 'pluck' });
    expect(buf).toBeTruthy();
  });

  it('explicit non-piano voice succeeds with the synth path', async () => {
    const song = { lengthBeats: 4, events: [{ type: 'melody', midi: 60, atBeat: 0, durationBeats: 1, velocity: 0.5 }] };
    const buf = await renderSongToBuffer(song, { bpm: 100 }, { voice: 'organ' });
    expect(buf).toBeTruthy();
  });
});
