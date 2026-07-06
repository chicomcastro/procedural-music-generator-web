// Modulation drill generator (ADR 0016).
//
// Builds a short two-voice passage that ESTABLISHES a start key, MODULATES
// to a target key by a chosen strategy, and CONFIRMS the new key with a
// cadence. Unlike the diatonic melody/counterpoint generators, this lays
// out explicit chords first — so the chromatic tones a modulation needs
// (the G# of an E7, the F# of a D7) actually appear in the voices.

import { keyFifths } from '../theory/scales.js';

// Target key expressed as its relationship to the start key.
export const MODULATION_TARGETS = [
  { id: 'dominant',       label: 'Dominant (V)',        semitones: 7,  minor: false },
  { id: 'subdominant',    label: 'Subdominant (IV)',    semitones: 5,  minor: false },
  { id: 'relative_minor', label: 'Relative minor (vi)', semitones: 9,  minor: true  },
  { id: 'up_step',        label: 'Up a whole step',     semitones: 2,  minor: false },
  { id: 'down_step',      label: 'Down a whole step',   semitones: 10, minor: false },
];

export const MODULATION_STRATEGIES = [
  { id: 'pivot',   label: 'Pivot chord' },
  { id: 'applied', label: 'Applied dominant' },
  { id: 'direct',  label: 'Direct (phrase)' },
];

// Diatonic triad quality by scale degree (offset in semitones → quality).
// Minor uses the harmonic-minor dominant (major V at +7) so cadences pull.
const MAJOR_TRIADS = { 0: 'maj', 2: 'min', 4: 'min', 5: 'maj', 7: 'maj', 9: 'min', 11: 'dim' };
const MINOR_TRIADS = { 0: 'min', 2: 'dim', 3: 'maj', 5: 'min', 7: 'maj', 8: 'maj', 10: 'maj' };

const QUALITY_INTERVALS = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6] };
const PC_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const norm = (pc) => ((pc % 12) + 12) % 12;

function triadsFor(tonicPc, minor) {
  const table = minor ? MINOR_TRIADS : MAJOR_TRIADS;
  const map = {};
  for (const [off, q] of Object.entries(table)) map[norm(tonicPc + Number(off))] = q;
  return map;
}

function chordSymbol(rootPc, quality, seventh) {
  const n = PC_NAMES[norm(rootPc)];
  if (quality === 'min') return n + (seventh ? 'm7' : 'm');
  if (quality === 'dim') return n + '°';
  return n + (seventh ? '7' : '');   // a 7th on a major triad = dominant 7
}

function chordTonePcs(rootPc, quality, seventh) {
  const iv = [...QUALITY_INTERVALS[quality]];
  if (seventh) iv.push(10);   // dominant / minor 7th
  return iv.map((i) => norm(rootPc + i));
}

// A common (pivot) chord: same root pitch-class AND same quality in both
// keys. Prefer a pre-dominant of the target so it leads cleanly into V7→I.
function findPivot(aPc, bPc, bMinor) {
  const aT = triadsFor(aPc, false);
  const bT = triadsFor(bPc, bMinor);
  const common = Object.keys(aT)
    .map(Number)
    .filter((pc) => bT[pc] && bT[pc] === aT[pc]);
  const prefOffsets = bMinor ? [5, 8, 3] : [5, 2, 9];   // iv/VI/III  or  IV/ii/vi
  for (const off of prefOffsets) {
    const pc = norm(bPc + off);
    if (common.includes(pc)) return { rootPc: pc, quality: aT[pc] };
  }
  if (common.length) return { rootPc: common[0], quality: aT[common[0]] };
  const off = 5;                                        // last resort: target's IV/iv
  return { rootPc: norm(bPc + off), quality: (bMinor ? MINOR_TRIADS : MAJOR_TRIADS)[off] };
}

// Ordered chord plan. Each slot occupies one bar.
function buildPlan(startPc, target, strategyId) {
  const A = norm(startPc);
  const B = norm(startPc + target.semitones);
  const bMinor = target.minor;

  const deg = (keyPc, keyMinor, off, opts = {}) => {
    const q = (keyMinor ? MINOR_TRIADS : MAJOR_TRIADS)[off];
    return { rootPc: norm(keyPc + off), quality: q, seventh: !!opts.seventh, keyPc, keyMinor, role: opts.role || '', pivot: !!opts.pivot };
  };

  // Establish the home key: I – IV – V – I.
  const slots = [
    deg(A, false, 0, { role: 'I' }),
    deg(A, false, 5, { role: 'IV' }),
    deg(A, false, 7, { role: 'V' }),
    deg(A, false, 0, { role: 'I' }),
  ];

  if (strategyId === 'pivot') {
    const p = findPivot(A, B, bMinor);
    slots.push({ rootPc: p.rootPc, quality: p.quality, seventh: false, keyPc: B, keyMinor: bMinor, role: 'pivot', pivot: true });
    slots.push(deg(B, bMinor, 7, { seventh: true, role: 'V7' }));
    slots.push(deg(B, bMinor, 0, { role: 'I' }));
    slots.push(deg(B, bMinor, 0, { role: 'I' }));
  } else if (strategyId === 'applied') {
    // Secondary dominant: V7 of the target, inserted directly (chromatic vs A).
    slots.push({ rootPc: norm(B + 7), quality: 'maj', seventh: true, keyPc: B, keyMinor: bMinor, role: 'V7/target', pivot: true });
    slots.push(deg(B, bMinor, 0, { role: 'I' }));
    slots.push(deg(B, bMinor, 5, { role: 'IV' }));
    slots.push(deg(B, bMinor, 7, { seventh: true, role: 'V7' }));
    slots.push(deg(B, bMinor, 0, { role: 'I' }));
  } else {
    // Direct / phrase modulation: no connector — restate the cadence in B.
    slots.push(deg(B, bMinor, 0, { role: 'I', pivot: true }));
    slots.push(deg(B, bMinor, 5, { role: 'IV' }));
    slots.push(deg(B, bMinor, 7, { seventh: true, role: 'V7' }));
    slots.push(deg(B, bMinor, 0, { role: 'I' }));
  }

  const modulationBar = slots.findIndex((s) => s.keyPc === B);
  return { slots, aPc: A, bPc: B, bMinor, modulationBar };
}

function nearestMidi(pc, target) {
  const base = target - norm(target) + norm(pc);
  let best = base;
  for (const c of [base - 12, base, base + 12]) {
    if (Math.abs(c - target) < Math.abs(best - target)) best = c;
  }
  return best;
}

/**
 * @param {() => number} rng
 * @param {{ startPc: number, targetId: string, strategyId: string, clefAnchor?: number, beatsPerBar?: number }} opts
 * @returns {{ events: Object[], chordSymbols: string[], keySignatures: {bar:number,fifths:number}[], bars: number, beatsPerBar: number, modulationBar: number }}
 */
export function generateModulationDrill(rng, { startPc, targetId, strategyId, clefAnchor = 60, beatsPerBar = 4 }) {
  const target = MODULATION_TARGETS.find((t) => t.id === targetId) || MODULATION_TARGETS[0];
  const strategy = MODULATION_STRATEGIES.find((s) => s.id === strategyId) || MODULATION_STRATEGIES[0];
  const { slots, aPc, bPc, bMinor, modulationBar } = buildPlan(startPc, target, strategy.id);

  const melAnchor = clefAnchor + 4;   // upper voice sits a little above the anchor
  const bassAnchor = clefAnchor - 8;  // lower voice below it
  const events = [];
  const chordSymbols = [];

  for (let bar = 0; bar < slots.length; bar++) {
    const slot = slots[bar];
    const isLast = bar === slots.length - 1;
    const start = bar * beatsPerBar;
    const tones = chordTonePcs(slot.rootPc, slot.quality, slot.seventh);
    chordSymbols.push(chordSymbol(slot.rootPc, slot.quality, slot.seventh));

    // Lower voice: root then fifth, two half notes — spells the harmony.
    const rootLow = nearestMidi(slot.rootPc, bassAnchor);
    const fifthLow = nearestMidi(tones[2], bassAnchor);
    events.push({ type: 'melody2', midi: rootLow, atBeat: start, durationBeats: beatsPerBar / 2, velocity: 0.6 });
    events.push({ type: 'melody2', midi: fifthLow, atBeat: start + beatsPerBar / 2, durationBeats: beatsPerBar / 2, velocity: 0.55 });

    // Upper voice: a four-quarter arpeggio outlining the chord, centred on
    // the anchor each bar (so the line doesn't drift out of range). The
    // final bar climbs to the new tonic.
    const root = nearestMidi(slot.rootPc, melAnchor);
    const third = nearestMidi(tones[1], root + 3);
    const fifth = nearestMidi(tones[2], root + 6);
    let figure;
    if (isLast) {
      figure = [root, third, fifth, root + 12];        // resolve up to the tonic
    } else {
      const shapes = [[root, third, fifth, third], [root, fifth, third, fifth], [third, root, fifth, root]];
      figure = shapes[Math.floor(rng() * shapes.length)];
    }
    for (let q = 0; q < 4; q++) {
      events.push({ type: 'melody', midi: figure[q], atBeat: start + q, durationBeats: 1, velocity: q === 0 ? 0.8 : 0.65 });
    }
  }

  const keySignatures = [
    { bar: 0, fifths: keyFifths(aPc, 'major') },
    { bar: modulationBar, fifths: keyFifths(bPc, bMinor ? 'natural_minor' : 'major') },
  ];

  return { events, chordSymbols, keySignatures, bars: slots.length, beatsPerBar, modulationBar };
}
