import { init, getContext, getMasterGain } from './audio/AudioEngine.js';
import { loadAll, getPlaybackFor } from './audio/SampleLibrary.js';
import { createVoice } from './audio/Voice.js';
import { playClick } from './audio/Click.js';
import { createPiano } from './ui/Piano.js';
import { createTransport } from './scheduler/Transport.js';
import { createScheduler } from './scheduler/Scheduler.js';

const statusEl = document.getElementById('status');
const startBtn = document.getElementById('start');
const pianoEl = document.getElementById('piano');
const bpmInput = document.getElementById('bpm');
const bpmDisplay = document.getElementById('bpm-display');
const beatsPerBarSelect = document.getElementById('beats-per-bar');
const metroBtn = document.getElementById('metronome-toggle');
const beatIndicator = document.getElementById('beat-indicator');

const activeVoices = new Map();
let ready = false;

const transport = createTransport({ bpm: 120, beatsPerBar: 4 });
let scheduler = null;

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

bpmInput.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  transport.setBpm(v);
  bpmDisplay.textContent = String(v);
});

beatsPerBarSelect.addEventListener('change', (e) => {
  transport.setBeatsPerBar(Number(e.target.value));
});

function flashBeat(when, accent) {
  const ctx = getContext();
  const ms = Math.max(0, (when - ctx.currentTime) * 1000);
  setTimeout(() => {
    beatIndicator.classList.add('tick');
    if (accent) beatIndicator.classList.add('accent');
    setTimeout(() => {
      beatIndicator.classList.remove('tick', 'accent');
    }, 80);
  }, ms);
}

function onBeat(beat, when) {
  const accent = beat % transport.beatsPerBar === 0;
  playClick(getContext(), getMasterGain(), when, { accent });
  flashBeat(when, accent);
}

metroBtn.addEventListener('click', async () => {
  await bootstrap();
  if (!ready) return;
  if (!scheduler) {
    scheduler = createScheduler(getContext(), transport, onBeat);
  }
  if (scheduler.isPlaying) {
    scheduler.stop();
    metroBtn.textContent = 'Play';
    metroBtn.classList.remove('playing');
  } else {
    scheduler.start();
    metroBtn.textContent = 'Stop';
    metroBtn.classList.add('playing');
  }
});

document.addEventListener('visibilitychange', () => {
  const ctx = getContext();
  if (ctx && !document.hidden && ctx.state === 'suspended') {
    ctx.resume();
  }
});
