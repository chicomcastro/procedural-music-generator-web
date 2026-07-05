# ADR 0008 — Practice: parametric Scale Etude

- **Status**: Accepted
- **Date**: 2026-07-05
- **PR**: claude/etude-patterns
- **Extends**: ADR 0007 (act modes), ADR 0005 (practice-first)

## Context

After ADR 0007 the Scale Etude offered three fixed exercises (ascending
pairs / descending pairs / threes). Real use asked for more:

- ascending + descending **combined in one pass** (as method books print
  them), instead of separate exercises;
- the classic **broken-interval studies** — thirds, fourths, fifths;
- **one and two octave** ranges;
- **note-value choice** (rhythm variations);
- and, with that many combinations, a **dropdown** instead of exercise
  tabs.

Three fixed acts can't span a 6-pattern × 2-octave × 4-rhythm space
(48 combinations). The study needed to become parametric.

## Decision

The Scale Etude becomes a **single-act sandbox study** (like the Duet
Workshop, ADR 0004) with three kind-specific dropdowns:

| Control | Options | Default |
|---|---|---|
| **Pattern** | Scale (up+down) · Pairs (2 by 2) · Threes (3 by 3) · Broken thirds · Broken fourths · Broken fifths | Scale |
| **Octaves** | 1 · 2 | 1 |
| **Note value** | Quarters · Eighths · Triplet eighths · Sixteenths | Eighths |

Every pattern generates the ascending **and** descending halves in one
continuous line:

- *Scale*: degrees `0…n-1` then `n-2…0` (top note not repeated).
- *Pairs / Threes*: the sliding window walks up, then the mirrored
  window walks down — matching the previous pairs_asc/pairs_desc and
  threes patterns, now fused.
- *Broken interval k* (thirds k=2, fourths k=3, fifths k=4): ascending
  `(i, i+k)` for each degree, then descending `(i, i-k)` from the top —
  the standard Ševčík / Hanon / Flesch figure.

Two octaves extend the scale shape by stacking a second octave of
degrees (`shape + shape[1:] + 12`). When the two-octave span would
overflow the clef's playable range (alto), the tonic register drops one
octave first; per-note clamping remains as backstop.

`SCALE_PATTERNS` (the act-based pattern table) is replaced by
`ETUDE_PATTERNS`; the acts array shrinks to one act, so the ADR 0007
`actMode: 'exercises'` tag is removed (a single act needs no tabs — the
rail shows one passive pill, and the pattern dropdown does the exercise
selection the tabs used to).

## Consequences

- **Prefs**: three new per-study fields (`etudePatternId`,
  `etudeOctaves`, `etudeRhythm`), backfilled with defaults; stale
  `actIdx` values from the tab era are harmless (single act).
- **Share URLs** gain `pattern=`, `oct=`, `rhy=`; favorites snapshot the
  three fields so "broken thirds, 2 octaves, sixteenths in D" is its own
  favorite.
- **Bar count is derived** (`ceil(sequence · noteValue / 4)`) instead of
  authored — the serializer pads the final bar with rests.
- Triplet notation keeps today's approximation (no `<tuplet>` marks in
  the MusicXML yet); playback timing is exact. True tuplet engraving is
  a possible follow-up.

## Open questions / future work

- Dotted / swing note-value options.
- Interval patterns beyond the fifth (sixths, octaves) — trivial to add
  to `ETUDE_PATTERNS` when asked for.
- `<tuplet>`/`<time-modification>` marks so triplets engrave with the 3.
