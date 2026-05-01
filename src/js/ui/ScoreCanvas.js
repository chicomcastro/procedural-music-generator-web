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

  function render(song) {
    if (!song || !song.events.length) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    lastSong = song;

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

    // locked bar backgrounds
    for (let bar = 0; bar < song.bars; bar++) {
      if (!lockedBars.has(bar)) continue;
      const bx = x(bar * song.beatsPerBar);
      const bw = beatW * song.beatsPerBar;
      ctx.fillStyle = 'rgba(74, 170, 136, 0.08)';
      ctx.fillRect(bx, pad.top, bw, h);
    }

    // beat grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let b = 0; b <= totalBeats; b++) {
      const bx = x(b);
      ctx.beginPath();
      ctx.moveTo(bx, pad.top);
      ctx.lineTo(bx, pad.top + h);
      ctx.stroke();
    }

    // bar lines
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    for (let b = 0; b <= totalBeats; b += song.beatsPerBar) {
      const bx = x(b);
      ctx.beginPath();
      ctx.moveTo(bx, pad.top);
      ctx.lineTo(bx, pad.top + h);
      ctx.stroke();
    }

    // notes
    for (const ev of song.events) {
      const nx = x(ev.atBeat);
      const ny = y(ev.midi);
      const nw = Math.max(beatW * ev.durationBeats - 1, 2);

      if (ev.type === 'chord') {
        ctx.fillStyle = 'rgba(74, 170, 136, 0.35)';
      } else {
        ctx.fillStyle = 'rgba(255, 213, 74, 0.85)';
      }
      ctx.beginPath();
      ctx.roundRect(nx, ny, nw, noteH, 2);
      ctx.fill();
    }

    // lock icons
    for (let bar = 0; bar < song.bars; bar++) {
      if (!lockedBars.has(bar)) continue;
      const barStart = bar * song.beatsPerBar;
      const cx = x(barStart + song.beatsPerBar / 2);
      const cy = pad.top + 12;
      drawLockIcon(ctx, cx, cy, 10);
    }

    // playhead
    if (playheadBeat >= 0 && playheadBeat < totalBeats) {
      const px = x(playheadBeat);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
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

function drawLockIcon(ctx, cx, cy, size) {
  const s = size;
  const bodyW = s * 0.7;
  const bodyH = s * 0.5;
  const bodyX = cx - bodyW / 2;
  const bodyY = cy;

  ctx.fillStyle = 'rgba(74, 170, 136, 0.6)';
  ctx.beginPath();
  ctx.roundRect(bodyX, bodyY, bodyW, bodyH, 1.5);
  ctx.fill();

  ctx.strokeStyle = 'rgba(74, 170, 136, 0.6)';
  ctx.lineWidth = 1.5;
  const shackleW = s * 0.4;
  ctx.beginPath();
  ctx.arc(cx, bodyY, shackleW / 2, Math.PI, 0);
  ctx.stroke();
}
