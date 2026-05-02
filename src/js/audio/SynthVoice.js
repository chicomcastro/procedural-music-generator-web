const PRESETS = {
  pad: {
    oscTypes: ['sawtooth', 'sawtooth'],
    detune: [0, 7],
    gainPerOsc: 0.35,
    filterFreq: 1200,
    filterQ: 1,
    attack: 0.15,
    release: 0.6,
    vibratoRate: 4.5,
    vibratoDepth: 8,
  },
  pluck: {
    oscTypes: ['triangle'],
    detune: [0],
    gainPerOsc: 0.6,
    filterFreq: 3000,
    filterQ: 2,
    attack: 0.002,
    release: 0.15,
    filterDecay: 0.2,
    filterSustainFreq: 600,
    vibratoRate: 0,
    vibratoDepth: 0,
  },
  bass: {
    oscTypes: ['sawtooth', 'square'],
    detune: [0, -1200],
    gainPerOsc: 0.4,
    filterFreq: 800,
    filterQ: 3,
    attack: 0.01,
    release: 0.2,
    vibratoRate: 0,
    vibratoDepth: 0,
  },
  organ: {
    oscTypes: ['sine', 'sine', 'sine'],
    detune: [0, 1200, 1902],
    gainPerOsc: 0.3,
    filterFreq: 5000,
    filterQ: 0.5,
    attack: 0.01,
    release: 0.08,
    vibratoRate: 5.5,
    vibratoDepth: 6,
  },
  strings: {
    oscTypes: ['sawtooth', 'sawtooth'],
    detune: [0, 5],
    gainPerOsc: 0.3,
    filterFreq: 2000,
    filterQ: 0.7,
    attack: 0.12,
    release: 0.5,
    vibratoRate: 5,
    vibratoDepth: 10,
  },
  marimba: {
    oscTypes: ['sine', 'sine'],
    detune: [0, 3],
    gainPerOsc: 0.55,
    filterFreq: 4000,
    filterQ: 1,
    attack: 0.001,
    release: 0.08,
    filterDecay: 0.12,
    filterSustainFreq: 500,
    vibratoRate: 0,
    vibratoDepth: 0,
  },
  bell: {
    oscTypes: ['sine', 'sine'],
    detune: [0, 1900],
    gainPerOsc: 0.35,
    filterFreq: 6000,
    filterQ: 0.5,
    attack: 0.002,
    release: 1.8,
    vibratoRate: 3,
    vibratoDepth: 4,
  },
  epiano: {
    oscTypes: ['sine', 'triangle'],
    detune: [0, 1200],
    gainPerOsc: 0.4,
    filterFreq: 3500,
    filterQ: 1.5,
    attack: 0.003,
    release: 0.4,
    filterDecay: 0.3,
    filterSustainFreq: 800,
    vibratoRate: 4,
    vibratoDepth: 5,
  },
  lead: {
    oscTypes: ['sawtooth'],
    detune: [0],
    gainPerOsc: 0.5,
    filterFreq: 2200,
    filterQ: 2,
    attack: 0.02,
    release: 0.25,
    vibratoRate: 5,
    vibratoDepth: 12,
  },
};

/** @returns {string[]} */
export function getSynthPresetNames() {
  return Object.keys(PRESETS);
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** @param {BaseAudioContext} ctx @param {AudioNode} destination @returns {{ release: (rt?: number) => void }} */
export function createSynthVoice(ctx, destination, opts) {
  const {
    midi,
    velocity = 0.9,
    when = ctx.currentTime,
    duration = null,
    preset = 'pad',
  } = opts;

  const p = PRESETS[preset] || PRESETS.pad;
  const freq = midiToFreq(midi);
  const attack = p.attack;
  const releaseTime = p.release;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(p.filterFreq, when);
  filter.Q.value = p.filterQ;

  if (p.filterDecay) {
    filter.frequency.exponentialRampToValueAtTime(
      p.filterSustainFreq || 400, when + p.filterDecay
    );
  }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(velocity * p.gainPerOsc * p.oscTypes.length, when + attack);

  filter.connect(gain);
  gain.connect(destination);

  const oscs = p.oscTypes.map((type, i) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    osc.detune.setValueAtTime(p.detune[i] || 0, when);
    osc.connect(filter);
    osc.start(when);
    return osc;
  });

  let lfo = null;
  let lfoGain = null;
  if (p.vibratoRate > 0 && p.vibratoDepth > 0) {
    lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(p.vibratoRate, when);
    lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0, when);
    lfoGain.gain.linearRampToValueAtTime(p.vibratoDepth, when + attack * 2);
    lfo.connect(lfoGain);
    for (const osc of oscs) {
      lfoGain.connect(osc.detune);
    }
    lfo.start(when);
  }

  let stopped = false;

  function disconnect() {
    oscs.forEach(o => { try { o.disconnect(); } catch {} });
    if (lfo) { try { lfo.disconnect(); } catch {} }
    if (lfoGain) { try { lfoGain.disconnect(); } catch {} }
    try { filter.disconnect(); } catch {}
    try { gain.disconnect(); } catch {}
  }

  if (duration !== null) {
    const releaseStart = when + duration;
    const peak = velocity * p.gainPerOsc * p.oscTypes.length;
    gain.gain.setValueAtTime(peak, releaseStart);
    gain.gain.linearRampToValueAtTime(0, releaseStart + releaseTime);
    const stopTime = releaseStart + releaseTime + 0.05;
    oscs.forEach(o => o.stop(stopTime));
    if (lfo) lfo.stop(stopTime);
    oscs[0].onended = disconnect;
    stopped = true;
  }

  function release(rt = releaseTime) {
    if (stopped) return;
    stopped = true;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + rt);
    const stopTime = t + rt + 0.05;
    oscs.forEach(o => o.stop(stopTime));
    if (lfo) lfo.stop(stopTime);
    oscs[0].onended = disconnect;
  }

  return { release };
}
