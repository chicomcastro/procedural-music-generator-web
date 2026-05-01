export function createVoice(ctx, destination, opts) {
  const {
    buffer,
    playbackRate = 1,
    velocity = 0.9,
    attack = 0.005,
    when = ctx.currentTime,
    duration = null,
    releaseTime = 0.4,
  } = opts;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = playbackRate;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(velocity, when + attack);

  source.connect(gain);
  gain.connect(destination);
  source.start(when);

  let stopped = false;

  function disconnect() {
    try { source.disconnect(); } catch {}
    try { gain.disconnect(); } catch {}
  }

  if (duration !== null) {
    const releaseStart = when + duration;
    gain.gain.setValueAtTime(velocity, releaseStart);
    gain.gain.linearRampToValueAtTime(0, releaseStart + releaseTime);
    source.stop(releaseStart + releaseTime + 0.05);
    source.onended = disconnect;
    stopped = true;
  }

  function release(rt = releaseTime) {
    if (stopped) return;
    stopped = true;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + rt);
    source.stop(t + rt + 0.05);
    source.onended = disconnect;
  }

  return { release };
}
