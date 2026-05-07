import { randomSeed } from '../generate/rng.js';
import { generateSong } from '../generate/song.js';

const STORAGE_KEY = 'seedsong-compose-project';

const SECTION_TEMPLATES = [
  { name: 'Intro', density: 0.4, bars: 4 },
  { name: 'Verse', density: 0.6, bars: 8 },
  { name: 'Chorus', density: 0.75, bars: 8 },
  { name: 'Bridge', density: 0.5, bars: 4 },
  { name: 'Outro', density: 0.35, bars: 4 },
];

const SCALE_LABELS = {
  major: 'Major',
  natural_minor: 'Natural minor',
  dorian: 'Dorian',
  pentatonic_minor: 'Pent. minor',
  pentatonic_major: 'Pent. major',
  blues: 'Blues',
  mixolydian: 'Mixolydian',
};

const TONIC_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

let sections = [];
let onLoadSeedCb = null;
let audioApiRef = null;

/* ---- Playback ---- */
let activeOscillators = [];
let isPlaying = false;
let stopTimeoutHandle = null;
let progressTimerHandle = null;
let totalDurationSec = 0;
let playStartTime = 0;
let activeSectionIndex = -1;

function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

function scheduleNote(ctx, dest, midi, when, dur, type, peakVel) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = midiToFreq(midi);
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(peakVel, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(gain).connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.05);
  activeOscillators.push(osc);
}

async function playComposition() {
  if (!audioApiRef || sections.length === 0) return;
  if (isPlaying) { stopComposition(); return; }
  try { await audioApiRef.ensureInit(); } catch {}
  const ctx = audioApiRef.getContext();
  if (!ctx) return;
  const melodyDest = audioApiRef.getTrackDest('melody') || audioApiRef.getMasterGain();
  const chordDest = audioApiRef.getTrackDest('chord') || melodyDest;
  const bassDest = audioApiRef.getTrackDest('bass') || melodyDest;

  isPlaying = true;
  setPlayUI(true);

  let cursorSec = ctx.currentTime + 0.05;
  playStartTime = cursorSec;
  totalDurationSec = 0;
  const sectionStarts = [];

  for (const sec of sections) {
    const beatDur = 60 / sec.bpm;
    const song = generateSong({
      seed: sec.seed,
      tonic: 60 + (sec.tonic | 0),
      scale: sec.scale,
      bars: sec.bars,
      beatsPerBar: 4,
      density: sec.density,
    });
    const sectionLengthSec = song.lengthBeats * beatDur;
    sectionStarts.push({ start: cursorSec - playStartTime, length: sectionLengthSec });

    for (const ev of song.events) {
      if (ev.type === 'drum') continue;
      const when = cursorSec + ev.atBeat * beatDur;
      const dur = Math.max(0.05, ev.durationBeats * beatDur * 0.92);
      const dest = ev.type === 'chord' ? chordDest : ev.type === 'bass' ? bassDest : melodyDest;
      const type = ev.type === 'chord' ? 'triangle' : ev.type === 'bass' ? 'sawtooth' : 'sine';
      const vel = ev.type === 'chord' ? 0.06 : ev.type === 'bass' ? 0.07 : 0.10;
      scheduleNote(ctx, dest, ev.midi, when, dur, type, vel);
    }

    cursorSec += sectionLengthSec;
    totalDurationSec += sectionLengthSec;
  }

  // Highlight + status timer
  startProgressTimer(sectionStarts);
  stopTimeoutHandle = window.setTimeout(() => stopComposition(), totalDurationSec * 1000 + 200);
}

function startProgressTimer(sectionStarts) {
  if (progressTimerHandle) window.clearInterval(progressTimerHandle);
  progressTimerHandle = window.setInterval(() => {
    if (!isPlaying || !audioApiRef) return;
    const ctx = audioApiRef.getContext();
    if (!ctx) return;
    const elapsed = ctx.currentTime - playStartTime;
    if (elapsed < 0) return;
    let idx = -1;
    for (let i = 0; i < sectionStarts.length; i++) {
      const s = sectionStarts[i];
      if (elapsed >= s.start && elapsed < s.start + s.length) { idx = i; break; }
    }
    if (idx !== activeSectionIndex) {
      activeSectionIndex = idx;
      highlightActiveBlock();
    }
    updateStatusTime(elapsed);
  }, 100);
}

function highlightActiveBlock() {
  document.querySelectorAll('.section-block').forEach((el, i) => {
    el.classList.toggle('section-block-active', i === activeSectionIndex);
  });
}

function updateStatusTime(elapsed) {
  const e = Math.max(0, Math.min(totalDurationSec, elapsed));
  const t = document.getElementById('compose-status-time');
  if (t) t.textContent = `${formatTime(e)} / ${formatTime(totalDurationSec)}`;
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function stopComposition() {
  isPlaying = false;
  for (const osc of activeOscillators) {
    try { osc.stop(); } catch {}
  }
  activeOscillators = [];
  if (stopTimeoutHandle) { window.clearTimeout(stopTimeoutHandle); stopTimeoutHandle = null; }
  if (progressTimerHandle) { window.clearInterval(progressTimerHandle); progressTimerHandle = null; }
  activeSectionIndex = -1;
  highlightActiveBlock();
  setPlayUI(false);
}

function setPlayUI(playing) {
  const btn = document.getElementById('compose-play');
  const icon = btn?.querySelector('.compose-play-icon');
  const label = document.getElementById('compose-play-label');
  const status = document.getElementById('compose-status');
  if (icon) icon.textContent = playing ? '■' : '▶';
  if (label) label.textContent = playing ? 'Stop' : 'Play composition';
  if (status) status.hidden = !playing;
  if (btn) btn.classList.toggle('compose-play-active', playing);
}

function refreshPlayButton() {
  const btn = document.getElementById('compose-play');
  if (!btn) return;
  btn.disabled = sections.length === 0;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) sections = JSON.parse(raw);
  } catch { sections = []; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
}

function makeSection(template) {
  const t = template || SECTION_TEMPLATES[sections.length % SECTION_TEMPLATES.length];
  return {
    id: `s${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: t.name,
    seed: randomSeed(),
    scale: 'major',
    tonic: 0,
    bpm: 110,
    bars: t.bars,
    density: t.density,
    voice: 'piano',
  };
}

function render() {
  const tl = document.getElementById('compose-timeline');
  const empty = document.getElementById('compose-empty');
  if (!tl) return;
  tl.innerHTML = '';
  if (sections.length === 0) {
    if (empty) empty.hidden = false;
    refreshPlayButton();
    return;
  }
  if (empty) empty.hidden = true;
  refreshPlayButton();

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const block = document.createElement('div');
    block.className = 'section-block';
    block.dataset.id = s.id;
    block.setAttribute('role', 'listitem');
    block.innerHTML = `
      <div class="section-block-handle">${i + 1}</div>
      <div class="section-block-body">
        <input class="section-block-name" value="${escapeHtml(s.name)}" aria-label="Section name">
        <div class="section-block-meta">
          seed ${s.seed} · ${TONIC_LABELS[s.tonic]} ${SCALE_LABELS[s.scale] || s.scale} · ${s.bars} bars · ${s.bpm} BPM · density ${Math.round(s.density * 100)}%
        </div>
      </div>
      <div class="section-block-actions">
        <button class="section-block-btn" data-action="up" title="Move up" aria-label="Move section up">↑</button>
        <button class="section-block-btn" data-action="down" title="Move down" aria-label="Move section down">↓</button>
        <button class="section-block-btn" data-action="reseed" title="New seed" aria-label="Generate new seed">⟲</button>
        <button class="section-block-btn" data-action="open" title="Open in Generator" aria-label="Open in Generator">↗</button>
        <button class="section-block-btn danger" data-action="remove" title="Remove section" aria-label="Remove section">×</button>
      </div>
    `;
    tl.appendChild(block);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function findIndex(id) { return sections.findIndex(s => s.id === id); }

function handleAction(id, action) {
  const idx = findIndex(id);
  if (idx < 0) return;
  if (isPlaying) stopComposition();
  if (action === 'remove') {
    sections.splice(idx, 1);
  } else if (action === 'up' && idx > 0) {
    [sections[idx - 1], sections[idx]] = [sections[idx], sections[idx - 1]];
  } else if (action === 'down' && idx < sections.length - 1) {
    [sections[idx + 1], sections[idx]] = [sections[idx], sections[idx + 1]];
  } else if (action === 'reseed') {
    sections[idx].seed = randomSeed();
  } else if (action === 'open') {
    const s = sections[idx];
    if (onLoadSeedCb) onLoadSeedCb({
      seed: s.seed,
      scale: s.scale,
      tonic: s.tonic,
      bpm: s.bpm,
      bars: s.bars,
      density: s.density,
      voice: s.voice,
    });
    window.location.hash = '#/generator';
    return;
  }
  save();
  render();
}

export function stopComposePlayback() {
  if (isPlaying) stopComposition();
}

export function initComposeView({ onLoadSeed, audioApi }) {
  load();
  onLoadSeedCb = onLoadSeed;
  audioApiRef = audioApi;
  render();

  const addBtn = document.getElementById('compose-add');
  const clearBtn = document.getElementById('compose-clear');
  const playBtn = document.getElementById('compose-play');
  const tl = document.getElementById('compose-timeline');

  playBtn?.addEventListener('click', () => playComposition());

  addBtn?.addEventListener('click', () => {
    sections.push(makeSection());
    save();
    render();
  });

  clearBtn?.addEventListener('click', () => {
    if (sections.length === 0) return;
    if (!window.confirm('Remove all sections?')) return;
    sections = [];
    save();
    render();
  });

  tl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const block = btn.closest('.section-block');
    if (!block) return;
    handleAction(block.dataset.id, btn.dataset.action);
  });

  tl?.addEventListener('change', (e) => {
    if (!e.target.classList.contains('section-block-name')) return;
    const block = e.target.closest('.section-block');
    if (!block) return;
    const idx = findIndex(block.dataset.id);
    if (idx >= 0) {
      sections[idx].name = e.target.value.slice(0, 32);
      save();
    }
  });
}
