import { randomSeed } from '../generate/rng.js';

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
    return;
  }
  if (empty) empty.hidden = true;

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

export function initComposeView({ onLoadSeed }) {
  load();
  onLoadSeedCb = onLoadSeed;
  render();

  const addBtn = document.getElementById('compose-add');
  const clearBtn = document.getElementById('compose-clear');
  const tl = document.getElementById('compose-timeline');

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
