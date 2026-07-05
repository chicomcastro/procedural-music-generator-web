// Regression tests for the clef-anchor tonic bug (PR S).
// `anchor + keyPc` only lands on the requested key when the anchor is a
// C (treble = 60). Bass (41 = F2) and alto (53 = F3) silently rooted the
// music a fourth up — "key of C" generated F-major content against a
// C-major (empty) signature, leaking one Bb accidental into the score.
import { describe, it, expect } from 'vitest';
import { STUDIES, CLEF_ANCHORS, tonicMidiFor } from '../src/js/ui/practice-studies.js';
import { songToMusicXML } from '../src/js/export/musicxml.js';
import { __test } from '../src/js/ui/PracticeView.js';

const { buildSong } = __test;

describe('tonicMidiFor', () => {
  it('returns the anchor itself when its pitch class already matches', () => {
    expect(tonicMidiFor(60, 0)).toBe(60);   // treble C4 for key C
    expect(tonicMidiFor(41, 5)).toBe(41);   // bass F2 for key F
  });

  it('finds the lowest matching pitch class at or above the anchor', () => {
    expect(tonicMidiFor(41, 0)).toBe(48);   // bass anchor F2 → C3 for key C
    expect(tonicMidiFor(53, 0)).toBe(60);   // alto anchor F3 → C4 for key C
    expect(tonicMidiFor(41, 7)).toBe(43);   // bass → G2 for key G
    expect(tonicMidiFor(41, 4)).toBe(52);   // bass → E3 for key E
    expect(tonicMidiFor(60, 11)).toBe(71);  // treble → B4 for key B
  });

  it('result is always within one octave above the anchor', () => {
    for (const anchor of Object.values(CLEF_ANCHORS)) {
      for (let pc = 0; pc < 12; pc++) {
        const m = tonicMidiFor(anchor, pc);
        expect(m).toBeGreaterThanOrEqual(anchor);
        expect(m).toBeLessThan(anchor + 12);
        expect(((m % 12) + 12) % 12).toBe(pc);
      }
    }
  });
});

describe('scale etude roots on the requested key in every clef', () => {
  const study = STUDIES.find(s => s.id === 'scale-etude');

  it('bass clef, key C: the first pattern note is a C', () => {
    const song = buildSong(study, {
      keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass'], scaleId: 'major', actIdx: 0,
    });
    expect(((song.events[0].midi % 12) + 12) % 12).toBe(0);
  });

  it('C major etude in bass clef serializes with ZERO accidentals (the reported bug)', () => {
    const song = buildSong(study, {
      keyPc: 0, seed: 1, difficulty: 50, clefVoices: ['bass'], scaleId: 'major', actIdx: 0,
    });
    const xml = songToMusicXML(song, {
      bpm: song.bpm, tracks: ['melody'], clefOverrides: { melody: 'bass' },
      keySignatures: song.keySignatures,
    });
    expect(xml).toContain('<fifths>0</fifths>');
    expect(xml).not.toContain('<alter>');
  });

  it('alto clef, key D: first note is a D', () => {
    const song = buildSong(study, {
      keyPc: 2, seed: 1, difficulty: 50, clefVoices: ['alto'], scaleId: 'major', actIdx: 0,
    });
    expect(((song.events[0].midi % 12) + 12) % 12).toBe(2);
  });
});

describe('other builders root on the requested key in bass clef', () => {
  it('two-voice invention in C (bass+bass): opening chord symbol is C-rooted', () => {
    const study = STUDIES.find(s => s.id === 'two-voice-invention');
    const song = buildSong(study, {
      keyPc: 0, seed: 42, difficulty: 50, clefVoices: ['bass', 'bass'], duetStyleId: 'free',
    });
    // Act I opens on degree 1 of the 'pop' progression — the tonic chord.
    expect(song.chordSymbols[0][0]).toBe('C');
  });

  it('solo etude in C (bass): opening chord symbol is C-rooted', () => {
    const study = STUDIES.find(s => s.id === 'solo-etude');
    const song = buildSong(study, {
      keyPc: 0, seed: 42, difficulty: 50, clefVoices: ['bass'],
    });
    expect(song.chordSymbols[0][0]).toBe('C');
  });

  it('modal vamp in C (bass): opening chord symbol is C-rooted', () => {
    const study = STUDIES.find(s => s.id === 'modal-vamp');
    const song = buildSong(study, {
      keyPc: 0, seed: 42, difficulty: 50, clefVoices: ['bass'],
    });
    expect(song.chordSymbols[0][0]).toBe('C');
  });
});
