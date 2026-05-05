/* ---- Constants ---- */
const STAFF_SPACING = 8;
const NOTE_HEAD_W = STAFF_SPACING * 1.3;
const NOTE_HEAD_H = STAFF_SPACING * 0.9;
const STEM_LENGTH = STAFF_SPACING * 3.5;
const MARGIN_LEFT = 60;
const SYSTEM_GAP = STAFF_SPACING * 8;
const STAFF_HEIGHT = STAFF_SPACING * 4; // 5 lines = 4 gaps
const GRAND_STAFF_GAP = STAFF_SPACING * 4;
const SYSTEM_TOP_PAD = 20;
const SYSTEM_BOTTOM_PAD = 10;

/* ---- Duration quantization (from musicxml.js) ---- */
const STANDARD_DURATIONS = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];

function quantizeDuration(beats) {
  if (beats <= 0) return 0.25;
  let best = 0.25;
  let bestDiff = Math.abs(beats - 0.25);
  for (const d of STANDARD_DURATIONS) {
    const diff = Math.abs(beats - d);
    if (diff < bestDiff) { bestDiff = diff; best = d; }
  }
  return best;
}

/* ---- Note name mapping ---- */
const NOTE_NAMES_DIATONIC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // C=0..B=6
const IS_SHARP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];

/* ---- Key signature data ---- */
// Fifths circle for major keys: tonic PC -> number of sharps (+) or flats (-)
const MAJOR_FIFTHS = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 5: -1, 10: -2, 3: -3, 8: -4, 1: -5 };

// Relative major for common scale types (interval from tonic to relative major root)
const RELATIVE_MAJOR_OFFSET = {
  major: 0, natural_minor: 3, harmonic_minor: 3, melodic_minor: 3,
  dorian: 10, phrygian: 8, lydian: 5, mixolydian: 7, locrian: 1,
};

// Sharp order and flat order on staff (treble clef staff positions from bottom line=0)
const SHARP_POSITIONS_TREBLE = [10, 7, 11, 8, 5, 9, 6]; // F C G D A E B
const FLAT_POSITIONS_TREBLE = [6, 9, 5, 8, 4, 7, 3];    // B E A D G C F
const SHARP_POSITIONS_BASS = [8, 5, 9, 6, 3, 7, 4];
const FLAT_POSITIONS_BASS = [4, 7, 3, 6, 2, 5, 1];

// Pitch classes in key for a given number of fifths
function keySigPitchClasses(fifths) {
  if (fifths === 0) return new Set([0, 2, 4, 5, 7, 9, 11]);
  const pcs = new Set([0, 2, 4, 5, 7, 9, 11]); // C major
  if (fifths > 0) {
    const sharpOrder = [5, 0, 7, 2, 9, 4, 11]; // F C G D A E B -> sharped
    for (let i = 0; i < fifths && i < 7; i++) {
      pcs.delete(sharpOrder[i]);
      pcs.add((sharpOrder[i] + 1) % 12);
    }
  } else {
    const flatOrder = [11, 4, 9, 2, 7, 0, 5]; // B E A D G C F -> flatted
    for (let i = 0; i < -fifths && i < 7; i++) {
      pcs.delete(flatOrder[i]);
      pcs.add((flatOrder[i] + 11) % 12);
    }
  }
  return pcs;
}

/** Convert MIDI to diatonic staff position.
 *  Even = on a line, odd = in a space.
 *  Treble: B4 (midi 71, diatonic 34) -> position 6 (middle line)
 *  Bass: D3 (midi 50, diatonic 22) -> position 6 (middle line)
 */
function midiToStaffPos(midi, clef) {
  const octave = Math.floor(midi / 12) - 1;
  const pc = ((midi % 12) + 12) % 12;
  const diatonic = octave * 7 + NOTE_NAMES_DIATONIC[pc];
  return clef === 'treble' ? diatonic - 28 : diatonic - 16;
}

/** Determine if a MIDI note needs an accidental given the key signature fifths.
 *  Returns: null (no accidental needed), '#', 'b', or 'n' (natural).
 */
function needsAccidental(midi, fifths, measureAccidentals) {
  const pc = ((midi % 12) + 12) % 12;
  const keyPCs = keySigPitchClasses(fifths);
  const diatonicPC = NOTE_NAMES_DIATONIC[pc];
  const octave = Math.floor(midi / 12) - 1;
  const noteKey = `${diatonicPC}-${octave}-${pc}`;

  // Check if already shown in this measure
  if (measureAccidentals.has(noteKey)) return null;

  const inKey = keyPCs.has(pc);
  if (inKey) {
    // Check if we need a natural (courtesy) - the natural diatonic note is in key
    // If a previous accidental was applied to the same letter in this measure
    const letterKey = `${diatonicPC}-${octave}`;
    if (measureAccidentals.has(letterKey + '-altered')) {
      measureAccidentals.set(noteKey, true);
      return 'n';
    }
    return null;
  }

  // Not in key - need sharp or flat
  measureAccidentals.set(noteKey, true);
  measureAccidentals.set(`${diatonicPC}-${octave}-altered`, true);
  return IS_SHARP[pc] ? '#' : 'b';
}

function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    melody: s.getPropertyValue('--melody-color').trim(),
    melody2: s.getPropertyValue('--melody-color').trim(), // same as melody for now
    chord: s.getPropertyValue('--chord-color').trim(),
    bass: s.getPropertyValue('--bass-color').trim(),
    accent: s.getPropertyValue('--accent').trim(),
    textPrimary: s.getPropertyValue('--text-primary').trim(),
    textSecondary: s.getPropertyValue('--text-secondary').trim(),
    border: s.getPropertyValue('--border').trim(),
    bgCard: s.getPropertyValue('--bg-card').trim(),
  };
}

function getFifths(tonic, scale) {
  const offset = RELATIVE_MAJOR_OFFSET[scale];
  if (offset == null) return 0; // pentatonic, blues - no standard key sig
  const majorRoot = ((tonic % 12) + offset) % 12;
  return MAJOR_FIFTHS[majorRoot] ?? 0;
}

/** @param {HTMLCanvasElement} canvas @param {Object} [_options] */
export function createSheetMusic(canvas, _options = {}) {
  const ctx = canvas.getContext('2d');
  let playheadBeat = -1;
  let lastSong = null;
  let lastOpts = null;
  let rafPending = false;
  let scrollY = 0;
  let totalContentHeight = 0;

  /* ---- Track visibility ---- */
  let visibleTracks = new Set(['melody', 'melody2', 'chord', 'bass']);

  function setVisibleTracks(trackSet) {
    visibleTracks = trackSet;
  }

  /* ---- Scroll handling ---- */
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    scrollY = Math.max(0, Math.min(scrollY + e.deltaY, Math.max(0, totalContentHeight - canvas.clientHeight)));
    requestRender();
  }, { passive: false });

  let touchStartY = 0;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) touchStartY = e.touches[0].clientY;
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      const dy = touchStartY - e.touches[0].clientY;
      touchStartY = e.touches[0].clientY;
      scrollY = Math.max(0, Math.min(scrollY + dy, Math.max(0, totalContentHeight - canvas.clientHeight)));
      requestRender();
    }
  }, { passive: true });

  function requestRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      if (lastSong && lastOpts) actualRender(lastSong, lastOpts);
    });
  }

  function render(song, opts) {
    if (!song || !song.events.length) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    lastSong = song;
    lastOpts = opts || lastOpts || {};
    requestRender();
  }

  function setPlayhead(beat) {
    playheadBeat = beat;
    requestRender();
  }

  /* ---- Main render ---- */
  function actualRender(song, opts) {
    const colors = getThemeColors();
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const { beatsPerBar = 4, tonic = 0, scale = 'major' } = opts;
    const fifths = getFifths(tonic, scale);
    const keySigWidth = Math.abs(fifths) * 8 + 4;

    // Separate events by staff
    const trebleEvents = song.events.filter(e =>
      visibleTracks.has(e.type) && (e.type === 'melody' || e.type === 'melody2')
    );
    const bassEvents = song.events.filter(e =>
      visibleTracks.has(e.type) && (e.type === 'bass' || e.type === 'chord')
    );

    // Measures
    const totalBeats = song.lengthBeats;
    const totalMeasures = Math.ceil(totalBeats / beatsPerBar);

    // Calculate measure widths and lay out systems
    const availableW = cssW - 10;
    const firstMeasureExtra = MARGIN_LEFT + keySigWidth;
    const normalMeasureW = Math.max(beatsPerBar * 30, 80);

    // Build systems (lines of measures)
    const systems = [];
    let currentSystem = { measures: [], startMeasure: 0, isFirst: true };
    let currentLineW = firstMeasureExtra;

    for (let m = 0; m < totalMeasures; m++) {
      const mw = normalMeasureW;
      if (currentSystem.measures.length > 0 && currentLineW + mw > availableW) {
        systems.push(currentSystem);
        currentSystem = { measures: [], startMeasure: m, isFirst: false };
        currentLineW = MARGIN_LEFT + keySigWidth;
      }
      currentSystem.measures.push(m);
      currentLineW += mw;
    }
    if (currentSystem.measures.length > 0) systems.push(currentSystem);

    // Calculate total height
    const systemHeight = SYSTEM_TOP_PAD + STAFF_HEIGHT + GRAND_STAFF_GAP + STAFF_HEIGHT + SYSTEM_BOTTOM_PAD;
    totalContentHeight = systems.length * (systemHeight + SYSTEM_GAP) - SYSTEM_GAP + 20;

    // Clamp scroll
    scrollY = Math.max(0, Math.min(scrollY, Math.max(0, totalContentHeight - cssH)));

    const staffLineColor = isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)';
    const noteColor = isLight ? '#1f2328' : '#e6edf3';

    // Render each system
    for (let si = 0; si < systems.length; si++) {
      const sys = systems[si];
      const sysY = si * (systemHeight + SYSTEM_GAP) + 10 - scrollY;

      // Skip systems entirely off screen
      if (sysY + systemHeight + SYSTEM_GAP < 0) continue;
      if (sysY > cssH) break;

      const trebleTopY = sysY + SYSTEM_TOP_PAD;
      const bassTopY = trebleTopY + STAFF_HEIGHT + GRAND_STAFF_GAP;

      // Calculate measure X positions for this system
      const prefix = MARGIN_LEFT + keySigWidth;
      const measuresInSystem = sys.measures.length;
      const totalMeasureSpace = availableW - prefix;
      const measureW = totalMeasureSpace / measuresInSystem;

      // Draw staff lines
      drawStaffLines(ctx, 5, trebleTopY, availableW, staffLineColor);
      drawStaffLines(ctx, 5, bassTopY, availableW, staffLineColor);

      // Draw brace / bracket
      drawBracket(ctx, 3, trebleTopY, bassTopY + STAFF_HEIGHT, noteColor);

      // Draw clefs
      drawTrebleClef(ctx, 12, trebleTopY, noteColor);
      drawBassClef(ctx, 12, bassTopY, noteColor);

      // Draw key signature
      const keySigX = 38;
      drawKeySignature(ctx, keySigX, trebleTopY, fifths, 'treble', noteColor);
      drawKeySignature(ctx, keySigX, bassTopY, fifths, 'bass', noteColor);

      // Draw time signature (first system only)
      if (si === 0) {
        const timeSigX = keySigX + keySigWidth + 4;
        drawTimeSignature(ctx, timeSigX, trebleTopY, beatsPerBar, noteColor);
        drawTimeSignature(ctx, timeSigX, bassTopY, beatsPerBar, noteColor);
      }

      // Draw barlines and notes per measure
      for (let mi = 0; mi < measuresInSystem; mi++) {
        const measureIndex = sys.measures[mi];
        const mx = prefix + mi * measureW;
        const measureStartBeat = measureIndex * beatsPerBar;
        const measureEndBeat = Math.min(measureStartBeat + beatsPerBar, totalBeats);

        // Barline at start
        ctx.strokeStyle = staffLineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mx, trebleTopY);
        ctx.lineTo(mx, trebleTopY + STAFF_HEIGHT);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mx, bassTopY);
        ctx.lineTo(mx, bassTopY + STAFF_HEIGHT);
        ctx.stroke();

        // Final barline
        if (mi === measuresInSystem - 1) {
          const endX = prefix + (mi + 1) * measureW;
          ctx.strokeStyle = staffLineColor;
          ctx.lineWidth = measureIndex === totalMeasures - 1 ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(endX, trebleTopY);
          ctx.lineTo(endX, trebleTopY + STAFF_HEIGHT);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(endX, bassTopY);
          ctx.lineTo(endX, bassTopY + STAFF_HEIGHT);
          ctx.stroke();
          ctx.lineWidth = 1;
        }

        // Playhead highlight
        if (playheadBeat >= 0 && playheadBeat >= measureStartBeat && playheadBeat < measureEndBeat) {
          const phFrac = (playheadBeat - measureStartBeat) / beatsPerBar;
          const phX = mx + phFrac * measureW;

          // Highlight measure background
          ctx.fillStyle = isLight ? 'rgba(45,166,114,0.06)' : 'rgba(68,170,136,0.06)';
          ctx.fillRect(mx, trebleTopY - 2, measureW, STAFF_HEIGHT + GRAND_STAFF_GAP + STAFF_HEIGHT + 4);

          // Playhead line
          ctx.strokeStyle = colors.accent;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(phX, trebleTopY - 2);
          ctx.lineTo(phX, bassTopY + STAFF_HEIGHT + 2);
          ctx.stroke();
          ctx.lineWidth = 1;
        }

        // Render notes - treble
        const measureAccTreble = new Map();
        const trebleInMeasure = trebleEvents
          .filter(e => e.atBeat >= measureStartBeat && e.atBeat < measureEndBeat)
          .sort((a, b) => a.atBeat - b.atBeat);

        for (const ev of trebleInMeasure) {
          const beatInMeasure = ev.atBeat - measureStartBeat;
          const nx = mx + (beatInMeasure / beatsPerBar) * measureW + 10;
          const pos = midiToStaffPos(ev.midi, 'treble');
          const ny = staffPosToY(pos, trebleTopY);
          const dur = quantizeDuration(Math.min(ev.durationBeats, measureEndBeat - ev.atBeat));
          const acc = needsAccidental(ev.midi, fifths, measureAccTreble);
          const color = ev.type === 'melody2' ? colors.melody2 : colors.melody;
          const stemUp = pos < 6;
          drawNote(ctx, nx, ny, dur, stemUp, acc, color, noteColor, pos, trebleTopY);
        }

        // Render notes - bass
        const measureAccBass = new Map();
        const bassInMeasure = bassEvents
          .filter(e => e.atBeat >= measureStartBeat && e.atBeat < measureEndBeat)
          .sort((a, b) => a.atBeat - b.atBeat);

        for (const ev of bassInMeasure) {
          const beatInMeasure = ev.atBeat - measureStartBeat;
          const nx = mx + (beatInMeasure / beatsPerBar) * measureW + 10;
          const pos = midiToStaffPos(ev.midi, 'bass');
          const ny = staffPosToY(pos, bassTopY);
          const dur = quantizeDuration(Math.min(ev.durationBeats, measureEndBeat - ev.atBeat));
          const acc = needsAccidental(ev.midi, fifths, measureAccBass);
          const color = ev.type === 'chord' ? colors.chord : colors.bass;
          const stemUp = pos < 6;
          drawNote(ctx, nx, ny, dur, stemUp, acc, color, noteColor, pos, bassTopY);
        }

        // Measure number
        if (mi === 0 || measureIndex % 4 === 0) {
          ctx.fillStyle = colors.textSecondary;
          ctx.font = `9px system-ui, sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(String(measureIndex + 1), mx + 2, trebleTopY - 3);
        }
      }
    }
  }

  /** Convert staff position to pixel Y. Position 0 = first ledger line below staff.
   *  Position 2 = bottom line, 4 = second line, ..., 10 = top line.
   */
  function staffPosToY(pos, staffTopY) {
    // Top line is position 10, bottom line is position 2
    // staffTopY is the top line Y
    // Each position step = STAFF_SPACING / 2
    return staffTopY + (10 - pos) * (STAFF_SPACING / 2);
  }

  function drawStaffLines(ctx, x, topY, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const ly = topY + i * STAFF_SPACING;
      ctx.beginPath();
      ctx.moveTo(x, ly);
      ctx.lineTo(x + width - 10, ly);
      ctx.stroke();
    }
  }

  function drawBracket(ctx, x, topY, bottomY, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, bottomY);
    ctx.stroke();

    // Top/bottom serifs
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x + 6, topY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, bottomY);
    ctx.lineTo(x + 6, bottomY);
    ctx.stroke();
  }

  function drawTrebleClef(ctx, x, staffTopY, color) {
    // Try Unicode treble clef first, fallback to simple drawn version
    ctx.fillStyle = color;
    ctx.font = '32px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const midY = staffTopY + STAFF_HEIGHT / 2;
    // Unicode treble clef
    ctx.fillText('\u{1D11E}', x + 10, midY);
  }

  function drawBassClef(ctx, x, staffTopY, color) {
    ctx.fillStyle = color;
    ctx.font = '26px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const midY = staffTopY + STAFF_HEIGHT / 2;
    ctx.fillText('\u{1D122}', x + 10, midY);
  }

  function drawKeySignature(ctx, startX, staffTopY, fifths, clef, color) {
    if (fifths === 0) return;
    ctx.fillStyle = color;
    ctx.font = '14px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const positions = fifths > 0
      ? (clef === 'treble' ? SHARP_POSITIONS_TREBLE : SHARP_POSITIONS_BASS)
      : (clef === 'treble' ? FLAT_POSITIONS_TREBLE : FLAT_POSITIONS_BASS);
    const symbol = fifths > 0 ? '♯' : '♭';
    const count = Math.abs(fifths);

    for (let i = 0; i < count && i < 7; i++) {
      const pos = positions[i];
      const y = staffPosToY(pos, staffTopY);
      ctx.fillText(symbol, startX + i * 8, y);
    }
  }

  function drawTimeSignature(ctx, x, staffTopY, beatsPerBar, color) {
    ctx.fillStyle = color;
    ctx.font = 'bold 14px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const topNum = String(beatsPerBar);
    const bottomNum = beatsPerBar === 6 ? '8' : '4';

    const line2Y = staffTopY + STAFF_SPACING;       // between line 1 and 2
    const line4Y = staffTopY + STAFF_SPACING * 3;   // between line 4 and 5

    ctx.fillText(topNum, x, line2Y);
    ctx.fillText(bottomNum, x, line4Y);
  }

  function drawNote(ctx, x, y, duration, stemUp, accidental, trackColor, noteColor, staffPos, staffTopY) {
    const filled = duration <= 1;   // quarter and shorter = filled
    const hasStem = duration < 4;   // whole = no stem
    const hw = NOTE_HEAD_W / 2;
    const hh = NOTE_HEAD_H / 2;

    // Draw ledger lines if needed
    drawLedgerLines(ctx, x, staffPos, staffTopY, noteColor);

    // Draw accidental
    if (accidental) {
      ctx.fillStyle = noteColor;
      ctx.font = '12px serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const accSymbol = accidental === '#' ? '♯' : accidental === 'b' ? '♭' : '♮';
      ctx.fillText(accSymbol, x - hw - 2, y);
    }

    // Note head
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.15); // slight tilt
    ctx.beginPath();
    ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);

    if (filled) {
      ctx.fillStyle = trackColor;
      ctx.fill();
    } else {
      ctx.strokeStyle = trackColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // Stem
    if (hasStem) {
      ctx.strokeStyle = trackColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (stemUp) {
        ctx.moveTo(x + hw, y);
        ctx.lineTo(x + hw, y - STEM_LENGTH);
      } else {
        ctx.moveTo(x - hw, y);
        ctx.lineTo(x - hw, y + STEM_LENGTH);
      }
      ctx.stroke();

      // Flags for eighth and sixteenth
      if (duration <= 0.5) {
        const flagCount = duration <= 0.25 ? 2 : 1;
        for (let f = 0; f < flagCount; f++) {
          const fy = stemUp ? y - STEM_LENGTH + f * 6 : y + STEM_LENGTH - f * 6;
          const dir = stemUp ? 1 : -1;
          const fx = stemUp ? x + hw : x - hw;
          ctx.strokeStyle = trackColor;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.quadraticCurveTo(fx + 8, fy + dir * 4, fx + 6, fy + dir * 10);
          ctx.stroke();
        }
      }
    }
  }

  function drawLedgerLines(ctx, x, pos, staffTopY, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    const hw = NOTE_HEAD_W / 2 + 3;

    // Ledger lines below staff (pos < 2)
    if (pos < 2) {
      for (let p = 0; p >= pos; p -= 2) {
        const ly = staffPosToY(p, staffTopY);
        ctx.beginPath();
        ctx.moveTo(x - hw, ly);
        ctx.lineTo(x + hw, ly);
        ctx.stroke();
      }
    }

    // Ledger lines above staff (pos > 10)
    if (pos > 10) {
      for (let p = 12; p <= pos; p += 2) {
        const ly = staffPosToY(p, staffTopY);
        ctx.beginPath();
        ctx.moveTo(x - hw, ly);
        ctx.lineTo(x + hw, ly);
        ctx.stroke();
      }
    }
  }

  return { render, setPlayhead, setVisibleTracks };
}
