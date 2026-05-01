export function generateRhythm(rng, { bars = 4, beatsPerBar = 4, density = 0.65, swing = 0 }) {
  const slots = bars * beatsPerBar * 2;
  const onsets = [];

  for (let s = 0; s < slots; s++) {
    const onBeat = s % 2 === 0;
    const isDownbeat = s % (beatsPerBar * 2) === 0;
    const w = isDownbeat ? 1.0 : (onBeat ? density * 1.2 : density * 0.7);

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
