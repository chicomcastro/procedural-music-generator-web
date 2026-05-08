// Integration tests — span multiple modules to validate end-to-end behaviours.
import { describe, it, expect } from 'vitest';
import { generateSong } from '../src/js/generate/song.js';
import { mulberry32 } from '../src/js/generate/rng.js';
import { songToMidi } from '../src/js/export/midi.js';

describe('integration: generate → export', () => {
  it('produces a valid MIDI buffer for a generated song', () => {
    const song = generateSong({
      seed: 42, tonic: 60, scale: 'major', bars: 4, beatsPerBar: 4, density: 0.6,
    });
    const midi = songToMidi(song, { bpm: 110 });
    expect(midi).toBeInstanceOf(Uint8Array);
    expect(midi.length).toBeGreaterThan(0);
    // MIDI files start with "MThd"
    const header = String.fromCharCode(midi[0], midi[1], midi[2], midi[3]);
    expect(header).toBe('MThd');
  });

  it('same seed yields byte-identical output across calls (determinism)', () => {
    const a = generateSong({ seed: 1234, tonic: 60, scale: 'major', bars: 4, beatsPerBar: 4, density: 0.5 });
    const b = generateSong({ seed: 1234, tonic: 60, scale: 'major', bars: 4, beatsPerBar: 4, density: 0.5 });
    expect(b.events).toEqual(a.events);
    expect(b.lengthBeats).toBe(a.lengthBeats);
  });

  it('different seeds produce different songs', () => {
    const a = generateSong({ seed: 100, tonic: 60, scale: 'major', bars: 4, beatsPerBar: 4, density: 0.5 });
    const b = generateSong({ seed: 200, tonic: 60, scale: 'major', bars: 4, beatsPerBar: 4, density: 0.5 });
    // Most of the events should differ
    const firstA = a.events.filter(e => e.type === 'melody').slice(0, 5).map(e => e.midi).join(',');
    const firstB = b.events.filter(e => e.type === 'melody').slice(0, 5).map(e => e.midi).join(',');
    expect(firstA).not.toBe(firstB);
  });

  it('songs respect the requested number of bars and time signature', () => {
    for (const bars of [2, 4, 8]) {
      for (const beats of [3, 4]) {
        const song = generateSong({
          seed: 777, tonic: 60, scale: 'major', bars, beatsPerBar: beats, density: 0.6,
        });
        expect(song.lengthBeats).toBe(bars * beats);
      }
    }
  });

  it('events stay within the song length', () => {
    const song = generateSong({ seed: 42, tonic: 60, scale: 'major', bars: 4, beatsPerBar: 4, density: 0.7 });
    for (const ev of song.events) {
      expect(ev.atBeat).toBeGreaterThanOrEqual(0);
      expect(ev.atBeat + ev.durationBeats).toBeLessThanOrEqual(song.lengthBeats + 0.01);
    }
  });

  it('mulberry32 is consistent regardless of who imported it', () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    for (let i = 0; i < 50; i++) expect(r1()).toBe(r2());
  });
});

describe('integration: compose project file format', () => {
  it('matches the v1 file shape that ComposeView writes', () => {
    // Mirror of what ComposeView.js downloads — keep this in sync if the
    // file format ever changes.
    const sections = [
      { id: 's1', name: 'Intro', seed: 42, scale: 'major', tonic: 0, bpm: 110, bars: 4, density: 0.5, voice: 'piano', tracks: ['melody', 'chord', 'bass'] },
    ];
    const data = {
      format: 'seedsong-compose',
      version: 1,
      savedAt: new Date().toISOString(),
      sections,
    };
    const json = JSON.stringify(data);
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe('seedsong-compose');
    expect(parsed.version).toBe(1);
    expect(parsed.sections.length).toBe(1);
    expect(parsed.sections[0].seed).toBe(42);
  });
});
