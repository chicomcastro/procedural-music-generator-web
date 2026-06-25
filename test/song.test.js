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

  it('structure=full builds a multi-section song with sections array', () => {
    const song = generateSong({ seed: 42, bars: 8, structure: 'full' });
    expect(Array.isArray(song.sections)).toBe(true);
    expect(song.sections.length).toBe(6);
    expect(song.sections[0].label).toBe('Intro');
    expect(song.sections[song.sections.length - 1].label).toBe('Outro');
    // Total length should be sum of section lengths
    const totalLen = song.sections.reduce((a, s) => a + s.lengthBeats, 0);
    expect(song.lengthBeats).toBe(totalLen);
  });

  it('structure=short builds a 4-section song', () => {
    const song = generateSong({ seed: 42, bars: 8, structure: 'short' });
    expect(song.sections.length).toBe(4);
  });

  it('structure with unknown name falls back to "full"', () => {
    const song = generateSong({ seed: 42, bars: 8, structure: 'bogus' });
    expect(song.sections.length).toBe(6);   // same as full
  });

  it('duet=true generates a second melodic voice (melody2)', () => {
    const song = generateSong({ seed: 42, density: 0.7, bars: 4, duet: true });
    const melody2 = song.events.filter(e => e.type === 'melody2');
    expect(melody2.length).toBeGreaterThan(0);
  });

  it('duet=false omits melody2 events', () => {
    const song = generateSong({ seed: 42, bars: 4, duet: false });
    const melody2 = song.events.filter(e => e.type === 'melody2');
    expect(melody2.length).toBe(0);
  });

  it('Intro section has noDrums=true → no drum events in intro span', () => {
    const song = generateSong({ seed: 42, bars: 8, structure: 'full' });
    const introEnd = song.sections[0].startBeat + song.sections[0].lengthBeats;
    const drumsInIntro = song.events.filter(e => e.type === 'drum' && e.atBeat < introEnd).length;
    expect(drumsInIntro).toBe(0);
  });
});
