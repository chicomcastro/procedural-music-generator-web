let reverbSend = null;
let delaySend = null;
let reverbGain = null;
let delayGain = null;

function createConvolver(ctx, duration, decay) {
  const rate = ctx.sampleRate;
  const length = rate * duration;
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = impulse;
  return conv;
}

export function initEffects(ctx, destination) {
  reverbGain = ctx.createGain();
  reverbGain.gain.value = 0;
  const convolver = createConvolver(ctx, 2, 2.5);
  reverbGain.connect(convolver);
  convolver.connect(destination);

  delayGain = ctx.createGain();
  delayGain.gain.value = 0;
  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = 0.33;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.35;
  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = 'lowpass';
  delayFilter.frequency.value = 3000;

  delayGain.connect(delay);
  delay.connect(delayFilter);
  delayFilter.connect(feedback);
  feedback.connect(delay);
  delayFilter.connect(destination);

  reverbSend = reverbGain;
  delaySend = delayGain;
}

export function getReverbSend() { return reverbSend; }
export function getDelaySend() { return delaySend; }

export function setReverbAmount(val) {
  if (reverbGain) reverbGain.gain.value = val;
}

export function setDelayAmount(val) {
  if (delayGain) delayGain.gain.value = val;
}
