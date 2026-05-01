export function playDrumHit(ctx, destination, { drum = 'kick', when = ctx.currentTime, velocity = 0.7 }) {
  if (drum === 'kick') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(40, when + 0.1);
    gain.gain.setValueAtTime(velocity, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.3);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(when);
    osc.stop(when + 0.3);
    return;
  }

  if (drum === 'snare') {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, when);
    osc.frequency.exponentialRampToValueAtTime(100, when + 0.05);
    oscGain.gain.setValueAtTime(velocity * 0.6, when);
    oscGain.gain.exponentialRampToValueAtTime(0.001, when + 0.1);
    osc.connect(oscGain);
    oscGain.connect(destination);
    osc.start(when);
    osc.stop(when + 0.1);

    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    noiseGain.gain.setValueAtTime(velocity * 0.5, when);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, when + 0.15);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(destination);
    noise.start(when);
    noise.stop(when + 0.15);
    return;
  }

  if (drum === 'hat') {
    const bufferSize = ctx.sampleRate * 0.06;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    gain.gain.setValueAtTime(velocity, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    noise.start(when);
    noise.stop(when + 0.06);
  }
}
