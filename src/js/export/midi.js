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

export function songToMidi(song, { bpm = 120, channel = 0 } = {}) {
  const ch = channel & 0x0F;
  const evs = [];

  for (const ev of song.events) {
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

  const track = [];
  let lastTick = 0;

  const microsPerQuarter = Math.round(60_000_000 / bpm);
  track.push(...writeVLQ(0));
  track.push(0xFF, 0x51, 0x03,
    (microsPerQuarter >> 16) & 0xFF,
    (microsPerQuarter >> 8) & 0xFF,
    microsPerQuarter & 0xFF);

  for (const e of evs) {
    const delta = e.tick - lastTick;
    lastTick = e.tick;
    track.push(...writeVLQ(delta));
    if (e.kind === 'on') {
      track.push(0x90 | ch, e.midi, e.vel);
    } else {
      track.push(0x80 | ch, e.midi, 0);
    }
  }

  track.push(...writeVLQ(0));
  track.push(0xFF, 0x2F, 0x00);

  const header = [
    ...ascii('MThd'),
    0, 0, 0, 6,
    0, 0,
    0, 1,
    (PPQ >> 8) & 0xFF, PPQ & 0xFF,
  ];

  const trackHeader = [
    ...ascii('MTrk'),
    (track.length >>> 24) & 0xFF,
    (track.length >>> 16) & 0xFF,
    (track.length >>> 8) & 0xFF,
    track.length & 0xFF,
  ];

  return new Uint8Array([...header, ...trackHeader, ...track]);
}
