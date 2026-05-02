/** @param {AudioContext} ctx @param {AudioNode} dest @param {number} when @param {{ accent?: boolean, volume?: number }} [opts] */
export function playClick(ctx, dest, when, { accent = false, volume = 1 } = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(accent ? 1500 : 1000, when);
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime((accent ? 0.5 : 0.25) * volume, when + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(when);
  osc.stop(when + 0.06);
  osc.onended = () => {
    try { osc.disconnect(); } catch {}
    try { gain.disconnect(); } catch {}
  };
}
