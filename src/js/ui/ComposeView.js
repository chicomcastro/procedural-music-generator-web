import { randomSeed } from '../generate/rng.js';
import { generateSong } from '../generate/song.js';
import { audioBufferToWav } from '../export/wav.js';
import { downloadBlob } from '../export/download.js';
import { createScoreCanvas } from './ScoreCanvas.js';

const STORAGE_KEY = 'seedsong-compose-project';
const FILE_VERSION = 1;
const UNDO_STACK_LIMIT = 60;

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

/* ---- Undo / redo stacks ---- */
const undoStack = [];
let redoStack = [];

function snapshot() {
  return JSON.stringify(sections);
}
function restore(snap) {
  try { sections = JSON.parse(snap); } catch { /* ignore */ }
}
function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > UNDO_STACK_LIMIT) undoStack.shift();
  redoStack = [];
  refreshHistoryButtons();
}
function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  save(false);
  render();
  refreshHistoryButtons();
}
function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  save(false);
  render();
  refreshHistoryButtons();
}
function refreshHistoryButtons() {
  const u = document.getElementById('compose-undo');
  const r = document.getElementById('compose-redo');
  if (u) u.disabled = undoStack.length === 0;
  if (r) r.disabled = redoStack.length === 0;
}

/* ---- Persistence ---- */
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) sections = JSON.parse(raw);
  } catch { sections = []; }
}
function save(takeSnapshot = true) {
  if (takeSnapshot) pushUndo();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
}

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

    const enabled = new Set(sec.tracks || ALL_TRACKS);
    for (const ev of song.events) {
      if (ev.type === 'drum') continue;
      if (!enabled.has(ev.type)) continue;
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
    tracks: ['melody', 'chord', 'bass'],
  };
}

const SCALES_LIST = ['major', 'natural_minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'pentatonic_major', 'pentatonic_minor', 'blues'];
const VOICES_LIST = ['piano', 'pad', 'pluck', 'organ', 'strings', 'marimba', 'epiano'];
const BARS_LIST = [2, 4, 8];
const ALL_TRACKS = ['melody', 'chord', 'bass'];

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function findIndex(id) { return sections.findIndex(s => s.id === id); }

function render() {
  const tl = document.getElementById('compose-timeline');
  const empty = document.getElementById('compose-empty');
  if (!tl) return;
  tl.innerHTML = '';
  refreshPlayButton();
  refreshFileButtons();
  refreshLivePreview();
  if (sections.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const block = document.createElement('div');
    block.className = 'section-block';
    block.dataset.id = s.id;
    block.draggable = true;
    block.setAttribute('role', 'listitem');
    const tracksSet = new Set(s.tracks || ALL_TRACKS);
    const trackChips = ALL_TRACKS.map(t => `
      <button type="button" class="section-track-chip${tracksSet.has(t) ? ' active' : ''}" data-action="toggle-track" data-track="${t}" aria-pressed="${tracksSet.has(t)}">
        <span class="section-track-dot section-track-dot-${t}"></span>${t}
      </button>
    `).join('');

    block.innerHTML = `
      <div class="section-block-main">
        <div class="section-block-grip" title="Drag to reorder" aria-hidden="true">
          <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor"><circle cx="4" cy="4" r="1.4"/><circle cx="10" cy="4" r="1.4"/><circle cx="4" cy="10" r="1.4"/><circle cx="10" cy="10" r="1.4"/><circle cx="4" cy="16" r="1.4"/><circle cx="10" cy="16" r="1.4"/></svg>
        </div>
        <div class="section-block-body">
          <div class="section-block-row">
            <span class="section-block-index">${i + 1}</span>
            <input class="section-block-name" value="${escapeHtml(s.name)}" aria-label="Section name">
          </div>
          <div class="section-block-meta">
            <span>seed ${s.seed}</span>
            <span class="section-meta-sep">·</span>
            <span>${TONIC_LABELS[s.tonic]} ${SCALE_LABELS[s.scale] || s.scale}</span>
            <span class="section-meta-sep">·</span>
            <span>${s.bars} bars · ${s.bpm} BPM</span>
            <span class="section-meta-sep">·</span>
            <span>${Math.round(s.density * 100)}% density · ${s.voice}</span>
          </div>
          <div class="section-block-tracks">${trackChips}</div>
        </div>
        <div class="section-block-actions">
          <button class="section-block-btn" data-action="toggle-edit" title="Edit parameters" aria-label="Edit parameters">⚙</button>
          <button class="section-block-btn" data-action="reseed" title="New seed" aria-label="Generate new seed">⟲</button>
          <button class="section-block-btn" data-action="open" title="Open in Generator" aria-label="Open in Generator">↗</button>
          <button class="section-block-btn section-block-btn-danger" data-action="remove" title="Remove section" aria-label="Remove section">×</button>
        </div>
      </div>
      <div class="section-block-editor" hidden>
        <div class="section-edit-grid">
          <label class="section-edit-field">
            <span>Tonic</span>
            <select data-edit="tonic">${TONIC_LABELS.map((t, ti) => `<option value="${ti}"${ti === s.tonic ? ' selected' : ''}>${t}</option>`).join('')}</select>
          </label>
          <label class="section-edit-field">
            <span>Scale</span>
            <select data-edit="scale">${SCALES_LIST.map(sc => `<option value="${sc}"${sc === s.scale ? ' selected' : ''}>${SCALE_LABELS[sc] || sc}</option>`).join('')}</select>
          </label>
          <label class="section-edit-field">
            <span>Bars</span>
            <select data-edit="bars">${BARS_LIST.map(b => `<option value="${b}"${b === s.bars ? ' selected' : ''}>${b}</option>`).join('')}</select>
          </label>
          <label class="section-edit-field">
            <span>BPM <em>${s.bpm}</em></span>
            <input type="range" data-edit="bpm" min="40" max="220" step="1" value="${s.bpm}">
          </label>
          <label class="section-edit-field">
            <span>Density <em>${Math.round(s.density * 100)}%</em></span>
            <input type="range" data-edit="density" min="0.2" max="1" step="0.05" value="${s.density}">
          </label>
          <label class="section-edit-field">
            <span>Voice</span>
            <select data-edit="voice">${VOICES_LIST.map(v => `<option value="${v}"${v === s.voice ? ' selected' : ''}>${v}</option>`).join('')}</select>
          </label>
        </div>
      </div>
    `;
    tl.appendChild(block);
  }

  attachDragHandlers();
}

/* ---- Drag-to-reorder ---- */
let dragSrcIndex = -1;

function attachDragHandlers() {
  const blocks = document.querySelectorAll('.section-block');
  blocks.forEach((el) => {
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    el.addEventListener('dragend', onDragEnd);
  });
}

function onDragStart(e) {
  const block = e.currentTarget;
  dragSrcIndex = findIndex(block.dataset.id);
  block.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', block.dataset.id); } catch {}
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const block = e.currentTarget;
  if (block.classList.contains('dragging')) return;
  const rect = block.getBoundingClientRect();
  const before = e.clientY < rect.top + rect.height / 2;
  block.classList.toggle('drop-before', before);
  block.classList.toggle('drop-after', !before);
}

function onDragLeave(e) {
  const block = e.currentTarget;
  block.classList.remove('drop-before', 'drop-after');
}

function onDrop(e) {
  e.preventDefault();
  const block = e.currentTarget;
  const targetIdx = findIndex(block.dataset.id);
  if (dragSrcIndex < 0 || targetIdx < 0 || targetIdx === dragSrcIndex) return;
  const rect = block.getBoundingClientRect();
  const before = e.clientY < rect.top + rect.height / 2;
  let insertAt = before ? targetIdx : targetIdx + 1;
  if (insertAt > dragSrcIndex) insertAt--;
  if (isPlaying) stopComposition();
  pushUndo();
  const [moved] = sections.splice(dragSrcIndex, 1);
  sections.splice(insertAt, 0, moved);
  save(false);
  render();
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.section-block').forEach(b => b.classList.remove('drop-before', 'drop-after'));
  dragSrcIndex = -1;
}

/* ---- Actions ---- */

function handleAction(id, action, dataset, blockEl) {
  const idx = findIndex(id);
  if (idx < 0) return;

  if (action === 'open') {
    if (isPlaying) stopComposition();
    const s = sections[idx];
    if (onLoadSeedCb) onLoadSeedCb({
      seed: s.seed, scale: s.scale, tonic: s.tonic, bpm: s.bpm,
      bars: s.bars, density: s.density, voice: s.voice,
    });
    window.location.hash = '#/generator';
    return;
  }

  if (action === 'toggle-edit') {
    const editor = blockEl?.querySelector('.section-block-editor');
    if (!editor) return;
    const opening = editor.hasAttribute('hidden');
    if (opening) editor.removeAttribute('hidden');
    else editor.setAttribute('hidden', '');
    blockEl.classList.toggle('section-editing', opening);
    return;
  }

  if (action === 'toggle-track') {
    const track = dataset?.track;
    if (!track || !ALL_TRACKS.includes(track)) return;
    if (isPlaying) stopComposition();
    pushUndo();
    const set = new Set(sections[idx].tracks || ALL_TRACKS);
    if (set.has(track)) {
      if (set.size > 1) set.delete(track);
    } else {
      set.add(track);
    }
    sections[idx].tracks = ALL_TRACKS.filter(t => set.has(t));
    save(false);
    render();
    return;
  }

  if (isPlaying) stopComposition();
  pushUndo();
  if (action === 'remove') {
    sections.splice(idx, 1);
  } else if (action === 'reseed') {
    sections[idx].seed = randomSeed();
  }
  save(false);
  render();
}

function applyEdit(id, field, value) {
  const idx = findIndex(id);
  if (idx < 0) return;
  if (isPlaying) stopComposition();
  pushUndo();
  if (field === 'tonic') sections[idx].tonic = Math.max(0, Math.min(11, Number(value) | 0));
  else if (field === 'scale') sections[idx].scale = String(value);
  else if (field === 'bars') sections[idx].bars = BARS_LIST.includes(Number(value)) ? Number(value) : sections[idx].bars;
  else if (field === 'bpm') sections[idx].bpm = Math.max(40, Math.min(240, Number(value) | 0));
  else if (field === 'density') sections[idx].density = Math.max(0.1, Math.min(1, Number(value)));
  else if (field === 'voice') sections[idx].voice = String(value);
  save(false);
  // Re-render only the affected block to preserve editor open state and focus
  const block = document.querySelector(`.section-block[data-id="${id}"]`);
  if (block) {
    const editorOpen = !block.querySelector('.section-block-editor')?.hasAttribute('hidden');
    render();
    const newBlock = document.querySelector(`.section-block[data-id="${id}"]`);
    if (newBlock && editorOpen) {
      newBlock.querySelector('.section-block-editor')?.removeAttribute('hidden');
      newBlock.classList.add('section-editing');
    }
  } else {
    render();
  }
}

/* ---- Save / load file ---- */

function refreshFileButtons() {
  const saveBtn = document.getElementById('compose-save-file');
  const stemsBtn = document.getElementById('compose-export-stems');
  if (saveBtn) saveBtn.disabled = sections.length === 0;
  if (stemsBtn) stemsBtn.disabled = sections.length === 0;
}

/* ---- Live preview canvas ---- */
let composeScoreCanvas = null;

function buildCombinedSong() {
  if (sections.length === 0) return null;
  const events = [];
  let beatCursor = 0;
  let totalBeats = 0;
  const sectionMarkers = [];
  // Use a uniform display BPM (the first section's) for visual scaling
  const displayBpm = sections[0]?.bpm || 110;
  for (const sec of sections) {
    const enabled = new Set(sec.tracks || ALL_TRACKS);
    const song = generateSong({
      seed: sec.seed,
      tonic: 60 + (sec.tonic | 0),
      scale: sec.scale,
      bars: sec.bars,
      beatsPerBar: 4,
      density: sec.density,
    });
    // Re-time events so each section's BPM stretches to the display BPM
    const stretch = displayBpm / sec.bpm;
    sectionMarkers.push({ label: sec.name, startBeat: beatCursor, lengthBeats: song.lengthBeats * stretch });
    for (const ev of song.events) {
      if (ev.type === 'drum') continue;
      if (!enabled.has(ev.type)) continue;
      events.push({
        type: ev.type,
        midi: ev.midi,
        atBeat: beatCursor + ev.atBeat * stretch,
        durationBeats: ev.durationBeats * stretch,
        velocity: ev.velocity,
      });
    }
    beatCursor += song.lengthBeats * stretch;
    totalBeats = beatCursor;
  }
  return {
    events: events.sort((a, b) => a.atBeat - b.atBeat),
    lengthBeats: totalBeats,
    beatsPerBar: 4,
    bars: Math.round(totalBeats / 4),
    bpm: displayBpm,
    sections: sectionMarkers,
  };
}

function refreshLivePreview() {
  const wrap = document.getElementById('compose-preview');
  if (!wrap) return;
  const meta = document.getElementById('compose-preview-meta');
  if (sections.length === 0) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  const canvasEl = document.getElementById('compose-preview-canvas');
  if (canvasEl && !composeScoreCanvas) {
    composeScoreCanvas = createScoreCanvas(canvasEl, {});
  }
  const song = buildCombinedSong();
  if (composeScoreCanvas && song) composeScoreCanvas.render(song);
  if (meta && song) {
    const totalSec = sections.reduce((acc, s) => acc + (s.bars * 4 * 60 / s.bpm), 0);
    const m = Math.floor(totalSec / 60);
    const sec = Math.floor(totalSec % 60).toString().padStart(2, '0');
    const noteCount = song.events.length;
    meta.textContent = `${sections.length} sections · ${noteCount} notes · ${m}:${sec}`;
  }
}

/* ---- Stem export ---- */

async function renderCompositionStem(trackType) {
  if (sections.length === 0) return null;
  // Compute total length first
  let totalSec = 0;
  const sectionData = sections.map(sec => {
    const beatDur = 60 / sec.bpm;
    const song = generateSong({
      seed: sec.seed,
      tonic: 60 + (sec.tonic | 0),
      scale: sec.scale,
      bars: sec.bars,
      beatsPerBar: 4,
      density: sec.density,
    });
    const lengthSec = song.lengthBeats * beatDur;
    const start = totalSec;
    totalSec += lengthSec;
    return { sec, song, beatDur, start };
  });
  const tailSeconds = 1.5;
  const sampleRate = 44100;
  const offline = new OfflineAudioContext(2, Math.ceil(sampleRate * (totalSec + tailSeconds)), sampleRate);
  const masterGain = offline.createGain();
  masterGain.gain.value = 0.85;
  masterGain.connect(offline.destination);

  const wave = trackType === 'chord' ? 'triangle' : trackType === 'bass' ? 'sawtooth' : 'sine';
  const peakVel = trackType === 'chord' ? 0.06 : trackType === 'bass' ? 0.07 : 0.10;

  for (const { sec, song, beatDur, start } of sectionData) {
    const enabled = new Set(sec.tracks || ALL_TRACKS);
    if (!enabled.has(trackType)) continue;
    for (const ev of song.events) {
      if (ev.type !== trackType) continue;
      const when = start + ev.atBeat * beatDur;
      const dur = Math.max(0.05, ev.durationBeats * beatDur * 0.92);
      const osc = offline.createOscillator();
      const gain = offline.createGain();
      osc.type = wave;
      osc.frequency.value = 440 * Math.pow(2, (ev.midi - 69) / 12);
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(peakVel, when + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      osc.connect(gain).connect(masterGain);
      osc.start(when);
      osc.stop(when + dur + 0.05);
    }
  }

  return offline.startRendering();
}

async function exportStems() {
  if (sections.length === 0) return;
  const btn = document.getElementById('compose-export-stems');
  if (btn) {
    btn.disabled = true;
    btn.dataset.label = btn.textContent;
    btn.textContent = 'Rendering…';
  }
  try {
    const stamp = new Date().toISOString().slice(0, 10);
    let exported = 0;
    for (const track of ALL_TRACKS) {
      const buffer = await renderCompositionStem(track);
      if (!buffer) continue;
      const wav = audioBufferToWav(buffer);
      // Skip silent stems (no notes for that track in any section)
      const hasContent = sections.some(s => (s.tracks || ALL_TRACKS).includes(track));
      if (!hasContent) continue;
      downloadBlob(wav, `seedsong-${stamp}-${track}.wav`, 'audio/wav');
      exported++;
    }
    if (btn) {
      btn.textContent = exported > 0 ? `✓ ${exported} stems` : 'No stems';
      window.setTimeout(() => {
        btn.textContent = btn.dataset.label || 'Export stems';
        btn.disabled = false;
      }, 1800);
    }
  } catch (_err) {
    if (btn) {
      btn.textContent = 'Failed';
      window.setTimeout(() => {
        btn.textContent = btn.dataset.label || 'Export stems';
        btn.disabled = false;
      }, 1800);
    }
  }
}

function downloadProject() {
  if (sections.length === 0) return;
  const data = {
    format: 'seedsong-compose',
    version: FILE_VERSION,
    savedAt: new Date().toISOString(),
    sections,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `seedsong-compose-${stamp}.seedsong.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

async function loadProjectFile(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.format !== 'seedsong-compose' || !Array.isArray(data.sections)) {
      window.alert('That file does not look like a SeedSong compose project.');
      return;
    }
    if (sections.length > 0 && !window.confirm('Replace your current composition with the loaded one?')) return;
    if (isPlaying) stopComposition();
    pushUndo();
    sections = data.sections.map(normalizeSection);
    save(false);
    render();
  } catch {
    window.alert('Could not read this project file.');
  }
}

function normalizeSection(s) {
  const tracks = Array.isArray(s.tracks)
    ? s.tracks.filter(t => ALL_TRACKS.includes(t))
    : ALL_TRACKS.slice();
  return {
    id: s.id || `s${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: String(s.name || 'Section').slice(0, 32),
    seed: Number.isFinite(s.seed) ? s.seed >>> 0 : randomSeed(),
    scale: typeof s.scale === 'string' ? s.scale : 'major',
    tonic: Number.isFinite(s.tonic) ? Math.max(0, Math.min(11, s.tonic | 0)) : 0,
    bpm: Number.isFinite(s.bpm) ? Math.max(40, Math.min(240, s.bpm | 0)) : 110,
    bars: BARS_LIST.includes(s.bars) ? s.bars : 4,
    density: typeof s.density === 'number' ? Math.max(0.1, Math.min(1, s.density)) : 0.5,
    voice: typeof s.voice === 'string' ? s.voice : 'piano',
    tracks: tracks.length > 0 ? tracks : ALL_TRACKS.slice(),
  };
}

/* ---- Init ---- */

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
  const undoBtn = document.getElementById('compose-undo');
  const redoBtn = document.getElementById('compose-redo');
  const saveFileBtn = document.getElementById('compose-save-file');
  const loadFileInput = document.getElementById('compose-load-file');
  const tl = document.getElementById('compose-timeline');

  refreshHistoryButtons();

  playBtn?.addEventListener('click', () => playComposition());

  addBtn?.addEventListener('click', () => {
    pushUndo();
    sections.push(makeSection());
    save(false);
    render();
  });

  clearBtn?.addEventListener('click', () => {
    if (sections.length === 0) return;
    if (!window.confirm('Remove all sections?')) return;
    pushUndo();
    sections = [];
    save(false);
    render();
  });

  undoBtn?.addEventListener('click', undo);
  redoBtn?.addEventListener('click', redo);

  saveFileBtn?.addEventListener('click', downloadProject);
  document.getElementById('compose-export-stems')?.addEventListener('click', exportStems);
  loadFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) loadProjectFile(file);
    e.target.value = '';
  });

  document.addEventListener('keydown', (e) => {
    if (document.getElementById('view-compose')?.classList.contains('hidden')) return;
    if (e.target.matches('input, textarea, select')) return;
    const meta = e.metaKey || e.ctrlKey;
    if (!meta) return;
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo(); }
  });

  tl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const block = btn.closest('.section-block');
    if (!block) return;
    handleAction(block.dataset.id, btn.dataset.action, btn.dataset, block);
  });

  tl?.addEventListener('change', (e) => {
    const block = e.target.closest('.section-block');
    if (!block) return;
    if (e.target.classList.contains('section-block-name')) {
      const idx = findIndex(block.dataset.id);
      if (idx >= 0) {
        pushUndo();
        sections[idx].name = e.target.value.slice(0, 32);
        save(false);
      }
      return;
    }
    if (e.target.dataset.edit) {
      applyEdit(block.dataset.id, e.target.dataset.edit, e.target.value);
    }
  });

  // Live preview of slider values without committing on every input
  tl?.addEventListener('input', (e) => {
    const block = e.target.closest('.section-block');
    if (!block) return;
    if (e.target.dataset.edit === 'bpm' || e.target.dataset.edit === 'density') {
      const labelEm = e.target.closest('label')?.querySelector('em');
      if (labelEm) {
        labelEm.textContent = e.target.dataset.edit === 'bpm'
          ? String(e.target.value)
          : `${Math.round(Number(e.target.value) * 100)}%`;
      }
    }
  });
}
