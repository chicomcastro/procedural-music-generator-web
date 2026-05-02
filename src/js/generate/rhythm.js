const TEMPLATES = {
  straight: { onBeatBonus: 1.5, offBeatPenalty: 0.4 },
  syncopated: { onBeatBonus: 0.5, offBeatPenalty: 1.8 },
  sparse: { onBeatBonus: 0.8, offBeatPenalty: 0.2 },
  driving: { onBeatBonus: 2.0, offBeatPenalty: 0.6 },
};

/** @param {() => number} rng @returns {{ atBeat: number, durationBeats: number, isDownbeat: boolean, onBeat: boolean }[]} */
export function generateRhythm(rng, { bars = 4, beatsPerBar = 4, density = 0.65, swing = 0, template = 'auto' }) {
  const slots = bars * beatsPerBar * 2;
  const onsets = [];
  const tpl = TEMPLATES[template] || null;

  for (let s = 0; s < slots; s++) {
    const onBeat = s % 2 === 0;
    const isDownbeat = s % (beatsPerBar * 2) === 0;

    let w;
    if (isDownbeat) {
      w = 1.0;
    } else if (tpl) {
      w = density * (onBeat ? tpl.onBeatBonus : tpl.offBeatPenalty);
    } else {
      w = onBeat ? density * 1.2 : density * 0.7;
    }

    const fire = isDownbeat || rng() < w;
    if (!fire) continue;

    let atBeat = s / 2;
    if (!onBeat && swing > 0) atBeat += swing * 0.5;

    onsets.push({
      atBeat,
      durationBeats: 0.5,
      isDownbeat,
      onBeat,
    });
  }

  return onsets;
}
