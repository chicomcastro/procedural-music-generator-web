// ADR 0005 (practice-first) — PR O: the Learn → Practice bridge.
//
// Maps every Learn module to the Practice study that exercises the same
// concept, expressed as a hash deep link. The bridge is *just a link*:
// Practice's share-URL system (PracticeView.applyShareParams) already
// hydrates study + scale + progression + duet-style from query params,
// so no new plumbing is needed on the Practice side.
//
// Pure module — no DOM — so the mapping is unit-testable in isolation.

// Per-module overrides. Anything not listed falls back to its group's
// default below. Values are the query-string portion after '#/practice?'.
const MODULE_LINKS = {
  // Scales → Scale Etude preset to the scale the module teaches.
  'major-scale':      'study=scale-etude&scale=major',
  'natural-minor':    'study=scale-etude&scale=natural_minor',
  'pentatonic-minor': 'study=scale-etude&scale=pentatonic_minor',
  'pentatonic-major': 'study=scale-etude&scale=pentatonic_major',
  'harmonic-minor':   'study=scale-etude&scale=harmonic_minor',
  'greek-modes':      'study=scale-etude&scale=dorian',
  // Blues scale is not in Practice's scale-override list — the walking
  // bass workout's 12-bar-blues act is the natural playground for it.
  'blues-scale':      'study=walking-bass-workout',

  // Progressions → Duet Workshop with the matching progression preset
  // (ids from src/js/theory/chords.js PROGRESSIONS).
  'prog-i-v-vi-iv':   'study=duet-workshop&prog=pop',
  'prog-50s':         'study=duet-workshop&prog=fifties',
  'prog-12-bar-blues':'study=duet-workshop&prog=twelve_bar',
  'prog-ii-v-i':      'study=duet-workshop&prog=jazz_ii_V_I',
  'prog-pachelbel':   'study=duet-workshop&prog=pachelbel',
  'prog-minor-loop':  'study=duet-workshop&prog=minor_loop',

  // Counterpoint — imitation maps to the call & response duet style.
  'counterpoint-imitation': 'study=duet-workshop&duet=call_response',
};

// Group-level fallbacks for modules without a specific override.
const GROUP_LINKS = {
  'Scales':       'study=scale-etude',
  'Chords':       'study=duet-workshop',
  'Progressions': 'study=duet-workshop',
  'Walking Bass': 'study=walking-bass-workout',
  'Reading':      'study=duet-workshop',
  'Duets':        'study=duet-workshop',
  'Counterpoint': 'study=two-voice-invention',
};

/**
 * @param {{ id: string, group?: string }} mod a Learn module
 * @returns {string|null} a '#/practice?...' hash, or null when no mapping exists
 */
export function practiceLinkForModule(mod) {
  if (!mod) return null;
  const query = MODULE_LINKS[mod.id] || GROUP_LINKS[mod.group] || null;
  return query ? `#/practice?${query}` : null;
}
