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

  function getLayout() {
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const pad = { top: 8, bottom: 8, left: 4, right: 4 };
    const w = cssW - pad.left - pad.right;
    const h = cssH - pad.top - pad.bottom;
    const pitchEvents = lastSong.events.filter(e => e.type !== 'drum');
    const midiValues = pitchEvents.map(e => e.midi);
    const minMidi = Math.min(...midiValues) - 1;
    const maxMidi = Math.max(...midiValues) + 1;
    const midiRange = maxMidi - minMidi || 1;
    const totalBeats = lastSong.lengthBeats;
    const beatW = w / totalBeats;
    const noteH = Math.min(h / midiRange, 10);
    return { pad, w, h, cssW, cssH, minMidi, maxMidi, midiRange, totalBeats, beatW, noteH };
  }

  function noteRect(ev, l) {
    const nx = l.pad.left + (ev.atBeat / l.totalBeats) * l.w;
    const ny = l.pad.top + l.h - ((ev.midi - l.minMidi) / l.midiRange) * l.h - l.noteH / 2;
    const nw = Math.max(l.beatW * ev.durationBeats - 1, 2);
    return { x: nx, y: ny, w: nw, h: l.noteH };
  }

  function hitTest(cssX, cssY) {
    if (!lastSong) return null;
    const l = getLayout();
    for (const ev of lastSong.events) {
      if (ev.type === 'drum') continue;
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

    if (dragMode === 'resize') {
      const beatDelta = (dx / l.w) * l.totalBeats;
      dragEvent.durationBeats = Math.max(0.25, dragEvent.durationBeats + beatDelta);
    } else {
      const beatDelta = (dx / l.w) * l.totalBeats;
      const midiDelta = -Math.round((dy / l.h) * l.midiRange);
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
      const beat = ((cssX - l.pad.left) / l.w) * l.totalBeats;
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

  function setLockedBars(set) {
    lockedBars = set;
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

    const pad = { top: 8, bottom: 8, left: 4, right: 4 };
    const w = cssW - pad.left - pad.right;
    const h = cssH - pad.top - pad.bottom;

    const pitchEvents = song.events.filter(e => e.type !== 'drum');
    const midiValues = pitchEvents.map(e => e.midi);
    const minMidi = Math.min(...midiValues) - 1;
    const maxMidi = Math.max(...midiValues) + 1;
    const midiRange = maxMidi - minMidi || 1;

    const totalBeats = song.lengthBeats;
    const beatW = w / totalBeats;
    const noteH = Math.min(h / midiRange, 10);

    function x(beat) { return pad.left + (beat / totalBeats) * w; }
    function y(midi) { return pad.top + h - ((midi - minMidi) / midiRange) * h - noteH / 2; }

    const gridBase = isLight ? '0,0,0' : '255,255,255';

    for (let bar = 0; bar < song.bars; bar++) {
      if (!lockedBars.has(bar)) continue;
      const bx = x(bar * song.beatsPerBar);
      const bw = beatW * song.beatsPerBar;
      ctx.fillStyle = colors.locked;
      ctx.fillRect(bx, pad.top, bw, h);
    }

    ctx.strokeStyle = `rgba(${gridBase},0.06)`;
    ctx.lineWidth = 1;
    for (let b = 0; b <= totalBeats; b++) {
      const bx = x(b);
      ctx.beginPath();
      ctx.moveTo(bx, pad.top);
      ctx.lineTo(bx, pad.top + h);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(${gridBase},0.15)`;
    for (let b = 0; b <= totalBeats; b += song.beatsPerBar) {
      const bx = x(b);
      ctx.beginPath();
      ctx.moveTo(bx, pad.top);
      ctx.lineTo(bx, pad.top + h);
      ctx.stroke();
    }

    if (song.sections) {
      ctx.font = '10px system-ui, sans-serif';
      ctx.textBaseline = 'top';
      const sectionColors = ['#5b8def', '#e8b528', '#5b8def', '#e8b528', '#5b8def', '#888888'];
      for (let si = 0; si < song.sections.length; si++) {
        const sec = song.sections[si];
        const sx = x(sec.startBeat);
        const sw = x(sec.startBeat + sec.lengthBeats) - sx;
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

    for (const ev of pitchEvents) {
      const nx = x(ev.atBeat);
      const ny = y(ev.midi);
      const nw = Math.max(beatW * ev.durationBeats - 1, 2);
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

    for (let bar = 0; bar < song.bars; bar++) {
      if (!lockedBars.has(bar)) continue;
      const barStart = bar * song.beatsPerBar;
      const cx = x(barStart + song.beatsPerBar / 2);
      const cy = pad.top + 12;
      drawLockIcon(ctx, cx, cy, 10, colors.accent);
    }

    if (playheadBeat >= 0 && playheadBeat < totalBeats) {
      const px = x(playheadBeat);
      ctx.strokeStyle = `rgba(${gridBase},0.6)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, pad.top);
      ctx.lineTo(px, pad.top + h);
      ctx.stroke();
    }
  }

  function setPlayhead(beat) {
    playheadBeat = beat;
  }

  return { render, setPlayhead, setLockedBars };
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
