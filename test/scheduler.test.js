import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createScheduler } from '../src/js/scheduler/Scheduler.js';

// Simulate an AudioContext clock by stepping currentTime manually. The
// scheduler ticks via setInterval; vitest's fake timers let us advance
// at will and capture every onBeat callback the scheduler emits.

function makeCtx() {
  return { currentTime: 0 };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Scheduler', () => {
  it('start() begins emitting beats with the right spacing', () => {
    const ctx = makeCtx();
    const transport = { beatDuration: 0.5 };
    const onBeat = vi.fn();
    const s = createScheduler(ctx, transport, onBeat);
    expect(s.isPlaying).toBe(false);

    s.start();
    expect(s.isPlaying).toBe(true);

    // The scheduler's lookahead is 0.1s; the first tick fires beats
    // whose nextNoteTime falls inside (ctx.currentTime + 0.1).
    // First tick at t=0 → schedules beat 0 (at 0.05s, < 0.1s ahead).
    vi.advanceTimersByTime(30);
    expect(onBeat).toHaveBeenCalledTimes(1);
    expect(onBeat).toHaveBeenCalledWith(0, 0.05);

    // Advance the audio clock by one beat — the scheduler should emit
    // beat 1 on the next tick.
    ctx.currentTime = 0.5;
    vi.advanceTimersByTime(30);
    expect(onBeat).toHaveBeenCalledTimes(2);
    expect(onBeat).toHaveBeenLastCalledWith(1, expect.closeTo(0.55, 5));
  });

  it('stop() halts further beats', () => {
    const ctx = makeCtx();
    const onBeat = vi.fn();
    const s = createScheduler(ctx, { beatDuration: 0.25 }, onBeat);
    s.start();
    vi.advanceTimersByTime(30);
    s.stop();
    expect(s.isPlaying).toBe(false);
    ctx.currentTime = 1;
    vi.advanceTimersByTime(200);
    // Only the beats emitted before stop() should be counted.
    expect(onBeat).toHaveBeenCalledTimes(1);
  });

  it('startFrom(beat) resumes counting from the given offset', () => {
    const ctx = makeCtx();
    const onBeat = vi.fn();
    const s = createScheduler(ctx, { beatDuration: 0.5 }, onBeat);
    s.startFrom(7);
    vi.advanceTimersByTime(30);
    expect(onBeat).toHaveBeenCalledWith(7, expect.any(Number));
    expect(s.currentBeat).toBe(8);   // advanced past 7 after firing it
  });

  it('start() while already playing is a no-op (idempotent)', () => {
    const ctx = makeCtx();
    const s = createScheduler(ctx, { beatDuration: 1 }, vi.fn());
    s.start();
    const firstId = s.isPlaying;
    s.start();          // should not clobber the interval
    expect(s.isPlaying).toBe(firstId);
    s.stop();
  });

  it('stop() when not playing is a no-op', () => {
    const ctx = makeCtx();
    const s = createScheduler(ctx, { beatDuration: 1 }, vi.fn());
    expect(() => s.stop()).not.toThrow();
  });

  it('resume() picks up beats from the current clock without resetting the count', () => {
    const ctx = makeCtx();
    const onBeat = vi.fn();
    const s = createScheduler(ctx, { beatDuration: 0.5 }, onBeat);
    s.startFrom(3);
    vi.advanceTimersByTime(30);
    s.stop();
    ctx.currentTime = 5;
    s.resume();
    vi.advanceTimersByTime(30);
    // The current beat counter kept progressing.
    expect(s.currentBeat).toBeGreaterThan(3);
  });

  it('the lookahead burst emits all beats within SCHEDULE_AHEAD_TIME of the clock', () => {
    const ctx = makeCtx();
    const transport = { beatDuration: 0.02 };   // 50 beats/sec — very fast
    const onBeat = vi.fn();
    const s = createScheduler(ctx, transport, onBeat);
    s.start();
    vi.advanceTimersByTime(30);
    // ctx.currentTime = 0, lookahead = 0.1s, first nextNoteTime = 0.05.
    // So beats fire at 0.05, 0.07, 0.09, 0.11 (next one > 0.1 stops loop).
    // That's at least 3 beats in the first burst.
    expect(onBeat.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
