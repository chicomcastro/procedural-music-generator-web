import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadBlob } from '../src/js/export/download.js';

describe('downloadBlob', () => {
  let createObjectURL;
  let revokeObjectURL;
  let clicked;

  beforeEach(() => {
    clicked = false;
    createObjectURL = vi.fn(() => 'blob:fake');
    revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;
    vi.useFakeTimers();
    // Intercept anchor click so jsdom doesn't try to navigate.
    HTMLAnchorElement.prototype.click = function () { clicked = true; this.__navigated = this.href; };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates an anchor, clicks it, removes it, and revokes the url', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    downloadBlob(bytes, 'foo.bin', 'application/octet-stream');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clicked).toBe(true);
    // The anchor was inserted then removed — querying the DOM shouldn't find it.
    expect(document.querySelector('a[download="foo.bin"]')).toBeNull();
    // URL.revokeObjectURL is scheduled with setTimeout(1000).
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });
});
