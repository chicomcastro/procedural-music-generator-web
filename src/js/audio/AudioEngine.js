let ctx = null;
let masterGain = null;
let compressor = null;

export function getContext() {
  return ctx;
}

export function getMasterGain() {
  return masterGain;
}

export async function init() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctx({ latencyHint: 'interactive' });

    compressor = ctx.createDynamicsCompressor();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.8;

    masterGain.connect(compressor);
    compressor.connect(ctx.destination);

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
