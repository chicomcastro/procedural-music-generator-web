import { mulberry32, randomSeed } from './rng.js';
import { generateProgression } from './progression.js';
import { generateRhythm } from './rhythm.js';
import { generateMelody } from './melody.js';

function generateDrums(rng, { bars, beatsPerBar, density, beatOffset = 0 }) {
  const events = [];
  const totalBeats = bars * beatsPerBar;
  const drumThreshold = 0.25 + (1 - density) * 0.4;

  for (let beat = 0; beat < totalBeats; beat++) {
    const posInBar = beat % beatsPerBar;
    const barIndex = Math.floor(beat / beatsPerBar);
    const isFillBar = barIndex === bars - 1;
    const isLastTwoBeats = isFillBar && posInBar >= beatsPerBar - 2;
    const ab = beat + beatOffset;

    if (posInBar === 0) {
      events.push({ type: 'drum', drum: 'kick', atBeat: ab, durationBeats: 0.25, velocity: 0.7, midi: 36 });
    }
    if (posInBar === 2.5 && rng() > 0.75) {
      events.push({ type: 'drum', drum: 'kick', atBeat: ab + 0.5, durationBeats: 0.2, velocity: 0.45, midi: 36 });
    }
    if (isLastTwoBeats && rng() > 0.5) {
      events.push({ type: 'drum', drum: 'kick', atBeat: ab, durationBeats: 0.2, velocity: 0.55, midi: 36 });
    }

    if (beatsPerBar === 4 && posInBar === 2) {
      events.push({ type: 'drum', drum: 'snare', atBeat: ab, durationBeats: 0.25, velocity: 0.55, midi: 38 });
    } else if (beatsPerBar === 3 && posInBar === 1) {
      events.push({ type: 'drum', drum: 'snare', atBeat: ab, durationBeats: 0.25, velocity: 0.5, midi: 38 });
    }
    if (rng() > (0.82 - density * 0.1)) {
      events.push({ type: 'drum', drum: 'snare', atBeat: ab + 0.5, durationBeats: 0.15, velocity: 0.18, midi: 38 });
    }
    if (isLastTwoBeats && rng() > 0.4) {
      events.push({ type: 'drum', drum: 'snare', atBeat: ab + 0.25, durationBeats: 0.12, velocity: 0.35, midi: 38 });
    }

    if (rng() > drumThreshold) {
      events.push({ type: 'drum', drum: 'hat', atBeat: ab, durationBeats: 0.15, velocity: 0.3, midi: 42 });
    }
    if (rng() > (drumThreshold + 0.15)) {
      events.push({ type: 'drum', drum: 'hat', atBeat: ab + 0.5, durationBeats: 0.1, velocity: 0.2, midi: 42 });
    }
    if (rng() > 0.88) {
      events.push({ type: 'drum', drum: 'hat', atBeat: ab + 0.5, durationBeats: 0.3, velocity: 0.25, midi: 46 });
    }
  }
  return events;
}

function generateSectionEvents(rng, {
  tonic, scale, bars, beatsPerBar, density, swing,
  progressionPreset, contour, rhythmTemplate,
  beatOffset = 0, noDrums = false, velocityScale = 1,
}) {
  const { preset, chords } = generateProgression(rng, { tonic, scale, bars, beatsPerBar, preset: progressionPreset });
  const rhythm = generateRhythm(rng, { bars, beatsPerBar, density, swing, template: rhythmTemplate });
  const melody = generateMelody(rng, { progression: chords, rhythm, scale, tonic, contour });

  const events = [];

  for (const c of chords) {
    for (const note of c.notes) {
      events.push({
        type: 'chord',
        midi: note - 12,
        atBeat: c.startBeat + beatOffset,
        durationBeats: c.durationBeats - 0.05,
        velocity: 0.4 * velocityScale,
      });
    }
  }

  for (const m of melody) {
    events.push({
      type: 'melody',
      midi: m.midi,
      atBeat: m.atBeat + beatOffset,
      durationBeats: m.durationBeats,
      velocity: m.velocity * velocityScale,
    });
  }

  for (const c of chords) {
    const root = Math.min(...c.notes) % 12;
    const bassMidi = 36 + root;
    events.push({
      type: 'bass',
      midi: bassMidi,
      atBeat: c.startBeat + beatOffset,
      durationBeats: c.durationBeats * 0.8,
      velocity: 0.55 * velocityScale,
    });
    if (c.durationBeats >= 2 && rng() > 0.4) {
      events.push({
        type: 'bass',
        midi: bassMidi,
        atBeat: c.startBeat + c.durationBeats / 2 + beatOffset,
        durationBeats: c.durationBeats * 0.3,
        velocity: 0.4 * velocityScale,
      });
    }
  }

  if (!noDrums) {
    events.push(...generateDrums(rng, { bars, beatsPerBar, density, beatOffset }));
  }

  return { events, preset };
}

const STRUCTURES = {
  full: [
    { label: 'Intro',   barsMul: 0.5, densityMul: 0.4, noDrums: true,  velocityScale: 0.6 },
    { label: 'Verse',   barsMul: 1,   densityMul: 0.85, noDrums: false, velocityScale: 0.9 },
    { label: 'Chorus',  barsMul: 1,   densityMul: 1.2, noDrums: false, velocityScale: 1.0 },
    { label: 'Verse',   barsMul: 1,   densityMul: 0.85, noDrums: false, velocityScale: 0.9 },
    { label: 'Chorus',  barsMul: 1,   densityMul: 1.2, noDrums: false, velocityScale: 1.0 },
    { label: 'Outro',   barsMul: 0.5, densityMul: 0.3, noDrums: false, velocityScale: 0.5 },
  ],
  short: [
    { label: 'Intro',   barsMul: 0.5, densityMul: 0.4, noDrums: true,  velocityScale: 0.6 },
    { label: 'Verse',   barsMul: 1,   densityMul: 0.85, noDrums: false, velocityScale: 0.9 },
    { label: 'Chorus',  barsMul: 1,   densityMul: 1.2, noDrums: false, velocityScale: 1.0 },
    { label: 'Outro',   barsMul: 0.5, densityMul: 0.3, noDrums: false, velocityScale: 0.5 },
  ],
};

/** @returns {{ seed: number, tonic: number, scale: string, bars: number, beatsPerBar: number, preset: string, lengthBeats: number, events: Object[], sections?: Object[] }} */
export function generateSong({
  seed = randomSeed(),
  tonic = 60,
  scale = 'major',
  bars = 4,
  beatsPerBar = 4,
  density = 0.65,
  swing = 0,
  progressionPreset = null,
  contour = 'auto',
  rhythmTemplate = 'auto',
  structure = 'single',
} = {}) {
  if (structure === 'single') {
    const rng = mulberry32(seed);
    const result = generateSectionEvents(rng, {
      tonic, scale, bars, beatsPerBar, density, swing,
      progressionPreset, contour, rhythmTemplate,
    });
    result.events.sort((a, b) => a.atBeat - b.atBeat);
    return {
      seed, tonic, scale, bars, beatsPerBar,
      preset: result.preset,
      lengthBeats: bars * beatsPerBar,
      events: result.events,
    };
  }

  const sectionDefs = STRUCTURES[structure] || STRUCTURES.full;
  const allEvents = [];
  const sections = [];
  let beatOffset = 0;
  let totalBars = 0;
  let firstPreset = '';

  for (let i = 0; i < sectionDefs.length; i++) {
    const def = sectionDefs[i];
    const secBars = Math.max(2, Math.round(bars * def.barsMul));
    const sectionRng = mulberry32(seed + i + 1);
    const secDensity = Math.min(1.0, density * def.densityMul);

    const result = generateSectionEvents(sectionRng, {
      tonic, scale,
      bars: secBars,
      beatsPerBar, density: secDensity, swing,
      progressionPreset, contour, rhythmTemplate,
      beatOffset,
      noDrums: def.noDrums,
      velocityScale: def.velocityScale,
    });

    if (i === 0) firstPreset = result.preset;
    allEvents.push(...result.events);
    sections.push({
      label: def.label,
      startBeat: beatOffset,
      bars: secBars,
      lengthBeats: secBars * beatsPerBar,
    });
    beatOffset += secBars * beatsPerBar;
    totalBars += secBars;
  }

  allEvents.sort((a, b) => a.atBeat - b.atBeat);

  return {
    seed, tonic, scale,
    bars: totalBars,
    beatsPerBar,
    preset: firstPreset,
    lengthBeats: beatOffset,
    events: allEvents,
    sections,
  };
}
