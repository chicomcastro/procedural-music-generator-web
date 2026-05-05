import { scaleNotes } from '../theory/scales.js';
import { weighted } from './rng.js';
import { generateRhythm } from './rhythm.js';

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

function scaleNotesInRange(tonic, scale, low, high) {
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

function shiftByScaleDegrees(midi, tonic, scale, steps) {
  const pool = scaleNotesInRange(tonic, scale, 0, 127);
  const idx = pool.indexOf(midi);
  if (idx === -1) {
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
 * Find the melody note sounding at a given beat (or the closest preceding one).
 */
function melodyAtBeat(melody, beat) {
  let best = melody[0];
  for (const m of melody) {
    if (m.atBeat <= beat) best = m;
    else break;
  }
  return best;
}

/**
 * @param {() => number} rng
 * @param {{ melody: Object[], scale: string, tonic: number, mode: string, independence: number, bars?: number, beatsPerBar?: number, density?: number, swing?: number, rhythmTemplate?: string }} opts
 */
export function generateCounterpoint(rng, {
  melody, scale, tonic, mode = 'parallel_thirds', independence = 0.5,
  bars = 4, beatsPerBar = 4, density = 0.65, swing = 0, rhythmTemplate = 'auto',
}) {
  if (!melody || melody.length === 0) return [];

  const melodyMidis = melody.map(m => m.midi);
  const melMin = Math.min(...melodyMidis);
  const rangeLow = melMin - 19;
  const rangeHigh = melMin + 2;
  const candidates = scaleNotesInRange(tonic, scale, rangeLow, rangeHigh);
  if (candidates.length === 0) return [];

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
    return generateCallResponse(rng, melody, tonic, scale, candidates, beatsPerBar);
  }

  // 'free' or 'contrary' — independent rhythm + weighted pitch selection
  const contraryBias = mode === 'contrary' ? 5.0 : 1.0;
  const rhythm2 = generateRhythm(rng, {
    bars, beatsPerBar,
    density: density * 0.8,
    swing,
    template: rhythmTemplate,
  });
  return generateIndependentCounterpoint(rng, melody, rhythm2, candidates, tonic, scale, contraryBias, blend);
}

function generateCallResponse(rng, melody, tonic, scale, candidates, beatsPerBar) {
  const events = [];
  const halfBar = beatsPerBar / 2;
  for (const m of melody) {
    const posInBar = m.atBeat % beatsPerBar;
    if (posInBar < halfBar) continue;
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

/**
 * Independent rhythm counterpoint: generate pitches for a separate rhythm
 * pattern, scoring against the concurrent melody note.
 */
function generateIndependentCounterpoint(rng, melody, rhythm, candidates, tonic, scale, contraryBias, blend) {
  const events = [];
  let prev = findClosest(candidates, melody[0].midi - 12);
  let prevMelodyMidi = melody[0].midi;
  let prevInterval = Math.abs(melody[0].midi - prev) % 12;

  for (let i = 0; i < rhythm.length; i++) {
    const onset = rhythm[i];
    const concurrent = melodyAtBeat(melody, onset.atBeat);
    const melodyDir = concurrent.midi - prevMelodyMidi;

    const weights = candidates.map(c => {
      const interval = Math.abs(concurrent.midi - c) % 12;
      let w = CONSONANCE[interval];

      const dist = Math.abs(c - prev);
      if (dist === 0) w *= 0.3;
      else if (dist <= 2) w *= 2.5;
      else if (dist <= 4) w *= 1.2;
      else if (dist <= 7) w *= 0.6;
      else w *= 0.15;

      const cpDir = c - prev;
      if (contraryBias > 1) {
        if (melodyDir > 0 && cpDir < 0) w *= contraryBias;
        else if (melodyDir < 0 && cpDir > 0) w *= contraryBias;
        else if (melodyDir !== 0 && cpDir !== 0) w *= 0.4;
      }

      if ((prevInterval === 7 || prevInterval === 0) && (interval === 7 || interval === 0)) {
        const prevDir = prev - prevMelodyMidi > 0 ? 1 : -1;
        const curDir = c - concurrent.midi > 0 ? 1 : -1;
        if (prevDir === curDir) w *= 0.05;
      }

      return Math.max(w, 0.001);
    });

    if (blend < 1) {
      const thirdNote = shiftByScaleDegrees(concurrent.midi, tonic, scale, 2);
      const thirdIdx = candidates.indexOf(thirdNote);
      if (thirdIdx >= 0) {
        weights[thirdIdx] += (1 - blend) * 50;
      }
    }

    const chosen = weighted(rng, candidates, weights);
    events.push({
      midi: chosen,
      atBeat: onset.atBeat,
      durationBeats: onset.durationBeats,
      velocity: (onset.isDownbeat ? 0.7 : 0.55),
    });

    prevInterval = Math.abs(concurrent.midi - chosen) % 12;
    prevMelodyMidi = concurrent.midi;
    prev = chosen;
  }

  return events;
}
