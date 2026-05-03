const PPQ = 480;

function writeVLQ(value) {
  if (value < 0) throw new Error(`VLQ cannot be negative: ${value}`);
  const bytes = [value & 0x7F];
  value >>>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7F) | 0x80);
    value >>>= 7;
  }
  return bytes;
}

function ascii(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xFF);
  return out;
}

function writeUint32(v) {
  return [(v >>> 24) & 0xFF, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF];
}

function buildTrackNameEvent(name) {
  const nameBytes = ascii(name);
  return [...writeVLQ(0), 0xFF, 0x03, ...writeVLQ(nameBytes.length), ...nameBytes];
}

function buildEndOfTrack() {
  return [...writeVLQ(0), 0xFF, 0x2F, 0x00];
}

function wrapTrack(data) {
  return [...ascii('MTrk'), ...writeUint32(data.length), ...data];
}

function buildConductorTrack(bpm) {
  const data = [];
  // Track name
  data.push(...buildTrackNameEvent('Tempo'));
  // Tempo meta event
  const microsPerQuarter = Math.round(60_000_000 / bpm);
  data.push(...writeVLQ(0));
  data.push(0xFF, 0x51, 0x03,
    (microsPerQuarter >> 16) & 0xFF,
    (microsPerQuarter >> 8) & 0xFF,
    microsPerQuarter & 0xFF);
  // End of track
  data.push(...buildEndOfTrack());
  return wrapTrack(data);
}

function buildNoteTrack(name, channel, events) {
  const ch = channel & 0x0F;
  const evs = [];

  for (const ev of events) {
    const onTick = Math.round(ev.atBeat * PPQ);
    const offTick = Math.max(onTick + 1, Math.round((ev.atBeat + ev.durationBeats) * PPQ));
    const vel = Math.max(1, Math.min(127, Math.round((ev.velocity ?? 0.7) * 127)));
    const midi = ev.midi & 0x7F;
    evs.push({ tick: onTick, kind: 'on', midi, vel });
    evs.push({ tick: offTick, kind: 'off', midi, vel: 0 });
  }

  evs.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    if (a.kind === b.kind) return 0;
    return a.kind === 'off' ? -1 : 1;
  });

  const data = [];
  // Track name
  data.push(...buildTrackNameEvent(name));

  let lastTick = 0;
  for (const e of evs) {
    const delta = e.tick - lastTick;
    lastTick = e.tick;
    data.push(...writeVLQ(delta));
    if (e.kind === 'on') {
      data.push(0x90 | ch, e.midi, e.vel);
    } else {
      data.push(0x80 | ch, e.midi, 0);
    }
  }

  data.push(...buildEndOfTrack());
  return wrapTrack(data);
}

/** @param {Object} song @param {{ bpm?: number, tracks?: string[] }} [opts] @returns {Uint8Array} Standard MIDI File Format 1 (multi-track) */
export function songToMidi(song, { bpm = 120, tracks: trackFilter } = {}) {
  const allTrackDefs = [
    { name: 'Melody', channel: 0, type: 'melody' },
    { name: 'Chords', channel: 1, type: 'chord' },
    { name: 'Bass',   channel: 2, type: 'bass' },
    { name: 'Drums',  channel: 9, type: 'drum' },
  ];

  const trackDefs = trackFilter
    ? allTrackDefs.filter(def => trackFilter.includes(def.type))
    : allTrackDefs;

  // Group events by type
  const eventsByType = {};
  for (const ev of song.events) {
    if (!eventsByType[ev.type]) eventsByType[ev.type] = [];
    eventsByType[ev.type].push(ev);
  }

  const nTracks = 1 + trackDefs.length; // conductor + instrument tracks

  // MThd header: Format 1
  const header = [
    ...ascii('MThd'),
    ...writeUint32(6),        // header length
    0, 1,                     // format 1
    (nTracks >> 8) & 0xFF, nTracks & 0xFF,
    (PPQ >> 8) & 0xFF, PPQ & 0xFF,
  ];

  const midiTracks = [
    buildConductorTrack(bpm),
    ...trackDefs.map(def =>
      buildNoteTrack(def.name, def.channel, eventsByType[def.type] || [])
    ),
  ];

  // Concatenate everything
  const totalLength = header.length + midiTracks.reduce((sum, t) => sum + t.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const byte of header) result[offset++] = byte;
  for (const track of midiTracks) {
    for (const byte of track) result[offset++] = byte;
  }

  return result;
}
