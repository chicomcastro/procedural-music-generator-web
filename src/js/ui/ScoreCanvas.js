/** @param {HTMLCanvasElement} canvas */
export function createScoreCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  let playheadBeat = -1;

  function render(song) {
    if (!song || !song.events.length) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

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

  return { render, setPlayhead };
}
