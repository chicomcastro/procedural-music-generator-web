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
    return generateCallAndResponse(rng, { melody, tonic, scale, bars, beatsPerBar }).response;
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

/**
 * True call-and-response: the two voices trade the melody in alternating
 * phrases. Voice 1 (the "call") plays a phrase and then rests; voice 2 (the
 * "answer") echoes that phrase transposed into its lower register, then
 * rests while voice 1 asks again. Phrase lengths vary between 1 and 2 bars,
 * and an answer occasionally enters early (stretto/imitation) so the two
 * voices briefly overlap.
 *
 * @returns {{ call: Object[], response: Object[] }} the upper (call) and
 *   lower (answer) voice events; the caller renders `call` as voice 1 and
 *   `response` as voice 2.
 */
export function generateCallAndResponse(rng, { melody, tonic, scale, bars = 4, beatsPerBar = 4 }) {
  if (!melody || melody.length === 0) return { call: [], response: [] };

  const melMin = Math.min(...melody.map(m => m.midi));
  const candidates = scaleNotesInRange(tonic, scale, melMin - 19, melMin + 2);
  const lower = (midi) => (candidates.length ? findClosest(candidates, midi - 12) : midi - 12);

  // Partition the act into call→answer PAIRS. Each pair picks a length of
  // 1 or 2 bars; the answer mirrors the call's length so the echo fills the
  // phrase exactly (no dead bars). A leftover bar at the end becomes a final
  // unanswered call.
  const phrases = [];
  let bar = 0;
  while (bar < bars) {
    let len = rng() < 0.5 ? 1 : 2;
    if (bar + len > bars) len = bars - bar;
    phrases.push({ startBar: bar, len, voice: 0 });   // call
    bar += len;
    if (bar >= bars) break;
    let alen = len;
    if (bar + alen > bars) alen = bars - bar;
    phrases.push({ startBar: bar, len: alen, voice: 1 });   // answer
    bar += alen;
  }

  const notesInBars = (startBar, endBar) => melody.filter(m => {
    const b = Math.floor(m.atBeat / beatsPerBar);
    return b >= startBar && b < endBar;
  });

  const call = [];
  const response = [];
  let material = null; // the most recent call's notes, for the answer to echo

  for (const ph of phrases) {
    const startBeat = ph.startBar * beatsPerBar;
    const endBeat = startBeat + ph.len * beatsPerBar;

    if (ph.voice === 0) {
      const notes = notesInBars(ph.startBar, ph.startBar + ph.len);
      for (const m of notes) call.push({ ...m });
      if (notes.length) material = notes;
      continue;
    }

    // Answer: replay the previous call's contour, transposed down, shifted
    // to this phrase. Fall back to this phrase's own melody if there's no
    // prior call (can't happen for phrase 0, but keeps it safe).
    const src = (material && material.length) ? material : notesInBars(ph.startBar, ph.startBar + ph.len);
    if (!src.length) continue;
    const srcStart = src[0].atBeat;
    const overlap = rng() < 0.3 ? Math.min(2, startBeat) : 0;   // occasional stretto
    const offset = (startBeat - overlap) - srcStart;

    for (const m of src) {
      const at = m.atBeat + offset;
      if (at < startBeat - overlap - 1e-9) continue;
      if (at >= endBeat - 1e-9) break;
      response.push({
        midi: lower(m.midi),
        atBeat: at,
        durationBeats: Math.min(m.durationBeats, endBeat - at),
        velocity: (m.velocity ?? 0.8) * 0.85,
      });
    }
  }

  return { call, response };
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
