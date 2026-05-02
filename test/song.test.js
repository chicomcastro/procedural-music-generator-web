import { describe, it, expect } from 'vitest';
import { generateSong } from '../src/js/generate/song.js';

describe('generateSong', () => {
  it('same seed + same params produces identical song', () => {
    const params = { seed: 42, tonic: 60, scale: 'major', bars: 4, beatsPerBar: 4, density: 0.65 };
    const song1 = generateSong(params);
    const song2 = generateSong(params);
    expect(song1).toEqual(song2);
  });

  it('has expected structure', () => {
    const song = generateSong({ seed: 100 });
    expect(song).toHaveProperty('events');
    expect(song).toHaveProperty('lengthBeats');
    expect(song).toHaveProperty('bars');
    expect(song).toHaveProperty('beatsPerBar');
    expect(song).toHaveProperty('seed');
    expect(song).toHaveProperty('tonic');
    expect(song).toHaveProperty('scale');
    expect(song).toHaveProperty('preset');
    expect(Array.isArray(song.events)).toBe(true);
    expect(song.lengthBeats).toBe(song.bars * song.beatsPerBar);
  });

  it('all events have required fields', () => {
    const song = generateSong({ seed: 200 });
    for (const ev of song.events) {
      expect(ev).toHaveProperty('type');
      expect(ev).toHaveProperty('midi');
      expect(ev).toHaveProperty('atBeat');
      expect(ev).toHaveProperty('durationBeats');
      expect(ev).toHaveProperty('velocity');
      expect(typeof ev.midi).toBe('number');
      expect(typeof ev.atBeat).toBe('number');
      expect(typeof ev.durationBeats).toBe('number');
      expect(typeof ev.velocity).toBe('number');
    }
  });

  it('different scales produce different note sets', () => {
    const major = generateSong({ seed: 42, scale: 'major' });
    const minor = generateSong({ seed: 42, scale: 'natural_minor' });
    const majorMidis = major.events.filter(e => e.type === 'melody').map(e => e.midi).sort();
    const minorMidis = minor.events.filter(e => e.type === 'melody').map(e => e.midi).sort();
    expect(majorMidis).not.toEqual(minorMidis);
  });

  it('changing density affects note count', () => {
    const low = generateSong({ seed: 42, density: 0.1, bars: 8 });
    const high = generateSong({ seed: 42, density: 0.95, bars: 8 });
    const lowMelody = low.events.filter(e => e.type === 'melody').length;
    const highMelody = high.events.filter(e => e.type === 'melody').length;
    expect(highMelody).toBeGreaterThan(lowMelody);
  });
});
