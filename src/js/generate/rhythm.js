import { weighted } from './rng.js';

// Rhythm templates split into two families:
//  - the STRAIGHT family (straight / sparse / driving, and the 'auto'
//    default) never syncopates and never uses augmentation dots. It tiles
//    each bar with clean cells — eighth-pairs, quarters, and (when `variety`
//    is on) halves/wholes. Swing only leans the eighth-pairs long-short; at
//    swing 0 the line is dead straight.
//  - the SYNCOPATED family deliberately places off-beat onsets (and swing
//    shifts them further). This is the only source of syncopation.
const TEMPLATES = {
  straight:   { variety: false },
  sparse:     { variety: true },
  driving:    { variety: false },
  syncopated: { syncopate: true },
};

/** @param {() => number} rng @returns {{ atBeat: number, durationBeats: number, isDownbeat: boolean, onBeat: boolean }[]} */
export function generateRhythm(rng, { bars = 4, beatsPerBar = 4, density = 0.65, swing = 0, template = 'auto' }) {
  const tpl = TEMPLATES[template];
  if (tpl && tpl.syncopate) {
    return generateSyncopatedRhythm(rng, { bars, beatsPerBar, density, swing });
  }
  // 'auto' (no named template) keeps a little variety; named straight
  // templates only get halves/wholes when they opt in.
  const variety = tpl ? !!tpl.variety : true;
  return generateStraightRhythm(rng, { bars, beatsPerBar, density, swing, variety });
}

// Continuous, dot-free line. Walks a cursor beat-by-beat, filling each step
// with a clean cell. No rests, no off-beat onsets except the second half of
// an eighth-pair (which swing may lean later).
function generateStraightRhythm(rng, { bars, beatsPerBar, density, swing, variety }) {
  const onsets = [];
  const total = bars * beatsPerBar;
  let beat = 0;

  while (beat < total - 1e-9) {
    const posInBar = beat % beatsPerBar;
    const atBarStart = posInBar < 1e-9;
    const remainingInBar = beatsPerBar - posInBar;
    const remainingTotal = total - beat;

    const choices = ['eighths', 'quarter'];
    const weights = [density * 1.6, 1.0];
    if (variety && remainingInBar >= 2 - 1e-9 && remainingTotal >= 2 - 1e-9) {
      choices.push('half');
      weights.push((1 - density) * 1.0);
    }
    if (variety && atBarStart && beatsPerBar >= 4 && remainingTotal >= 4 - 1e-9) {
      choices.push('whole');
      weights.push((1 - density) * 0.35);
    }
    const cell = weighted(rng, choices, weights);

    if (cell === 'eighths') {
      // Swing leans the pair long-short; the exact ratio is quantized to
      // dotted-8th + 16th by the serializer, but playback stays smooth.
      const delay = swing > 0 ? swing * (1 / 6) : 0;
      const off = beat + 0.5 + delay;
      onsets.push({ atBeat: beat, durationBeats: 0.5 + delay, isDownbeat: atBarStart, onBeat: true });
      onsets.push({ atBeat: off, durationBeats: (beat + 1) - off, isDownbeat: false, onBeat: false });
      beat += 1;
    } else if (cell === 'quarter') {
      onsets.push({ atBeat: beat, durationBeats: 1, isDownbeat: atBarStart, onBeat: true });
      beat += 1;
    } else if (cell === 'half') {
      onsets.push({ atBeat: beat, durationBeats: 2, isDownbeat: atBarStart, onBeat: true });
      beat += 2;
    } else {
      onsets.push({ atBeat: beat, durationBeats: 4, isDownbeat: true, onBeat: true });
      beat += 4;
    }
  }

  return onsets;
}

// The original slot-based generator — off-beat onsets fire on their own
// merit and swing shifts them. Kept for the 'syncopated' template only.
function generateSyncopatedRhythm(rng, { bars, beatsPerBar, density, swing }) {
  const slots = bars * beatsPerBar * 2;
  const onsets = [];
  const tpl = { onBeatBonus: 0.5, offBeatPenalty: 1.8 };

  for (let s = 0; s < slots; s++) {
    const onBeat = s % 2 === 0;
    const isDownbeat = s % (beatsPerBar * 2) === 0;

    let w;
    if (isDownbeat) w = 1.0;
    else w = density * (onBeat ? tpl.onBeatBonus : tpl.offBeatPenalty);

    const fire = isDownbeat || rng() < w;
    if (!fire) continue;

    let atBeat = s / 2;
    if (!onBeat && swing > 0) atBeat += swing * 0.5;

    onsets.push({ atBeat, durationBeats: 0, isDownbeat, onBeat });
  }

  const totalBeats = bars * beatsPerBar;
  for (let i = 0; i < onsets.length; i++) {
    const nextBeat = i < onsets.length - 1 ? onsets[i + 1].atBeat : totalBeats;
    const gap = nextBeat - onsets[i].atBeat;
    const legato = 0.6 + rng() * 0.35;
    const raw = gap * legato;
    const snapped = Math.round(raw * 2) / 2;
    onsets[i].durationBeats = Math.max(0.5, Math.min(snapped, 4));
  }

  return onsets;
}
