const DIVISIONS = 4; // divisions per quarter note

const STEP_MAP = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
const ALTER_MAP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];

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

function midiToPitch(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const step = STEP_MAP[pc];
  const alter = ALTER_MAP[pc];
  return { step, alter, octave };
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildPitchXml(midi) {
  const { step, alter, octave } = midiToPitch(midi);
  let xml = `          <pitch>\n            <step>${step}</step>\n`;
  if (alter !== 0) xml += `            <alter>${alter}</alter>\n`;
  xml += `            <octave>${octave}</octave>\n          </pitch>`;
  return xml;
}

function buildNoteXml(midi, durationBeats, isChord, isRest, isDrum) {
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
    xml += buildPitchXml(midi) + '\n';
  }

  xml += `          <duration>${info.divisions}</duration>\n`;
  xml += `          <type>${info.type}</type>\n`;
  if (info.dot) xml += '          <dot/>\n';
  xml += '        </note>\n';
  return xml;
}

function buildMeasureAttributes(beatsPerBar, isDrum) {
  const beatType = beatsPerBar === 6 ? 8 : 4;
  const beats = beatsPerBar;
  let xml = '        <attributes>\n';
  xml += `          <divisions>${DIVISIONS}</divisions>\n`;
  xml += '          <key>\n            <fifths>0</fifths>\n          </key>\n';
  xml += `          <time>\n            <beats>${beats}</beats>\n            <beat-type>${beatType}</beat-type>\n          </time>\n`;
  if (isDrum) {
    xml += '          <clef>\n            <sign>percussion</sign>\n          </clef>\n';
  } else {
    xml += '          <clef>\n            <sign>G</sign>\n            <line>2</line>\n          </clef>\n';
  }
  xml += '        </attributes>\n';
  return xml;
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

function buildPartMeasures(events, beatsPerBar, totalBars, isDrum, bpm, isFirstPart) {
  let xml = '';

  for (let bar = 0; bar < totalBars; bar++) {
    const barStart = bar * beatsPerBar;
    const barEnd = barStart + beatsPerBar;

    // Gather events for this bar, sorted by beat
    const barEvents = events
      .filter(ev => ev.atBeat >= barStart && ev.atBeat < barEnd)
      .map(ev => ({
        ...ev,
        localBeat: ev.atBeat - barStart,
        // Truncate duration at bar boundary
        durationBeats: Math.min(ev.durationBeats, barEnd - ev.atBeat),
      }))
      .sort((a, b) => a.localBeat - b.localBeat || a.midi - b.midi);

    xml += `      <measure number="${bar + 1}">\n`;

    if (bar === 0) {
      xml += buildMeasureAttributes(beatsPerBar, isDrum);
      if (isFirstPart) {
        xml += buildTempoDirection(bpm);
      }
    }

    if (barEvents.length === 0) {
      // Whole-bar rest
      const restDur = quantizeDuration(beatsPerBar);
      const info = DURATION_TYPE_MAP[restDur];
      if (info) {
        xml += '        <note>\n          <rest measure="yes"/>\n';
        xml += `          <duration>${beatsPerBar * DIVISIONS}</duration>\n`;
        xml += '        </note>\n';
      }
    } else {
      // Group events by beat position for chord detection
      let currentBeat = 0;

      // Collect unique beat positions
      const beatPositions = [...new Set(barEvents.map(ev => ev.localBeat))].sort((a, b) => a - b);

      for (const beatPos of beatPositions) {
        // Fill gap with rest if needed
        if (beatPos > currentBeat + 0.001) {
          const gapBeats = beatPos - currentBeat;
          xml += fillRestGap(gapBeats);
        }

        const notesAtBeat = barEvents.filter(ev => Math.abs(ev.localBeat - beatPos) < 0.001);
        let isFirst = true;
        for (const ev of notesAtBeat) {
          xml += buildNoteXml(ev.midi, ev.durationBeats, !isFirst, false, isDrum);
          isFirst = false;
        }

        // Advance current beat by the first note's quantized duration
        const firstDur = quantizeDuration(notesAtBeat[0].durationBeats);
        currentBeat = beatPos + firstDur;
      }

      // Fill trailing rest
      if (currentBeat < beatsPerBar - 0.001) {
        const gapBeats = beatsPerBar - currentBeat;
        xml += fillRestGap(gapBeats);
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
 * @param {{ bpm?: number }} [opts]
 * @returns {string} MusicXML document string
 */
export function songToMusicXML(song, { bpm = 120 } = {}) {
  const partDefs = [
    { id: 'P1', name: 'Melody', type: 'melody', drum: false },
    { id: 'P2', name: 'Chords', type: 'chord',  drum: false },
    { id: 'P3', name: 'Bass',   type: 'bass',   drum: false },
    { id: 'P4', name: 'Drums',  type: 'drum',   drum: true },
  ];

  const eventsByType = {};
  for (const ev of song.events) {
    if (!eventsByType[ev.type]) eventsByType[ev.type] = [];
    eventsByType[ev.type].push(ev);
  }

  const beatsPerBar = song.beatsPerBar || 4;
  const totalBars = song.bars || Math.ceil(song.lengthBeats / beatsPerBar);

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
    xml += `  <part id="${part.id}">\n`;
    xml += buildPartMeasures(partEvents, beatsPerBar, totalBars, part.drum, bpm, i === 0);
    xml += '  </part>\n';
  }

  xml += '</score-partwise>\n';
  return xml;
}
