import { describe, it, expect } from 'vitest';
import { songToMidi } from '../src/js/export/midi.js';
import { generateSong } from '../src/js/generate/song.js';

describe('songToMidi', () => {
  it('produces output with MThd header', () => {
    const song = generateSong({ seed: 42 });
    const bytes = songToMidi(song, { bpm: 120 });
    expect(bytes).toBeInstanceOf(Uint8Array);
    // MThd = 0x4D 0x54 0x68 0x64
    expect(bytes[0]).toBe(0x4D);
    expect(bytes[1]).toBe(0x54);
    expect(bytes[2]).toBe(0x68);
    expect(bytes[3]).toBe(0x64);
  });

  it('output length is greater than 0', () => {
    const song = generateSong({ seed: 42 });
    const bytes = songToMidi(song);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('contains MTrk chunk after header', () => {
    const song = generateSong({ seed: 42 });
    const bytes = songToMidi(song);
    // MThd header is 14 bytes, then MTrk starts at byte 14
    expect(bytes[14]).toBe(0x4D); // M
    expect(bytes[15]).toBe(0x54); // T
    expect(bytes[16]).toBe(0x72); // r
    expect(bytes[17]).toBe(0x6B); // k
  });
});
