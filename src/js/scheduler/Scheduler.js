const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_TIME = 0.1;

export function createScheduler(ctx, transport, onBeat) {
  let intervalId = null;
  let nextNoteTime = 0;
  let currentBeat = 0;

  function tick() {
    while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_TIME) {
      onBeat(currentBeat, nextNoteTime);
      currentBeat += 1;
      nextNoteTime += transport.beatDuration;
    }
  }

  return {
    get isPlaying() { return intervalId !== null; },
    get currentBeat() { return currentBeat; },

    start() {
      if (intervalId !== null) return;
      currentBeat = 0;
      nextNoteTime = ctx.currentTime + 0.05;
      intervalId = setInterval(tick, LOOKAHEAD_MS);
    },

    stop() {
      if (intervalId === null) return;
      clearInterval(intervalId);
      intervalId = null;
    },
  };
}
