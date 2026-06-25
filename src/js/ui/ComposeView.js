import { randomSeed } from '../generate/rng.js';
import { generateSong } from '../generate/song.js';
import { audioBufferToWav } from '../export/wav.js';
import { downloadBlob } from '../export/download.js';
import { playDrumHit } from '../audio/DrumSynth.js';
import { t, onLangChange } from '../i18n/i18n.js';

const STORAGE_KEY = 'seedsong-compose-project';
const TEMPLATES_KEY = 'seedsong-compose-templates';
const FILE_VERSION = 1;
const UNDO_STACK_LIMIT = 60;

const SECTION_TEMPLATES = [
  { name: 'Intro', density: 0.4, bars: 4 },
  { name: 'Verse', density: 0.6, bars: 8 },
  { name: 'Chorus', density: 0.75, bars: 8 },
  { name: 'Bridge', density: 0.5, bars: 4 },
  { name: 'Outro', density: 0.35, bars: 4 },
];

// User-saved templates. Persisted to localStorage; loaded at boot.
let customTemplates = [];

function loadCustomTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    customTemplates = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(customTemplates)) customTemplates = [];
  } catch { customTemplates = []; }
}

function saveCustomTemplates() {
  try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(customTemplates)); } catch { /* ignore */ }
}

// Captures the per-section parameters that survive into a template
// — everything except the seed (which is regenerated when applied so
// each instantiation of a template is a fresh roll) and the id/name.
function templateFromSection(sec) {
  return {
    scale: sec.scale, tonic: sec.tonic, bpm: sec.bpm,
    bars: sec.bars, density: sec.density, voice: sec.voice,
    tracks: [...(sec.tracks || ['melody', 'chord', 'bass', 'drum'])],
    transitionIn: sec.transitionIn || 'hard',
    transitionBars: sec.transitionBars ?? 1,
  };
}

function addCustomTemplate(name, sectionParams) {
  const t = {
    id: `t${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: String(name || 'Custom').slice(0, 32),
    ...sectionParams,
  };
  customTemplates.push(t);
  if (customTemplates.length > 20) customTemplates.shift();   // cap
  saveCustomTemplates();
  return t;
}

function removeCustomTemplate(id) {
  customTemplates = customTemplates.filter(t => t.id !== id);
  saveCustomTemplates();
}

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
  // Backfill new fields on older projects so the transition selector
  // doesn't show a blank.
  for (const s of sections) {
    if (s.transitionIn == null) s.transitionIn = 'hard';
    if (s.transitionBars == null) s.transitionBars = 1;
  }
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

// Crossfade scale for one event. Sections joined by `crossfade` overlap
// `transitionBars * beatDur` of beats; the incoming section ramps from 0
// to 1 and the outgoing section ramps from 1 to 0 across that window.
// Returns 1 (no scaling) for sections joined hard / by gap.
function crossfadeScaleFor(eventAbsSec, sectionIdx, starts, sectionList) {
  let scale = 1;
  const sec = starts[sectionIdx];
  // Fade IN: this section starts with a crossfade.
  if (sectionList[sectionIdx].transitionIn === 'crossfade' && sectionIdx > 0) {
    const winSec = (sectionList[sectionIdx].transitionBars || 1) * sec.beatDur;
    const t = (eventAbsSec - sec.start) / winSec;
    if (t >= 0 && t < 1) scale *= Math.max(0, Math.min(1, t));
  }
  // Fade OUT: the NEXT section will start with a crossfade, which means
  // this section's tail overlaps it.
  const next = sectionList[sectionIdx + 1];
  if (next && next.transitionIn === 'crossfade') {
    const nextStart = starts[sectionIdx + 1].start;
    const winSec = (next.transitionBars || 1) * (60 / next.bpm);
    const t = (eventAbsSec - nextStart) / winSec;
    if (t >= 0 && t < 1) scale *= Math.max(0, Math.min(1, 1 - t));
  }
  return scale;
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
  const drumDest = audioApiRef.getTrackDest('drum') || melodyDest;

  isPlaying = true;
  setPlayUI(true);

  const baseWhen = ctx.currentTime + 0.05;
  playStartTime = baseWhen;
  const { starts, totalSec } = computeSectionStarts(sections);
  totalDurationSec = totalSec;

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const beatDur = starts[i].beatDur;
    const song = generateSong({
      seed: sec.seed,
      tonic: 60 + (sec.tonic | 0),
      scale: sec.scale,
      bars: sec.bars,
      beatsPerBar: 4,
      density: sec.density,
    });

    const enabled = new Set(sec.tracks || ALL_TRACKS);
    for (const ev of song.events) {
      if (!enabled.has(ev.type)) continue;
      const evAbs = starts[i].start + timeOffsetForBeat(starts, i, ev.atBeat, sections);
      const when = baseWhen + evAbs;
      const crossfade = crossfadeScaleFor(evAbs, i, starts, sections);
      if (crossfade <= 0.001) continue;   // fully attenuated, skip
      if (ev.type === 'drum') {
        playDrumHit(ctx, drumDest, { drum: ev.drum, when, velocity: (ev.velocity ?? 0.6) * crossfade });
        continue;
      }
      // Note duration uses the local beatDur at the event's start —
      // ramp-internal events get a slightly skewed duration, which is
      // acceptable: durations are short and re-anchoring per-event is
      // overkill for the tempo difference between adjacent sections.
      const dur = Math.max(0.05, ev.durationBeats * beatDur * 0.92);
      const dest = ev.type === 'chord' ? chordDest : ev.type === 'bass' ? bassDest : melodyDest;
      const type = ev.type === 'chord' ? 'triangle' : ev.type === 'bass' ? 'sawtooth' : 'sine';
      const vel = (ev.type === 'chord' ? 0.06 : ev.type === 'bass' ? 0.07 : 0.10) * crossfade;
      scheduleNote(ctx, dest, ev.midi, when, dur, type, vel);
    }
  }

  // sectionStarts the progress timer expects: { start, length } in
  // composition-relative seconds.
  startProgressTimer(starts.map(s => ({ start: s.start, length: s.length })));
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
  if (t) t.textContent = formatTime(e);
  const totalEl = document.getElementById('compose-status-total');
  if (totalEl) totalEl.textContent = `/ ${formatTime(totalDurationSec)}`;
  // Drive the timeline-wide progress bar so the user has a single
  // glance reference for where in the composition we are.
  const fill = document.getElementById('compose-status-progress-fill');
  if (fill) {
    const pct = totalDurationSec > 0 ? (e / totalDurationSec) * 100 : 0;
    fill.style.width = `${pct.toFixed(1)}%`;
  }
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
  const fill = document.getElementById('compose-status-progress-fill');
  if (fill) fill.style.width = '0%';
  setPlayUI(false);
}

function setPlayUI(playing) {
  const btn = document.getElementById('compose-play');
  const icon = btn?.querySelector('.compose-play-icon');
  const label = document.getElementById('compose-play-label');
  const status = document.getElementById('compose-status');
  if (icon) icon.textContent = playing ? '■' : '▶';
  if (label) label.textContent = playing ? t('compose.stop') : t('compose.play');
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
    // Templates may override every field — custom templates serialise
    // the full section parameter set (scale / tonic / bpm / tracks /
    // transition…). Built-in templates only carry name / bars /
    // density, so the fallback defaults below kick in.
    scale: t.scale || 'major',
    tonic: t.tonic ?? 0,
    bpm: t.bpm ?? 110,
    bars: t.bars,
    density: t.density,
    voice: t.voice || 'piano',
    tracks: t.tracks ? [...t.tracks] : ['melody', 'chord', 'bass', 'drum'],
    // Transition INTO this section from the previous one.
    // 'hard' = no overlap, no gap (default; same as old behaviour).
    // 'crossfade' = overlap `transitionBars` of the prev tail with this head.
    // 'gap' = insert `transitionBars` of silence.
    transitionIn: t.transitionIn || 'hard',
    transitionBars: t.transitionBars ?? 1,
  };
}

// Closed-form ramp integral. ADR 0002: the last K beats of an outgoing
// section linearly interpolate beat-duration from bd0 to bd1. For an
// offset `s` (in beats) into the ramp:
//   bd(s) = bd0 + (bd1-bd0) * (s/K)
//   t(s)  = bd0*s + (bd1-bd0)*s^2 / (2K)
// (Trapezoidal integral of the linear bd curve — exact, not discrete.)
function rampElapsed(bd0, bd1, K, s) {
  if (K <= 0) return 0;
  return bd0 * s + (bd1 - bd0) * s * s / (2 * K);
}

// Absolute time offset (from starts[i].start) for an event at `atBeat`
// inside section `i`. Handles the tempo-ramp window at the section's
// tail when the NEXT section's transitionIn === 'tempo-ramp'.
function timeOffsetForBeat(starts, sectionIdx, atBeat, sectionList) {
  const s = starts[sectionIdx];
  const next = sectionList[sectionIdx + 1];
  const rampBeats = (next && next.transitionIn === 'tempo-ramp')
    ? Math.max(0, Math.min(8, next.transitionBars ?? 1))
    : 0;
  const lengthBeats = sectionList[sectionIdx].bars * 4;
  const rampStartBeat = lengthBeats - rampBeats;
  if (atBeat <= rampStartBeat || rampBeats <= 0) {
    return atBeat * s.beatDur;
  }
  const bd0 = s.beatDur;
  const bd1 = 60 / next.bpm;
  const into = atBeat - rampStartBeat;
  return rampStartBeat * bd0 + rampElapsed(bd0, bd1, rampBeats, into);
}

// Compute the per-section absolute start times in seconds, applying
// transitionIn deltas (crossfade subtracts; gap adds; tempo-ramp warps
// the outgoing section's tail). The first section always starts at 0 —
// its transitionIn is ignored.
function computeSectionStarts(sectionList) {
  const starts = [];
  let cursor = 0;
  for (let i = 0; i < sectionList.length; i++) {
    const sec = sectionList[i];
    const beatDur = 60 / sec.bpm;
    const lengthBeats = sec.bars * 4;
    // Base length; tempo-ramp at this section's END (driven by the
    // NEXT section's transitionIn) replaces the last K beats with the
    // closed-form ramp integral.
    const next = sectionList[i + 1];
    let lengthSec = lengthBeats * beatDur;
    if (next && next.transitionIn === 'tempo-ramp') {
      const K = Math.max(0, Math.min(8, next.transitionBars ?? 1));
      if (K > 0 && K <= lengthBeats) {
        const bd1 = 60 / next.bpm;
        lengthSec = lengthSec - K * beatDur + rampElapsed(beatDur, bd1, K, K);
      }
    }
    if (i > 0) {
      const tType = sec.transitionIn || 'hard';
      const tBars = Math.max(0, Math.min(8, sec.transitionBars ?? 1));
      const tSec = tBars * beatDur;
      if (tType === 'crossfade') cursor -= tSec;
      else if (tType === 'gap') cursor += tSec;
      // tempo-ramp does NOT shift the boundary — the ramp lives inside
      // the OUTGOING section and the recomputed lengthSec covers it.
    }
    starts.push({ start: cursor, length: lengthSec, beatDur, transitionIn: sec.transitionIn || 'hard', transitionBars: sec.transitionBars ?? 1 });
    cursor += lengthSec;
  }
  return { starts, totalSec: cursor };
}

const SCALES_LIST = ['major', 'natural_minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'pentatonic_major', 'pentatonic_minor', 'blues'];
const VOICES_LIST = ['piano', 'pad', 'pluck', 'organ', 'strings', 'marimba', 'epiano'];
const BARS_LIST = [2, 4, 8];
const ALL_TRACKS = ['melody', 'chord', 'bass', 'drum'];

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
            <span class="section-meta-chip" title="Seed">⌗ ${s.seed}</span>
            <span class="section-meta-chip" title="Key">${TONIC_LABELS[s.tonic]} ${SCALE_LABELS[s.scale] || s.scale}</span>
            <span class="section-meta-chip" title="Length">${s.bars} bars</span>
            <span class="section-meta-chip" title="Tempo">${s.bpm} BPM</span>
            <span class="section-meta-chip" title="Density">${Math.round(s.density * 100)}%</span>
            <span class="section-meta-chip section-meta-chip-voice" title="Voice">${s.voice}</span>
            ${i > 0 && s.transitionIn && s.transitionIn !== 'hard'
              ? `<span class="section-meta-chip section-meta-chip-transition" title="Transition from previous section">⇢ ${s.transitionIn === 'crossfade' ? 'Crossfade' : s.transitionIn === 'gap' ? 'Gap' : 'Tempo ramp'} ${s.transitionBars ?? 1}b</span>`
              : ''}
          </div>
          <div class="section-block-tracks">${trackChips}</div>
        </div>
        <div class="section-block-actions">
          <button class="section-block-btn" data-action="toggle-edit" title="Edit parameters" aria-label="Edit parameters">⚙</button>
          <button class="section-block-btn" data-action="reseed" title="New seed" aria-label="Generate new seed">⟲</button>
          <button class="section-block-btn" data-action="save-template" title="Save as template" aria-label="Save as template">★</button>
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
          ${i > 0 ? `
            <label class="section-edit-field">
              <span>Transition in</span>
              <select data-edit="transitionIn">
                <option value="hard"${s.transitionIn === 'hard' ? ' selected' : ''}>Hard cut</option>
                <option value="crossfade"${s.transitionIn === 'crossfade' ? ' selected' : ''}>Crossfade</option>
                <option value="gap"${s.transitionIn === 'gap' ? ' selected' : ''}>Gap (silence)</option>
                <option value="tempo-ramp"${s.transitionIn === 'tempo-ramp' ? ' selected' : ''}>Tempo ramp</option>
              </select>
            </label>
            <label class="section-edit-field"${s.transitionIn === 'hard' ? ' hidden' : ''}>
              <span>Transition length <em>${s.transitionBars ?? 1} beat${(s.transitionBars ?? 1) === 1 ? '' : 's'}</em></span>
              <input type="range" data-edit="transitionBars" min="0" max="8" step="1" value="${s.transitionBars ?? 1}">
            </label>
          ` : ''}
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

  if (action === 'save-template') {
    if (isPlaying) stopComposition();
    const sec = sections[idx];
    const defaultName = sec.name || `Section ${idx + 1}`;
    const name = window.prompt('Template name', defaultName);
    if (!name) return;
    addCustomTemplate(name, templateFromSection(sec));
    // No section state changed — no undo entry, just refresh + feedback.
    if (blockEl) {
      const btn = blockEl.querySelector('[data-action="save-template"]');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓';
        btn.classList.add('section-block-btn-confirm');
        window.setTimeout(() => {
          btn.textContent = orig;
          btn.classList.remove('section-block-btn-confirm');
        }, 1200);
      }
    }
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
  else if (field === 'transitionIn') sections[idx].transitionIn = ['hard', 'crossfade', 'gap', 'tempo-ramp'].includes(value) ? value : 'hard';
  else if (field === 'transitionBars') sections[idx].transitionBars = Math.max(0, Math.min(8, Number(value) | 0));
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
  const mixBtn = document.getElementById('compose-export-mix');
  if (saveBtn) saveBtn.disabled = sections.length === 0;
  if (stemsBtn) stemsBtn.disabled = sections.length === 0;
  if (mixBtn) mixBtn.disabled = sections.length === 0;
}

/* ---- Stem export ---- */

// Pre-compute the per-section playback layout used by both the stem
// renderer and the mix renderer.
function buildOfflineSections() {
  const { starts, totalSec } = computeSectionStarts(sections);
  const sectionData = sections.map((sec, i) => ({
    sec,
    song: generateSong({
      seed: sec.seed,
      tonic: 60 + (sec.tonic | 0),
      scale: sec.scale,
      bars: sec.bars,
      beatsPerBar: 4,
      density: sec.density,
    }),
    beatDur: starts[i].beatDur,
    start: starts[i].start,
    index: i,
  }));
  return { sectionData, totalSec, starts };
}

// Schedule one event into an OfflineAudioContext. Mirrors the live
// scheduleNote shape but driven by the event's track type so the same
// helper can render melody/chord/bass/drum.
// `evAbs` is the absolute time within the composition (seconds from 0);
// the caller computes it via timeOffsetForBeat so the same call site
// works for hard / crossfade / gap / tempo-ramp transitions.
// `crossfade` is a multiplier in [0, 1] applied to the event's gain so
// the offline path produces the same audible crossfade as live playback.
function scheduleOfflineEventAt(offline, dest, ev, evAbs, beatDur, crossfade = 1) {
  if (crossfade <= 0.001) return;
  const when = evAbs;
  if (ev.type === 'drum') {
    playDrumHit(offline, dest, { drum: ev.drum, when, velocity: (ev.velocity ?? 0.5) * crossfade });
    return;
  }
  const dur = Math.max(0.05, ev.durationBeats * beatDur * 0.92);
  const wave = ev.type === 'chord' ? 'triangle' : ev.type === 'bass' ? 'sawtooth' : 'sine';
  const peakVel = (ev.type === 'chord' ? 0.06 : ev.type === 'bass' ? 0.07 : 0.10) * crossfade;
  const osc = offline.createOscillator();
  const gain = offline.createGain();
  osc.type = wave;
  osc.frequency.value = 440 * Math.pow(2, (ev.midi - 69) / 12);
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(peakVel, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(gain).connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

async function renderCompositionStem(trackType) {
  if (sections.length === 0) return null;
  const { sectionData, totalSec, starts } = buildOfflineSections();
  const tailSeconds = 1.5;
  const sampleRate = 44100;
  const offline = new OfflineAudioContext(2, Math.ceil(sampleRate * (totalSec + tailSeconds)), sampleRate);
  const masterGain = offline.createGain();
  masterGain.gain.value = 0.85;
  masterGain.connect(offline.destination);

  for (const { sec, song, beatDur, start, index } of sectionData) {
    const enabled = new Set(sec.tracks || ALL_TRACKS);
    if (!enabled.has(trackType)) continue;
    for (const ev of song.events) {
      if (ev.type !== trackType) continue;
      const eventOffset = timeOffsetForBeat(starts, index, ev.atBeat, sections);
      const evAbs = start + eventOffset;
      const cf = crossfadeScaleFor(evAbs, index, starts, sections);
      scheduleOfflineEventAt(offline, masterGain, ev, evAbs, beatDur, cf);
    }
  }

  return offline.startRendering();
}

// Render the full mix — every enabled track of every section — into one
// stereo buffer. Caller can then turn it into a single WAV.
async function renderCompositionMix() {
  if (sections.length === 0) return null;
  const { sectionData, totalSec, starts } = buildOfflineSections();
  const tailSeconds = 1.5;
  const sampleRate = 44100;
  const offline = new OfflineAudioContext(2, Math.ceil(sampleRate * (totalSec + tailSeconds)), sampleRate);
  const masterGain = offline.createGain();
  masterGain.gain.value = 0.85;
  masterGain.connect(offline.destination);

  for (const { sec, song, beatDur, start, index } of sectionData) {
    const enabled = new Set(sec.tracks || ALL_TRACKS);
    for (const ev of song.events) {
      if (!enabled.has(ev.type)) continue;
      const eventOffset = timeOffsetForBeat(starts, index, ev.atBeat, sections);
      const evAbs = start + eventOffset;
      const cf = crossfadeScaleFor(evAbs, index, starts, sections);
      scheduleOfflineEventAt(offline, masterGain, ev, evAbs, beatDur, cf);
    }
  }

  return offline.startRendering();
}

async function exportMix() {
  if (sections.length === 0) return;
  const btn = document.getElementById('compose-export-mix');
  if (btn) {
    btn.disabled = true;
    btn.dataset.label = btn.textContent;
    btn.textContent = 'Rendering…';
  }
  try {
    const buffer = await renderCompositionMix();
    if (buffer) {
      const wav = audioBufferToWav(buffer);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(wav, `seedsong-${stamp}-mix.wav`, 'audio/wav');
    }
    if (btn) {
      btn.textContent = '✓ Mix';
      window.setTimeout(() => {
        btn.textContent = btn.dataset.label || 'Export mix';
        btn.disabled = false;
      }, 1800);
    }
  } catch (_err) {
    if (btn) {
      btn.textContent = 'Failed';
      window.setTimeout(() => {
        btn.textContent = btn.dataset.label || 'Export mix';
        btn.disabled = false;
      }, 1800);
    }
  }
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
    transitionIn: ['hard', 'crossfade', 'gap', 'tempo-ramp'].includes(s.transitionIn) ? s.transitionIn : 'hard',
    transitionBars: Number.isFinite(s.transitionBars) ? Math.max(0, Math.min(8, s.transitionBars | 0)) : 1,
  };
}

/* ---- Init ---- */

export function stopComposePlayback() {
  if (isPlaying) stopComposition();
}

export function initComposeView({ onLoadSeed, audioApi }) {
  load();
  loadCustomTemplates();
  onLoadSeedCb = onLoadSeed;
  audioApiRef = audioApi;
  render();

  onLangChange(() => {
    setPlayUI(isPlaying);
    render();
  });

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

  // Template menu — opens via the ▾ chevron next to "+ Add section".
  // Lists built-ins + user-saved templates; click adds a section with
  // that template applied; × removes a user template.
  const menuBtn = document.getElementById('compose-add-menu-btn');
  const menu = document.getElementById('compose-add-menu');

  function closeTemplateMenu() {
    if (menu) menu.hidden = true;
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
  }

  function renderTemplateMenu() {
    if (!menu) return;
    menu.innerHTML = '';
    const heading = document.createElement('div');
    heading.className = 'compose-add-menu-heading';
    heading.textContent = 'Built-in';
    menu.appendChild(heading);
    for (const t of SECTION_TEMPLATES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'compose-add-menu-item';
      btn.textContent = t.name;
      btn.addEventListener('click', () => {
        pushUndo();
        sections.push(makeSection(t));
        save(false);
        render();
        closeTemplateMenu();
      });
      menu.appendChild(btn);
    }
    if (customTemplates.length > 0) {
      const sep = document.createElement('div');
      sep.className = 'compose-add-menu-heading';
      sep.textContent = 'Saved';
      menu.appendChild(sep);
      for (const t of customTemplates) {
        const row = document.createElement('div');
        row.className = 'compose-add-menu-row';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'compose-add-menu-item';
        btn.textContent = t.name;
        btn.addEventListener('click', () => {
          pushUndo();
          sections.push(makeSection(t));
          save(false);
          render();
          closeTemplateMenu();
        });
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'compose-add-menu-remove';
        del.setAttribute('aria-label', `Delete template ${t.name}`);
        del.title = 'Delete template';
        del.textContent = '×';
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          removeCustomTemplate(t.id);
          renderTemplateMenu();
        });
        row.appendChild(btn);
        row.appendChild(del);
        menu.appendChild(row);
      }
    }
  }

  menuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.hidden) {
      renderTemplateMenu();
      menu.hidden = false;
      menuBtn.setAttribute('aria-expanded', 'true');
    } else {
      closeTemplateMenu();
    }
  });
  document.addEventListener('click', (e) => {
    if (menu?.hidden) return;
    if (!menu?.contains(e.target) && e.target !== menuBtn) closeTemplateMenu();
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
  document.getElementById('compose-export-mix')?.addEventListener('click', exportMix);
  loadFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) loadProjectFile(file);
    e.target.value = '';
  });

  document.addEventListener('keydown', (e) => {
    if (document.getElementById('view-compose')?.classList.contains('hidden')) return;
    // e.target may be `document` when the event is dispatched at the
    // document level (vitest does this). Guard with optional chaining.
    if (e.target?.matches?.('input, textarea, select')) return;
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
    if (e.target.dataset.edit === 'bpm' || e.target.dataset.edit === 'density' || e.target.dataset.edit === 'transitionBars') {
      const labelEm = e.target.closest('label')?.querySelector('em');
      if (labelEm) {
        const v = e.target.value;
        labelEm.textContent = e.target.dataset.edit === 'bpm'
          ? String(v)
          : e.target.dataset.edit === 'density'
          ? `${Math.round(Number(v) * 100)}%`
          : `${v} beat${Number(v) === 1 ? '' : 's'}`;
      }
    }
  });
}
