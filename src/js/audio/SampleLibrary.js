const SAMPLE_FILES = {
  48: 'C3.mp3',
  49: 'Db3.mp3',
  50: 'D3.mp3',
  51: 'Eb3.mp3',
  52: 'E3.mp3',
  53: 'F3.mp3',
  54: 'Gb3.mp3',
  55: 'G3.mp3',
  56: 'Ab3.mp3',
  57: 'A3.mp3',
  58: 'Bb3.mp3',
  59: 'B3.mp3',
};

const buffers = new Map();

export async function loadAll(ctx, baseUrl = 'sounds/') {
  const entries = Object.entries(SAMPLE_FILES);
  await Promise.all(entries.map(async ([midi, file]) => {
    const res = await fetch(baseUrl + file);
    if (!res.ok) throw new Error(`Failed to fetch ${file}: ${res.status}`);
    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    buffers.set(Number(midi), buf);
  }));
  return buffers;
}

export function getPlaybackFor(midi) {
  if (buffers.size === 0) {
    throw new Error('SampleLibrary not loaded; call loadAll() first');
  }
  let nearest = null;
  let bestDist = Infinity;
  for (const sampleMidi of buffers.keys()) {
    const dist = Math.abs(sampleMidi - midi);
    if (dist < bestDist) {
      bestDist = dist;
      nearest = sampleMidi;
    }
  }
  return {
    buffer: buffers.get(nearest),
    playbackRate: 2 ** ((midi - nearest) / 12),
  };
}

export function getLoadedMidiNumbers() {
  return [...buffers.keys()].sort((a, b) => a - b);
}
