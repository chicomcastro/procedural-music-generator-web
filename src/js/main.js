import { init, getContext, getMasterGain } from './audio/AudioEngine.js';
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
const saveBtn = document.getElementById('save-btn');
const saveHint = document.getElementById('save-hint');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const clearHistoryBtn = document.getElementById('clear-history');
const voiceSelect = document.getElementById('voice');
const exportMidiBtn = document.getElementById('export-midi');
const exportWavBtn = document.getElementById('export-wav');
const exportStatus = document.getElementById('export-status');

const lockedBars = new Set();
const lockedBarEvents = new Map();

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

const activeVoices = new Map();
let ready = false;
let lastSavedSnapshot = null;

function applyUrlParams() {
  const p = new URLSearchParams(window.location.search);
  if (p.has('bpm')) bpmInput.value = p.get('bpm');
  if (p.has('time')) beatsPerBarSelect.value = p.get('time');
  if (p.has('tonic')) tonicSelect.value = p.get('tonic');
  if (p.has('scale')) scaleSelect.value = p.get('scale');
  if (p.has('bars')) barsSelect.value = p.get('bars');
  if (p.has('voice')) voiceSelect.value = p.get('voice');
  if (p.has('seed')) seedInput.value = p.get('seed');
  bpmDisplay.textContent = bpmInput.value;
}

applyUrlParams();

const transport = createTransport({ bpm: Number(bpmInput.value), beatsPerBar: Number(beatsPerBarSelect.value) });
let scheduler = null;
let currentSong = null;

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

async function firstGestureBootstrap() { await bootstrap(); if (ready) startPlayback(); }
window.addEventListener('keydown', firstGestureBootstrap, { once: true });
pianoEl.addEventListener('pointerdown', firstGestureBootstrap, { once: true });

bpmInput.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  transport.setBpm(v);
  bpmDisplay.textContent = String(v);
  pushUrlState();
  document.querySelectorAll('.preset-btn.active').forEach(b => b.classList.remove('active'));
  checkUnsaved();
});

beatsPerBarSelect.addEventListener('change', (e) => {
  transport.setBeatsPerBar(Number(e.target.value));
  clearLockedBars();
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

function getSelectedVoice() {
  return voiceSelect.value;
}

function scheduleNote(midi, when, durationSec, velocity, evType = 'melody') {
  const ctx = getContext();
  const dest = getMasterGain();
  const voice = getSelectedVoice();

  if (voice === 'piano') {
    const { buffer, playbackRate } = getPlaybackFor(midi);
    createVoice(ctx, dest, {
      buffer,
      playbackRate,
      velocity,
      when,
      duration: durationSec,
      releaseTime: 0.25,
    });
  } else {
    createSynthVoice(ctx, dest, {
      midi,
      velocity,
      when,
      duration: durationSec,
      preset: voice,
    });
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
      scheduleNote(ev.midi, when + offset, ev.durationBeats * beatDur, ev.velocity, ev.type);
    }
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateProgress(beatInSong) {
  if (!currentSong) return;
  const total = currentSong.lengthBeats;
  const pct = (beatInSong / total) * 100;
  progressFill.style.width = `${pct}%`;
  const elapsed = beatInSong * transport.beatDuration;
  const totalSec = total * transport.beatDuration;
  timeDisplay.textContent = `${formatTime(elapsed)} / ${formatTime(totalSec)}`;
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
    scoreCanvas.setPlayhead(beatInSong);
    scoreCanvas.render(currentSong);
    updateProgress(beatInSong);
  }
}

function buildShareUrl() {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set('seed', seedInput.value);
  url.searchParams.set('bpm', bpmInput.value);
  url.searchParams.set('time', beatsPerBarSelect.value);
  url.searchParams.set('tonic', tonicSelect.value);
  url.searchParams.set('scale', scaleSelect.value);
  url.searchParams.set('bars', barsSelect.value);
  if (voiceSelect.value !== 'piano') url.searchParams.set('voice', voiceSelect.value);
  return url.toString();
}

function pushUrlState() {
  const url = buildShareUrl();
  history.replaceState(null, '', url);
}

function applyLockedBars(song) {
  if (lockedBars.size === 0) return song;
  const bpb = song.beatsPerBar;
  const unlocked = song.events.filter(ev => {
    const bar = Math.floor(ev.atBeat / bpb);
    return !lockedBars.has(bar);
  });
  const frozen = [];
  for (const [bar, events] of lockedBarEvents) {
    if (bar < song.bars) frozen.push(...events);
  }
  const merged = [...unlocked, ...frozen].sort((a, b) => a.atBeat - b.atBeat);
  return { ...song, events: merged };
}

function clearLockedBars() {
  lockedBars.clear();
  lockedBarEvents.clear();
  scoreCanvas.setLockedBars(lockedBars);
}

function regenerateSong({ keepSeed = false } = {}) {
  const seed = keepSeed && seedInput.value !== '' ? Number(seedInput.value) >>> 0 : randomSeed();
  const tonicPc = Number(tonicSelect.value);
  const tonic = 60 + tonicPc;
  const scale = scaleSelect.value;
  const bars = Number(barsSelect.value);

  const raw = generateSong({ seed, tonic, scale, bars, beatsPerBar: transport.beatsPerBar });
  currentSong = applyLockedBars(raw);

  seedInput.value = String(seed);
  const lockInfo = lockedBars.size > 0 ? ` · ${lockedBars.size} locked` : '';
  songInfo.textContent = `seed ${seed} · ${currentSong.preset} · ${currentSong.events.length} notes${lockInfo}`;
  pushUrlState();
  scoreCanvas.render(currentSong);
  const totalSec = currentSong.lengthBeats * transport.beatDuration;
  timeDisplay.textContent = `0:00 / ${formatTime(totalSec)}`;
  progressFill.style.width = '0%';

  generateBtn.classList.add('flash');
  songInfo.classList.add('flash');
  setTimeout(() => {
    generateBtn.classList.remove('flash');
    songInfo.classList.remove('flash');
  }, 200);

  checkUnsaved();
}

generateBtn.addEventListener('click', () => regenerateSong({ keepSeed: false }));

seedInput.addEventListener('change', () => regenerateSong({ keepSeed: true }));

[tonicSelect, scaleSelect].forEach(sel =>
  sel.addEventListener('change', () => {
    clearActivePreset();
    regenerateSong({ keepSeed: true });
  })
);

barsSelect.addEventListener('change', () => {
  clearActivePreset();
  clearLockedBars();
  regenerateSong({ keepSeed: true });
});

voiceSelect.addEventListener('change', () => {
  pushUrlState();
  checkUnsaved();
});

const presetBtns = document.querySelectorAll('.preset-btn');

function clearActivePreset() {
  presetBtns.forEach(b => b.classList.remove('active'));
}

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
    clearActivePreset();
    clearLockedBars();
    btn.classList.add('active');
    regenerateSong({ keepSeed: false });
  });
}

const hasUrlSeed = new URLSearchParams(window.location.search).has('seed');
regenerateSong({ keepSeed: hasUrlSeed });

function updatePlayerUI() {
  const playing = scheduler && scheduler.isPlaying;
  playPauseBtn.innerHTML = playing ? '&#9646;&#9646;' : '&#9654;';
  playPauseBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
}

function startPlayback() {
  if (!scheduler) {
    scheduler = createScheduler(getContext(), transport, onBeat);
  }
  if (!scheduler.isPlaying) {
    scheduler.start();
    updatePlayerUI();
  }
}

function pausePlayback() {
  if (scheduler && scheduler.isPlaying) {
    scheduler.stop();
    updatePlayerUI();
  }
}

function stopPlayback() {
  if (scheduler) {
    scheduler.stop();
  }
  updatePlayerUI();
  progressFill.style.width = '0%';
  if (currentSong) {
    const totalSec = currentSong.lengthBeats * transport.beatDuration;
    timeDisplay.textContent = `0:00 / ${formatTime(totalSec)}`;
  }
  setTimeout(() => piano.clearAllVisual(), 200);
  scoreCanvas.setPlayhead(-1);
  if (currentSong) scoreCanvas.render(currentSong);
}

playPauseBtn.addEventListener('click', async () => {
  await bootstrap();
  if (!ready) return;
  if (scheduler && scheduler.isPlaying) {
    pausePlayback();
  } else {
    startPlayback();
  }
});

stopBtn.addEventListener('click', async () => {
  await bootstrap();
  if (!ready) return;
  stopPlayback();
});

progressBar.addEventListener('click', (e) => {
  if (!currentSong || !scheduler) return;
  const rect = progressBar.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  const targetBeat = Math.floor(pct * currentSong.lengthBeats);
  const wasPlaying = scheduler.isPlaying;
  if (wasPlaying) scheduler.stop();
  scheduler = createScheduler(getContext(), transport, onBeat);
  scheduler.startFrom(targetBeat);
  if (!wasPlaying) {
    scheduler.stop();
  }
  updateProgress(targetBeat);
  updatePlayerUI();
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

shareBtn.addEventListener('click', async () => {
  const url = buildShareUrl();
  try {
    await navigator.clipboard.writeText(url);
    shareBtn.textContent = 'Copied!';
    shareBtn.classList.add('copied');
    setTimeout(() => {
      shareBtn.textContent = 'Share';
      shareBtn.classList.remove('copied');
    }, 1500);
  } catch {
    shareBtn.textContent = 'Copy failed';
    setTimeout(() => { shareBtn.textContent = 'Share'; }, 1500);
  }
});

const STORAGE_KEY = 'seedsong-history';

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

function saveHistory(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function currentSnapshot() {
  return {
    seed: seedInput.value,
    bpm: bpmInput.value,
    time: beatsPerBarSelect.value,
    tonic: tonicSelect.value,
    scale: scaleSelect.value,
    bars: barsSelect.value,
    voice: voiceSelect.value,
  };
}

function snapshotsMatch(a, b) {
  if (!a || !b) return false;
  return a.seed === b.seed && a.bpm === b.bpm && a.time === b.time
    && a.tonic === b.tonic && a.scale === b.scale && a.bars === b.bars
    && (a.voice || 'piano') === (b.voice || 'piano');
}

function checkUnsaved() {
  const snap = currentSnapshot();
  if (snapshotsMatch(snap, lastSavedSnapshot)) {
    saveHint.textContent = '';
    saveHint.classList.remove('unsaved');
  } else {
    saveHint.textContent = 'Unsaved changes';
    saveHint.classList.add('unsaved');
  }
}

function formatDate(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function scaleLabel(val) {
  const opt = scaleSelect.querySelector(`option[value="${val}"]`);
  return opt ? opt.textContent : val;
}

function tonicLabel(val) {
  const opt = tonicSelect.querySelector(`option[value="${val}"]`);
  return opt ? opt.textContent : val;
}

function renderHistory() {
  const entries = getHistory();
  historyList.innerHTML = '';
  historyEmpty.style.display = entries.length ? 'none' : 'block';
  clearHistoryBtn.style.display = entries.length ? '' : 'none';

  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    const item = document.createElement('div');
    item.className = 'history-item';

    const info = document.createElement('div');
    info.className = 'history-item-info';
    const name = document.createElement('div');
    name.className = 'history-item-name';
    name.textContent = e.name || 'Untitled';
    const meta = document.createElement('div');
    meta.className = 'history-item-meta';
    const voiceLabel = e.voice && e.voice !== 'piano' ? ` · ${e.voice}` : '';
    meta.textContent = `${formatDate(e.savedAt)} · ${tonicLabel(e.tonic)} ${scaleLabel(e.scale)} · ${e.bpm} bpm${voiceLabel} · seed ${e.seed} · ${e.noteCount || '?'} notes`;
    info.appendChild(name);
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'history-item-actions';

    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.addEventListener('click', () => loadEntry(e));

    const renameBtn = document.createElement('button');
    renameBtn.textContent = 'Rename';
    renameBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'history-rename-input';
      input.value = e.name || '';
      name.replaceWith(input);
      input.focus();
      input.select();

      function commitRename() {
        const h = getHistory();
        h[i].name = input.value.trim();
        saveHistory(h);
        renderHistory();
      }
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') commitRename();
        if (ev.key === 'Escape') renderHistory();
      });
      input.addEventListener('blur', commitRename);
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      const h = getHistory();
      h.splice(i, 1);
      saveHistory(h);
      renderHistory();
    });

    actions.appendChild(loadBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);
    item.appendChild(info);
    item.appendChild(actions);
    historyList.appendChild(item);
  }
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
  seedInput.value = e.seed;
  songNameInput.value = e.name || '';
  clearActivePreset();
  regenerateSong({ keepSeed: true });
  lastSavedSnapshot = currentSnapshot();
  checkUnsaved();
}

songNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
});

saveBtn.addEventListener('click', () => {
  if (!currentSong) return;
  const snap = currentSnapshot();
  const entry = {
    ...snap,
    name: songNameInput.value.trim(),
    savedAt: Date.now(),
    noteCount: currentSong.events.length,
    preset: currentSong.preset,
  };
  const h = getHistory();
  h.push(entry);
  saveHistory(h);
  lastSavedSnapshot = { ...snap };
  songNameInput.value = '';
  checkUnsaved();
  renderHistory();
  saveHint.textContent = 'Saved!';
  saveHint.classList.remove('unsaved');
  setTimeout(() => checkUnsaved(), 1500);
});

clearHistoryBtn.addEventListener('click', () => {
  saveHistory([]);
  renderHistory();
});

renderHistory();

document.addEventListener('visibilitychange', () => {
  const ctx = getContext();
  if (ctx && !document.hidden && ctx.state === 'suspended') {
    ctx.resume();
  }
});
