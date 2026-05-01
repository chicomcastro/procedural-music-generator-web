import { init, getContext, getMasterGain } from './audio/AudioEngine.js';
import { loadAll, getPlaybackFor } from './audio/SampleLibrary.js';
import { createVoice } from './audio/Voice.js';
import { playClick } from './audio/Click.js';
import { createPiano } from './ui/Piano.js';
import { createTransport } from './scheduler/Transport.js';
import { createScheduler } from './scheduler/Scheduler.js';
import { generateSong } from './generate/song.js';
import { randomSeed } from './generate/rng.js';
import { songToMidi } from './export/midi.js';
import { renderSongToBuffer, audioBufferToWav } from './export/wav.js';
import { downloadBlob } from './export/download.js';

const statusEl = document.getElementById('status');
const startBtn = document.getElementById('start');
const pianoEl = document.getElementById('piano');
const bpmInput = document.getElementById('bpm');
const bpmDisplay = document.getElementById('bpm-display');
const beatsPerBarSelect = document.getElementById('beats-per-bar');
const metroBtn = document.getElementById('metronome-toggle');
const beatIndicator = document.getElementById('beat-indicator');
const clickEnabledInput = document.getElementById('click-enabled');
const songEnabledInput = document.getElementById('song-enabled');
const generateBtn = document.getElementById('generate-btn');
const tonicSelect = document.getElementById('tonic');
const scaleSelect = document.getElementById('scale');
const barsSelect = document.getElementById('bars');
const seedInput = document.getElementById('seed');
const songInfo = document.getElementById('song-info');
const kbdOctaveDisplay = document.getElementById('kbd-octave');
const exportMidiBtn = document.getElementById('export-midi');
const exportWavBtn = document.getElementById('export-wav');
const exportStatus = document.getElementById('export-status');

const activeVoices = new Map();
let ready = false;

const transport = createTransport({ bpm: Number(bpmInput.value), beatsPerBar: 4 });
let scheduler = null;
let currentSong = null;

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
    setStatus('Pronto. Clique nas teclas ou em Play.');
  } catch (err) {
    console.error(err);
    setStatus(`Erro: ${err.message}`);
    startBtn.disabled = false;
  }
}

const piano = createPiano(pianoEl, {
  startOctave: 3,
  octaves: 2,
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
  onOctaveChange(oct) {
    kbdOctaveDisplay.textContent = String(oct);
  },
});

startBtn.addEventListener('click', bootstrap);

function firstGestureBootstrap() { bootstrap(); }
window.addEventListener('keydown', firstGestureBootstrap, { once: true });
pianoEl.addEventListener('pointerdown', firstGestureBootstrap, { once: true });

bpmInput.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  transport.setBpm(v);
  bpmDisplay.textContent = String(v);
});

beatsPerBarSelect.addEventListener('change', (e) => {
  transport.setBeatsPerBar(Number(e.target.value));
  regenerateSong({ keepSeed: true });
});

function flashBeat(when, accent) {
  const ctx = getContext();
  const ms = Math.max(0, (when - ctx.currentTime) * 1000);
  setTimeout(() => {
    beatIndicator.classList.add('tick');
    if (accent) beatIndicator.classList.add('accent');
    setTimeout(() => beatIndicator.classList.remove('tick', 'accent'), 80);
  }, ms);
}

function scheduleNote(midi, when, durationSec, velocity) {
  const ctx = getContext();
  const dest = getMasterGain();
  const { buffer, playbackRate } = getPlaybackFor(midi);
  createVoice(ctx, dest, {
    buffer,
    playbackRate,
    velocity,
    when,
    duration: durationSec,
    releaseTime: 0.25,
  });

  const onMs = Math.max(0, (when - ctx.currentTime) * 1000);
  const offMs = onMs + durationSec * 1000;
  setTimeout(() => piano.setVisual(midi, true), onMs);
  setTimeout(() => piano.setVisual(midi, false), offMs);
}

function scheduleSongAtBeat(beatInSong, when) {
  if (!currentSong) return;
  const beatDur = transport.beatDuration;
  for (const ev of currentSong.events) {
    if (ev.atBeat >= beatInSong && ev.atBeat < beatInSong + 1) {
      const offset = (ev.atBeat - beatInSong) * beatDur;
      scheduleNote(ev.midi, when + offset, ev.durationBeats * beatDur, ev.velocity);
    }
  }
}

function onBeat(beat, when) {
  const accent = beat % transport.beatsPerBar === 0;
  if (clickEnabledInput.checked) {
    playClick(getContext(), getMasterGain(), when, { accent });
  }
  flashBeat(when, accent);
  if (songEnabledInput.checked && currentSong) {
    const beatInSong = beat % currentSong.lengthBeats;
    scheduleSongAtBeat(beatInSong, when);
  }
}

function regenerateSong({ keepSeed = false } = {}) {
  const seed = keepSeed && seedInput.value !== '' ? Number(seedInput.value) >>> 0 : randomSeed();
  const tonicPc = Number(tonicSelect.value);
  const tonic = 60 + tonicPc;
  const scale = scaleSelect.value;
  const bars = Number(barsSelect.value);

  currentSong = generateSong({ seed, tonic, scale, bars, beatsPerBar: transport.beatsPerBar });

  seedInput.value = String(seed);
  songInfo.textContent = `seed ${seed} · ${currentSong.preset} · ${currentSong.events.length} notas`;
}

generateBtn.addEventListener('click', () => regenerateSong({ keepSeed: false }));

seedInput.addEventListener('change', () => regenerateSong({ keepSeed: true }));

[tonicSelect, scaleSelect, barsSelect].forEach(sel =>
  sel.addEventListener('change', () => regenerateSong({ keepSeed: true }))
);

regenerateSong({ keepSeed: false });

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
    setTimeout(() => piano.clearAllVisual(), 200);
  } else {
    scheduler.start();
    metroBtn.textContent = 'Stop';
    metroBtn.classList.add('playing');
  }
});

exportMidiBtn.addEventListener('click', () => {
  if (!currentSong) return;
  const bytes = songToMidi(currentSong, { bpm: transport.bpm });
  downloadBlob(bytes, `song-${currentSong.seed}.mid`, 'audio/midi');
  exportStatus.textContent = `MIDI: ${(bytes.length / 1024).toFixed(1)} KB`;
});

exportWavBtn.addEventListener('click', async () => {
  if (!currentSong) return;
  await bootstrap();
  if (!ready) return;
  exportStatus.textContent = 'Renderizando…';
  exportWavBtn.disabled = true;
  exportMidiBtn.disabled = true;
  try {
    const buf = await renderSongToBuffer(currentSong, transport);
    const wav = audioBufferToWav(buf);
    downloadBlob(wav, `song-${currentSong.seed}.wav`, 'audio/wav');
    exportStatus.textContent = `WAV: ${(wav.length / 1024 / 1024).toFixed(2)} MB`;
  } catch (err) {
    console.error(err);
    exportStatus.textContent = `Erro: ${err.message}`;
  } finally {
    exportWavBtn.disabled = false;
    exportMidiBtn.disabled = false;
  }
});

document.addEventListener('visibilitychange', () => {
  const ctx = getContext();
  if (ctx && !document.hidden && ctx.state === 'suspended') {
    ctx.resume();
  }
});
