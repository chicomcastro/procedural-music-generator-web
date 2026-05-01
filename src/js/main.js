import { init, getContext, getMasterGain, getReverbSend, getDelaySend, setReverbAmount, setDelayAmount, setEQ } from './audio/AudioEngine.js';
import { loadAll, getPlaybackFor } from './audio/SampleLibrary.js';
import { createVoice } from './audio/Voice.js';
import { createSynthVoice } from './audio/SynthVoice.js';
import { playClick } from './audio/Click.js';
import { createPiano } from './ui/Piano.js';
import { createTransport } from './scheduler/Transport.js';
import { createScheduler } from './scheduler/Scheduler.js';
import { generateSong } from './generate/song.js';
import { randomSeed } from './generate/rng.js';
import { songToMidi } from './export/midi.js';
import { renderSongToBuffer, audioBufferToWav } from './export/wav.js';
import { downloadBlob } from './export/download.js';
import { createScoreCanvas } from './ui/ScoreCanvas.js';
import { playDrumHit } from './audio/DrumSynth.js';
import { initTheme } from './ui/Theme.js';
import { initShortcuts } from './ui/Shortcuts.js';
import { initHistory, checkUnsaved, setLastSaved } from './ui/History.js';
import { initGallery } from './ui/Gallery.js';

/* ---- DOM refs ---- */
const pianoEl = document.getElementById('piano');
const bpmInput = document.getElementById('bpm');
const bpmDisplay = document.getElementById('bpm-display');
const beatsPerBarSelect = document.getElementById('beats-per-bar');
const playPauseBtn = document.getElementById('play-pause');
const stopBtn = document.getElementById('stop-btn');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');
const timeDisplay = document.getElementById('time-display');
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
const shareBtn = document.getElementById('share-btn');
const songNameInput = document.getElementById('song-name');
const voiceSelect = document.getElementById('voice');
const densityInput = document.getElementById('density');
const densityDisplay = document.getElementById('density-display');
const swingInput = document.getElementById('swing');
const swingDisplay = document.getElementById('swing-display');
const transposeUpBtn = document.getElementById('transpose-up');
const transposeDownBtn = document.getElementById('transpose-down');
const transposeDisplay = document.getElementById('transpose-display');
const velocityInput = document.getElementById('velocity');
const velocityDisplay = document.getElementById('velocity-display');
const eqLowInput = document.getElementById('eq-low');
const eqLowDisplay = document.getElementById('eq-low-display');
const eqMidInput = document.getElementById('eq-mid');
const eqMidDisplay = document.getElementById('eq-mid-display');
const eqHighInput = document.getElementById('eq-high');
const eqHighDisplay = document.getElementById('eq-high-display');
const melodyVolInput = document.getElementById('melody-vol');
const melodyVolDisplay = document.getElementById('melody-vol-display');
const chordVolInput = document.getElementById('chord-vol');
const chordVolDisplay = document.getElementById('chord-vol-display');
const reverbInput = document.getElementById('reverb');
const reverbDisplay = document.getElementById('reverb-display');
const delayInput = document.getElementById('delay');
const delayDisplay = document.getElementById('delay-display');
const recordBtn = document.getElementById('record-btn');
const exportPreviewBtn = document.getElementById('export-preview');
const exportMidiBtn = document.getElementById('export-midi');
const exportWavBtn = document.getElementById('export-wav');
const exportStatus = document.getElementById('export-status');

/* ---- State ---- */
let transposeSemitones = 0;
let pendingLockedBars = null;
const lockedBars = new Set();
const lockedBarEvents = new Map();
const activeVoices = new Map();
let ready = false;
let scheduler = null;
let currentSong = null;
let recording = false;
let recordStartTime = 0;
const recordedNotes = new Map();
const recordedEvents = [];

/* ---- Score canvas ---- */
const scoreCanvas = createScoreCanvas(document.getElementById('score-canvas'), {
  onBarClick(barIndex) {
    if (lockedBars.has(barIndex)) {
      lockedBars.delete(barIndex);
      lockedBarEvents.delete(barIndex);
    } else if (currentSong) {
      lockedBars.add(barIndex);
      lockedBarEvents.set(barIndex, getEventsForBar(currentSong, barIndex));
    }
    scoreCanvas.setLockedBars(lockedBars);
    if (currentSong) scoreCanvas.render(currentSong);
  },
});

function getEventsForBar(song, barIndex) {
  const start = barIndex * song.beatsPerBar;
  const end = start + song.beatsPerBar;
  return song.events
    .filter(ev => ev.atBeat >= start && ev.atBeat < end)
    .map(ev => ({ ...ev }));
}

/* ---- Theme ---- */
initTheme(() => { if (currentSong) scoreCanvas.render(currentSong); });

/* ---- URL params ---- */
function applyUrlParams() {
  const p = new URLSearchParams(window.location.search);
  if (p.has('bpm')) bpmInput.value = p.get('bpm');
  if (p.has('time')) beatsPerBarSelect.value = p.get('time');
  if (p.has('tonic')) tonicSelect.value = p.get('tonic');
  if (p.has('scale')) scaleSelect.value = p.get('scale');
  if (p.has('bars')) barsSelect.value = p.get('bars');
  if (p.has('voice')) voiceSelect.value = p.get('voice');
  if (p.has('density')) densityInput.value = p.get('density');
  if (p.has('swing')) swingInput.value = p.get('swing');
  if (p.has('velocity')) velocityInput.value = p.get('velocity');
  if (p.has('transpose')) {
    transposeSemitones = Number(p.get('transpose')) || 0;
    transposeDisplay.textContent = transposeSemitones > 0 ? `+${transposeSemitones}` : String(transposeSemitones);
  }
  if (p.has('seed')) seedInput.value = p.get('seed');
  if (p.has('locked')) {
    pendingLockedBars = p.get('locked').split(',').map(Number).filter(n => !isNaN(n));
  }
  bpmDisplay.textContent = bpmInput.value;
  densityDisplay.textContent = `${Math.round(densityInput.value * 100)}%`;
  swingDisplay.textContent = `${Math.round(swingInput.value * 100)}%`;
  velocityDisplay.textContent = `${Math.round(velocityInput.value * 100)}%`;
}

applyUrlParams();

/* ---- Transport ---- */
const transport = createTransport({ bpm: Number(bpmInput.value), beatsPerBar: Number(beatsPerBarSelect.value) });

/* ---- Audio bootstrap ---- */
async function bootstrap() {
  if (ready) return;
  playPauseBtn.classList.add('loading');
  playPauseBtn.disabled = true;
  try {
    const ctx = await init();
    await loadAll(ctx);
    ready = true;
    document.getElementById('hero').classList.add('collapsed');
  } catch (err) {
    console.error(err);
  } finally {
    playPauseBtn.classList.remove('loading');
    playPauseBtn.disabled = false;
  }
}

/* ---- Piano ---- */
function getSelectedVoice() { return voiceSelect.value; }

const piano = createPiano(pianoEl, {
  startOctave: 2,
  octaves: 4,
  onAttack(midi) {
    if (!ready) return;
    const ctx = getContext();
    const dest = getMasterGain();
    const prev = activeVoices.get(midi);
    if (prev) prev.release(0.05);
    const v = getSelectedVoice();
    let voice;
    if (v === 'piano') {
      const { buffer, playbackRate } = getPlaybackFor(midi);
      voice = createVoice(ctx, dest, { buffer, playbackRate, velocity: 0.9 });
    } else {
      voice = createSynthVoice(ctx, dest, { midi, velocity: 0.9, preset: v });
    }
    activeVoices.set(midi, voice);
    if (recording) {
      const elapsed = (ctx.currentTime - recordStartTime);
      const atBeat = elapsed / transport.beatDuration;
      recordedNotes.set(midi, atBeat);
    }
  },
  onRelease(midi) {
    const voice = activeVoices.get(midi);
    if (voice) {
      voice.release(0.4);
      activeVoices.delete(midi);
    }
    if (recording && recordedNotes.has(midi)) {
      const startBeat = recordedNotes.get(midi);
      const ctx = getContext();
      const elapsed = (ctx.currentTime - recordStartTime);
      const endBeat = elapsed / transport.beatDuration;
      recordedEvents.push({
        type: 'melody',
        midi,
        atBeat: startBeat,
        durationBeats: Math.max(endBeat - startBeat, 0.1),
        velocity: 0.8,
      });
      recordedNotes.delete(midi);
    }
  },
  onOctaveChange(oct) {
    kbdOctaveDisplay.textContent = String(oct);
  },
});

async function firstGestureBootstrap() {
  window.removeEventListener('keydown', firstGestureBootstrap);
  pianoEl.removeEventListener('pointerdown', firstGestureBootstrap);
  await bootstrap();
  if (ready && (!scheduler || !scheduler.isPlaying)) startPlayback();
}
window.addEventListener('keydown', firstGestureBootstrap, { once: true });
pianoEl.addEventListener('pointerdown', firstGestureBootstrap, { once: true });

/* ---- Scheduling ---- */
function scheduleNote(midi, when, durationSec, velocity, evType = 'melody', ev = null) {
  const ctx = getContext();
  const dest = getMasterGain();

  if (evType === 'drum' && ev) {
    playDrumHit(ctx, dest, { drum: ev.drum, when, velocity: velocity * Number(velocityInput.value) });
    return;
  }

  const trackVol = evType === 'chord' ? Number(chordVolInput.value) : Number(melodyVolInput.value);
  const vel = velocity * Number(velocityInput.value) * trackVol;

  if (evType === 'bass') {
    createSynthVoice(ctx, dest, { midi, velocity: vel, when, duration: durationSec, preset: 'bass' });
  } else {
    const voice = getSelectedVoice();
    if (voice === 'piano') {
      const { buffer, playbackRate } = getPlaybackFor(midi);
      createVoice(ctx, dest, { buffer, playbackRate, velocity: vel, when, duration: durationSec, releaseTime: 0.25 });
    } else {
      createSynthVoice(ctx, dest, { midi, velocity: vel, when, duration: durationSec, preset: voice });
    }
  }

  const onMs = Math.max(0, (when - ctx.currentTime) * 1000);
  const offMs = onMs + durationSec * 1000;
  setTimeout(() => piano.setVisual(midi, true, evType), onMs);
  setTimeout(() => piano.setVisual(midi, false), offMs);
}

function scheduleSongAtBeat(beatInSong, when) {
  if (!currentSong) return;
  const beatDur = transport.beatDuration;
  for (const ev of currentSong.events) {
    if (ev.atBeat >= beatInSong && ev.atBeat < beatInSong + 1) {
      const offset = (ev.atBeat - beatInSong) * beatDur;
      scheduleNote(ev.midi, when + offset, ev.durationBeats * beatDur, ev.velocity, ev.type, ev);
    }
  }
}

function flashBeat(when, accent) {
  const ctx = getContext();
  const ms = Math.max(0, (when - ctx.currentTime) * 1000);
  setTimeout(() => {
    beatIndicator.classList.add('tick');
    if (accent) beatIndicator.classList.add('accent');
    setTimeout(() => beatIndicator.classList.remove('tick', 'accent'), 80);
  }, ms);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateProgress(beatInSong) {
  if (!currentSong) return;
  const total = currentSong.lengthBeats;
  progressFill.style.width = `${(beatInSong / total) * 100}%`;
  const elapsed = beatInSong * transport.beatDuration;
  const totalSec = total * transport.beatDuration;
  timeDisplay.textContent = `${formatTime(elapsed)} / ${formatTime(totalSec)}`;
}

function onBeat(beat, when) {
  const accent = beat % transport.beatsPerBar === 0;
  if (clickEnabledInput.checked) playClick(getContext(), getMasterGain(), when, { accent });
  flashBeat(when, accent);
  if (songEnabledInput.checked && currentSong) {
    const beatInSong = beat % currentSong.lengthBeats;
    scheduleSongAtBeat(beatInSong, when);
    scoreCanvas.setPlayhead(beatInSong);
    scoreCanvas.render(currentSong);
    updateProgress(beatInSong);
  }
}

/* ---- URL state ---- */
function buildShareUrl() {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set('seed', seedInput.value);
  url.searchParams.set('bpm', bpmInput.value);
  url.searchParams.set('time', beatsPerBarSelect.value);
  url.searchParams.set('tonic', tonicSelect.value);
  url.searchParams.set('scale', scaleSelect.value);
  url.searchParams.set('bars', barsSelect.value);
  if (voiceSelect.value !== 'piano') url.searchParams.set('voice', voiceSelect.value);
  if (densityInput.value !== '0.65') url.searchParams.set('density', densityInput.value);
  if (swingInput.value !== '0') url.searchParams.set('swing', swingInput.value);
  if (velocityInput.value !== '0.8') url.searchParams.set('velocity', velocityInput.value);
  if (transposeSemitones !== 0) url.searchParams.set('transpose', transposeSemitones);
  if (lockedBars.size > 0) url.searchParams.set('locked', [...lockedBars].sort((a, b) => a - b).join(','));
  return url.toString();
}

function pushUrlState() { history.replaceState(null, '', buildShareUrl()); }

/* ---- Song generation ---- */
function applyLockedBars(song) {
  if (lockedBars.size === 0) return song;
  const bpb = song.beatsPerBar;
  const unlocked = song.events.filter(ev => !lockedBars.has(Math.floor(ev.atBeat / bpb)));
  const frozen = [];
  for (const [bar, events] of lockedBarEvents) {
    if (bar < song.bars) frozen.push(...events);
  }
  return { ...song, events: [...unlocked, ...frozen].sort((a, b) => a.atBeat - b.atBeat) };
}

function clearLockedBars() {
  lockedBars.clear();
  lockedBarEvents.clear();
  scoreCanvas.setLockedBars(lockedBars);
}

function regenerateSong({ keepSeed = false } = {}) {
  const seed = keepSeed && seedInput.value !== '' ? Number(seedInput.value) >>> 0 : randomSeed();
  const raw = generateSong({
    seed,
    tonic: 60 + Number(tonicSelect.value),
    scale: scaleSelect.value,
    bars: Number(barsSelect.value),
    beatsPerBar: transport.beatsPerBar,
    density: Number(densityInput.value),
    swing: Number(swingInput.value),
  });
  currentSong = applyLockedBars(raw);
  if (transposeSemitones !== 0) currentSong.events.forEach(ev => { ev.midi += transposeSemitones; });

  seedInput.value = String(seed);
  const lockInfo = lockedBars.size > 0 ? ` · ${lockedBars.size} locked` : '';
  songInfo.textContent = `seed ${seed} · ${currentSong.preset} · ${currentSong.events.length} notes${lockInfo}`;
  pushUrlState();

  if (pendingLockedBars) {
    for (const bar of pendingLockedBars) {
      if (bar >= 0 && bar < currentSong.bars) {
        lockedBars.add(bar);
        lockedBarEvents.set(bar, getEventsForBar(currentSong, bar));
      }
    }
    scoreCanvas.setLockedBars(lockedBars);
    pendingLockedBars = null;
  }

  scoreCanvas.render(currentSong);
  timeDisplay.textContent = `0:00 / ${formatTime(currentSong.lengthBeats * transport.beatDuration)}`;
  progressFill.style.width = '0%';

  generateBtn.classList.add('flash');
  songInfo.classList.add('flash');
  setTimeout(() => { generateBtn.classList.remove('flash'); songInfo.classList.remove('flash'); }, 200);

  checkUnsaved();
}

/* ---- Transpose ---- */
function applyTranspose(delta) {
  transposeSemitones = Math.max(-24, Math.min(24, transposeSemitones + delta));
  transposeDisplay.textContent = transposeSemitones > 0 ? `+${transposeSemitones}` : String(transposeSemitones);
  if (currentSong) {
    currentSong.events.forEach(ev => { ev.midi += delta; });
    scoreCanvas.render(currentSong);
  }
  checkUnsaved();
}

transposeUpBtn.addEventListener('click', () => applyTranspose(1));
transposeDownBtn.addEventListener('click', () => applyTranspose(-1));

/* ---- Generator controls ---- */
generateBtn.addEventListener('click', () => regenerateSong({ keepSeed: false }));
seedInput.addEventListener('change', () => regenerateSong({ keepSeed: true }));

bpmInput.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  transport.setBpm(v);
  bpmDisplay.textContent = String(v);
  pushUrlState();
  clearActivePreset();
  checkUnsaved();
});

beatsPerBarSelect.addEventListener('change', () => {
  transport.setBeatsPerBar(Number(beatsPerBarSelect.value));
  clearLockedBars();
  regenerateSong({ keepSeed: true });
});

[tonicSelect, scaleSelect].forEach(sel =>
  sel.addEventListener('change', () => { clearActivePreset(); regenerateSong({ keepSeed: true }); })
);

barsSelect.addEventListener('change', () => { clearActivePreset(); clearLockedBars(); regenerateSong({ keepSeed: true }); });
voiceSelect.addEventListener('change', () => { pushUrlState(); checkUnsaved(); });

densityInput.addEventListener('input', (e) => {
  densityDisplay.textContent = `${Math.round(e.target.value * 100)}%`;
  clearActivePreset();
  regenerateSong({ keepSeed: true });
});

swingInput.addEventListener('input', (e) => {
  swingDisplay.textContent = `${Math.round(e.target.value * 100)}%`;
  clearActivePreset();
  regenerateSong({ keepSeed: true });
});

velocityInput.addEventListener('input', (e) => {
  velocityDisplay.textContent = `${Math.round(e.target.value * 100)}%`;
  pushUrlState();
  checkUnsaved();
});

for (const [input, display, band] of [[eqLowInput, eqLowDisplay, 'low'], [eqMidInput, eqMidDisplay, 'mid'], [eqHighInput, eqHighDisplay, 'high']]) {
  input.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    display.textContent = `${v > 0 ? '+' : ''}${v} dB`;
    setEQ(band, v);
  });
}

melodyVolInput.addEventListener('input', (e) => {
  melodyVolDisplay.textContent = `${Math.round(e.target.value * 100)}%`;
});

chordVolInput.addEventListener('input', (e) => {
  chordVolDisplay.textContent = `${Math.round(e.target.value * 100)}%`;
});

reverbInput.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  reverbDisplay.textContent = `${Math.round(v * 100)}%`;
  setReverbAmount(v);
});

delayInput.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  delayDisplay.textContent = `${Math.round(v * 100)}%`;
  setDelayAmount(v);
});

/* ---- Presets ---- */
const presetBtns = document.querySelectorAll('.preset-btn');
function clearActivePreset() { presetBtns.forEach(b => b.classList.remove('active')); }

for (const btn of presetBtns) {
  btn.addEventListener('click', () => {
    bpmInput.value = btn.dataset.bpm;
    bpmDisplay.textContent = btn.dataset.bpm;
    transport.setBpm(Number(btn.dataset.bpm));
    beatsPerBarSelect.value = btn.dataset.time;
    transport.setBeatsPerBar(Number(btn.dataset.time));
    tonicSelect.value = btn.dataset.tonic;
    scaleSelect.value = btn.dataset.scale;
    barsSelect.value = btn.dataset.bars;
    densityInput.value = btn.dataset.density || '0.65';
    densityDisplay.textContent = `${Math.round(densityInput.value * 100)}%`;
    swingInput.value = btn.dataset.swing || '0';
    swingDisplay.textContent = `${Math.round(swingInput.value * 100)}%`;
    clearActivePreset();
    clearLockedBars();
    btn.classList.add('active');
    regenerateSong({ keepSeed: false });
  });
}

/* ---- Initial song ---- */
regenerateSong({ keepSeed: new URLSearchParams(window.location.search).has('seed') });

/* ---- Player ---- */
function updatePlayerUI() {
  const playing = scheduler && scheduler.isPlaying;
  playPauseBtn.innerHTML = playing ? '&#9646;&#9646;' : '&#9654;';
  playPauseBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
}

function startPlayback() {
  if (!scheduler) {
    scheduler = createScheduler(getContext(), transport, onBeat);
    scheduler.start();
  } else if (!scheduler.isPlaying) {
    scheduler.resume();
  }
  updatePlayerUI();
}

function pausePlayback() {
  if (scheduler && scheduler.isPlaying) { scheduler.stop(); updatePlayerUI(); }
}

function stopPlayback() {
  if (scheduler) { scheduler.stop(); scheduler = null; }
  updatePlayerUI();
  progressFill.style.width = '0%';
  if (currentSong) timeDisplay.textContent = `0:00 / ${formatTime(currentSong.lengthBeats * transport.beatDuration)}`;
  setTimeout(() => piano.clearAllVisual(), 200);
  scoreCanvas.setPlayhead(-1);
  if (currentSong) scoreCanvas.render(currentSong);
}

playPauseBtn.addEventListener('click', async () => {
  await bootstrap();
  if (!ready) return;
  if (scheduler && scheduler.isPlaying) pausePlayback(); else startPlayback();
});

stopBtn.addEventListener('click', async () => { await bootstrap(); if (!ready) return; stopPlayback(); });

progressBar.addEventListener('click', (e) => {
  if (!currentSong || !scheduler) return;
  const rect = progressBar.getBoundingClientRect();
  const targetBeat = Math.floor(((e.clientX - rect.left) / rect.width) * currentSong.lengthBeats);
  const wasPlaying = scheduler.isPlaying;
  if (wasPlaying) scheduler.stop();
  scheduler = createScheduler(getContext(), transport, onBeat);
  scheduler.startFrom(targetBeat);
  if (!wasPlaying) scheduler.stop();
  updateProgress(targetBeat);
  updatePlayerUI();
});

/* ---- Recording ---- */
recordBtn.addEventListener('click', async () => {
  await bootstrap();
  if (!ready) return;
  if (recording) {
    recording = false;
    recordBtn.classList.remove('recording');
    recordBtn.textContent = '● Rec';
    if (recordedEvents.length > 0 && currentSong) {
      const totalBeats = currentSong.lengthBeats;
      const looped = recordedEvents.map(ev => ({
        ...ev,
        atBeat: ev.atBeat % totalBeats,
      }));
      currentSong.events = [...currentSong.events.filter(e => e.type !== 'melody'), ...looped]
        .sort((a, b) => a.atBeat - b.atBeat);
      scoreCanvas.render(currentSong);
    }
  } else {
    recording = true;
    recordedEvents.length = 0;
    recordedNotes.clear();
    recordStartTime = getContext().currentTime;
    recordBtn.classList.add('recording');
    recordBtn.textContent = '■ Stop';
    if (!scheduler || !scheduler.isPlaying) startPlayback();
  }
});

/* ---- Export ---- */
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
  exportStatus.textContent = 'Rendering…';
  exportWavBtn.disabled = true;
  exportMidiBtn.disabled = true;
  try {
    const buf = await renderSongToBuffer(currentSong, transport, { voice: getSelectedVoice() });
    const wav = audioBufferToWav(buf);
    downloadBlob(wav, `song-${currentSong.seed}.wav`, 'audio/wav');
    exportStatus.textContent = `WAV: ${(wav.length / 1024 / 1024).toFixed(2)} MB`;
  } catch (err) {
    console.error(err);
    exportStatus.textContent = `Error: ${err.message}`;
  } finally {
    exportWavBtn.disabled = false;
    exportMidiBtn.disabled = false;
  }
});

exportPreviewBtn.addEventListener('click', async () => {
  if (!currentSong) return;
  await bootstrap();
  if (!ready) return;
  exportStatus.textContent = 'Rendering preview…';
  exportPreviewBtn.disabled = true;
  try {
    const previewSong = {
      ...currentSong,
      events: currentSong.events.filter(ev => ev.atBeat < currentSong.beatsPerBar * 2),
      bars: Math.min(2, currentSong.bars),
      lengthBeats: currentSong.beatsPerBar * Math.min(2, currentSong.bars),
    };
    const buf = await renderSongToBuffer(previewSong, transport, { voice: getSelectedVoice() });
    const wav = audioBufferToWav(buf);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
    audio.onended = () => URL.revokeObjectURL(url);
    exportStatus.textContent = 'Playing preview…';
  } catch (err) {
    console.error(err);
    exportStatus.textContent = `Error: ${err.message}`;
  } finally {
    exportPreviewBtn.disabled = false;
  }
});

/* ---- Share ---- */
shareBtn.addEventListener('click', async () => {
  const url = buildShareUrl();
  try {
    await navigator.clipboard.writeText(url);
    shareBtn.textContent = 'Copied!';
    shareBtn.classList.add('copied');
    setTimeout(() => { shareBtn.textContent = 'Share'; shareBtn.classList.remove('copied'); }, 1500);
  } catch {
    shareBtn.textContent = 'Copy failed';
    setTimeout(() => { shareBtn.textContent = 'Share'; }, 1500);
  }
});

/* ---- Snapshot helpers for History ---- */
function currentSnapshot() {
  if (!currentSong) return null;
  return {
    seed: seedInput.value,
    bpm: bpmInput.value,
    time: beatsPerBarSelect.value,
    tonic: tonicSelect.value,
    scale: scaleSelect.value,
    bars: barsSelect.value,
    voice: voiceSelect.value,
    density: densityInput.value,
    swing: swingInput.value,
    velocity: velocityInput.value,
    noteCount: currentSong.events.length,
    preset: currentSong.preset,
  };
}

function loadEntry(e) {
  bpmInput.value = e.bpm;
  bpmDisplay.textContent = e.bpm;
  transport.setBpm(Number(e.bpm));
  beatsPerBarSelect.value = e.time;
  transport.setBeatsPerBar(Number(e.time));
  tonicSelect.value = e.tonic;
  scaleSelect.value = e.scale;
  barsSelect.value = e.bars;
  voiceSelect.value = e.voice || 'piano';
  densityInput.value = e.density || '0.65';
  densityDisplay.textContent = `${Math.round(densityInput.value * 100)}%`;
  swingInput.value = e.swing || '0';
  swingDisplay.textContent = `${Math.round(swingInput.value * 100)}%`;
  velocityInput.value = e.velocity || '0.8';
  velocityDisplay.textContent = `${Math.round(velocityInput.value * 100)}%`;
  seedInput.value = e.seed;
  songNameInput.value = e.name || '';
  clearActivePreset();
  regenerateSong({ keepSeed: true });
}

/* ---- History init ---- */
initHistory({
  onLoadEntry: loadEntry,
  snapshotFn: currentSnapshot,
  labelsFn: () => ({
    scaleLabel: (val) => { const o = scaleSelect.querySelector(`option[value="${val}"]`); return o ? o.textContent : val; },
    tonicLabel: (val) => { const o = tonicSelect.querySelector(`option[value="${val}"]`); return o ? o.textContent : val; },
  }),
});

/* ---- Gallery init ---- */
initGallery({ onLoadSeed: loadEntry });

/* ---- Shortcuts init ---- */
initShortcuts({
  onPlay: () => playPauseBtn.click(),
  onStop: () => stopBtn.click(),
  onRandomize: () => generateBtn.click(),
});

/* ---- Visibility resume ---- */
document.addEventListener('visibilitychange', () => {
  const ctx = getContext();
  if (ctx && !document.hidden && ctx.state === 'suspended') ctx.resume();
});
