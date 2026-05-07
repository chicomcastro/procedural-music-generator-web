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

/* ---- "More like this" ---- */
function topOfMap(map) {
  let best = null, bestN = -1;
  for (const [k, v] of Object.entries(map)) {
    if (v > bestN) { best = k; bestN = v; }
  }
  return { key: best, count: bestN };
}

function getLikedTaste() {
  const liked = readFeedback().filter(e => e.action === 'like' || e.action === 'save');
  if (liked.length < 2) return null;
  const scaleMap = {}, tonicMap = {}, voiceMap = {};
  let densitySum = 0, swingSum = 0, bpmSum = 0;
  for (const e of liked) {
    scaleMap[e.scale] = (scaleMap[e.scale] || 0) + 1;
    tonicMap[e.tonic] = (tonicMap[e.tonic] || 0) + 1;
    voiceMap[e.voice] = (voiceMap[e.voice] || 0) + 1;
    densitySum += e.density;
    swingSum += e.swing;
    bpmSum += e.bpm;
  }
  return {
    scales: scaleMap,
    tonics: tonicMap,
    voices: voiceMap,
    avgDensity: densitySum / liked.length,
    avgSwing: swingSum / liked.length,
    avgBpm: bpmSum / liked.length,
    topScale: topOfMap(scaleMap).key,
    topVoice: topOfMap(voiceMap).key,
  };
}

function pickWeighted(map, fallbackArr, exploreChance = 0.35) {
  if (Math.random() < exploreChance) return fallbackArr[Math.floor(Math.random() * fallbackArr.length)];
  const entries = Object.entries(map);
  if (entries.length === 0) return fallbackArr[Math.floor(Math.random() * fallbackArr.length)];
  const total = entries.reduce((a, [, n]) => a + n, 0);
  let pickPoint = Math.random() * total;
  for (const [k, n] of entries) {
    pickPoint -= n;
    if (pickPoint <= 0) {
      // Coerce numeric keys back to numbers for tonic
      return /^\d+$/.test(k) ? Number(k) : k;
    }
  }
  return entries[0][0];
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function generateRandomCandidate() {
  const taste = getLikedTaste();
  let params;
  if (taste) {
    // Bias toward favourites with some exploration
    const scale = pickWeighted(taste.scales, SCALES);
    const tonic = pickWeighted(taste.tonics, [...Array(12).keys()]);
    const voice = pickWeighted(taste.voices, VOICES);
    // BPM jitter around average, density nudged toward avg
    const bpm = clamp(Math.round(taste.avgBpm + (Math.random() - 0.5) * 24), 60, 180);
    const density = clamp(taste.avgDensity + (Math.random() - 0.5) * 0.25, 0.25, 0.95);
    const swing = Math.random() < 0.35 ? clamp(taste.avgSwing + (Math.random() - 0.5) * 0.2, 0, 0.7) : 0;
    params = {
      seed: randomSeed(),
      scale, tonic: typeof tonic === 'number' ? tonic : Number(tonic),
      bpm, voice,
      bars: 4, beatsPerBar: 4,
      density, swing,
      affinity: true,
    };
  } else {
    const r = Math.random;
    params = {
      seed: randomSeed(),
      scale: pick(SCALES, r),
      tonic: Math.floor(r() * 12),
      bpm: pick(BPMS, r),
      voice: pick(VOICES, r),
      bars: 4, beatsPerBar: 4,
      density: 0.4 + r() * 0.45,
      swing: r() < 0.4 ? Math.round(r() * 4) / 10 : 0,
      affinity: false,
    };
  }
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
    const affinityTag = candidate.params.affinity ? `<span class="feed-tag feed-tag-affinity" title="Picked based on what you liked">★ for you</span>` : '';
    tagsEl.innerHTML = `
      ${affinityTag}
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

let lastWrappedSummary = null;

function renderWrapped() {
  const all = readFeedback();
  const liked = all.filter(e => e.action === 'like');
  const body = document.getElementById('wrapped-body');
  const actions = document.getElementById('wrapped-actions');
  if (!body) return;
  if (liked.length < 3) {
    body.innerHTML = `<p class="wrapped-empty">Like at least 3 seeds to unlock your Wrapped. You're ${liked.length}/3 there.</p>`;
    if (actions) actions.hidden = true;
    lastWrappedSummary = null;
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

  lastWrappedSummary = {
    total: liked.length,
    scale: topScale.key.replace('_', ' '),
    key: TONIC_LABELS[topTonic.key],
    voice: topVoice.key,
    tempo: topBpm.key,
    density: avgDensity,
    swing: avgSwing,
  };

  body.innerHTML = `
    <div class="wrapped-stat"><span class="wrapped-stat-label">Total liked</span><span class="wrapped-stat-value">${liked.length}</span></div>
    <div class="wrapped-stat"><span class="wrapped-stat-label">Favourite scale</span><span class="wrapped-stat-value">${topScale.key.replace('_', ' ')} (${topScale.count})</span></div>
    <div class="wrapped-stat"><span class="wrapped-stat-label">Favourite key</span><span class="wrapped-stat-value">${TONIC_LABELS[topTonic.key]}</span></div>
    <div class="wrapped-stat"><span class="wrapped-stat-label">Favourite voice</span><span class="wrapped-stat-value">${topVoice.key}</span></div>
    <div class="wrapped-stat"><span class="wrapped-stat-label">Tempo zone</span><span class="wrapped-stat-value">${topBpm.key}</span></div>
    <div class="wrapped-stat"><span class="wrapped-stat-label">Avg density</span><span class="wrapped-stat-value">${avgDensity}%</span></div>
    <div class="wrapped-stat"><span class="wrapped-stat-label">Avg swing</span><span class="wrapped-stat-value">${avgSwing}%</span></div>
  `;
  if (actions) actions.hidden = false;
}

function renderWrappedImage() {
  if (!lastWrappedSummary) return null;
  const dpr = window.devicePixelRatio || 1;
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0f1f2a');
  grad.addColorStop(0.5, '#142f44');
  grad.addColorStop(1, '#0a1a26');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Accent glow blobs
  ctx.fillStyle = 'rgba(74, 200, 168, 0.18)';
  ctx.beginPath(); ctx.arc(W * 0.18, H * 0.22, 280, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(232, 167, 53, 0.12)';
  ctx.beginPath(); ctx.arc(W * 0.85, H * 0.85, 320, 0, Math.PI * 2); ctx.fill();

  // Header
  ctx.fillStyle = '#4a8';
  ctx.font = '700 38px -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('SeedSong', 70, 110);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = '500 18px -apple-system, sans-serif';
  ctx.fillText('Your Wrapped', 70, 140);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 76px -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('My musical taste', 70, 280);

  // Stats grid
  const stats = [
    { label: 'TOTAL LIKED', value: String(lastWrappedSummary.total) },
    { label: 'FAVOURITE SCALE', value: capitalise(lastWrappedSummary.scale) },
    { label: 'FAVOURITE KEY', value: lastWrappedSummary.key },
    { label: 'FAVOURITE VOICE', value: capitalise(lastWrappedSummary.voice) },
    { label: 'TEMPO ZONE', value: lastWrappedSummary.tempo },
    { label: 'AVG DENSITY · SWING', value: `${lastWrappedSummary.density}% · ${lastWrappedSummary.swing}%` },
  ];

  let y = 370;
  for (const s of stats) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '700 18px -apple-system, sans-serif';
    ctx.fillText(s.label, 70, y);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 50px -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(s.value, 70, y + 60);
    y += 105;
  }

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '400 16px -apple-system, sans-serif';
  ctx.fillText('chicomcastro.github.io/procedural-music-generator-web', 70, H - 70);

  return canvas;
}

function capitalise(s) {
  if (!s) return s;
  return String(s).replace(/(^|\s)\S/g, c => c.toUpperCase());
}

async function shareWrapped() {
  const canvas = renderWrappedImage();
  if (!canvas) return;
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], 'seedsong-wrapped.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'My SeedSong Wrapped',
        text: 'My musical taste, distilled.',
        files: [file],
      });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
    flashShareBtn('Copied!');
    return;
  } catch {}
  // Final fallback: download
  downloadWrapped();
}

function downloadWrapped() {
  const canvas = renderWrappedImage();
  if (!canvas) return;
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'seedsong-wrapped.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  });
}

function flashShareBtn(text) {
  const btn = document.getElementById('wrapped-share');
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = orig; }, 1400);
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
  document.getElementById('wrapped-share')?.addEventListener('click', shareWrapped);
  document.getElementById('wrapped-download')?.addEventListener('click', downloadWrapped);

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
