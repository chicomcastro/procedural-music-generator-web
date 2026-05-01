import { progression as buildProgression, PROGRESSIONS } from '../theory/chords.js';
import { pick } from './rng.js';

/** @param {() => number} rng @returns {{ preset: string, chords: Object[] }} */
export function generateProgression(rng, { tonic, scale, bars = 4, beatsPerBar = 4, preset = null }) {
  const presetName = preset ?? pick(rng, Object.keys(PROGRESSIONS));
  const template = PROGRESSIONS[presetName];
  if (!template) throw new Error(`Unknown progression preset: ${presetName}`);

  const degrees = [];
  for (let b = 0; b < bars; b++) {
    degrees.push(template[b % template.length]);
  }

  const chords = buildProgression(tonic, scale, degrees);
  return {
    preset: presetName,
    chords: chords.map((notes, i) => ({
      degree: degrees[i],
      notes,
      startBeat: i * beatsPerBar,
      durationBeats: beatsPerBar,
    })),
  };
}
