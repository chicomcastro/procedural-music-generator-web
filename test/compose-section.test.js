import { describe, it, expect } from 'vitest';
import { generateSong } from '../src/js/generate/song.js';

// We can't import ComposeView directly (it touches DOM at module load).
// Instead replicate the section-shape contract here and ensure the song
// generator accepts it identically.

const SECTION_TEMPLATES = [
  { name: 'Intro', density: 0.4, bars: 4 },
  { name: 'Verse', density: 0.6, bars: 8 },
  { name: 'Chorus', density: 0.75, bars: 8 },
  { name: 'Bridge', density: 0.5, bars: 4 },
  { name: 'Outro', density: 0.35, bars: 4 },
];

function makeSection(i) {
  const t = SECTION_TEMPLATES[i % SECTION_TEMPLATES.length];
  return {
    id: `s${i}`,
    name: t.name,
    seed: 100 + i,
    scale: 'major',
    tonic: 0,
    bpm: 110,
    bars: t.bars,
    density: t.density,
    voice: 'piano',
    tracks: ['melody', 'chord', 'bass'],
  };
}

describe('Compose section data contract', () => {
  it('makeSection produces every key the generator needs', () => {
    const sec = makeSection(0);
    expect(sec).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      seed: expect.any(Number),
      scale: expect.any(String),
      tonic: expect.any(Number),
      bpm: expect.any(Number),
      bars: expect.any(Number),
      density: expect.any(Number),
      voice: expect.any(String),
      tracks: expect.any(Array),
    });
  });

  it('generates a song from a section', () => {
    const sec = makeSection(0);
    const song = generateSong({
      seed: sec.seed,
      tonic: 60 + sec.tonic,
      scale: sec.scale,
      bars: sec.bars,
      beatsPerBar: 4,
      density: sec.density,
    });
    expect(song.events.length).toBeGreaterThan(0);
    expect(song.lengthBeats).toBe(sec.bars * 4);
  });

  it('chaining sections produces total length equal to sum of section lengths', () => {
    const sections = [makeSection(0), makeSection(1), makeSection(2)];
    const totalBeats = sections.reduce((acc, s) => acc + s.bars * 4, 0);
    const songs = sections.map(s => generateSong({
      seed: s.seed,
      tonic: 60 + s.tonic,
      scale: s.scale,
      bars: s.bars,
      beatsPerBar: 4,
      density: s.density,
    }));
    const summed = songs.reduce((acc, sg) => acc + sg.lengthBeats, 0);
    expect(summed).toBe(totalBeats);
  });

  it('track filtering yields events of only enabled types', () => {
    const sec = makeSection(0);
    sec.tracks = ['melody']; // chord and bass disabled
    const song = generateSong({
      seed: sec.seed,
      tonic: 60 + sec.tonic,
      scale: sec.scale,
      bars: sec.bars,
      beatsPerBar: 4,
      density: sec.density,
    });
    const enabled = new Set(sec.tracks);
    const filteredCount = song.events.filter(e => e.type !== 'drum' && enabled.has(e.type)).length;
    const totalNonDrum = song.events.filter(e => e.type !== 'drum').length;
    expect(filteredCount).toBeLessThan(totalNonDrum);
    expect(filteredCount).toBeGreaterThan(0);
  });
});
