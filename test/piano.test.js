import { describe, it, expect, beforeEach, vi } from 'vitest';
import { noteNameToMidi, createPiano } from '../src/js/ui/Piano.js';

beforeEach(() => {
  document.body.innerHTML = '';
  if (document.activeElement && document.activeElement !== document.body) {
    try { document.activeElement.blur(); } catch {}
  }
});

const flushRAF = () => new Promise(r => requestAnimationFrame(() => r()));

describe('noteNameToMidi', () => {
  it('maps C4 → 60, A4 → 69, etc.', () => {
    expect(noteNameToMidi('C', 4)).toBe(60);
    expect(noteNameToMidi('A', 4)).toBe(69);
    expect(noteNameToMidi('C', 5)).toBe(72);
  });
  it('treats sharps and flats as enharmonics', () => {
    expect(noteNameToMidi('C#', 4)).toBe(61);
    expect(noteNameToMidi('Db', 4)).toBe(61);
    expect(noteNameToMidi('Eb', 4)).toBe(63);
    expect(noteNameToMidi('D#', 4)).toBe(63);
  });
  it('throws on unknown note names', () => {
    expect(() => noteNameToMidi('H', 4)).toThrow();
    expect(() => noteNameToMidi('', 4)).toThrow();
  });
});

describe('createPiano', () => {
  function makeRoot() {
    const root = document.createElement('div');
    document.body.appendChild(root);
    return root;
  }

  it('renders white + black keys for the configured octave range', async () => {
    const root = makeRoot();
    createPiano(root, { startOctave: 4, octaves: 1, onAttack: vi.fn(), onRelease: vi.fn() });
    expect(root.querySelectorAll('.white-keys .key').length).toBe(7);
    await flushRAF();
    expect(root.querySelectorAll('.black-keys .key').length).toBe(5);
  });

  it('returns a controller with setPressed / setVisual / clearAllVisual', () => {
    const root = makeRoot();
    const ctrl = createPiano(root, { startOctave: 4, octaves: 1, onAttack: vi.fn(), onRelease: vi.fn() });
    expect(typeof ctrl.setPressed).toBe('function');
    expect(typeof ctrl.setVisual).toBe('function');
    expect(typeof ctrl.clearAllVisual).toBe('function');
  });

  it('setVisual + clearAllVisual toggle the "glow" classes', async () => {
    const root = makeRoot();
    const ctrl = createPiano(root, { startOctave: 4, octaves: 1, onAttack: vi.fn(), onRelease: vi.fn() });
    await flushRAF();
    ctrl.setVisual(60, true);
    expect(root.querySelector('[data-midi="60"]').classList.contains('glow')).toBe(true);
    ctrl.setVisual(60, true, 'chord');
    expect(root.querySelector('[data-midi="60"]').classList.contains('glow-chord')).toBe(true);
    ctrl.clearAllVisual();
    expect(root.querySelector('[data-midi="60"]').classList.contains('glow')).toBe(false);
  });

  it('pointerdown on a white key fires onAttack with the correct midi', async () => {
    const root = makeRoot();
    const onAttack = vi.fn();
    const onRelease = vi.fn();
    createPiano(root, { startOctave: 4, octaves: 1, onAttack, onRelease });
    await flushRAF();
    const c4 = root.querySelector('[data-midi="60"]');
    const e = new Event('pointerdown', { bubbles: true, cancelable: true });
    e.pointerId = 1;
    c4.dispatchEvent(e);
    expect(onAttack).toHaveBeenCalledWith(60);
  });

  it('pointerup releases the held key', async () => {
    const root = makeRoot();
    const onAttack = vi.fn(), onRelease = vi.fn();
    createPiano(root, { startOctave: 4, octaves: 1, onAttack, onRelease });
    await flushRAF();
    const c4 = root.querySelector('[data-midi="60"]');
    const down = new Event('pointerdown', { bubbles: true, cancelable: true });
    down.pointerId = 7;
    c4.dispatchEvent(down);
    const up = new Event('pointerup', { bubbles: true });
    up.pointerId = 7;
    window.dispatchEvent(up);
    expect(onRelease).toHaveBeenCalledWith(60);
    expect(c4.classList.contains('playing')).toBe(false);
  });

  it('pointercancel also releases', async () => {
    const root = makeRoot();
    const onRelease = vi.fn();
    createPiano(root, { startOctave: 4, octaves: 1, onAttack: vi.fn(), onRelease });
    await flushRAF();
    const c4 = root.querySelector('[data-midi="60"]');
    const down = new Event('pointerdown', { bubbles: true, cancelable: true });
    down.pointerId = 5;
    c4.dispatchEvent(down);
    const cancel = new Event('pointercancel', { bubbles: true });
    cancel.pointerId = 5;
    window.dispatchEvent(cancel);
    expect(onRelease).toHaveBeenCalled();
  });

  it('pointerup for an untracked pointer is a no-op', async () => {
    const root = makeRoot();
    const onRelease = vi.fn();
    createPiano(root, { startOctave: 4, octaves: 1, onAttack: vi.fn(), onRelease });
    await flushRAF();
    const up = new Event('pointerup', { bubbles: true });
    up.pointerId = 999;
    window.dispatchEvent(up);
    expect(onRelease).not.toHaveBeenCalled();
  });

  it('setPressed(midi, true/false) presses + releases', async () => {
    const root = makeRoot();
    const onAttack = vi.fn(), onRelease = vi.fn();
    const ctrl = createPiano(root, { startOctave: 4, octaves: 1, onAttack, onRelease });
    await flushRAF();
    ctrl.setPressed(60, true);
    expect(onAttack).toHaveBeenCalledWith(60);
    ctrl.setPressed(60, false);
    expect(onRelease).toHaveBeenCalledWith(60);
  });

  it('setPressed on an unknown midi is a no-op', async () => {
    const root = makeRoot();
    const onAttack = vi.fn();
    const ctrl = createPiano(root, { startOctave: 4, octaves: 1, onAttack, onRelease: vi.fn() });
    await flushRAF();
    ctrl.setPressed(999, true);
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('setVisual(midi, true, "bass") applies glow-bass class', async () => {
    const root = makeRoot();
    const ctrl = createPiano(root, { startOctave: 4, octaves: 1, onAttack: vi.fn(), onRelease: vi.fn() });
    await flushRAF();
    ctrl.setVisual(60, true, 'bass');
    expect(root.querySelector('[data-midi="60"]').classList.contains('glow-bass')).toBe(true);
    ctrl.setVisual(60, false);
    expect(root.querySelector('[data-midi="60"]').classList.contains('glow-bass')).toBe(false);
  });

  it('setVisual on unknown midi is a no-op', async () => {
    const root = makeRoot();
    const ctrl = createPiano(root, { startOctave: 4, octaves: 1, onAttack: vi.fn(), onRelease: vi.fn() });
    await flushRAF();
    ctrl.setVisual(99999, true);
    expect(true).toBe(true);
  });

  it('exposes the current keyboard octave via getter', async () => {
    const root = makeRoot();
    const ctrl = createPiano(root, { startOctave: 3, octaves: 2, onAttack: vi.fn(), onRelease: vi.fn() });
    await flushRAF();
    expect(ctrl.keyboardOctave).toBe(4);
  });

  it('fires onOctaveChange on init', async () => {
    const root = makeRoot();
    const onOctaveChange = vi.fn();
    createPiano(root, { startOctave: 3, octaves: 2, onAttack: vi.fn(), onRelease: vi.fn(), onOctaveChange });
    await flushRAF();
    expect(onOctaveChange).toHaveBeenCalled();
  });

  it('keyboard A key plays C in the current octave', async () => {
    const root = makeRoot();
    const onAttack = vi.fn(), onRelease = vi.fn();
    const ctrl = createPiano(root, { startOctave: 4, octaves: 1, onAttack, onRelease });
    await flushRAF();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));
    const expectedMidi = noteNameToMidi('C', ctrl.keyboardOctave);
    expect(onAttack).toHaveBeenCalledWith(expectedMidi);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', bubbles: true }));
    expect(onRelease).toHaveBeenCalledWith(expectedMidi);
  });

  it('Z shifts octave down; X shifts it up', async () => {
    const root = makeRoot();
    const ctrl = createPiano(root, { startOctave: 3, octaves: 3, onAttack: vi.fn(), onRelease: vi.fn() });
    await flushRAF();
    const initial = ctrl.keyboardOctave;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true }));
    expect(ctrl.keyboardOctave).toBe(initial - 1);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', bubbles: true }));
    expect(ctrl.keyboardOctave).toBe(initial);
  });

  it('Z is clamped to min octave', async () => {
    const root = makeRoot();
    const ctrl = createPiano(root, { startOctave: 3, octaves: 2, onAttack: vi.fn(), onRelease: vi.fn() });
    await flushRAF();
    for (let i = 0; i < 10; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true }));
    }
    expect(ctrl.keyboardOctave).toBe(3);
  });

  it('X is clamped to max octave', async () => {
    const root = makeRoot();
    const ctrl = createPiano(root, { startOctave: 3, octaves: 2, onAttack: vi.fn(), onRelease: vi.fn() });
    await flushRAF();
    for (let i = 0; i < 10; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', bubbles: true }));
    }
    expect(ctrl.keyboardOctave).toBeLessThanOrEqual(4);
  });

  it('modifier-key keydowns are ignored', async () => {
    const root = makeRoot();
    const onAttack = vi.fn();
    createPiano(root, { startOctave: 4, octaves: 1, onAttack, onRelease: vi.fn() });
    await flushRAF();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', ctrlKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', metaKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', altKey: true, bubbles: true }));
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('keydowns while typing into an input are ignored', async () => {
    const root = makeRoot();
    document.body.insertAdjacentHTML('beforeend', '<input id="probe" />');
    document.getElementById('probe').focus();
    const onAttack = vi.fn();
    createPiano(root, { startOctave: 4, octaves: 1, onAttack, onRelease: vi.fn() });
    await flushRAF();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('keydown auto-repeat is ignored', async () => {
    const root = makeRoot();
    const onAttack = vi.fn();
    createPiano(root, { startOctave: 4, octaves: 1, onAttack, onRelease: vi.fn() });
    await flushRAF();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', repeat: true, bubbles: true }));
    expect(onAttack).toHaveBeenCalledTimes(1);
  });

  it('window blur releases all held keys', async () => {
    const root = makeRoot();
    const onRelease = vi.fn();
    createPiano(root, { startOctave: 4, octaves: 1, onAttack: vi.fn(), onRelease });
    await flushRAF();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', bubbles: true }));
    window.dispatchEvent(new Event('blur'));
    expect(onRelease.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('unknown key codes are ignored', async () => {
    const root = makeRoot();
    const onAttack = vi.fn();
    createPiano(root, { startOctave: 4, octaves: 1, onAttack, onRelease: vi.fn() });
    await flushRAF();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }));
    expect(onAttack).not.toHaveBeenCalled();
  });
});
