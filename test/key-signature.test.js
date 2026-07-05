// Tests for key signatures + note spelling in generated MusicXML (PR Q).
// Regression for: "key signature always renders as C even after changing
// the key" — <fifths> was hardcoded to 0 and black keys always spelled
// as sharps regardless of key.
import { describe, it, expect } from 'vitest';
import { keyFifths } from '../src/js/theory/scales.js';
import { songToMusicXML } from '../src/js/export/musicxml.js';

describe('keyFifths', () => {
  it('major keys around the circle of fifths', () => {
    expect(keyFifths(0, 'major')).toBe(0);    // C
    expect(keyFifths(7, 'major')).toBe(1);    // G
    expect(keyFifths(2, 'major')).toBe(2);    // D
    expect(keyFifths(9, 'major')).toBe(3);    // A
    expect(keyFifths(4, 'major')).toBe(4);    // E
    expect(keyFifths(11, 'major')).toBe(5);   // B
    expect(keyFifths(6, 'major')).toBe(6);    // F# (over Gb)
    expect(keyFifths(5, 'major')).toBe(-1);   // F
    expect(keyFifths(10, 'major')).toBe(-2);  // Bb
    expect(keyFifths(3, 'major')).toBe(-3);   // Eb
    expect(keyFifths(8, 'major')).toBe(-4);   // Ab
    expect(keyFifths(1, 'major')).toBe(-5);   // Db
  });

  it('minor keys take the relative-major signature', () => {
    expect(keyFifths(9, 'natural_minor')).toBe(0);   // Am ↔ C
    expect(keyFifths(4, 'natural_minor')).toBe(1);   // Em ↔ G
    expect(keyFifths(5, 'natural_minor')).toBe(-4);  // Fm ↔ Ab (the reported bug!)
    expect(keyFifths(0, 'natural_minor')).toBe(-3);  // Cm ↔ Eb
    expect(keyFifths(10, 'natural_minor')).toBe(-5); // Bbm ↔ Db
    // Harmonic/melodic minor share the natural-minor signature.
    expect(keyFifths(9, 'harmonic_minor')).toBe(0);
    expect(keyFifths(9, 'melodic_minor')).toBe(0);
  });

  it('modes take the signature of the major scale with the same notes', () => {
    expect(keyFifths(2, 'dorian')).toBe(0);       // D dorian ↔ C
    expect(keyFifths(7, 'mixolydian')).toBe(0);   // G mixo ↔ C
    expect(keyFifths(5, 'lydian')).toBe(0);       // F lydian ↔ C
    expect(keyFifths(4, 'phrygian')).toBe(0);     // E phrygian ↔ C
    expect(keyFifths(9, 'dorian')).toBe(1);       // A dorian ↔ G
  });

  it('pentatonics + blues inherit their parent signature', () => {
    expect(keyFifths(0, 'pentatonic_major')).toBe(0);
    expect(keyFifths(9, 'pentatonic_minor')).toBe(0);
    expect(keyFifths(5, 'blues')).toBe(-4);       // F blues ↔ F minor world
  });

  it('unknown scale falls back to major', () => {
    expect(keyFifths(7, 'weird_scale')).toBe(1);
  });
});

function makeSong(events, extra = {}) {
  return {
    bars: 2,
    beatsPerBar: 4,
    lengthBeats: 8,
    events,
    ...extra,
  };
}

describe('songToMusicXML — key signatures', () => {
  it('emits fifths 0 with no key information (back-compat)', () => {
    const xml = songToMusicXML(makeSong([{ type: 'melody', midi: 60, atBeat: 0, durationBeats: 1, velocity: 0.7 }]));
    expect(xml).toContain('<fifths>0</fifths>');
  });

  it('keySignatures option drives <fifths> in the first measure', () => {
    const xml = songToMusicXML(
      makeSong([{ type: 'melody', midi: 60, atBeat: 0, durationBeats: 1, velocity: 0.7 }]),
      { keySignatures: [{ bar: 0, fifths: -4 }] },
    );
    expect(xml).toContain('<fifths>-4</fifths>');
    expect(xml).not.toContain('<fifths>0</fifths>');
  });

  it('emits a mid-piece key change at the declared bar', () => {
    const xml = songToMusicXML(
      makeSong([{ type: 'melody', midi: 60, atBeat: 0, durationBeats: 1, velocity: 0.7 }], { bars: 4, lengthBeats: 16 }),
      { keySignatures: [{ bar: 0, fifths: 1 }, { bar: 2, fifths: -3 }] },
    );
    expect(xml).toContain('<fifths>1</fifths>');
    expect(xml).toContain('<fifths>-3</fifths>');
    // The change lives in measure 3 (bar index 2).
    const m3 = xml.slice(xml.indexOf('<measure number="3">'), xml.indexOf('<measure number="4">'));
    expect(m3).toContain('<fifths>-3</fifths>');
  });

  it('derives the signature from song.tonic + song.scale when no option given (Generator path)', () => {
    const xml = songToMusicXML(
      makeSong([{ type: 'melody', midi: 65, atBeat: 0, durationBeats: 1, velocity: 0.7 }], { tonic: 65, scale: 'major' }),
    );
    // F major → 1 flat.
    expect(xml).toContain('<fifths>-1</fifths>');
  });
});

describe('songToMusicXML — note spelling follows the key', () => {
  it('flat keys spell black keys flat-wise (Ab, not G#)', () => {
    // MIDI 68 = G#/Ab. In F minor (fifths -4) it must be A-flat.
    const xml = songToMusicXML(
      makeSong([{ type: 'melody', midi: 68, atBeat: 0, durationBeats: 1, velocity: 0.7 }]),
      { keySignatures: [{ bar: 0, fifths: -4 }] },
    );
    expect(xml).toContain('<step>A</step>');
    expect(xml).toContain('<alter>-1</alter>');
    expect(xml).not.toContain('<alter>1</alter>');
  });

  it('sharp keys keep sharp-wise spelling (F#, not Gb)', () => {
    // MIDI 66 = F#/Gb. In G major (fifths 1) it must be F-sharp.
    const xml = songToMusicXML(
      makeSong([{ type: 'melody', midi: 66, atBeat: 0, durationBeats: 1, velocity: 0.7 }]),
      { keySignatures: [{ bar: 0, fifths: 1 }] },
    );
    expect(xml).toContain('<step>F</step>');
    expect(xml).toContain('<alter>1</alter>');
  });

  it('spelling switches at a mid-piece key change', () => {
    const events = [
      { type: 'melody', midi: 66, atBeat: 0, durationBeats: 1, velocity: 0.7 },  // bar 0 (sharp key) → F#
      { type: 'melody', midi: 66, atBeat: 8, durationBeats: 1, velocity: 0.7 },  // bar 2 (flat key) → Gb
    ];
    const xml = songToMusicXML(
      makeSong(events, { bars: 4, lengthBeats: 16 }),
      { keySignatures: [{ bar: 0, fifths: 1 }, { bar: 2, fifths: -2 }] },
    );
    const m1 = xml.slice(xml.indexOf('<measure number="1">'), xml.indexOf('<measure number="2">'));
    const m3 = xml.slice(xml.indexOf('<measure number="3">'), xml.indexOf('<measure number="4">'));
    expect(m1).toContain('<step>F</step>');
    expect(m1).toContain('<alter>1</alter>');
    expect(m3).toContain('<step>G</step>');
    expect(m3).toContain('<alter>-1</alter>');
  });
});

describe('Practice builders attach keySignatures', () => {
  it('two-voice invention carries a per-act signature reflecting keyShift', async () => {
    const { __test } = await import('../src/js/ui/PracticeView.js');
    const { STUDIES } = await import('../src/js/ui/practice-studies.js');
    const study = STUDIES.find(s => s.id === 'two-voice-invention');
    // Key of F (pc 5). Act I: major-ish 'pop' progression in F; act II
    // shifts +9 (relative minor world).
    const song = __test.buildSong(study, {
      keyPc: 5, seed: 42, difficulty: 50,
      clefVoices: ['bass', 'bass'], duetStyleId: 'free',
    });
    expect(Array.isArray(song.keySignatures)).toBe(true);
    expect(song.keySignatures.length).toBe(study.acts.length);
    expect(song.keySignatures[0].bar).toBe(0);
    // F major → -1.
    expect(song.keySignatures[0].fifths).toBe(-1);
    // Acts start at increasing bars.
    for (let i = 1; i < song.keySignatures.length; i++) {
      expect(song.keySignatures[i].bar).toBeGreaterThan(song.keySignatures[i - 1].bar);
    }
  });

  it('walking-bass workout carries signatures for its acts', async () => {
    const { __test } = await import('../src/js/ui/PracticeView.js');
    const { STUDIES } = await import('../src/js/ui/practice-studies.js');
    const study = STUDIES.find(s => s.id === 'walking-bass-workout');
    const song = __test.buildSong(study, {
      keyPc: 0, seed: 7, difficulty: 50, clefVoices: ['bass'],
    });
    expect(song.keySignatures.length).toBe(study.acts.length);
    // Act I is C major → 0.
    expect(song.keySignatures[0].fifths).toBe(0);
  });

  it('scale etude signature follows the scale override', async () => {
    const { __test } = await import('../src/js/ui/PracticeView.js');
    const { STUDIES } = await import('../src/js/ui/practice-studies.js');
    const study = STUDIES.find(s => s.id === 'scale-etude');
    const song = __test.buildSong(study, {
      keyPc: 5, seed: 3, difficulty: 50, clefVoices: ['treble'],
      scaleId: 'natural_minor',
    });
    // F natural minor → -4 (the exact case from the bug report).
    expect(song.keySignatures[0].fifths).toBe(-4);
  });
});
