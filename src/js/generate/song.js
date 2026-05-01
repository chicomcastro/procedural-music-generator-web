import { mulberry32, randomSeed } from './rng.js';
import { generateProgression } from './progression.js';
import { generateRhythm } from './rhythm.js';
import { generateMelody } from './melody.js';

/** @returns {{ seed: number, tonic: number, scale: string, bars: number, beatsPerBar: number, preset: string, lengthBeats: number, events: Object[] }} */
export function generateSong({
  seed = randomSeed(),
  tonic = 60,
  scale = 'major',
  bars = 4,
  beatsPerBar = 4,
  density = 0.65,
  swing = 0,
} = {}) {
  const rng = mulberry32(seed);

  const { preset, chords } = generateProgression(rng, { tonic, scale, bars, beatsPerBar });
  const rhythm = generateRhythm(rng, { bars, beatsPerBar, density, swing });
  const melody = generateMelody(rng, {
    progression: chords,
    rhythm,
    scale,
    tonic,
  });

  const events = [];

  for (const c of chords) {
    for (const note of c.notes) {
      events.push({
        type: 'chord',
        midi: note - 12,
        atBeat: c.startBeat,
        durationBeats: c.durationBeats - 0.05,
        velocity: 0.4,
      });
    }
  }

  for (const m of melody) {
    events.push({
      type: 'melody',
      midi: m.midi,
      atBeat: m.atBeat,
      durationBeats: m.durationBeats,
      velocity: m.velocity,
    });
  }

  events.sort((a, b) => a.atBeat - b.atBeat);

  return {
    seed,
    tonic,
    scale,
    bars,
    beatsPerBar,
    preset,
    lengthBeats: bars * beatsPerBar,
    events,
  };
}
