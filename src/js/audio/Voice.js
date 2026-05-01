export function createVoice(ctx, destination, { buffer, playbackRate = 1, velocity = 0.9, attack = 0.005 }) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = playbackRate;

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(velocity, now + attack);

  source.connect(gain);
  gain.connect(destination);
  source.start(now);

  let stopped = false;

  function release(releaseTime = 0.4) {
    if (stopped) return;
    stopped = true;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + releaseTime);
    source.stop(t + releaseTime + 0.05);
    source.onended = () => {
      try { source.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };
  }

  return { release };
}
