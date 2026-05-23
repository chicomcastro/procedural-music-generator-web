import { describe, it, expect, vi } from 'vitest';
import { noteNameToMidi, createPiano } from '../src/js/ui/Piano.js';

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
    // jsdom may not have a PointerEvent constructor — fall back to a mouse-like
    // event with the pointerId field that the handler reads.
    const e = new Event('pointerdown', { bubbles: true, cancelable: true });
    e.pointerId = 1;
    c4.dispatchEvent(e);
    expect(onAttack).toHaveBeenCalledWith(60);
  });
});
