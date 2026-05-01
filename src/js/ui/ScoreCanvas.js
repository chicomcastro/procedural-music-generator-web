/** @param {HTMLCanvasElement} canvas @param {{ onBarClick?: (barIndex: number) => void }} [options] */
export function createScoreCanvas(canvas, options = {}) {
  const ctx = canvas.getContext('2d');
  let playheadBeat = -1;
  let lockedBars = new Set();
  let lastSong = null;

  canvas.style.cursor = 'pointer';
  canvas.addEventListener('click', (e) => {
    if (!lastSong || !options.onBarClick) return;
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssW = canvas.clientWidth;
    const pad = { left: 4, right: 4 };
    const w = cssW - pad.left - pad.right;
    const totalBeats = lastSong.lengthBeats;
    const beat = ((cssX - pad.left) / w) * totalBeats;
    const barIndex = Math.floor(beat / lastSong.beatsPerBar);
    if (barIndex >= 0 && barIndex < lastSong.bars) {
      options.onBarClick(barIndex);
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
      locked: s.getPropertyValue('--locked-bg').trim(),
      accent: s.getPropertyValue('--accent').trim(),
      textPrimary: s.getPropertyValue('--text-primary').trim(),
    };
  }

  function render(song) {
    if (!song || !song.events.length) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    lastSong = song;
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

    const midiValues = song.events.map(e => e.midi);
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

    for (const ev of song.events) {
      const nx = x(ev.atBeat);
      const ny = y(ev.midi);
      const nw = Math.max(beatW * ev.durationBeats - 1, 2);
      ctx.fillStyle = ev.type === 'chord' ? colors.chord : colors.melody;
      ctx.beginPath();
      ctx.roundRect(nx, ny, nw, noteH, 2);
      ctx.fill();
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
