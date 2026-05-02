import { initEffects, getReverbSend, getDelaySend, getChorusSend } from './Effects.js';

let ctx = null;
let masterGain = null;
let compressor = null;
let eqLow = null;
let eqMid = null;
let eqHigh = null;
const trackPanners = {};

/** @returns {AudioContext|null} */
export function getContext() {
  return ctx;
}

/** @returns {GainNode|null} */
export function getMasterGain() {
  return masterGain;
}

export { getReverbSend, getDelaySend, getChorusSend };
export { setReverbAmount, setDelayAmount, setChorusAmount, setReverbPreset } from './Effects.js';

export function setEQ(band, value) {
  const node = band === 'low' ? eqLow : band === 'mid' ? eqMid : eqHigh;
  if (node) node.gain.value = value;
}

export function setMasterVolume(value) {
  if (masterGain) masterGain.gain.value = value;
}

export function getTrackDest(track) {
  return trackPanners[track] || masterGain;
}

export function setTrackPan(track, value) {
  if (trackPanners[track]) trackPanners[track].pan.value = value;
}

/** @returns {Promise<AudioContext>} */
export async function init() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctx({ latencyHint: 'interactive' });

    compressor = ctx.createDynamicsCompressor();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.8;

    eqLow = ctx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 320;
    eqLow.gain.value = 0;

    eqMid = ctx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 0.5;
    eqMid.gain.value = 0;

    eqHigh = ctx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 3200;
    eqHigh.gain.value = 0;

    for (const track of ['melody', 'chord', 'bass', 'drum', 'click']) {
      const panner = ctx.createStereoPanner();
      panner.connect(masterGain);
      trackPanners[track] = panner;
    }

    masterGain.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(compressor);
    compressor.connect(ctx.destination);

    initEffects(ctx, compressor);
    masterGain.connect(getReverbSend());
    masterGain.connect(getDelaySend());
    masterGain.connect(getChorusSend());

    primeIosUnlock();
  }
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx;
}

function primeIosUnlock() {
  const buffer = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start(0);
}
