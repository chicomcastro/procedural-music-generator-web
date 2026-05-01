export function createTransport({ bpm = 120, beatsPerBar = 4 } = {}) {
  const state = { bpm, beatsPerBar };
  return {
    get bpm() { return state.bpm; },
    get beatsPerBar() { return state.beatsPerBar; },
    get beatDuration() { return 60 / state.bpm; },
    setBpm(n) {
      if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid bpm: ${n}`);
      state.bpm = n;
    },
    setBeatsPerBar(n) {
      if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid beatsPerBar: ${n}`);
      state.beatsPerBar = n;
    },
  };
}
