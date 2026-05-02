const STORAGE_KEY = 'seedsong-history';

const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const clearHistoryBtn = document.getElementById('clear-history');
const songNameInput = document.getElementById('song-name');
const saveBtn = document.getElementById('save-btn');
const saveHint = document.getElementById('save-hint');

let onLoad = null;
let getSnapshot = null;
let getLabels = null;
let lastSavedSnapshot = null;

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

export function saveHistory(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function snapshotsMatch(a, b) {
  if (!a || !b) return false;
  return a.seed === b.seed && a.bpm === b.bpm && a.time === b.time
    && a.tonic === b.tonic && a.scale === b.scale && a.bars === b.bars
    && (a.voice || 'piano') === (b.voice || 'piano')
    && (a.density || '0.65') === (b.density || '0.65')
    && (a.swing || '0') === (b.swing || '0')
    && (a.velocity || '0.8') === (b.velocity || '0.8');
}

export function checkUnsaved() {
  if (!getSnapshot) return;
  const snap = getSnapshot();
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

function renderHistory() {
  const entries = getHistory();
  const { scaleLabel, tonicLabel } = getLabels();
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
    loadBtn.addEventListener('click', () => {
      onLoad(e);
      lastSavedSnapshot = getSnapshot();
      checkUnsaved();
    });

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

export function initHistory({ onLoadEntry, snapshotFn, labelsFn }) {
  onLoad = onLoadEntry;
  getSnapshot = snapshotFn;
  getLabels = labelsFn;

  songNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
  });

  saveBtn.addEventListener('click', () => {
    const snap = getSnapshot();
    if (!snap) return;
    const entry = {
      ...snap,
      name: songNameInput.value.trim(),
      savedAt: Date.now(),
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
}

export function setLastSaved(snap) {
  lastSavedSnapshot = snap;
}
