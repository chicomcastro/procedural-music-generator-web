let reverbSend = null;
let delaySend = null;
let chorusSend = null;
let reverbGain = null;
let delayGain = null;
let chorusGain = null;
let convolver = null;
let effectsCtx = null;
let effectsDest = null;

const REVERB_PRESETS = {
  room:       { duration: 0.8, decay: 3.5 },
  hall:       { duration: 2.0, decay: 2.5 },
  cathedral:  { duration: 4.0, decay: 1.8 },
};

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
  effectsCtx = ctx;
  effectsDest = destination;

  reverbGain = ctx.createGain();
  reverbGain.gain.value = 0;
  convolver = createConvolver(ctx, 2, 2.5);
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

  chorusGain = ctx.createGain();
  chorusGain.gain.value = 0;
  const chorusDelay = ctx.createDelay(0.05);
  chorusDelay.delayTime.value = 0.012;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 1.5;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.003;
  lfo.connect(lfoDepth);
  lfoDepth.connect(chorusDelay.delayTime);
  lfo.start();
  chorusGain.connect(chorusDelay);
  chorusDelay.connect(destination);

  reverbSend = reverbGain;
  delaySend = delayGain;
  chorusSend = chorusGain;
}

export function getReverbSend() { return reverbSend; }
export function getDelaySend() { return delaySend; }
export function getChorusSend() { return chorusSend; }

export function setReverbAmount(val) {
  if (reverbGain) reverbGain.gain.value = val;
}

export function setDelayAmount(val) {
  if (delayGain) delayGain.gain.value = val;
}

export function setChorusAmount(val) {
  if (chorusGain) chorusGain.gain.value = val;
}

export function setReverbPreset(presetName) {
  if (!effectsCtx || !effectsDest || !reverbGain) return;
  const preset = REVERB_PRESETS[presetName];
  if (!preset) return;
  const oldConv = convolver;
  convolver = createConvolver(effectsCtx, preset.duration, preset.decay);
  reverbGain.disconnect(oldConv);
  oldConv.disconnect();
  reverbGain.connect(convolver);
  convolver.connect(effectsDest);
}

export function getReverbPresetNames() {
  return Object.keys(REVERB_PRESETS);
}
