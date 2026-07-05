import { harmonyTagFor } from './harmony.js';
import { keyFifths } from '../theory/scales.js';

const DIVISIONS = 4; // divisions per quarter note

// Two spellings per chromatic pitch class: sharp-wise for sharp keys
// (fifths >= 0) and flat-wise for flat keys (fifths < 0). Spelling to
// match the key signature is what lets in-key notes render without
// accidental glyphs (e.g. Ab in F minor sits on the signature's Ab).
const SHARP_STEP_MAP = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
const SHARP_ALTER_MAP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
const FLAT_STEP_MAP = ['C', 'D', 'D', 'E', 'E', 'F', 'G', 'G', 'A', 'A', 'B', 'B'];
const FLAT_ALTER_MAP = [0, -1, 0, -1, 0, 0, -1, 0, -1, 0, -1, 0];

const DURATION_TYPE_MAP = {
  4:    { type: 'whole',    divisions: 16, dot: false },
  3:    { type: 'half',     divisions: 12, dot: true },
  2:    { type: 'half',     divisions: 8,  dot: false },
  1.5:  { type: 'quarter',  divisions: 6,  dot: true },
  1:    { type: 'quarter',  divisions: 4,  dot: false },
  0.75: { type: 'eighth',   divisions: 3,  dot: true },
  0.5:  { type: 'eighth',   divisions: 2,  dot: false },
  0.25: { type: '16th',     divisions: 1,  dot: false },
};

const STANDARD_DURATIONS = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];

function quantizeDuration(beats) {
  if (beats <= 0) return 0.25;
  let best = 0.25;
  let bestDiff = Math.abs(beats - 0.25);
  for (const d of STANDARD_DURATIONS) {
    const diff = Math.abs(beats - d);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = d;
    }
  }
  return best;
}

function midiToPitch(midi, useFlats = false) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const step = useFlats ? FLAT_STEP_MAP[pc] : SHARP_STEP_MAP[pc];
  const alter = useFlats ? FLAT_ALTER_MAP[pc] : SHARP_ALTER_MAP[pc];
  return { step, alter, octave };
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildPitchXml(midi, useFlats) {
  const { step, alter, octave } = midiToPitch(midi, useFlats);
  let xml = `          <pitch>\n            <step>${step}</step>\n`;
  if (alter !== 0) xml += `            <alter>${alter}</alter>\n`;
  xml += `            <octave>${octave}</octave>\n          </pitch>`;
  return xml;
}

function buildNoteXml(midi, durationBeats, isChord, isRest, isDrum, beam, useFlats = false) {
  const qDur = quantizeDuration(durationBeats);
  const info = DURATION_TYPE_MAP[qDur];
  if (!info) return '';

  let xml = '        <note>\n';
  if (isChord) xml += '          <chord/>\n';

  if (isRest) {
    xml += '          <rest/>\n';
  } else if (isDrum) {
    const { step, octave } = midiToPitch(midi);
    xml += `          <unpitched>\n            <display-step>${step}</display-step>\n            <display-octave>${octave}</display-octave>\n          </unpitched>\n`;
  } else {
    xml += buildPitchXml(midi, useFlats) + '\n';
  }

  xml += `          <duration>${info.divisions}</duration>\n`;
  xml += `          <type>${info.type}</type>\n`;
  if (info.dot) xml += '          <dot/>\n';
  if (beam) xml += `          <beam number="1">${beam}</beam>\n`;
  xml += '        </note>\n';
  return xml;
}

function buildMeasureAttributes(beatsPerBar, isDrum, clefSign, fifths = 0) {
  const beatType = beatsPerBar === 6 ? 8 : 4;
  const beats = beatsPerBar;
  let xml = '        <attributes>\n';
  xml += `          <divisions>${DIVISIONS}</divisions>\n`;
  xml += `          <key>\n            <fifths>${fifths}</fifths>\n          </key>\n`;
  xml += `          <time>\n            <beats>${beats}</beats>\n            <beat-type>${beatType}</beat-type>\n          </time>\n`;
  if (isDrum) {
    xml += '          <clef>\n            <sign>percussion</sign>\n          </clef>\n';
  } else if (clefSign === 'F') {
    xml += '          <clef>\n            <sign>F</sign>\n            <line>4</line>\n          </clef>\n';
  } else if (clefSign === 'C') {
    xml += '          <clef>\n            <sign>C</sign>\n            <line>3</line>\n          </clef>\n';
  } else {
    xml += '          <clef>\n            <sign>G</sign>\n            <line>2</line>\n          </clef>\n';
  }
  xml += '        </attributes>\n';
  return xml;
}

function detectClef(events) {
  if (events.length === 0) return 'G';
  const avgMidi = events.reduce((s, e) => s + e.midi, 0) / events.length;
  return avgMidi < 55 ? 'F' : 'G';
}

function buildTempoDirection(bpm) {
  return `        <direction placement="above">
          <direction-type>
            <metronome>
              <beat-unit>quarter</beat-unit>
              <per-minute>${bpm}</per-minute>
            </metronome>
          </direction-type>
          <sound tempo="${bpm}"/>
        </direction>\n`;
}

function snapToGrid(beat, grid) {
  return Math.round(beat / grid) * grid;
}

function buildPartMeasures(events, beatsPerBar, totalBars, isDrum, bpm, isFirstPart, clefSign, chordSymbols, doubleBarsBefore, barFifths) {
  const GRID = 0.25;
  let xml = '';
  // Bar indices at which we draw a "light-light" (double) barline at the
  // LEFT side — i.e. before the bar. Set form for O(1) lookup.
  const doubleBars = new Set(doubleBarsBefore || []);

  for (let bar = 0; bar < totalBars; bar++) {
    const barStart = bar * beatsPerBar;
    const barEnd = barStart + beatsPerBar;
    const drawDoubleLeft = doubleBars.has(bar);
    const fifths = barFifths ? (barFifths[bar] ?? 0) : 0;
    const useFlats = fifths < 0;

    const harmonyXml = (chordSymbols && chordSymbols[bar])
      ? harmonyTagFor(chordSymbols[bar])
      : '';

    const barEvents = events
      .filter(ev => ev.atBeat >= barStart && ev.atBeat < barEnd)
      .map(ev => {
        const snappedLocal = snapToGrid(ev.atBeat - barStart, GRID);
        const snappedDur = snapToGrid(Math.min(ev.durationBeats, barEnd - ev.atBeat), GRID) || GRID;
        return { ...ev, localBeat: Math.min(snappedLocal, beatsPerBar - GRID), durationBeats: snappedDur };
      })
      .sort((a, b) => a.localBeat - b.localBeat || a.midi - b.midi);

    xml += `      <measure number="${bar + 1}">\n`;

    if (bar === 0) {
      xml += buildMeasureAttributes(beatsPerBar, isDrum, clefSign, fifths);
      if (isFirstPart) {
        xml += buildTempoDirection(bpm);
      }
    } else if (barFifths && barFifths[bar] !== barFifths[bar - 1]) {
      // Mid-piece key change (Practice acts modulate) — emit a fresh
      // key signature at the act boundary.
      xml += `        <attributes>\n          <key>\n            <fifths>${fifths}</fifths>\n          </key>\n        </attributes>\n`;
    }

    // Double-bar at the left edge of this bar (i.e. the divider between
    // sections / acts in the Practice studies).
    if (drawDoubleLeft) {
      xml += '        <barline location="left">\n          <bar-style>light-light</bar-style>\n        </barline>\n';
    }

    if (harmonyXml) xml += `        ${harmonyXml}\n`;

    if (barEvents.length === 0) {
      xml += '        <note>\n          <rest measure="yes"/>\n';
      xml += `          <duration>${beatsPerBar * DIVISIONS}</duration>\n`;
      xml += '        </note>\n';
    } else {
      let usedBeats = 0;
      const beatPositions = [...new Set(barEvents.map(ev => ev.localBeat))].sort((a, b) => a - b);

      const slots = [];
      for (const beatPos of beatPositions) {
        const notesAtBeat = barEvents.filter(ev => Math.abs(ev.localBeat - beatPos) < 0.001);
        const noteDur = quantizeDuration(notesAtBeat[0].durationBeats);
        slots.push({ beatPos, notes: notesAtBeat, dur: noteDur });
      }

      const beamable = (dur) => dur <= 0.5;
      for (let si = 0; si < slots.length; si++) {
        const slot = slots[si];
        if (slot.beatPos > usedBeats + 0.001) {
          xml += fillRestGap(slot.beatPos - usedBeats);
          usedBeats = slot.beatPos;
        }

        const cappedDur = Math.min(slot.dur, beatsPerBar - usedBeats);
        const finalDur = quantizeDuration(cappedDur);
        const beatGroup = Math.floor(slot.beatPos);

        let beam = null;
        if (beamable(finalDur) && !isDrum) {
          const prevAdj = si > 0 && Math.abs(slots[si - 1].beatPos + quantizeDuration(Math.min(slots[si - 1].dur, beatsPerBar)) - slot.beatPos) < 0.001;
          const prevBeamable = prevAdj && beamable(slots[si - 1].dur) && Math.floor(slots[si - 1].beatPos) === beatGroup;
          const nextAdj = si < slots.length - 1 && Math.abs(slot.beatPos + finalDur - slots[si + 1].beatPos) < 0.001;
          const nextBeamable = nextAdj && beamable(slots[si + 1].dur) && Math.floor(slots[si + 1].beatPos) === beatGroup;
          if (prevBeamable && nextBeamable) beam = 'continue';
          else if (!prevBeamable && nextBeamable) beam = 'begin';
          else if (prevBeamable && !nextBeamable) beam = 'end';
        }

        let isFirst = true;
        for (const ev of slot.notes) {
          xml += buildNoteXml(ev.midi, finalDur, !isFirst, false, isDrum, isFirst ? beam : null, useFlats);
          isFirst = false;
        }

        usedBeats += finalDur;
      }

      if (usedBeats < beatsPerBar - 0.001) {
        xml += fillRestGap(beatsPerBar - usedBeats);
      }
    }

    xml += '      </measure>\n';
  }

  return xml;
}

function fillRestGap(gapBeats) {
  let xml = '';
  let remaining = gapBeats;

  while (remaining > 0.001) {
    const qDur = quantizeDuration(remaining);
    // Don't overshoot
    const actualDur = Math.min(qDur, remaining);
    const finalDur = quantizeDuration(actualDur);
    const info = DURATION_TYPE_MAP[finalDur];
    if (!info || finalDur > remaining + 0.001) {
      // Find largest duration that fits
      let found = false;
      for (const d of STANDARD_DURATIONS) {
        if (d <= remaining + 0.001) {
          const dInfo = DURATION_TYPE_MAP[d];
          if (dInfo) {
            xml += buildNoteXml(0, d, false, true, false);
            remaining -= d;
            found = true;
            break;
          }
        }
      }
      if (!found) break;
    } else {
      xml += buildNoteXml(0, finalDur, false, true, false);
      remaining -= finalDur;
    }
  }

  return xml;
}

/**
 * @param {Object} song
 * @param {{ bpm?: number, tracks?: string[] }} [opts]
 * @returns {string} MusicXML document string
 */
// Optional `clefOverrides` is a `{ [partType]: 'G'|'F'|'C'|'treble'|'bass'|'alto' }`
// map. Anything missing falls back to detectClef. Friendly aliases ('treble',
// 'bass', 'alto') are normalised to the MusicXML letter codes.
function normaliseClef(sign) {
  if (!sign) return null;
  if (sign === 'treble') return 'G';
  if (sign === 'bass') return 'F';
  if (sign === 'alto' || sign === 'tenor') return 'C';
  return sign;
}

// `chordSymbols` is an optional array of strings indexed by bar number;
// when present, each non-empty entry adds a `<harmony>` tag to the first
// part's measure so OSMD renders the chord name above the staff.
//
// `keySignatures` is an optional array of `{ bar, fifths }` entries
// (sorted or not) declaring the key signature from that bar onward —
// Practice studies modulate between acts. When absent, a single
// signature is derived from `song.tonic` (MIDI or pitch class) +
// `song.scale` when the song carries them (the Generator does);
// otherwise C (fifths 0) is assumed. Notes are spelled flat-wise in
// flat keys and sharp-wise otherwise, so in-key notes render without
// accidental glyphs.
export function songToMusicXML(song, { bpm = 120, tracks: trackFilter, clefOverrides, chordSymbols, doubleBarsBefore, keySignatures } = {}) {
  const allPartDefs = [
    { id: 'P1', name: 'Melody',   type: 'melody',  drum: false },
    { id: 'P5', name: 'Melody 2', type: 'melody2', drum: false },
    { id: 'P2', name: 'Chords',   type: 'chord',   drum: false },
    { id: 'P3', name: 'Bass',     type: 'bass',     drum: false },
    { id: 'P4', name: 'Drums',    type: 'drum',     drum: true },
  ];

  const partDefs = trackFilter
    ? allPartDefs.filter(def => trackFilter.includes(def.type))
    : allPartDefs;

  const eventsByType = {};
  for (const ev of song.events) {
    if (!eventsByType[ev.type]) eventsByType[ev.type] = [];
    eventsByType[ev.type].push(ev);
  }

  const beatsPerBar = song.beatsPerBar || 4;
  const totalBars = song.bars || Math.ceil(song.lengthBeats / beatsPerBar);

  // Resolve the active key signature for every bar.
  let sigs = keySignatures;
  if (!sigs || sigs.length === 0) {
    if (typeof song.tonic === 'number' && typeof song.scale === 'string') {
      sigs = [{ bar: 0, fifths: keyFifths(((song.tonic % 12) + 12) % 12, song.scale) }];
    } else {
      sigs = [{ bar: 0, fifths: 0 }];
    }
  }
  const sorted = [...sigs].sort((a, b) => a.bar - b.bar);
  const barFifths = new Array(totalBars);
  let sigIdx = 0;
  let current = 0;
  for (let bar = 0; bar < totalBars; bar++) {
    while (sigIdx < sorted.length && sorted[sigIdx].bar <= bar) {
      current = sorted[sigIdx].fifths | 0;
      sigIdx++;
    }
    barFifths[bar] = current;
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n';
  xml += '<score-partwise version="4.0">\n';
  xml += '  <identification>\n';
  xml += '    <encoding>\n';
  xml += '      <software>SeedSong</software>\n';
  xml += '    </encoding>\n';
  xml += '  </identification>\n';

  // Part list
  xml += '  <part-list>\n';
  for (const part of partDefs) {
    xml += `    <score-part id="${part.id}">\n`;
    xml += `      <part-name>${escapeXml(part.name)}</part-name>\n`;
    xml += '    </score-part>\n';
  }
  xml += '  </part-list>\n';

  // Parts
  for (let i = 0; i < partDefs.length; i++) {
    const part = partDefs[i];
    const partEvents = eventsByType[part.type] || [];
    const override = normaliseClef(clefOverrides?.[part.type]);
    const clefSign = part.drum ? 'percussion' : (override || detectClef(partEvents));
    xml += `  <part id="${part.id}">\n`;
    // Chord symbols only attach to the first part — OSMD draws them once above the system.
    const partChords = i === 0 ? chordSymbols : null;
    xml += buildPartMeasures(partEvents, beatsPerBar, totalBars, part.drum, bpm, i === 0, clefSign, partChords, doubleBarsBefore, barFifths);
    xml += '  </part>\n';
  }

  xml += '</score-partwise>\n';
  return xml;
}
