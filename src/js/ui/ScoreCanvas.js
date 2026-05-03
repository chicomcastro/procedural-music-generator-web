/** @param {HTMLCanvasElement} canvas @param {{ onBarClick?: (barIndex: number, e: PointerEvent) => void, onNoteEdited?: () => void, onBarLock?: (barIndex: number) => void }} [options] */
export function createScoreCanvas(canvas, options = {}) {
  const ctx = canvas.getContext('2d');
  let playheadBeat = -1;
  let lockedBars = new Set();
  let lastSong = null;
  let rafPending = false;
  let selectedEvent = null;

  canvas.style.cursor = 'pointer';
  canvas.setAttribute('tabindex', '0');

  let dragEvent = null;
  let dragMode = null; // 'move' or 'resize'
  let dragStartX = 0;
  let dragStartY = 0;
  let didDrag = false;

  /* ---- Track visibility ---- */
  let visibleTracks = new Set(['melody', 'chord', 'bass']);

  /* ---- Zoom & scroll state ---- */
  let zoomX = 1;
  let zoomY = 1;
  let scrollOffsetX = 0;
  let scrollOffsetY = 0;

  const PIANO_GUTTER = 44;
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 8;

  function clampZoom(v) { return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v)); }

  function getLayout() {
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const pad = { top: 8, bottom: 8, left: PIANO_GUTTER, right: 4 };
    const w = cssW - pad.left - pad.right;
    const h = cssH - pad.top - pad.bottom;
    const allPitchEvents = lastSong.events.filter(e => e.type !== 'drum');
    const midiValues = allPitchEvents.map(e => e.midi);
    const minMidi = Math.min(...midiValues) - 1;
    const maxMidi = Math.max(...midiValues) + 1;
    const midiRange = maxMidi - minMidi || 1;
    const totalBeats = lastSong.lengthBeats;
    const beatW = (w / totalBeats) * zoomX;
    const noteH = Math.min(h / midiRange, 10) * zoomY;
    return { pad, w, h, cssW, cssH, minMidi, maxMidi, midiRange, totalBeats, beatW, noteH };
  }

  function noteRect(ev, l) {
    const nx = l.pad.left + (ev.atBeat / l.totalBeats) * l.w * zoomX - scrollOffsetX;
    const ny = l.pad.top + l.h - ((ev.midi - l.minMidi) / l.midiRange) * l.h * zoomY - l.noteH / 2 - scrollOffsetY;
    const nw = Math.max(l.beatW * ev.durationBeats - 1, 2);
    return { x: nx, y: ny, w: nw, h: l.noteH };
  }

  function hitTest(cssX, cssY) {
    if (!lastSong) return null;
    const l = getLayout();
    for (const ev of lastSong.events) {
      if (ev.type === 'drum') continue;
      if (!visibleTracks.has(ev.type)) continue;
      const r = noteRect(ev, l);
      if (cssX >= r.x && cssX <= r.x + r.w && cssY >= r.y && cssY <= r.y + r.h) {
        return ev;
      }
    }
    return null;
  }

  function isOnRightEdge(cssX, ev, l) {
    const r = noteRect(ev, l);
    return cssX >= r.x + r.w - 5;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!lastSong) return;
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    const hit = hitTest(cssX, cssY);

    if (hit) {
      selectedEvent = hit;
      dragEvent = hit;
      const l = getLayout();
      dragMode = isOnRightEdge(cssX, hit, l) ? 'resize' : 'move';
      canvas.setPointerCapture(e.pointerId);
    } else {
      selectedEvent = null;
      dragEvent = null;
    }

    dragStartX = cssX;
    dragStartY = cssY;
    didDrag = false;
    render(lastSong);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!lastSong) return;
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    if (!dragEvent) {
      const hover = hitTest(cssX, cssY);
      if (hover) {
        const l = getLayout();
        canvas.style.cursor = isOnRightEdge(cssX, hover, l) ? 'ew-resize' : 'grab';
      } else {
        canvas.style.cursor = 'pointer';
      }
      return;
    }

    const dx = cssX - dragStartX;
    const dy = cssY - dragStartY;
    if (!didDrag && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    didDrag = true;

    const l = getLayout();
    const scaledW = l.w * zoomX;
    const scaledH = l.h * zoomY;

    if (dragMode === 'resize') {
      const beatDelta = (dx / scaledW) * l.totalBeats;
      dragEvent.durationBeats = Math.max(0.25, dragEvent.durationBeats + beatDelta);
    } else {
      const beatDelta = (dx / scaledW) * l.totalBeats;
      const midiDelta = -Math.round((dy / scaledH) * l.midiRange);
      dragEvent.atBeat = Math.max(0, Math.min(l.totalBeats - dragEvent.durationBeats, dragEvent.atBeat + beatDelta));
      dragEvent.midi = dragEvent.midi + midiDelta;
    }

    dragStartX = cssX;
    dragStartY = cssY;
    render(lastSong);
  });

  canvas.addEventListener('pointerup', (e) => {
    if (didDrag && dragEvent && lastSong) {
      const barIndex = Math.floor(dragEvent.atBeat / lastSong.beatsPerBar);
      if (options.onBarLock) options.onBarLock(barIndex);
      if (options.onNoteEdited) options.onNoteEdited();
    } else if (!didDrag && !dragEvent && lastSong && options.onBarClick) {
      const rect = canvas.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const l = getLayout();
      const beat = ((cssX - l.pad.left + scrollOffsetX) / (l.w * zoomX)) * l.totalBeats;
      const barIndex = Math.floor(beat / lastSong.beatsPerBar);
      if (barIndex >= 0 && barIndex < lastSong.bars) {
        options.onBarClick(barIndex, e);
      }
    }
    dragEvent = null;
    dragMode = null;
  });

  canvas.addEventListener('keydown', (e) => {
    if (!selectedEvent || !lastSong) return;
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      const barIndex = Math.floor(selectedEvent.atBeat / lastSong.beatsPerBar);
      const idx = lastSong.events.indexOf(selectedEvent);
      if (idx >= 0) lastSong.events.splice(idx, 1);
      selectedEvent = null;
      if (options.onBarLock) options.onBarLock(barIndex);
      if (options.onNoteEdited) options.onNoteEdited();
      render(lastSong);
    }
  });

  /* ---- Wheel: zoom & scroll ---- */
  canvas.addEventListener('wheel', (e) => {
    if (!lastSong) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      // Zoom X toward cursor
      const oldZoomX = zoomX;
      zoomX = clampZoom(zoomX * (1 - e.deltaY * 0.005));
      const ratio = zoomX / oldZoomX;
      const relX = cssX - PIANO_GUTTER + scrollOffsetX;
      scrollOffsetX = Math.max(0, relX * ratio - (cssX - PIANO_GUTTER));
    } else if (e.shiftKey) {
      // Zoom Y toward cursor
      const l = getLayout();
      const oldZoomY = zoomY;
      zoomY = clampZoom(zoomY * (1 - e.deltaY * 0.005));
      const ratio = zoomY / oldZoomY;
      const relY = cssY - l.pad.top + scrollOffsetY;
      scrollOffsetY = Math.max(0, relY * ratio - (cssY - l.pad.top));
    } else {
      // Plain scroll when zoomed
      scrollOffsetX = Math.max(0, scrollOffsetX + e.deltaX + e.deltaY);
    }

    clampScrollOffsets();
    render(lastSong);
  }, { passive: false });

  function clampScrollOffsets() {
    if (!lastSong) return;
    const l = getLayout();
    const maxScrollX = Math.max(0, l.w * zoomX - l.w);
    const maxScrollY = Math.max(0, l.h * zoomY - l.h);
    scrollOffsetX = Math.max(0, Math.min(scrollOffsetX, maxScrollX));
    scrollOffsetY = Math.max(0, Math.min(scrollOffsetY, maxScrollY));
  }

  function setLockedBars(set) {
    lockedBars = set;
  }

  function setVisibleTracks(trackSet) {
    visibleTracks = trackSet;
  }

  function setZoom(newZoomX, newZoomY) {
    zoomX = clampZoom(newZoomX);
    zoomY = clampZoom(newZoomY);
    clampScrollOffsets();
    if (lastSong) render(lastSong);
  }

  function resetZoom() {
    zoomX = 1;
    zoomY = 1;
    scrollOffsetX = 0;
    scrollOffsetY = 0;
    if (lastSong) render(lastSong);
  }

  function getThemeColors() {
    const s = getComputedStyle(document.documentElement);
    return {
      melody: s.getPropertyValue('--melody-color').trim(),
      chord: s.getPropertyValue('--chord-color').trim(),
      bass: s.getPropertyValue('--bass-color').trim(),
      locked: s.getPropertyValue('--locked-bg').trim(),
      accent: s.getPropertyValue('--accent').trim(),
      textPrimary: s.getPropertyValue('--text-primary').trim(),
      textSecondary: s.getPropertyValue('--text-secondary').trim(),
      keyWhite: s.getPropertyValue('--key-white').trim(),
      keyBlack: s.getPropertyValue('--key-black').trim(),
      border: s.getPropertyValue('--border').trim(),
    };
  }

  function requestRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      actualRender(lastSong);
    });
  }

  function render(song) {
    if (!song || !song.events.length) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    lastSong = song;
    requestRender();
  }

  /** Convert midi number to note name like C3, C4 */
  function midiToNoteName(midi) {
    const octave = Math.floor(midi / 12) - 1;
    return `C${octave}`;
  }

  /** Is this midi number a black key? */
  function isBlackKey(midi) {
    const pc = midi % 12;
    return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
  }

  function actualRender(song) {
    if (!song || !song.events.length) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const colors = getThemeColors();
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, cssW, cssH);

    const pad = { top: 8, bottom: 8, left: PIANO_GUTTER, right: 4 };
    const w = cssW - pad.left - pad.right;
    const h = cssH - pad.top - pad.bottom;

    const allPitchEvents = song.events.filter(e => e.type !== 'drum');
    const midiValues = allPitchEvents.map(e => e.midi);
    const minMidi = Math.min(...midiValues) - 1;
    const maxMidi = Math.max(...midiValues) + 1;
    const midiRange = maxMidi - minMidi || 1;

    const totalBeats = song.lengthBeats;
    const beatW = (w / totalBeats) * zoomX;
    const noteH = Math.min(h / midiRange, 10) * zoomY;

    const scaledW = w * zoomX;
    const scaledH = h * zoomY;

    function xBeat(beat) { return pad.left + (beat / totalBeats) * scaledW - scrollOffsetX; }
    function yMidi(midi) { return pad.top + scaledH - ((midi - minMidi) / midiRange) * scaledH - noteH / 2 - scrollOffsetY; }

    const gridBase = isLight ? '0,0,0' : '255,255,255';

    /* ---- Piano keyboard gutter (fixed, not scrolled) ---- */
    const gutterRight = pad.left - 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, pad.top, gutterRight, h);
    ctx.clip();

    for (let midi = minMidi; midi <= maxMidi; midi++) {
      const ky = pad.top + scaledH - ((midi - minMidi) / midiRange) * scaledH - noteH / 2 - scrollOffsetY;
      if (ky + noteH < pad.top || ky > pad.top + h) continue;

      const black = isBlackKey(midi);
      ctx.fillStyle = black
        ? (isLight ? '#2d2d2d' : '#1a1a1a')
        : (isLight ? '#f0f0f0' : '#333');
      ctx.fillRect(0, ky, gutterRight, noteH);

      // key border
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, ky + noteH);
      ctx.lineTo(gutterRight, ky + noteH);
      ctx.stroke();

      // Label C notes
      if (midi % 12 === 0) {
        ctx.fillStyle = black ? '#ccc' : colors.textSecondary;
        ctx.font = '9px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(midiToNoteName(midi), gutterRight / 2, ky + noteH / 2);
      }
    }
    ctx.restore();

    // Gutter right edge line
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gutterRight, pad.top);
    ctx.lineTo(gutterRight, pad.top + h);
    ctx.stroke();

    /* ---- Clip the score area (everything right of the gutter) ---- */
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.left, pad.top, w, h);
    ctx.clip();

    /* ---- C-note guide lines across full width ---- */
    for (let midi = minMidi; midi <= maxMidi; midi++) {
      if (midi % 12 !== 0) continue;
      const gy = yMidi(midi) + noteH / 2;
      if (gy < pad.top || gy > pad.top + h) continue;
      ctx.strokeStyle = `rgba(${gridBase},0.08)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(pad.left + w, gy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    /* ---- Locked bar backgrounds ---- */
    for (let bar = 0; bar < song.bars; bar++) {
      if (!lockedBars.has(bar)) continue;
      const bx = xBeat(bar * song.beatsPerBar);
      const bw = beatW * song.beatsPerBar;
      ctx.fillStyle = colors.locked;
      ctx.fillRect(bx, pad.top, bw, h);
    }

    /* ---- Grid lines ---- */
    ctx.strokeStyle = `rgba(${gridBase},0.06)`;
    ctx.lineWidth = 1;
    for (let b = 0; b <= totalBeats; b++) {
      const bx = xBeat(b);
      if (bx < pad.left || bx > pad.left + w) continue;
      ctx.beginPath();
      ctx.moveTo(bx, pad.top);
      ctx.lineTo(bx, pad.top + h);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(${gridBase},0.15)`;
    for (let b = 0; b <= totalBeats; b += song.beatsPerBar) {
      const bx = xBeat(b);
      if (bx < pad.left || bx > pad.left + w) continue;
      ctx.beginPath();
      ctx.moveTo(bx, pad.top);
      ctx.lineTo(bx, pad.top + h);
      ctx.stroke();
    }

    /* ---- Sections ---- */
    if (song.sections) {
      ctx.font = '10px system-ui, sans-serif';
      ctx.textBaseline = 'top';
      const sectionColors = ['#5b8def', '#e8b528', '#5b8def', '#e8b528', '#5b8def', '#888888'];
      for (let si = 0; si < song.sections.length; si++) {
        const sec = song.sections[si];
        const sx = xBeat(sec.startBeat);
        const sw = xBeat(sec.startBeat + sec.lengthBeats) - sx;
        const sc = sectionColors[si] || '#888888';
        ctx.fillStyle = sc + '12';
        ctx.fillRect(sx, pad.top, sw, h);
        ctx.strokeStyle = sc + '60';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, pad.top);
        ctx.lineTo(sx, pad.top + h);
        ctx.stroke();
        ctx.fillStyle = colors.textPrimary;
        ctx.globalAlpha = 0.5;
        ctx.fillText(sec.label, sx + 3, pad.top + 2);
        ctx.globalAlpha = 1;
      }
    }

    /* ---- Notes (filtered by visible tracks) ---- */
    const pitchEvents = allPitchEvents.filter(e => visibleTracks.has(e.type));

    for (const ev of pitchEvents) {
      const nx = xBeat(ev.atBeat);
      const ny = yMidi(ev.midi);
      const nw = Math.max(beatW * ev.durationBeats - 1, 2);

      // Skip notes entirely outside viewport
      if (nx + nw < pad.left || nx > pad.left + w) continue;
      if (ny + noteH < pad.top || ny > pad.top + h) continue;

      ctx.fillStyle = ev.type === 'chord' ? colors.chord : ev.type === 'bass' ? colors.bass : colors.melody;
      ctx.beginPath();
      ctx.roundRect(nx, ny, nw, noteH, 2);
      ctx.fill();

      if (ev === selectedEvent) {
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(nx - 1, ny - 1, nw + 2, noteH + 2, 3);
        ctx.stroke();
      }
    }

    /* ---- Lock icons ---- */
    for (let bar = 0; bar < song.bars; bar++) {
      if (!lockedBars.has(bar)) continue;
      const barStart = bar * song.beatsPerBar;
      const cx = xBeat(barStart + song.beatsPerBar / 2);
      const cy = pad.top + 12;
      if (cx < pad.left || cx > pad.left + w) continue;
      drawLockIcon(ctx, cx, cy, 10, colors.accent);
    }

    /* ---- Playhead ---- */
    if (playheadBeat >= 0 && playheadBeat < totalBeats) {
      const px = xBeat(playheadBeat);
      if (px >= pad.left && px <= pad.left + w) {
        ctx.strokeStyle = `rgba(${gridBase},0.6)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, pad.top);
        ctx.lineTo(px, pad.top + h);
        ctx.stroke();
      }
    }

    ctx.restore(); // restore clip
  }

  function setPlayhead(beat) {
    playheadBeat = beat;

    // Auto-scroll to keep playhead visible during playback
    if (beat >= 0 && lastSong && zoomX > 1) {
      const l = getLayout();
      const px = l.pad.left + (beat / l.totalBeats) * l.w * zoomX - scrollOffsetX;
      const visibleLeft = l.pad.left;
      const visibleRight = l.pad.left + l.w;
      if (px < visibleLeft || px > visibleRight - 20) {
        scrollOffsetX = Math.max(0, (beat / l.totalBeats) * l.w * zoomX - l.w * 0.25);
        clampScrollOffsets();
      }
    }
  }

  return {
    render,
    setPlayhead,
    setLockedBars,
    setVisibleTracks,
    setZoom,
    resetZoom,
    getZoom() { return { zoomX, zoomY }; },
  };
}

function drawLockIcon(ctx, cx, cy, size, color) {
  const s = size;
  const bodyW = s * 0.7;
  const bodyH = s * 0.5;
  const bodyX = cx - bodyW / 2;
  const bodyY = cy;

  ctx.globalAlpha = 0.6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(bodyX, bodyY, bodyW, bodyH, 1.5);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  const shackleW = s * 0.4;
  ctx.beginPath();
  ctx.arc(cx, bodyY, shackleW / 2, Math.PI, 0);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
