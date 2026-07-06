/** @param {BaseAudioContext} ctx @param {AudioNode} destination @returns {{ release: (rt?: number) => void }} */
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

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800 + velocity * 14000;
  filter.Q.value = 0.7;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(velocity, when + attack);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(when);

  let stopped = false;

  function disconnect() {
    try { source.disconnect(); } catch {}
    try { filter.disconnect(); } catch {}
    try { gain.disconnect(); } catch {}
  }

  if (duration !== null) {
    const releaseStart = when + duration;
    gain.gain.setValueAtTime(velocity, releaseStart);
    gain.gain.linearRampToValueAtTime(0, releaseStart + releaseTime);
    source.stop(releaseStart + releaseTime + 0.05);
    source.onended = disconnect;
  }

  // Cut the note short — used to stop playback. Must work even for a voice
  // that was spawned with a fixed duration (the previous code flagged those
  // as `stopped` and made release a no-op, so paused playback kept sounding).
  // `stopped` here only guards against a double release.
  function release(rt = releaseTime) {
    if (stopped) return;
    stopped = true;
    const t = ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(t);
      if (when > t) {
        // Note hasn't started yet — silence it and stop before it sounds.
        gain.gain.setValueAtTime(0, t);
        source.stop(t);
      } else {
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t);
        gain.gain.linearRampToValueAtTime(0, t + rt);
        source.stop(t + rt + 0.05);
      }
    } catch { /* stop() throws if the source already ended */ }
    source.onended = disconnect;
  }

  return { release };
}
