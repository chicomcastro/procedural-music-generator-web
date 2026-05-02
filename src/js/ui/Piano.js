const NOTE_OFFSETS = {
  'C': 0, 'C#': 1, 'Db': 1,
  'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5,
  'F#': 6, 'Gb': 6,
  'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10,
  'B': 11,
};

export function noteNameToMidi(name, octave) {
  const offset = NOTE_OFFSETS[name];
  if (offset == null) throw new Error(`Unknown note: ${name}`);
  return (octave + 1) * 12 + offset;
}

const KEYBOARD_MAP = {
  KeyA: 'C', KeyW: 'C#',
  KeyS: 'D', KeyE: 'D#',
  KeyD: 'E',
  KeyF: 'F', KeyT: 'F#',
  KeyG: 'G', KeyY: 'G#',
  KeyH: 'A', KeyU: 'A#',
  KeyJ: 'B',
};

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_GROUPS = [[1, 3], [6, 8, 10]];

function midiAt(octave, pc) {
  return (octave + 1) * 12 + pc;
}

/** @param {HTMLElement} rootEl @returns {{ setPressed: (midi: number, on: boolean) => void, setVisual: (midi: number, on: boolean) => void, clearAllVisual: () => void, keyboardOctave: number }} */
export function createPiano(rootEl, { startOctave = 3, octaves = 2, onAttack, onRelease, onOctaveChange = null }) {
  rootEl.innerHTML = '';
  const keyByMidi = new Map();

  const BLACK_PCS = [1, 3, 6, 8, 10];
  const BLACK_OFFSETS = { 1: 0.75, 3: 1.75, 6: 3.75, 8: 4.75, 10: 5.75 };

  const whiteRow = document.createElement('div');
  whiteRow.className = 'key-group white-keys';
  for (let o = 0; o < octaves; o++) {
    for (const pc of WHITE_PCS) {
      const midi = midiAt(startOctave + o, pc);
      const el = document.createElement('div');
      el.className = 'key';
      el.dataset.midi = String(midi);
      whiteRow.appendChild(el);
      keyByMidi.set(midi, el);
    }
  }

  rootEl.appendChild(whiteRow);

  const blackRow = document.createElement('div');
  blackRow.className = 'key-group black-keys';
  rootEl.appendChild(blackRow);

  requestAnimationFrame(() => {
    const whiteKeyEl = whiteRow.querySelector('.key');
    const W = whiteKeyEl ? whiteKeyEl.offsetWidth : 36;
    for (let o = 0; o < octaves; o++) {
      for (const pc of BLACK_PCS) {
        const midi = midiAt(startOctave + o, pc);
        const el = document.createElement('div');
        el.className = 'key black';
        el.dataset.midi = String(midi);
        const left = (o * 7 + BLACK_OFFSETS[pc]) * W;
        el.style.left = `${left}px`;
        blackRow.appendChild(el);
        keyByMidi.set(midi, el);
      }
    }
    updateKbdHints();
  });

  let kbdOctave = Math.min(startOctave + 2, startOctave + octaves - 1);
  const minKbdOctave = startOctave;
  const maxKbdOctave = startOctave + octaves - 1;

  function updateKbdHints() {
    rootEl.querySelectorAll('.keyhint').forEach(el => el.remove());
    for (const [code, note] of Object.entries(KEYBOARD_MAP)) {
      const midi = noteNameToMidi(note, kbdOctave);
      const keyEl = keyByMidi.get(midi);
      if (!keyEl) continue;
      const span = document.createElement('span');
      span.className = 'keyhint';
      span.textContent = code.replace('Key', '');
      keyEl.appendChild(span);
    }
    if (onOctaveChange) onOctaveChange(kbdOctave);
  }

  function press(midi, source) {
    const el = keyByMidi.get(midi);
    if (!el) return;
    if (!el.classList.contains('playing')) {
      el.classList.add('playing');
      onAttack(midi);
    }
    el.dataset.heldBy = source;
  }

  function releaseKey(midi) {
    const el = keyByMidi.get(midi);
    if (!el || !el.classList.contains('playing')) return;
    el.classList.remove('playing');
    delete el.dataset.heldBy;
    onRelease(midi);
  }

  const activePointers = new Map();

  for (const el of keyByMidi.values()) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const midi = Number(el.dataset.midi);
      activePointers.set(e.pointerId, midi);
      press(midi, `pointer:${e.pointerId}`);
    });
  }

  function endPointer(e) {
    const midi = activePointers.get(e.pointerId);
    if (midi == null) return;
    activePointers.delete(e.pointerId);
    releaseKey(midi);
  }

  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);

  const heldByCode = new Map();

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'KeyZ' && !e.repeat) {
      if (kbdOctave > minKbdOctave) {
        kbdOctave -= 1;
        updateKbdHints();
      }
      e.preventDefault();
      return;
    }
    if (e.code === 'KeyX' && !e.repeat) {
      if (kbdOctave < maxKbdOctave) {
        kbdOctave += 1;
        updateKbdHints();
      }
      e.preventDefault();
      return;
    }
    if (e.repeat) return;
    const note = KEYBOARD_MAP[e.code];
    if (!note) return;
    e.preventDefault();
    if (heldByCode.has(e.code)) return;
    const midi = noteNameToMidi(note, kbdOctave);
    heldByCode.set(e.code, midi);
    press(midi, `key:${e.code}`);
  });

  window.addEventListener('keyup', (e) => {
    const midi = heldByCode.get(e.code);
    if (midi == null) return;
    heldByCode.delete(e.code);
    releaseKey(midi);
  });

  window.addEventListener('blur', () => {
    for (const midi of heldByCode.values()) releaseKey(midi);
    heldByCode.clear();
  });

  updateKbdHints();

  function setVisual(midi, on, type = 'melody') {
    const el = keyByMidi.get(midi);
    if (!el) return;
    if (on) {
      el.classList.add('glow');
      el.classList.remove('glow-chord', 'glow-bass');
      if (type === 'chord') el.classList.add('glow-chord');
      else if (type === 'bass') el.classList.add('glow-bass');
    } else {
      el.classList.remove('glow', 'glow-chord', 'glow-bass');
    }
  }

  function clearAllVisual() {
    rootEl.querySelectorAll('.key.glow').forEach(el => el.classList.remove('glow', 'glow-chord', 'glow-bass'));
  }

  return {
    setPressed(midi, on) {
      if (on) press(midi, 'external');
      else releaseKey(midi);
    },
    setVisual,
    clearAllVisual,
    get keyboardOctave() { return kbdOctave; },
  };
}
