import { init, getContext, getMasterGain } from './audio/AudioEngine.js';
import { loadAll, getPlaybackFor } from './audio/SampleLibrary.js';
import { createVoice } from './audio/Voice.js';
import { createPiano } from './ui/Piano.js';

const statusEl = document.getElementById('status');
const startBtn = document.getElementById('start');
const pianoEl = document.getElementById('piano');

const activeVoices = new Map();
let ready = false;

function setStatus(msg) {
  statusEl.textContent = msg;
}

async function bootstrap() {
  if (ready) return;
  setStatus('Carregando samples…');
  startBtn.disabled = true;
  try {
    const ctx = await init();
    await loadAll(ctx);
    ready = true;
    startBtn.style.display = 'none';
    setStatus('Pronto. Clique nas teclas.');
  } catch (err) {
    console.error(err);
    setStatus(`Erro: ${err.message}`);
    startBtn.disabled = false;
  }
}

createPiano(pianoEl, {
  onAttack(midi) {
    if (!ready) return;
    const ctx = getContext();
    const dest = getMasterGain();
    const { buffer, playbackRate } = getPlaybackFor(midi);
    const voice = createVoice(ctx, dest, { buffer, playbackRate, velocity: 0.9 });
    const prev = activeVoices.get(midi);
    if (prev) prev.release(0.05);
    activeVoices.set(midi, voice);
  },
  onRelease(midi) {
    const voice = activeVoices.get(midi);
    if (voice) {
      voice.release(0.4);
      activeVoices.delete(midi);
    }
  },
});

startBtn.addEventListener('click', bootstrap);

function firstGestureBootstrap() {
  bootstrap();
}
window.addEventListener('keydown', firstGestureBootstrap, { once: true });
pianoEl.addEventListener('pointerdown', firstGestureBootstrap, { once: true });

document.addEventListener('visibilitychange', () => {
  const ctx = getContext();
  if (ctx && !document.hidden && ctx.state === 'suspended') {
    ctx.resume();
  }
});
