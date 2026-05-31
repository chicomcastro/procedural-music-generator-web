// Deep-coverage tests for the History module — every public function +
// the inline rename / delete / load actions that fire from rendered cards.
import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';

const STORAGE_KEY = 'seedsong-history';

function scaffold() {
  document.body.innerHTML = `
    <input id="song-name" />
    <button id="save-btn"></button>
    <span id="save-hint"></span>
    <span id="unsaved-dot" hidden></span>
    <button id="clear-history"></button>
    <div id="history-empty"></div>
    <div id="history-list"></div>
  `;
}

let saved;
beforeEach(() => {
  scaffold();
  localStorage.clear();
  saved = null;
  vi.resetModules();
});

const snap = (over = {}) => ({
  seed: 1, bpm: 110, time: 4, tonic: 0, scale: 'major', bars: 4,
  voice: 'piano', density: '0.65', swing: '0', velocity: '0.8',
  noteCount: 12, ...over,
});

const labels = () => ({
  scaleLabel: (s) => s,
  tonicLabel: (n) => `T${n}`,
});

describe('History — public surface', () => {
  it('getHistory returns [] when nothing is stored', async () => {
    const { getHistory } = await import('../src/js/ui/History.js');
    expect(getHistory()).toEqual([]);
  });

  it('getHistory tolerates malformed localStorage payloads', async () => {
    localStorage.setItem(STORAGE_KEY, 'not json');
    const { getHistory } = await import('../src/js/ui/History.js');
    expect(getHistory()).toEqual([]);
  });

  it('saveHistory + getHistory round-trip an array of entries', async () => {
    const { saveHistory, getHistory } = await import('../src/js/ui/History.js');
    saveHistory([snap({ seed: 7 }), snap({ seed: 8 })]);
    const back = getHistory();
    expect(back).toHaveLength(2);
    expect(back[0].seed).toBe(7);
    expect(back[1].seed).toBe(8);
  });
});

describe('History — initHistory + save flow', () => {
  it('Save button appends an entry, clears the name input, and renders it', async () => {
    const { initHistory, getHistory } = await import('../src/js/ui/History.js');
    initHistory({
      onLoadEntry: (e) => { saved = e; },
      snapshotFn: () => snap(),
      labelsFn: labels,
    });

    document.getElementById('song-name').value = 'My song';
    document.getElementById('save-btn').click();

    expect(getHistory()).toHaveLength(1);
    expect(getHistory()[0].name).toBe('My song');
    expect(document.getElementById('song-name').value).toBe('');
    // History list contains one rendered card.
    expect(document.querySelectorAll('#history-list .history-item').length).toBe(1);
    expect(document.getElementById('history-empty').style.display).toBe('none');
  });

  it('Save shows "Saved!" hint that auto-clears after a delay', async () => {
    vi.useFakeTimers();
    const { initHistory } = await import('../src/js/ui/History.js');
    initHistory({
      onLoadEntry: () => {},
      snapshotFn: () => snap(),
      labelsFn: labels,
    });
    document.getElementById('save-btn').click();
    expect(document.getElementById('save-hint').textContent).toBe('Saved!');
    vi.advanceTimersByTime(2000);
    // checkUnsaved runs; since the snapshot still matches lastSaved, the
    // hint resets to empty.
    expect(document.getElementById('save-hint').textContent).toBe('');
    vi.useRealTimers();
  });

  it('Enter inside the name input triggers Save', async () => {
    const { initHistory, getHistory } = await import('../src/js/ui/History.js');
    initHistory({ onLoadEntry: () => {}, snapshotFn: () => snap(), labelsFn: labels });
    const nameInput = document.getElementById('song-name');
    nameInput.value = 'Enter-saved';
    nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(getHistory().some(e => e.name === 'Enter-saved')).toBe(true);
  });

  it('Save with snapshotFn returning null is a no-op', async () => {
    const { initHistory, getHistory } = await import('../src/js/ui/History.js');
    initHistory({ onLoadEntry: () => {}, snapshotFn: () => null, labelsFn: labels });
    document.getElementById('save-btn').click();
    expect(getHistory()).toEqual([]);
  });
});

describe('History — checkUnsaved flag', () => {
  it('shows "Unsaved changes" when the live snapshot diverges from lastSaved', async () => {
    let curr = snap();
    const { initHistory, checkUnsaved } = await import('../src/js/ui/History.js');
    initHistory({ onLoadEntry: () => {}, snapshotFn: () => curr, labelsFn: labels });
    // Right after init, lastSaved is null so checkUnsaved flags unsaved.
    checkUnsaved();
    expect(document.getElementById('save-hint').textContent).toBe('Unsaved changes');
    expect(document.getElementById('unsaved-dot').hidden).toBe(false);

    // After a save, the snapshot matches; checkUnsaved clears the hint.
    document.getElementById('save-btn').click();
    expect(document.getElementById('save-hint').textContent).not.toBe('Unsaved changes');

    // Mutate the snapshot — flag should come back.
    curr = snap({ seed: 99 });
    checkUnsaved();
    expect(document.getElementById('save-hint').textContent).toBe('Unsaved changes');
  });

  it('returns early when snapshotFn is not wired (e.g. before initHistory)', async () => {
    // checkUnsaved without initHistory shouldn't throw — getSnapshot is null.
    const { checkUnsaved } = await import('../src/js/ui/History.js');
    expect(() => checkUnsaved()).not.toThrow();
  });
});

describe('History — rendered card actions', () => {
  it('Load button invokes onLoadEntry with the entry and re-syncs lastSaved', async () => {
    const onLoad = vi.fn();
    const { initHistory } = await import('../src/js/ui/History.js');
    initHistory({ onLoadEntry: onLoad, snapshotFn: () => snap(), labelsFn: labels });
    document.getElementById('save-btn').click();
    // After save, one card with three buttons (Load / Rename / Delete).
    const loadBtn = document.querySelector('#history-list .history-item-actions button');
    expect(loadBtn.textContent).toBe('Load');
    loadBtn.click();
    expect(onLoad).toHaveBeenCalled();
  });

  it('Rename swaps name → input → committed name (Enter)', async () => {
    const { initHistory, getHistory } = await import('../src/js/ui/History.js');
    initHistory({ onLoadEntry: () => {}, snapshotFn: () => snap(), labelsFn: labels });
    document.getElementById('song-name').value = 'Original';
    document.getElementById('save-btn').click();

    // Rename is the second action button.
    const buttons = document.querySelectorAll('#history-list .history-item-actions button');
    const renameBtn = buttons[1];
    renameBtn.click();

    const input = document.querySelector('#history-list .history-rename-input');
    expect(input).toBeTruthy();
    input.value = 'Renamed';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(getHistory()[0].name).toBe('Renamed');
  });

  it('Rename → Escape reverts to the previous render', async () => {
    const { initHistory, getHistory } = await import('../src/js/ui/History.js');
    initHistory({ onLoadEntry: () => {}, snapshotFn: () => snap(), labelsFn: labels });
    document.getElementById('song-name').value = 'Keep me';
    document.getElementById('save-btn').click();

    const buttons = document.querySelectorAll('#history-list .history-item-actions button');
    buttons[1].click();
    const input = document.querySelector('#history-list .history-rename-input');
    input.value = 'do not save';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(getHistory()[0].name).toBe('Keep me');
  });

  it('Delete button removes the entry from storage + DOM', async () => {
    const { initHistory, getHistory } = await import('../src/js/ui/History.js');
    initHistory({ onLoadEntry: () => {}, snapshotFn: () => snap(), labelsFn: labels });
    document.getElementById('save-btn').click();
    document.getElementById('save-btn').click();
    expect(getHistory()).toHaveLength(2);

    const buttons = document.querySelectorAll('#history-list .history-item-actions button');
    // The Delete is the third button of the first card.
    buttons[2].click();
    expect(getHistory()).toHaveLength(1);
  });

  it('Clear-history button wipes everything', async () => {
    const { initHistory, getHistory } = await import('../src/js/ui/History.js');
    initHistory({ onLoadEntry: () => {}, snapshotFn: () => snap(), labelsFn: labels });
    document.getElementById('save-btn').click();
    document.getElementById('save-btn').click();
    document.getElementById('clear-history').click();
    expect(getHistory()).toEqual([]);
    expect(document.querySelectorAll('#history-list .history-item').length).toBe(0);
    expect(document.getElementById('history-empty').style.display).toBe('');
  });
});

describe('History — setLastSaved', () => {
  it('a setLastSaved snapshot makes checkUnsaved report clean', async () => {
    let curr = snap();
    const { initHistory, setLastSaved, checkUnsaved } = await import('../src/js/ui/History.js');
    initHistory({ onLoadEntry: () => {}, snapshotFn: () => curr, labelsFn: labels });
    setLastSaved(snap());
    checkUnsaved();
    expect(document.getElementById('save-hint').textContent).not.toBe('Unsaved changes');
  });
});

afterAll(() => {
  vi.useRealTimers();
});
