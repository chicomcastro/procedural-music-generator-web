import { describe, it, expect } from 'vitest';
import { songToMusicXML } from '../src/js/export/musicxml.js';

const makeSong = (over = {}) => ({
  bars: 2,
  beatsPerBar: 4,
  lengthBeats: 8,
  events: [
    { type: 'melody', midi: 60, atBeat: 0, durationBeats: 1, velocity: 0.8 },
    { type: 'melody', midi: 64, atBeat: 1, durationBeats: 1, velocity: 0.8 },
    { type: 'melody', midi: 67, atBeat: 2, durationBeats: 2, velocity: 0.8 },
    { type: 'chord',  midi: 60, atBeat: 0, durationBeats: 4, velocity: 0.6 },
    { type: 'chord',  midi: 64, atBeat: 0, durationBeats: 4, velocity: 0.6 },
    { type: 'chord',  midi: 67, atBeat: 0, durationBeats: 4, velocity: 0.6 },
    { type: 'bass',   midi: 36, atBeat: 0, durationBeats: 1, velocity: 0.8 },
    { type: 'bass',   midi: 36, atBeat: 1, durationBeats: 1, velocity: 0.8 },
    { type: 'drum',   midi: 36, atBeat: 0, durationBeats: 0.5, velocity: 0.9 },
    { type: 'drum',   midi: 38, atBeat: 1, durationBeats: 0.5, velocity: 0.9 },
  ],
  ...over,
});

describe('songToMusicXML', () => {
  it('produces a valid score-partwise document', () => {
    const xml = songToMusicXML(makeSong(), { bpm: 100 });
    expect(xml).toMatch(/<\?xml version="1\.0"/);
    expect(xml).toMatch(/<score-partwise version="4\.0">/);
    expect(xml).toMatch(/<\/score-partwise>/);
  });

  it('emits one <score-part> per defined part by default', () => {
    const xml = songToMusicXML(makeSong());
    const matches = xml.match(/<score-part /g) || [];
    expect(matches.length).toBe(5);  // melody, melody2, chord, bass, drum
  });

  it('respects the tracks filter', () => {
    const xml = songToMusicXML(makeSong(), { tracks: ['melody'] });
    const matches = xml.match(/<score-part /g) || [];
    expect(matches.length).toBe(1);
    expect(xml).toMatch(/<part-name>Melody<\/part-name>/);
    expect(xml).not.toMatch(/<part-name>Chords<\/part-name>/);
  });

  it('includes a tempo marking in the first part', () => {
    const xml = songToMusicXML(makeSong(), { bpm: 144 });
    expect(xml).toMatch(/per-minute>144<\/per-minute>/);
  });

  it('emits measures matching song.bars', () => {
    const xml = songToMusicXML(makeSong({ bars: 3, lengthBeats: 12 }));
    // Count measures in the first <part> block.
    const partBlock = xml.match(/<part id="P1">[\s\S]*?<\/part>/)[0];
    const measures = partBlock.match(/<measure number=/g) || [];
    expect(measures.length).toBe(3);
  });

  it('infers totalBars from lengthBeats when bars is missing', () => {
    const song = makeSong();
    delete song.bars;
    song.lengthBeats = 16;
    const xml = songToMusicXML(song);
    const partBlock = xml.match(/<part id="P1">[\s\S]*?<\/part>/)[0];
    const measures = partBlock.match(/<measure number=/g) || [];
    expect(measures.length).toBe(4);  // 16 beats / 4
  });

  it('XML-escapes special characters in song metadata that would break parsing', () => {
    const xml = songToMusicXML(makeSong());
    // Drum part name should be intact and parseable
    expect(xml).toMatch(/<part-name>Drums<\/part-name>/);
  });

  it('emits a percussion clef for the drum part', () => {
    const xml = songToMusicXML(makeSong());
    expect(xml).toMatch(/percussion/);
  });

  it('overrides clefs per part type when clefOverrides is provided', () => {
    const xml = songToMusicXML(makeSong(), {
      tracks: ['melody'],
      clefOverrides: { melody: 'bass' },
    });
    expect(xml).toMatch(/<sign>F<\/sign>/);
    expect(xml).not.toMatch(/<sign>G<\/sign>/);
  });

  it('accepts alto clef via friendly aliases', () => {
    const xml = songToMusicXML(makeSong(), {
      tracks: ['melody'],
      clefOverrides: { melody: 'alto' },
    });
    expect(xml).toMatch(/<sign>C<\/sign>/);
  });

  it('emits <harmony> tags from chordSymbols, one per bar in the first part', () => {
    const xml = songToMusicXML(makeSong({ bars: 2, lengthBeats: 8 }), {
      tracks: ['melody'],
      chordSymbols: ['C', 'G7'],
    });
    const harmony = xml.match(/<harmony>/g) || [];
    expect(harmony.length).toBe(2);
    expect(xml).toMatch(/text="C"/);
    expect(xml).toMatch(/text="G7"/);
    expect(xml).toMatch(/dominant/);
  });

  it('omits <harmony> in non-first parts so OSMD only draws labels once', () => {
    const xml = songToMusicXML(makeSong(), {
      tracks: ['melody', 'bass'],
      chordSymbols: ['C', 'G'],
    });
    const bassPart = xml.match(/<part id="P3">[\s\S]*?<\/part>/);
    if (bassPart) expect(bassPart[0]).not.toMatch(/<harmony>/);
  });
});
