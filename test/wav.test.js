import { describe, it, expect } from 'vitest';
import { audioBufferToWav } from '../src/js/export/wav.js';

// Build a minimal fake AudioBuffer that audioBufferToWav can consume.
// jsdom doesn't ship AudioBuffer so we mimic the interface manually.
function fakeBuffer({ numberOfChannels = 1, sampleRate = 44100, length = 8 } = {}) {
  const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  // Fill with a recognisable ramp.
  for (let c = 0; c < numberOfChannels; c++) {
    for (let i = 0; i < length; i++) channels[c][i] = (i / (length - 1)) - 0.5;
  }
  return {
    numberOfChannels,
    sampleRate,
    length,
    getChannelData: (i) => channels[i],
  };
}

describe('audioBufferToWav', () => {
  it('produces a valid RIFF/WAVE header', () => {
    const wav = audioBufferToWav(fakeBuffer({ numberOfChannels: 1, sampleRate: 8000, length: 4 }));
    expect(wav).toBeInstanceOf(Uint8Array);
    const dec = new TextDecoder('ascii');
    expect(dec.decode(wav.slice(0, 4))).toBe('RIFF');
    expect(dec.decode(wav.slice(8, 12))).toBe('WAVE');
    expect(dec.decode(wav.slice(12, 16))).toBe('fmt ');
    expect(dec.decode(wav.slice(36, 40))).toBe('data');
  });

  it('encodes the right sample rate and channel count', () => {
    const wav = audioBufferToWav(fakeBuffer({ numberOfChannels: 2, sampleRate: 22050, length: 16 }));
    const view = new DataView(wav.buffer);
    expect(view.getUint16(22, true)).toBe(2);  // channels
    expect(view.getUint32(24, true)).toBe(22050);  // sample rate
    expect(view.getUint16(34, true)).toBe(16);  // bits per sample
  });

  it('correctly sizes the file (header + samples × channels × 2 bytes)', () => {
    const buf = fakeBuffer({ numberOfChannels: 1, sampleRate: 44100, length: 100 });
    const wav = audioBufferToWav(buf);
    expect(wav.length).toBe(44 + 100 * 1 * 2);
  });

  it('clips samples outside [-1, 1]', () => {
    const buf = fakeBuffer({ numberOfChannels: 1, sampleRate: 44100, length: 4 });
    buf.getChannelData(0)[0] = 5;
    buf.getChannelData(0)[1] = -5;
    const wav = audioBufferToWav(buf);
    const view = new DataView(wav.buffer);
    // Sample 0 should be max positive (0x7FFF), sample 1 should be min negative (-0x8000).
    expect(view.getInt16(44, true)).toBe(0x7FFF);
    expect(view.getInt16(46, true)).toBe(-0x8000);
  });
});
