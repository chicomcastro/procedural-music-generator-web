import { scaleNotes } from '../theory/scales.js';
import { pitchClass } from '../theory/notes.js';
import { weighted, pick } from './rng.js';

function distanceWeight(candidate, prev) {
  const d = Math.abs(candidate - prev);
  if (d === 0) return 0.25;
  if (d <= 2) return 3.0;
  if (d <= 4) return 1.4;
  if (d <= 7) return 0.5;
  return 0.1;
}

function findActiveChord(progression, atBeat) {
  for (const c of progression) {
    if (atBeat >= c.startBeat && atBeat < c.startBeat + c.durationBeats) return c;
  }
  return null;
}

export function generateMelody(rng, { progression, rhythm, scale, tonic, range = [tonic - 5, tonic + 14] }) {
  const allowed = scaleNotes(tonic, scale, 4).filter(n => n >= range[0] && n <= range[1]);
  if (allowed.length === 0) throw new Error('Empty melody range; check tonic/scale/range');

  const startCandidates = allowed.filter(n => n >= range[0] + 4 && n <= range[1] - 4);
  let prev = pick(rng, startCandidates.length ? startCandidates : allowed);

  const events = [];

  for (let i = 0; i < rhythm.length; i++) {
    const onset = rhythm[i];
    const isLast = i === rhythm.length - 1;
    const active = findActiveChord(progression, onset.atBeat);
    const chordPCs = active ? new Set(active.notes.map(pitchClass)) : null;

    let candidates = allowed;
    let weights;

    if (isLast) {
      const tonicPC = pitchClass(tonic);
      const tonicNotes = allowed.filter(n => pitchClass(n) === tonicPC);
      candidates = tonicNotes.length ? tonicNotes : allowed;
      weights = candidates.map(c => distanceWeight(c, prev));
    } else if (onset.isDownbeat && chordPCs) {
      const chordTones = allowed.filter(n => chordPCs.has(pitchClass(n)));
      candidates = chordTones.length ? chordTones : allowed;
      weights = candidates.map(c => distanceWeight(c, prev));
    } else if (onset.onBeat && chordPCs) {
      weights = candidates.map(c => {
        const base = distanceWeight(c, prev);
        const bonus = chordPCs.has(pitchClass(c)) ? 1.6 : 1.0;
        return base * bonus;
      });
    } else {
      weights = candidates.map(c => distanceWeight(c, prev));
    }

    const next = weighted(rng, candidates, weights);
    events.push({
      midi: next,
      atBeat: onset.atBeat,
      durationBeats: onset.durationBeats,
      velocity: onset.isDownbeat ? 0.8 : 0.65,
    });
    prev = next;
  }

  return events;
}
