import { generateSong } from '../generate/song.js';
import { randomSeed } from '../generate/rng.js';

const STORAGE_KEY = 'seedsong-explore-feedback';
const SCALES = ['major', 'natural_minor', 'dorian', 'mixolydian', 'pentatonic_major', 'pentatonic_minor', 'blues', 'lydian', 'phrygian'];
const VOICES = ['piano', 'pad', 'pluck', 'organ', 'strings', 'marimba', 'epiano'];
const BPMS = [72, 80, 88, 96, 110, 120, 130, 145];

const TONIC_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function readFeedback() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function writeFeedback(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

let currentParams = null;
let currentSong = null;
let isPlaying = false;
let activeOscillators = [];
let stopHandle = null;

function generateRandomCandidate() {
  const r = Math.random;
  const params = {
    seed: randomSeed(),
    scale: pick(SCALES, r),
    tonic: Math.floor(r() * 12),
    bpm: pick(BPMS, r),
    voice: pick(VOICES, r),
    bars: 4,
    beatsPerBar: 4,
    density: 0.4 + r() * 0.45,
    swing: r() < 0.4 ? Math.round(r() * 4) / 10 : 0,
  };
  const song = generateSong({
    seed: params.seed,
    tonic: 60 + (params.tonic - 0),
    scale: params.scale,
    bars: params.bars,
    beatsPerBar: params.beatsPerBar,
    density: params.density,
    swing: params.swing,
  });
  return { params, song };
}

function drawPreview(canvas, song) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW === 0 || cssH === 0) return;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const styles = getComputedStyle(document.documentElement);
  const melodyColor = styles.getPropertyValue('--melody-color').trim() || '#ffd54a';
  const chordColor = styles.getPropertyValue('--chord-color').trim() || '#4a8';
  const bassColor = styles.getPropertyValue('--bass-color').trim() || '#6495ed';

  const events = song.events.filter(e => e.type !== 'drum');
  if (!events.length) return;
  const midis = events.map(e => e.midi);
  const minMidi = Math.min(...midis) - 1;
  const maxMidi = Math.max(...midis) + 1;
  const totalBeats = song.lengthBeats;

  const pad = 12;
  const w = cssW - pad * 2;
  const h = cssH - pad * 2;
  const rng = maxMidi - minMidi || 1;

  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let b = 0; b <= totalBeats; b++) {
    const x = pad + (b / totalBeats) * w;
    ctx.beginPath();
    ctx.moveTo(x, pad);
    ctx.lineTo(x, pad + h);
    ctx.stroke();
  }

  for (const ev of events) {
    const x = pad + (ev.atBeat / totalBeats) * w;
    const wd = Math.max((ev.durationBeats / totalBeats) * w - 1, 2);
    const y = pad + h - ((ev.midi - minMidi) / rng) * h - 3;
    ctx.fillStyle = ev.type === 'chord' ? chordColor : ev.type === 'bass' ? bassColor : melodyColor;
    ctx.beginPath();
    ctx.roundRect(x, y, wd, 5, 2);
    ctx.fill();
  }
}

async function startPreviewPlayback(song, params, audioApi) {
  if (isPlaying) stopPreviewPlayback();
  if (!audioApi) return;
  try {
    await audioApi.ensureInit();
  } catch {}
  const ctx = audioApi.getContext();
  if (!ctx) return;
  const dest = audioApi.getTrackDest('melody') || audioApi.getMasterGain();
  if (!dest) return;
  isPlaying = true;
  document.getElementById('feed-play')?.classList.add('playing');

  const beatDur = 60 / params.bpm;
  const startTime = ctx.currentTime + 0.05;
  const events = song.events.filter(e => e.type !== 'drum');
  for (const ev of events) {
    const when = startTime + ev.atBeat * beatDur;
    const dur = Math.max(0.05, ev.durationBeats * beatDur * 0.95);
    const freq = 440 * Math.pow(2, (ev.midi - 69) / 12);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = ev.type === 'chord' ? 'triangle' : 'sine';
    osc.frequency.value = freq;
    const peakVel = ev.type === 'chord' ? 0.06 : 0.10;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peakVel, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain).connect(dest);
    osc.start(when);
    osc.stop(when + dur + 0.05);
    activeOscillators.push(osc);
  }

  const totalDur = song.lengthBeats * beatDur;
  stopHandle = setTimeout(() => stopPreviewPlayback(), totalDur * 1000 + 100);
}

function stopPreviewPlayback() {
  isPlaying = false;
  document.getElementById('feed-play')?.classList.remove('playing');
  for (const osc of activeOscillators) {
    try { osc.stop(); } catch {}
  }
  activeOscillators = [];
  if (stopHandle) { window.clearTimeout(stopHandle); stopHandle = null; }
}

function loadNextCard() {
  stopPreviewPlayback();
  const candidate = generateRandomCandidate();
  currentParams = candidate.params;
  currentSong = candidate.song;
  const seedEl = document.getElementById('feed-seed');
  if (seedEl) seedEl.textContent = `seed ${candidate.params.seed}`;
  const tagsEl = document.getElementById('feed-tags');
  if (tagsEl) {
    const swingTag = candidate.params.swing > 0 ? `<span class="feed-tag">${Math.round(candidate.params.swing * 100)}% swing</span>` : '';
    tagsEl.innerHTML = `
      <span class="feed-tag">${TONIC_LABELS[candidate.params.tonic]} ${candidate.params.scale.replace('_', ' ')}</span>
      <span class="feed-tag">${candidate.params.bpm} BPM</span>
      <span class="feed-tag">${candidate.params.voice}</span>
      ${swingTag}
    `;
  }
  const card = document.getElementById('feed-card');
  if (card) {
    card.classList.remove('swipe-left', 'swipe-right', 'swipe-up');
  }
  const canvas = document.getElementById('feed-canvas');
  if (canvas) {
    requestAnimationFrame(() => drawPreview(canvas, candidate.song));
  }
}

function recordFeedback(action) {
  if (!currentParams) return;
  const all = readFeedback();
  all.push({
    seed: currentParams.seed,
    scale: currentParams.scale,
    tonic: currentParams.tonic,
    bpm: currentParams.bpm,
    voice: currentParams.voice,
    density: currentParams.density,
    swing: currentParams.swing,
    action,
    at: Date.now(),
  });
  if (all.length > 1000) all.splice(0, all.length - 1000);
  writeFeedback(all);
  updateStats();
}

function updateStats() {
  const all = readFeedback();
  const liked = all.filter(e => e.action === 'like').length;
  const skipped = all.filter(e => e.action === 'skip').length;
  const likedEl = document.getElementById('explore-count-liked');
  const skippedEl = document.getElementById('explore-count-skipped');
  if (likedEl) likedEl.textContent = String(liked);
  if (skippedEl) skippedEl.textContent = String(skipped);
}

function topOf(map) {
  let best = null, bestN = -1;
  for (const [k, v] of Object.entries(map)) {
    if (v > bestN) { best = k; bestN = v; }
  }
  return { key: best, count: bestN };
}

function renderWrapped() {
  const all = readFeedback();
  const liked = all.filter(e => e.action === 'like');
  const body = document.getElementById('wrapped-body');
  if (!body) return;
  if (liked.length < 3) {
    body.innerHTML = `<p class="wrapped-empty">Like at least 3 seeds to unlock your Wrapped. You're ${liked.length}/3 there.</p>`;
    return;
  }
  const scale = {}, tonic = {}, voice = {}, bpmBucket = {};
  let densitySum = 0, swingSum = 0;
  for (const e of liked) {
    scale[e.scale] = (scale[e.scale] || 0) + 1;
    tonic[e.tonic] = (tonic[e.tonic] || 0) + 1;
    voice[e.voice] = (voice[e.voice] || 0) + 1;
    const bucket = e.bpm < 90 ? 'slow (<90)' : e.bpm < 120 ? 'medium (90–119)' : 'fast (≥120)';
    bpmBucket[bucket] = (bpmBucket[bucket] || 0) + 1;
    densitySum += e.density;
    swingSum += e.swing;
  }
  const topScale = topOf(scale);
  const topTonic = topOf(tonic);
  const topVoice = topOf(voice);
  const topBpm = topOf(bpmBucket);
  const avgDensity = Math.round((densitySum / liked.length) * 100);
  const avgSwing = Math.round((swingSum / liked.length) * 100);

  body.innerHTML = `
    <div class="wrapped-stat"><span class="wrapped-stat-label">Total liked</span><span class="wrapped-stat-value">${liked.length}</span></div>
    <div class="wrapped-stat"><span class="wrapped-stat-label">Favourite scale</span><span class="wrapped-stat-value">${topScale.key.replace('_', ' ')} (${topScale.count})</span></div>
    <div class="wrapped-stat"><span class="wrapped-stat-label">Favourite key</span><span class="wrapped-stat-value">${TONIC_LABELS[topTonic.key]}</span></div>
    <div class="wrapped-stat"><span class="wrapped-stat-label">Favourite voice</span><span class="wrapped-stat-value">${topVoice.key}</span></div>
    <div class="wrapped-stat"><span class="wrapped-stat-label">Tempo zone</span><span class="wrapped-stat-value">${topBpm.key}</span></div>
    <div class="wrapped-stat"><span class="wrapped-stat-label">Avg density</span><span class="wrapped-stat-value">${avgDensity}%</span></div>
    <div class="wrapped-stat"><span class="wrapped-stat-label">Avg swing</span><span class="wrapped-stat-value">${avgSwing}%</span></div>
  `;
}

function swipeAndAdvance(direction, action) {
  const card = document.getElementById('feed-card');
  if (card) card.classList.add(`swipe-${direction}`);
  recordFeedback(action);
  setTimeout(() => loadNextCard(), 280);
}

export function initExploreView({ audioApi, onLoadSeed }) {
  const playBtn = document.getElementById('feed-play');
  const skipBtn = document.getElementById('feed-skip');
  const likeBtn = document.getElementById('feed-like');
  const saveBtn = document.getElementById('feed-save');
  const wrappedBtn = document.getElementById('explore-wrapped-btn');
  const wrappedClose = document.getElementById('wrapped-close');
  const wrappedOverlay = document.getElementById('wrapped-overlay');

  playBtn?.addEventListener('click', () => {
    if (isPlaying) stopPreviewPlayback();
    else startPreviewPlayback(currentSong, currentParams, audioApi);
  });

  skipBtn?.addEventListener('click', () => swipeAndAdvance('left', 'skip'));
  likeBtn?.addEventListener('click', () => swipeAndAdvance('right', 'like'));
  saveBtn?.addEventListener('click', () => {
    if (!currentParams) return;
    recordFeedback('save');
    if (onLoadSeed) onLoadSeed(currentParams);
    window.location.hash = '#/generator';
  });

  wrappedBtn?.addEventListener('click', () => {
    renderWrapped();
    wrappedOverlay?.classList.remove('hidden');
  });
  wrappedClose?.addEventListener('click', () => wrappedOverlay?.classList.add('hidden'));
  wrappedOverlay?.addEventListener('click', (e) => {
    if (e.target === wrappedOverlay) wrappedOverlay.classList.add('hidden');
  });

  // Touch swipe
  const card = document.getElementById('feed-card');
  let dragStart = null;
  card?.addEventListener('pointerdown', (e) => {
    dragStart = { x: e.clientX, y: e.clientY, t: Date.now() };
  });
  card?.addEventListener('pointerup', (e) => {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const dt = Date.now() - dragStart.t;
    dragStart = null;
    if (dt > 800 || (Math.abs(dx) < 50 && Math.abs(dy) < 50)) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) swipeAndAdvance('right', 'like');
      else swipeAndAdvance('left', 'skip');
    } else if (dy < 0) {
      // upward swipe → save
      const card = document.getElementById('feed-card');
      card?.classList.add('swipe-up');
      recordFeedback('save');
      if (onLoadSeed && currentParams) onLoadSeed(currentParams);
      setTimeout(() => loadNextCard(), 280);
    }
  });
  card?.addEventListener('pointercancel', () => { dragStart = null; });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (document.getElementById('view-explore')?.classList.contains('hidden')) return;
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') { swipeAndAdvance('left', 'skip'); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { swipeAndAdvance('right', 'like'); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { saveBtn?.click(); e.preventDefault(); }
    else if (e.key === ' ') { playBtn?.click(); e.preventDefault(); }
  });

  loadNextCard();
  updateStats();
}

export function refreshExplore() {
  const canvas = document.getElementById('feed-canvas');
  if (canvas && currentSong) drawPreview(canvas, currentSong);
}

export function stopExplorePlayback() {
  stopPreviewPlayback();
}
