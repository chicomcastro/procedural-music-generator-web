// Chord-symbol MusicXML helpers, shared between Learn (exercise scores) and
// Practice (study scores). The two consumers used to keep private copies;
// extracting here so chord symbols on the walking-bass workout don't drift
// from the LearnView implementation.

export function escapeText(s) {
  return String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

// Build a MusicXML `<harmony>` element from a plain-text chord symbol
// ("F#maj7", "Bdim", "C/E"). `offsetDivisions` shifts placement within a
// measure — used when more than one chord lives in the same bar.
export function harmonyTagFor(symbol, offsetDivisions = 0) {
  if (!symbol || typeof symbol !== 'string') return '';
  const slash = symbol.split('/');
  const head = slash[0];
  const bassPart = slash[1];
  const m = head.match(/^([A-G])([#b]?)(.*)$/);
  if (!m) return '';
  const stepLetter = m[1];
  const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const tail = (m[3] || '').toLowerCase();
  let kind = 'major';
  if (tail === '' || tail === 'maj') kind = 'major';
  else if (tail === 'm' || tail === 'min') kind = 'minor';
  else if (tail === '7') kind = 'dominant';
  else if (tail === 'maj7' || tail === 'M7') kind = 'major-seventh';
  else if (tail === 'm7' || tail === 'min7') kind = 'minor-seventh';
  else if (tail === 'dim' || tail === '°') kind = 'diminished';
  else if (tail === 'sus' || tail === 'sus4') kind = 'suspended-fourth';
  else kind = 'major';
  const alterTag = alter !== 0 ? `<root-alter>${alter}</root-alter>` : '';
  let bassXml = '';
  if (bassPart) {
    const bm = bassPart.match(/^([A-G])([#b]?)/);
    if (bm) {
      const bAlter = bm[2] === '#' ? 1 : bm[2] === 'b' ? -1 : 0;
      const bAlterTag = bAlter !== 0 ? `<bass-alter>${bAlter}</bass-alter>` : '';
      bassXml = `<bass><bass-step>${bm[1]}</bass-step>${bAlterTag}</bass>`;
    }
  }
  const offsetXml = offsetDivisions > 0 ? `<offset>${offsetDivisions}</offset>` : '';
  return `<harmony><root><root-step>${stepLetter}</root-step>${alterTag}</root><kind text="${escapeText(symbol)}">${kind}</kind>${bassXml}${offsetXml}</harmony>`;
}

const PITCH_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const PC_TO_NAME_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PC_TO_NAME_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Shift a chord symbol's root by `semitones`. Keeps the suffix ("m7", "7", …)
// intact and chooses an enharmonic spelling biased toward the original
// accidental (flat originals stay flat-ish after positive shifts).
export function transposeChordSymbol(symbol, semitones) {
  if (!symbol || typeof symbol !== 'string') return symbol;
  const [headRaw, bassRaw] = symbol.split('/');
  const shiftOne = (s) => {
    const m = s.match(/^([A-G])([#b]?)(.*)$/);
    if (!m) return s;
    const root = PITCH_PC[m[1]];
    if (root == null) return s;
    const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    const tail = m[3] || '';
    const pc = ((root + alter + semitones) % 12 + 12) % 12;
    const useFlats = m[2] === 'b' || (m[2] === '' && semitones < 0);
    const name = (useFlats ? PC_TO_NAME_FLAT : PC_TO_NAME_SHARP)[pc];
    return `${name}${tail}`;
  };
  const head = shiftOne(headRaw);
  const bass = bassRaw ? shiftOne(bassRaw) : null;
  return bass ? `${head}/${bass}` : head;
}
