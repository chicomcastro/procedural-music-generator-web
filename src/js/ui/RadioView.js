import { generateSong } from '../generate/song.js';
import { t, onLangChange } from '../i18n/i18n.js';

const FEEDBACK_KEY = 'seedsong-explore-feedback';
const TONIC_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

let audioApiRef = null;
let onLoadSeedCb = null;

let queue = [];           // shuffled list of liked feedback entries
let queueIdx = 0;
let currentSong = null;
let currentParams = null;

let isPlaying = false;
let activeOscillators = [];
let advanceTimer = null;  // scheduled "play next" handle

function readLiked() {
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(FEEDBACK_KEY)) || []; } catch {}
  return arr.filter(e => e.action === 'like' || e.action === 'save');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQueue() {
  const liked = readLiked();
  queue = shuffle(liked);
  queueIdx = 0;
}

function paramsFromFeedback(fb) {
  return {
    seed: fb.seed,
    scale: fb.scale,
    tonic: fb.tonic,
    bpm: fb.bpm,
    voice: fb.voice,
    density: fb.density,
    swing: fb.swing,
    bars: 4,
    beatsPerBar: 4,
  };
}

function regenerateSong(params) {
  return generateSong({
    seed: params.seed,
    tonic: 60 + (params.tonic - 0),
    scale: params.scale,
    bars: params.bars,
    beatsPerBar: params.beatsPerBar,
    density: params.density,
    swing: params.swing,
  });
}

/* ---- Rendering ---- */
function render() {
  const empty = document.getElementById('radio-empty');
  const stage = document.getElementById('radio-stage');
  const playBtn = document.getElementById('radio-play');
  const skipBtn = document.getElementById('radio-skip');
  const shuffleBtn = document.getElementById('radio-shuffle');

  if (queue.length === 0) {
    if (empty) empty.hidden = false;
    if (stage) stage.hidden = true;
    [playBtn, skipBtn, shuffleBtn].forEach(b => { if (b) b.disabled = true; });
    return;
  }
  if (empty) empty.hidden = true;
  if (stage) stage.hidden = false;
  [playBtn, skipBtn, shuffleBtn].forEach(b => { if (b) b.disabled = false; });

  const cur = queue[queueIdx];
  currentParams = paramsFromFeedback(cur);
  currentSong = regenerateSong(currentParams);

  const seedEl = document.getElementById('radio-now-seed');
  if (seedEl) seedEl.textContent = `seed ${currentParams.seed}`;
  const tagsEl = document.getElementById('radio-now-tags');
  if (tagsEl) {
    tagsEl.innerHTML = `
      <span class="feed-tag">${TONIC_LABELS[currentParams.tonic] || ''} ${currentParams.scale.replace('_', ' ')}</span>
      <span class="feed-tag">${currentParams.bpm} BPM</span>
      <span class="feed-tag">${currentParams.voice}</span>
    `;
  }
  drawCanvas();
  renderQueueList();
}

function drawCanvas() {
  const canvas = document.getElementById('radio-canvas');
  if (!canvas || !currentSong) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320;
  const h = canvas.clientHeight || 160;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  const notes = currentSong.events.filter(e => e.type !== 'drum');
  if (notes.length === 0) return;
  const minMidi = Math.min(...notes.map(n => n.midi));
  const maxMidi = Math.max(...notes.map(n => n.midi));
  const range = Math.max(1, maxMidi - minMidi);
  const beats = currentSong.lengthBeats || 16;
  for (const n of notes) {
    const x = (n.atBeat / beats) * w;
    const x2 = ((n.atBeat + n.durationBeats) / beats) * w;
    const y = h - ((n.midi - minMidi) / range) * (h - 12) - 6;
    ctx.fillStyle = n.type === 'chord' ? '#5b9eff' : n.type === 'bass' ? '#bb86fc' : '#e8a735';
    ctx.fillRect(x, y, Math.max(2, x2 - x - 1), 4);
  }
}

function renderQueueList() {
  const list = document.getElementById('radio-queue-list');
  const remaining = document.getElementById('radio-queue-remaining');
  if (!list || !remaining) return;
  list.innerHTML = '';
  const upcoming = queue.slice(queueIdx + 1, queueIdx + 6);
  remaining.textContent = String(Math.max(0, queue.length - queueIdx - 1));
  for (const fb of upcoming) {
    const li = document.createElement('div');
    li.className = 'radio-queue-item';
    li.innerHTML = `
      <span class="radio-queue-seed">⌗ ${fb.seed}</span>
      <span class="radio-queue-tag">${TONIC_LABELS[fb.tonic] || ''} ${(fb.scale || '').replace('_', ' ')}</span>
      <span class="radio-queue-tag">${fb.bpm} BPM</span>
    `;
    list.appendChild(li);
  }
}

/* ---- Audio ---- */
async function playCurrent() {
  if (!audioApiRef || !currentSong) return;
  try { await audioApiRef.ensureInit(); } catch {}
  const ctx = audioApiRef.getContext();
  if (!ctx) return;
  const dest = audioApiRef.getTrackDest('melody') || audioApiRef.getMasterGain();
  if (!dest) return;
  stopOscillators();

  const beatDur = 60 / currentParams.bpm;
  const startTime = ctx.currentTime + 0.05;
  const events = currentSong.events.filter(e => e.type !== 'drum');
  for (const ev of events) {
    const when = startTime + ev.atBeat * beatDur;
    const dur = Math.max(0.05, ev.durationBeats * beatDur * 0.95);
    const freq = 440 * Math.pow(2, (ev.midi - 69) / 12);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = ev.type === 'chord' ? 'triangle' : 'sine';
    osc.frequency.value = freq;
    const peak = ev.type === 'chord' ? 0.06 : 0.10;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peak, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain).connect(dest);
    osc.start(when);
    osc.stop(when + dur + 0.05);
    activeOscillators.push(osc);
  }

  const totalMs = currentSong.lengthBeats * beatDur * 1000 + 300;
  if (advanceTimer) clearTimeout(advanceTimer);
  advanceTimer = setTimeout(() => {
    stopOscillators();
    if (isPlaying) skipToNext();
  }, totalMs);
}

function stopOscillators() {
  for (const osc of activeOscillators) {
    try { osc.stop(); } catch {}
  }
  activeOscillators = [];
  if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
}

function skipToNext() {
  if (queue.length === 0) return;
  queueIdx = (queueIdx + 1) % queue.length;
  render();
  if (isPlaying) playCurrent();
}

function setPlayingUI(playing) {
  const btn = document.getElementById('radio-play');
  const icon = btn?.querySelector('.radio-play-icon');
  const label = document.getElementById('radio-play-label');
  if (icon) icon.textContent = playing ? '■' : '▶';
  if (label) label.textContent = playing ? t('radio.pause') : t('radio.play');
  if (btn) btn.classList.toggle('compose-play-active', playing);
}

function togglePlay() {
  if (queue.length === 0) return;
  if (isPlaying) {
    isPlaying = false;
    stopOscillators();
    setPlayingUI(false);
  } else {
    isPlaying = true;
    setPlayingUI(true);
    playCurrent();
  }
}

export function stopRadioPlayback() {
  if (!isPlaying) return;
  isPlaying = false;
  stopOscillators();
  setPlayingUI(false);
}

export function refreshRadio() {
  buildQueue();
  render();
}

export function initRadioView({ audioApi, onLoadSeed }) {
  audioApiRef = audioApi;
  onLoadSeedCb = onLoadSeed;
  buildQueue();
  render();

  document.getElementById('radio-play')?.addEventListener('click', togglePlay);
  document.getElementById('radio-skip')?.addEventListener('click', () => {
    skipToNext();
  });
  document.getElementById('radio-shuffle')?.addEventListener('click', () => {
    if (queue.length === 0) return;
    queue = shuffle(queue);
    queueIdx = 0;
    render();
    if (isPlaying) playCurrent();
  });
  document.getElementById('radio-now-open')?.addEventListener('click', () => {
    if (currentParams && onLoadSeedCb) onLoadSeedCb(currentParams);
  });

  onLangChange(() => setPlayingUI(isPlaying));

  // Refresh canvas on resize so it stays crisp.
  window.addEventListener('resize', () => drawCanvas());
}
