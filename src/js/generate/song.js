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

  for (const c of chords) {
    const root = Math.min(...c.notes) % 12;
    const bassMidi = 36 + root;
    events.push({
      type: 'bass',
      midi: bassMidi,
      atBeat: c.startBeat,
      durationBeats: c.durationBeats * 0.8,
      velocity: 0.55,
    });
    if (c.durationBeats >= 2 && rng() > 0.4) {
      events.push({
        type: 'bass',
        midi: bassMidi,
        atBeat: c.startBeat + c.durationBeats / 2,
        durationBeats: c.durationBeats * 0.3,
        velocity: 0.4,
      });
    }
  }

  const totalBeats = bars * beatsPerBar;
  for (let beat = 0; beat < totalBeats; beat++) {
    const posInBar = beat % beatsPerBar;
    if (posInBar === 0) {
      events.push({ type: 'drum', drum: 'kick', atBeat: beat, durationBeats: 0.25, velocity: 0.7, midi: 36 });
    }
    if (beatsPerBar === 4 && posInBar === 2) {
      events.push({ type: 'drum', drum: 'snare', atBeat: beat, durationBeats: 0.25, velocity: 0.55, midi: 38 });
    } else if (beatsPerBar === 3 && posInBar === 1) {
      events.push({ type: 'drum', drum: 'snare', atBeat: beat, durationBeats: 0.25, velocity: 0.5, midi: 38 });
    }
    if (rng() > 0.35) {
      events.push({ type: 'drum', drum: 'hat', atBeat: beat, durationBeats: 0.15, velocity: 0.3, midi: 42 });
    }
    if (rng() > 0.6) {
      events.push({ type: 'drum', drum: 'hat', atBeat: beat + 0.5, durationBeats: 0.1, velocity: 0.2, midi: 42 });
    }
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
