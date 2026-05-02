import { init, getContext, setReverbAmount, setDelayAmount, setChorusAmount, setReverbPreset, setEQ, setMasterVolume, getTrackDest, setTrackPan } from './audio/AudioEngine.js';
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
import { initHistory, checkUnsaved } from './ui/History.js';
import { initGallery } from './ui/Gallery.js';
import { startOnboarding, shouldShowOnboarding } from './ui/Onboarding.js';

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
const clickModeBtn = document.getElementById('click-mode');
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
const progressionSelect = document.getElementById('progression');
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
const bassVolInput = document.getElementById('bass-vol');
const bassVolDisplay = document.getElementById('bass-vol-display');
const drumVolInput = document.getElementById('drum-vol');
const drumVolDisplay = document.getElementById('drum-vol-display');
const clickVolInput = document.getElementById('click-vol');
const clickVolDisplay = document.getElementById('click-vol-display');
const masterVolInput = document.getElementById('master-vol');
const masterVolDisplay = document.getElementById('master-vol-display');
const reverbInput = document.getElementById('reverb');
const reverbDisplay = document.getElementById('reverb-display');
const reverbPresetSelect = document.getElementById('reverb-preset');
const delayInput = document.getElementById('delay');
const delayDisplay = document.getElementById('delay-display');
const chorusInput = document.getElementById('chorus');
const chorusDisplay = document.getElementById('chorus-display');
const recordBtn = document.getElementById('record-btn');
const exportPreviewBtn = document.getElementById('export-preview');
const exportMidiBtn = document.getElementById('export-midi');
const exportWavBtn = document.getElementById('export-wav');
const exportStatus = document.getElementById('export-status');
const structureSelect = document.getElementById('structure');
const contourSelect = document.getElementById('contour');
const rhythmTemplateSelect = document.getElementById('rhythm-template');
const lockAllBtn = document.getElementById('lock-all-btn');
const unlockAllBtn = document.getElementById('unlock-all-btn');
const invertLockBtn = document.getElementById('invert-lock-btn');

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
let lastClickedBar = -1;
const scoreCanvas = createScoreCanvas(document.getElementById('score-canvas'), {
  onBarClick(barIndex, e) {
    if (e && e.shiftKey && lastClickedBar >= 0 && currentSong) {
      const from = Math.min(lastClickedBar, barIndex);
      const to = Math.max(lastClickedBar, barIndex);
      for (let b = from; b <= to; b++) {
        lockedBars.add(b);
        lockedBarEvents.set(b, getEventsForBar(currentSong, b));
      }
    } else if (lockedBars.has(barIndex)) {
      lockedBars.delete(barIndex);
      lockedBarEvents.delete(barIndex);
    } else if (currentSong) {
      lockedBars.add(barIndex);
      lockedBarEvents.set(barIndex, getEventsForBar(currentSong, barIndex));
    }
    lastClickedBar = barIndex;
    scoreCanvas.setLockedBars(lockedBars);
    if (currentSong) scoreCanvas.render(currentSong);
  },
  onBarLock(barIndex) {
    if (!currentSong || barIndex < 0 || barIndex >= currentSong.bars) return;
    lockedBars.add(barIndex);
    lockedBarEvents.set(barIndex, getEventsForBar(currentSong, barIndex));
    scoreCanvas.setLockedBars(lockedBars);
  },
  onNoteEdited() {
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
  if (p.has('chordVoice')) chordVoiceSelect.value = p.get('chordVoice');
  if (p.has('density')) densityInput.value = p.get('density');
  if (p.has('swing')) swingInput.value = p.get('swing');
  if (p.has('velocity')) velocityInput.value = p.get('velocity');
  if (p.has('transpose')) {
    transposeSemitones = Number(p.get('transpose')) || 0;
    transposeDisplay.textContent = transposeSemitones > 0 ? `+${transposeSemitones}` : String(transposeSemitones);
  }
  if (p.has('progression')) progressionSelect.value = p.get('progression');
  if (p.has('structure')) structureSelect.value = p.get('structure');
  if (p.has('contour')) contourSelect.value = p.get('contour');
  if (p.has('rhythm')) rhythmTemplateSelect.value = p.get('rhythm');
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
    setReverbAmount(Number(reverbInput.value));
    setDelayAmount(Number(delayInput.value));
    setChorusAmount(Number(chorusInput.value));
    setReverbPreset(reverbPresetSelect.value);
    setEQ('low', Number(eqLowInput.value));
    setEQ('mid', Number(eqMidInput.value));
    setEQ('high', Number(eqHighInput.value));
    setMasterVolume(Number(masterVolInput.value));
  } catch (err) {
    console.error(err);
  } finally {
    playPauseBtn.classList.remove('loading');
    playPauseBtn.disabled = false;
  }
}

const chordVoiceSelect = document.getElementById('chord-voice');

/* ---- Piano ---- */
function getSelectedVoice() { return voiceSelect.value; }
function getChordVoice() { return chordVoiceSelect.value; }

const piano = createPiano(pianoEl, {
  startOctave: 1,
  octaves: 6,
  onAttack(midi) {
    if (!ready) { bootstrap(); return; }
    const ctx = getContext();
    const dest = getTrackDest('melody');
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

const pianoScroll = document.getElementById('piano-scroll');
if (pianoScroll) {
  requestAnimationFrame(() => {
    const f3Index = 2 * 7 + 3;
    const keyW = pianoEl.querySelector('.key')?.offsetWidth || 36;
    pianoScroll.scrollLeft = f3Index * keyW - pianoScroll.clientWidth / 2;
  });
}

/* ---- Scheduling ---- */
function scheduleNote(midi, when, durationSec, velocity, evType = 'melody', ev = null) {
  const ctx = getContext();

  if (evType === 'drum' && ev) {
    const dest = getTrackDest('drum');
    playDrumHit(ctx, dest, { drum: ev.drum, when, velocity: velocity * Number(velocityInput.value) * Number(drumVolInput.value) });
    return;
  }

  const trackVol = evType === 'chord' ? Number(chordVolInput.value)
    : evType === 'bass' ? Number(bassVolInput.value)
    : Number(melodyVolInput.value);
  const vel = velocity * Number(velocityInput.value) * trackVol;
  const dest = getTrackDest(evType === 'chord' ? 'chord' : evType === 'bass' ? 'bass' : 'melody');

  if (evType === 'bass') {
    createSynthVoice(ctx, dest, { midi, velocity: vel, when, duration: durationSec, preset: 'bass' });
  } else {
    const voice = evType === 'chord' ? getChordVoice() : getSelectedVoice();
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
  const clickMode = Number(clickModeBtn.dataset.mode);
  const clickDest = getTrackDest('click');
  const clickVol = Number(clickVolInput.value);
  if (clickMode === 1) playClick(getContext(), clickDest, when, { accent, volume: clickVol });
  if (clickMode === 2 && accent) playClick(getContext(), clickDest, when, { accent: true, volume: clickVol });
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
  if (progressionSelect.value !== 'auto') url.searchParams.set('progression', progressionSelect.value);
  if (voiceSelect.value !== 'piano') url.searchParams.set('voice', voiceSelect.value);
  if (chordVoiceSelect.value !== 'pad') url.searchParams.set('chordVoice', chordVoiceSelect.value);
  if (densityInput.value !== '0.65') url.searchParams.set('density', densityInput.value);
  if (swingInput.value !== '0') url.searchParams.set('swing', swingInput.value);
  if (velocityInput.value !== '0.8') url.searchParams.set('velocity', velocityInput.value);
  if (transposeSemitones !== 0) url.searchParams.set('transpose', transposeSemitones);
  if (structureSelect.value !== 'single') url.searchParams.set('structure', structureSelect.value);
  if (contourSelect.value !== 'auto') url.searchParams.set('contour', contourSelect.value);
  if (rhythmTemplateSelect.value !== 'auto') url.searchParams.set('rhythm', rhythmTemplateSelect.value);
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
  const progressionPreset = progressionSelect.value === 'auto' ? null : progressionSelect.value;
  const contour = contourSelect.value === 'auto' ? 'auto' : contourSelect.value;
  const rhythmTemplate = rhythmTemplateSelect.value === 'auto' ? 'auto' : rhythmTemplateSelect.value;
  const raw = generateSong({
    seed,
    tonic: 60 + Number(tonicSelect.value),
    scale: scaleSelect.value,
    bars: Number(barsSelect.value),
    beatsPerBar: transport.beatsPerBar,
    density: Number(densityInput.value),
    swing: Number(swingInput.value),
    progressionPreset,
    contour,
    rhythmTemplate,
    structure: structureSelect.value,
  });
  currentSong = applyLockedBars(raw);
  if (transposeSemitones !== 0) currentSong.events.forEach(ev => { ev.midi += transposeSemitones; });

  seedInput.value = String(seed);
  const lockInfo = lockedBars.size > 0 ? ` · ${lockedBars.size} locked` : '';
  const progLabel = progressionSelect.value === 'auto' ? currentSong.preset : progressionSelect.value;
  const sectionInfo = currentSong.sections ? ` · ${currentSong.sections.length} sections` : '';
  songInfo.textContent = `seed ${seed} · ${progLabel} · ${currentSong.events.length} notes${sectionInfo}${lockInfo}`;
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
  saveSettings();
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

const CLICK_TITLES = ['Click track: off', 'Click track: all beats', 'Click track: downbeat only'];
clickModeBtn.addEventListener('click', () => {
  const mode = (Number(clickModeBtn.dataset.mode) + 1) % 3;
  clickModeBtn.dataset.mode = String(mode);
  clickModeBtn.title = CLICK_TITLES[mode];
});

[tonicSelect, scaleSelect, progressionSelect, contourSelect, rhythmTemplateSelect, structureSelect].forEach(sel =>
  sel.addEventListener('change', () => { clearActivePreset(); regenerateSong({ keepSeed: true }); })
);

barsSelect.addEventListener('change', () => { clearActivePreset(); clearLockedBars(); regenerateSong({ keepSeed: true }); });
voiceSelect.addEventListener('change', () => { pushUrlState(); checkUnsaved(); });
chordVoiceSelect.addEventListener('change', () => { pushUrlState(); checkUnsaved(); });

lockAllBtn.addEventListener('click', () => {
  if (!currentSong) return;
  for (let b = 0; b < currentSong.bars; b++) {
    lockedBars.add(b);
    lockedBarEvents.set(b, getEventsForBar(currentSong, b));
  }
  scoreCanvas.setLockedBars(lockedBars);
  scoreCanvas.render(currentSong);
});

unlockAllBtn.addEventListener('click', () => {
  clearLockedBars();
  if (currentSong) scoreCanvas.render(currentSong);
});

invertLockBtn.addEventListener('click', () => {
  if (!currentSong) return;
  for (let b = 0; b < currentSong.bars; b++) {
    if (lockedBars.has(b)) {
      lockedBars.delete(b);
      lockedBarEvents.delete(b);
    } else {
      lockedBars.add(b);
      lockedBarEvents.set(b, getEventsForBar(currentSong, b));
    }
  }
  scoreCanvas.setLockedBars(lockedBars);
  scoreCanvas.render(currentSong);
});

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

/* ---- Mixer controls ---- */
for (const [input, display, band] of [[eqLowInput, eqLowDisplay, 'low'], [eqMidInput, eqMidDisplay, 'mid'], [eqHighInput, eqHighDisplay, 'high']]) {
  input.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    display.textContent = `${v > 0 ? '+' : ''}${v}`;
    setEQ(band, v);
  });
}

for (const [input, display] of [[melodyVolInput, melodyVolDisplay], [chordVolInput, chordVolDisplay], [bassVolInput, bassVolDisplay], [drumVolInput, drumVolDisplay], [clickVolInput, clickVolDisplay], [masterVolInput, masterVolDisplay]]) {
  input.addEventListener('input', (e) => {
    display.textContent = `${Math.round(e.target.value * 100)}%`;
  });
}

masterVolInput.addEventListener('input', (e) => setMasterVolume(Number(e.target.value)));

reverbInput.addEventListener('input', (e) => {
  reverbDisplay.textContent = `${Math.round(e.target.value * 100)}%`;
  setReverbAmount(Number(e.target.value));
});

delayInput.addEventListener('input', (e) => {
  delayDisplay.textContent = `${Math.round(e.target.value * 100)}%`;
  setDelayAmount(Number(e.target.value));
});

chorusInput.addEventListener('input', (e) => {
  chorusDisplay.textContent = `${Math.round(e.target.value * 100)}%`;
  setChorusAmount(Number(e.target.value));
});

reverbPresetSelect.addEventListener('change', () => {
  setReverbPreset(reverbPresetSelect.value);
});

for (const muteBtn of document.querySelectorAll('.mixer-mute')) {
  muteBtn.addEventListener('click', () => {
    const fader = muteBtn.closest('.mixer-channel').querySelector('.mixer-fader');
    if (muteBtn.classList.toggle('muted')) {
      muteBtn.dataset.prev = fader.value;
      fader.value = 0;
    } else {
      fader.value = muteBtn.dataset.prev || 1;
    }
    fader.dispatchEvent(new Event('input'));
  });
}

const trackChannels = document.querySelectorAll('.mixer-channel[data-ch]');

function updateSoloState() {
  const anySoloed = document.querySelector('.mixer-solo.soloed');
  for (const ch of trackChannels) {
    const fader = ch.querySelector('.mixer-fader');
    const muteBtn = ch.querySelector('.mixer-mute');
    const soloBtn = ch.querySelector('.mixer-solo');
    if (!anySoloed) {
      if (muteBtn.classList.contains('muted')) return;
      if (ch.dataset.preSolo) {
        fader.value = ch.dataset.preSolo;
        delete ch.dataset.preSolo;
        fader.dispatchEvent(new Event('input'));
      }
    } else {
      const isSoloed = soloBtn.classList.contains('soloed');
      if (isSoloed) {
        if (ch.dataset.preSolo) {
          fader.value = ch.dataset.preSolo;
          delete ch.dataset.preSolo;
        }
      } else {
        if (!ch.dataset.preSolo) ch.dataset.preSolo = fader.value;
        fader.value = 0;
      }
      fader.dispatchEvent(new Event('input'));
    }
  }
}

for (const soloBtn of document.querySelectorAll('.mixer-solo')) {
  soloBtn.addEventListener('click', () => {
    soloBtn.classList.toggle('soloed');
    updateSoloState();
  });
}

for (const panInput of document.querySelectorAll('.mixer-pan')) {
  panInput.addEventListener('input', () => {
    setTrackPan(panInput.dataset.track, Number(panInput.value));
  });
  panInput.addEventListener('dblclick', () => {
    panInput.value = 0;
    setTrackPan(panInput.dataset.track, 0);
  });
}

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
    if (btn.dataset.voice) {
      voiceSelect.value = btn.dataset.voice;
    }
    chordVoiceSelect.value = btn.dataset.chordVoice || 'pad';
    if (btn.dataset.velocity) {
      velocityInput.value = btn.dataset.velocity;
      velocityDisplay.textContent = `${Math.round(btn.dataset.velocity * 100)}%`;
    }
    if (btn.dataset.reverb) {
      reverbInput.value = btn.dataset.reverb;
      reverbDisplay.textContent = `${Math.round(btn.dataset.reverb * 100)}%`;
      setReverbAmount(Number(btn.dataset.reverb));
    }
    if (btn.dataset.delay) {
      delayInput.value = btn.dataset.delay;
      delayDisplay.textContent = `${Math.round(btn.dataset.delay * 100)}%`;
      setDelayAmount(Number(btn.dataset.delay));
    }
    if (btn.dataset.structure) structureSelect.value = btn.dataset.structure;
    contourSelect.value = btn.dataset.contour || 'auto';
    rhythmTemplateSelect.value = btn.dataset.rhythm || 'auto';
    clearActivePreset();
    clearLockedBars();
    btn.classList.add('active');
    regenerateSong({ keepSeed: false });
    saveSettings();
  });
}

/* ---- Settings persistence ---- */
const SETTINGS_KEY = 'seedsong-settings';

const settingsInputs = {
  bpm: bpmInput, tonic: tonicSelect, scale: scaleSelect, bars: barsSelect,
  beatsPerBar: beatsPerBarSelect, voice: voiceSelect, chordVoice: chordVoiceSelect,
  density: densityInput, swing: swingInput, velocity: velocityInput,
  progression: progressionSelect, structure: structureSelect, contour: contourSelect,
  rhythmTemplate: rhythmTemplateSelect, seed: seedInput,
  melodyVol: melodyVolInput, chordVol: chordVolInput, bassVol: bassVolInput,
  drumVol: drumVolInput, clickVol: clickVolInput, masterVol: masterVolInput,
  reverb: reverbInput, delay: delayInput, chorus: chorusInput,
  reverbPreset: reverbPresetSelect,
  eqLow: eqLowInput, eqMid: eqMidInput, eqHigh: eqHighInput,
};

function saveSettings() {
  const data = {};
  for (const [k, el] of Object.entries(settingsInputs)) data[k] = el.value;
  data.transpose = transposeSemitones;
  const pans = {};
  for (const p of document.querySelectorAll('.mixer-pan')) {
    pans[p.dataset.track] = p.value;
  }
  data.pans = pans;
  const activeTab = document.querySelector('#tab-bar [aria-selected="true"]');
  if (activeTab) data.activeTab = activeTab.dataset.panel;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(data)); } catch {}
}

function loadSettings() {
  let data;
  try { data = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch {}
  if (!data) return false;
  for (const [k, el] of Object.entries(settingsInputs)) {
    if (data[k] != null) el.value = data[k];
  }
  if (data.transpose != null) {
    transposeSemitones = data.transpose;
    transposeDisplay.textContent = transposeSemitones > 0 ? `+${transposeSemitones}` : String(transposeSemitones);
  }
  if (data.pans) {
    for (const [track, val] of Object.entries(data.pans)) {
      const p = document.querySelector(`.mixer-pan[data-track="${track}"]`);
      if (p) { p.value = val; setTrackPan(track, Number(val)); }
    }
  }
  bpmDisplay.textContent = bpmInput.value;
  transport.setBpm(Number(bpmInput.value));
  transport.setBeatsPerBar(Number(beatsPerBarSelect.value));
  densityDisplay.textContent = `${Math.round(densityInput.value * 100)}%`;
  swingDisplay.textContent = `${Math.round(swingInput.value * 100)}%`;
  velocityDisplay.textContent = `${Math.round(velocityInput.value * 100)}%`;
  melodyVolDisplay.textContent = `${Math.round(melodyVolInput.value * 100)}%`;
  chordVolDisplay.textContent = `${Math.round(chordVolInput.value * 100)}%`;
  bassVolDisplay.textContent = `${Math.round(bassVolInput.value * 100)}%`;
  drumVolDisplay.textContent = `${Math.round(drumVolInput.value * 100)}%`;
  clickVolDisplay.textContent = `${Math.round(clickVolInput.value * 100)}%`;
  masterVolDisplay.textContent = `${Math.round(masterVolInput.value * 100)}%`;
  reverbDisplay.textContent = `${Math.round(reverbInput.value * 100)}%`;
  delayDisplay.textContent = `${Math.round(delayInput.value * 100)}%`;
  chorusDisplay.textContent = `${Math.round(chorusInput.value * 100)}%`;
  const eqFmt = (v) => `${Number(v) > 0 ? '+' : ''}${v}`;
  eqLowDisplay.textContent = eqFmt(eqLowInput.value);
  eqMidDisplay.textContent = eqFmt(eqMidInput.value);
  eqHighDisplay.textContent = eqFmt(eqHighInput.value);
  if (data.activeTab) {
    const tabBar = document.getElementById('tab-bar');
    const tab = tabBar.querySelector(`[data-panel="${data.activeTab}"]`);
    if (tab) {
      for (const t of tabBar.querySelectorAll('[role="tab"]')) {
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      }
      for (const p of document.querySelectorAll('.tab-panel')) {
        p.classList.toggle('hidden', p.id !== `panel-${data.activeTab}`);
      }
    }
  }
  return true;
}

/* ---- Settings event listeners ---- */
for (const el of Object.values(settingsInputs)) {
  el.addEventListener('change', saveSettings);
  el.addEventListener('input', saveSettings);
}
document.querySelectorAll('.mixer-pan').forEach(p => {
  p.addEventListener('input', saveSettings);
});
window.addEventListener('beforeunload', saveSettings);

/* ---- Initial song ---- */
{
  const urlHasSeed = new URLSearchParams(window.location.search).has('seed');
  loadSettings();
  if (urlHasSeed) applyUrlParams();
  regenerateSong({ keepSeed: urlHasSeed || seedInput.value !== '' });
}

requestAnimationFrame(() => { document.body.style.opacity = '1'; });

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

const shareImageBtn = document.getElementById('share-image-btn');
shareImageBtn.addEventListener('click', async () => {
  if (!currentSong) return;
  const canvas = document.getElementById('score-canvas');
  try {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    shareImageBtn.textContent = 'Copied!';
    shareImageBtn.classList.add('copied');
  } catch {
    shareImageBtn.textContent = 'Failed';
  }
  setTimeout(() => { shareImageBtn.textContent = 'Copy Image'; shareImageBtn.classList.remove('copied'); }, 1500);
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
    chordVoice: chordVoiceSelect.value,
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
  chordVoiceSelect.value = e.chordVoice || 'pad';
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

/* ---- Onboarding ---- */
const tourBtn = document.getElementById('tour-btn');
tourBtn.addEventListener('click', () => startOnboarding());
if (shouldShowOnboarding()) startOnboarding();

/* ---- Tab switching ---- */
const tabBar = document.getElementById('tab-bar');
tabBar.addEventListener('click', (e) => {
  const tab = e.target.closest('[role="tab"]');
  if (!tab) return;
  const panelId = tab.dataset.panel;
  if (!panelId) return;
  for (const t of tabBar.querySelectorAll('[role="tab"]')) {
    t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
  }
  for (const p of document.querySelectorAll('.tab-panel')) {
    p.classList.toggle('hidden', p.id !== `panel-${panelId}`);
  }
  saveSettings();
});

/* ---- Piano drawer toggle ---- */
const pianoToggle = document.getElementById('piano-toggle');
const pianoDrawer = document.getElementById('piano-drawer');
pianoToggle.addEventListener('click', () => {
  const open = pianoDrawer.classList.toggle('collapsed');
  pianoToggle.setAttribute('aria-expanded', String(!open));
});

/* ---- ResizeObserver for score canvas ---- */
const scoreCanvasEl = document.getElementById('score-canvas');
const resizeObs = new ResizeObserver(() => {
  if (currentSong) scoreCanvas.render(currentSong);
});
resizeObs.observe(scoreCanvasEl);

/* ---- Visibility resume ---- */
document.addEventListener('visibilitychange', () => {
  const ctx = getContext();
  if (ctx && !document.hidden && ctx.state === 'suspended') ctx.resume();
});
