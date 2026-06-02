import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch + AudioContext at the module level so we can drive loadAll
// through every path (priority + background fetch).
let originalFetch;
const fakeBuffer = (label) => ({ label });

function mockAudioCtx() {
  return {
    decodeAudioData: vi.fn(async (arr) => fakeBuffer(arr.byteLength)),
  };
}

beforeEach(() => {
  originalFetch = globalThis.fetch;
  vi.resetModules();
});

describe('SampleLibrary', () => {
  it('getPlaybackFor throws when nothing is loaded', async () => {
    const { getPlaybackFor } = await import('../src/js/audio/SampleLibrary.js');
    expect(() => getPlaybackFor(60)).toThrow(/not loaded/);
  });

  it('loadAll resolves once the four priority samples are ready', async () => {
    globalThis.fetch = vi.fn(async (url) => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(url.length),
    }));
    const ctx = mockAudioCtx();
    const { loadAll, getLoadedMidiNumbers } = await import('../src/js/audio/SampleLibrary.js');
    await loadAll(ctx, 'sounds/');
    const loaded = getLoadedMidiNumbers();
    // After the awaited priority load resolves, the four priority pitches
    // (C3 = 48, E3 = 52, G3 = 55, A3 = 57) are guaranteed present. The
    // remaining background fetches may or may not have completed yet.
    expect(loaded).toEqual(expect.arrayContaining([48, 52, 55, 57]));
  });

  it('getPlaybackFor finds the nearest sample + computes a sane playbackRate', async () => {
    globalThis.fetch = vi.fn(async (url) => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
    const { loadAll, getPlaybackFor } = await import('../src/js/audio/SampleLibrary.js');
    await loadAll(mockAudioCtx());

    // Exact match on a priority pitch → playbackRate is 1.
    const exact = getPlaybackFor(48);
    expect(exact.buffer).toBeTruthy();
    expect(exact.playbackRate).toBeCloseTo(1, 5);

    // One semitone above the priority C3 (48) → either lands on Db3 (49, if
    // the background fetch resolved) at rate 1, or on C3 at rate 2^(1/12).
    const oneUp = getPlaybackFor(49);
    expect(oneUp.buffer).toBeTruthy();
    expect(oneUp.playbackRate).toBeGreaterThan(0);
    expect(oneUp.playbackRate).toBeLessThanOrEqual(2);
  });

  it('getPlaybackFor pitch-shifts an octave when no nearby sample exists', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));
    const { loadAll, getPlaybackFor } = await import('../src/js/audio/SampleLibrary.js');
    await loadAll(mockAudioCtx());

    // Asking for C4 (60) — outside the library's range. Nearest sample is
    // likely B3 (59) → playbackRate 2^(1/12).
    const c4 = getPlaybackFor(60);
    expect(c4.playbackRate).toBeGreaterThan(1);

    // Asking for an extreme low — C2 (36) — should still resolve to the
    // nearest sample with rate < 1.
    const c2 = getPlaybackFor(36);
    expect(c2.playbackRate).toBeLessThan(1);
  });

  it('loadAll surfaces a clear error when a priority sample fails to fetch', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404 }));
    const { loadAll } = await import('../src/js/audio/SampleLibrary.js');
    await expect(loadAll(mockAudioCtx(), 'sounds/')).rejects.toThrow(/Failed to fetch/);
  });

  it('background-fetch errors are caught (no unhandled rejection)', async () => {
    let n = 0;
    globalThis.fetch = vi.fn(async () => {
      // Priority fetches (first 4) succeed, the rest reject.
      n += 1;
      if (n <= 4) return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
      return { ok: false, status: 500 };
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { loadAll } = await import('../src/js/audio/SampleLibrary.js');
    await loadAll(mockAudioCtx(), 'sounds/');
    // Let the unhandled background promise resolve before we check the warn spy.
    await new Promise(r => setTimeout(r, 0));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

// vitest globals
import { afterAll } from 'vitest';
