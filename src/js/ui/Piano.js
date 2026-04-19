const NOTE_OFFSETS = {
  'C': 0, 'C#': 1, 'Db': 1,
  'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5,
  'F#': 6, 'Gb': 6,
  'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10,
  'B': 11,
};

export function noteNameToMidi(name, octave = 3) {
  const offset = NOTE_OFFSETS[name];
  if (offset == null) throw new Error(`Unknown note: ${name}`);
  return (octave + 1) * 12 + offset;
}

export function createPiano(rootEl, { onAttack, onRelease }) {
  const keys = [...rootEl.querySelectorAll('.key')];
  const keyByMidi = new Map();
  for (const el of keys) {
    const midi = noteNameToMidi(el.dataset.note, 3);
    el.dataset.midi = String(midi);
    keyByMidi.set(midi, el);
  }

  const activePointers = new Map();

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

  for (const el of keys) {
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

  return {
    setPressed(midi, on) {
      if (on) press(midi, 'external');
      else releaseKey(midi);
    },
  };
}
