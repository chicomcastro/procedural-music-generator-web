import { scaleNotes } from '../theory/scales.js';
import { weighted } from './rng.js';

/**
 * Interval consonance weights (semitones mod 12).
 */
const CONSONANCE = [
  /* 0 unison */ 0.3,
  /* 1 */ 0.1,
  /* 2 */ 0.1,
  /* 3 m3 */ 3.0,
  /* 4 M3 */ 3.0,
  /* 5 P4 */ 1.0,
  /* 6 tritone */ 0.05,
  /* 7 P5 */ 1.5,
  /* 8 m6 */ 2.5,
  /* 9 M6 */ 2.5,
  /* 10 */ 0.1,
  /* 11 */ 0.1,
];

/**
 * Get all in-scale notes in a MIDI range.
 */
function scaleNotesInRange(tonic, scale, low, high) {
  // Generate enough octaves to cover the range
  const baseRoot = tonic % 12;
  const notes = [];
  for (let oct = -2; oct < 8; oct++) {
    for (const n of scaleNotes(baseRoot, scale, 1)) {
      const midi = n + oct * 12;
      if (midi >= low && midi <= high) notes.push(midi);
    }
  }
  return [...new Set(notes)].sort((a, b) => a - b);
}

/**
 * Shift a melody note down by `steps` scale degrees, staying in scale.
 */
function shiftByScaleDegrees(midi, tonic, scale, steps) {
  const pool = scaleNotesInRange(tonic, scale, 0, 127);
  const idx = pool.indexOf(midi);
  if (idx === -1) {
    // Find closest in-scale note
    let closest = pool[0];
    for (const n of pool) {
      if (Math.abs(n - midi) < Math.abs(closest - midi)) closest = n;
    }
    const ci = pool.indexOf(closest);
    const target = ci - steps;
    return target >= 0 ? pool[target] : pool[0];
  }
  const target = idx - steps;
  return target >= 0 ? pool[target] : pool[0];
}

/**
 * Generate a counterpoint (melody2) line against an existing melody.
 *
 * @param {() => number} rng
 * @param {{ melody: Object[], progression: Object[], scale: string, tonic: number, mode: string, independence: number }} opts
 * @returns {{ midi: number, atBeat: number, durationBeats: number, velocity: number }[]}
 */
export function generateCounterpoint(rng, { melody, scale, tonic, mode = 'parallel_thirds', independence = 0.5 }) {
  if (!melody || melody.length === 0) return [];

  // Voice range: roughly an octave below melody
  const melodyMidis = melody.map(m => m.midi);
  const melMin = Math.min(...melodyMidis);
  const rangeLow = melMin - 19;
  const rangeHigh = melMin + 2;
  const candidates = scaleNotesInRange(tonic, scale, rangeLow, rangeHigh);
  if (candidates.length === 0) return [];

  // Blend factor: independence 0 = pure parallel thirds, 1 = full algorithm
  const blend = Math.max(0, Math.min(1, independence));

  if (mode === 'parallel_thirds' || (blend === 0 && mode !== 'call_response')) {
    return melody.map(m => ({
      midi: shiftByScaleDegrees(m.midi, tonic, scale, 2),
      atBeat: m.atBeat,
      durationBeats: m.durationBeats,
      velocity: m.velocity * 0.85,
    }));
  }

  if (mode === 'parallel_sixths') {
    return melody.map(m => ({
      midi: shiftByScaleDegrees(m.midi, tonic, scale, 5),
      atBeat: m.atBeat,
      durationBeats: m.durationBeats,
      velocity: m.velocity * 0.85,
    }));
  }

  if (mode === 'call_response') {
    return generateCallResponse(rng, melody, tonic, scale, candidates);
  }

  // 'free' or 'contrary' modes — weighted counterpoint
  const contraryBias = mode === 'contrary' ? 5.0 : 1.0;
  return generateWeightedCounterpoint(rng, melody, candidates, tonic, scale, contraryBias, blend);
}

/**
 * Call-and-response: first half of each bar is silent, second half responds.
 */
function generateCallResponse(rng, melody, tonic, scale, candidates) {
  const events = [];
  for (const m of melody) {
    // Determine bar position — assume beats are absolute
    const posInBar = m.atBeat % 4; // works for 4/4; approximate for other meters
    const halfBar = 2; // second half starts at beat 2

    if (posInBar < halfBar) continue; // skip first half

    // Respond with shifted rhythm in second half
    const shifted = shiftByScaleDegrees(m.midi, tonic, scale, 2);
    const target = candidates.includes(shifted) ? shifted : findClosest(candidates, shifted);
    events.push({
      midi: target,
      atBeat: m.atBeat,
      durationBeats: m.durationBeats,
      velocity: m.velocity * 0.8,
    });
  }
  return events;
}

function findClosest(pool, midi) {
  let best = pool[0];
  let bestDist = Math.abs(pool[0] - midi);
  for (const n of pool) {
    const d = Math.abs(n - midi);
    if (d < bestDist) { bestDist = d; best = n; }
  }
  return best;
}

/**
 * Full weighted counterpoint with interval scoring, motion scoring,
 * and anti-parallel-fifths rule.
 */
function generateWeightedCounterpoint(rng, melody, candidates, tonic, scale, contraryBias, blend) {
  const events = [];
  let prev = findClosest(candidates, melody[0].midi - 12);
  let prevMelodyMidi = melody[0].midi;
  let prevInterval = Math.abs(melody[0].midi - prev) % 12;

  for (let i = 0; i < melody.length; i++) {
    const m = melody[i];
    const melodyDir = m.midi - prevMelodyMidi; // melody motion direction

    const weights = candidates.map(c => {
      // Interval consonance
      const interval = Math.abs(m.midi - c) % 12;
      let w = CONSONANCE[interval];

      // Distance from previous counterpoint note (prefer stepwise)
      const dist = Math.abs(c - prev);
      if (dist === 0) w *= 0.3;
      else if (dist <= 2) w *= 2.5;
      else if (dist <= 4) w *= 1.2;
      else if (dist <= 7) w *= 0.6;
      else w *= 0.15;

      // Motion scoring
      const cpDir = c - prev;
      if (contraryBias > 1) {
        // Contrary motion: reward moving opposite to melody
        if (melodyDir > 0 && cpDir < 0) w *= contraryBias;
        else if (melodyDir < 0 && cpDir > 0) w *= contraryBias;
        else if (melodyDir !== 0 && cpDir !== 0) w *= 0.4; // parallel motion penalty
      }

      // Anti-parallel-fifths: if previous interval was P5 (7) or P8 (0),
      // penalize next P5/P8 in same direction
      if ((prevInterval === 7 || prevInterval === 0) && (interval === 7 || interval === 0)) {
        const prevDir = prev - prevMelodyMidi > 0 ? 1 : -1;
        const curDir = c - m.midi > 0 ? 1 : -1;
        if (prevDir === curDir) w *= 0.05;
      }

      return Math.max(w, 0.001);
    });

    // Blend with parallel thirds based on independence
    if (blend < 1) {
      const thirdNote = shiftByScaleDegrees(m.midi, tonic, scale, 2);
      const thirdIdx = candidates.indexOf(thirdNote);
      if (thirdIdx >= 0) {
        // Boost the parallel-third candidate inversely proportional to independence
        const boost = (1 - blend) * 50;
        weights[thirdIdx] += boost;
      }
    }

    const chosen = weighted(rng, candidates, weights);
    events.push({
      midi: chosen,
      atBeat: m.atBeat,
      durationBeats: m.durationBeats,
      velocity: m.velocity * 0.8,
    });

    prevInterval = Math.abs(m.midi - chosen) % 12;
    prevMelodyMidi = m.midi;
    prev = chosen;
  }

  return events;
}
