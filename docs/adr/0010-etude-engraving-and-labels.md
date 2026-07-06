# ADR 0010 — Scale Etude: rhythm cells, beaming, localized labels, tight margins

- **Status**: Accepted
- **Date**: 2026-07-06
- **PR**: claude/etude-beam-i18n-margin
- **Extends**: ADR 0008 (parametric scale etude)

## Context

Four presentation issues surfaced once players started reading the
etude off the screen with the composite rhythms added in PR Y:

1. **Rhythm cells were undocumented.** PR Y turned each note-value into
   a repeating *cell* pattern (`cells: [{ beats, noteType }]`, note `j`
   takes `cells[j % cells.length]`) so composite figures like the
   dotted-8th + 16th could exist. The code cited "ADR 0010" for this
   but the record was never written.

2. **Composite figures weren't beamed.** The serializer only ever
   emitted a single `<beam number="1">` and only for durations
   `<= 0.5`. So a dotted eighth (0.75) never beamed at all, and the
   16th next to it drew a lone flag instead of the primary beam +
   secondary hook the figure needs — "faltou a bandeirinha ligando as
   notas."

3. **Dropdown option labels were English-only.** The etude bar's
   Pattern / Octaves / Note-value values ("Dotted 8th + 16th", "Scale
   (up + down)", "1 octave") stayed in English even in PT/ES, while the
   field *labels* around them were translated.

4. **Dead space on the left of the score.** OSMD's default
   `PageLeftMargin` (~5 staff-space units) left a wide empty gutter on a
   single-line etude.

## Decision

### Rhythm cells (retroactive)

A note-value is a cyclic list of cells that each carry a duration in
beats and a note-type tag. The etude builder walks the note sequence
applying `cells[j % cells.length]`; composite cells are authored to sum
to one beat so the figure stays bar-aligned. Simple values (quarter,
eighth, triplet, sixteenth) are one-cell patterns.

### Multi-level beaming

The MusicXML serializer now assigns beams in two passes over each bar:

1. Resolve every slot's final position + duration and the rest gaps
   between them in one forward walk.
2. Grow maximal beam groups — runs of contiguous 8th/16th notes that
   share the same quarter-note beat and aren't split by a rest — then
   assign a beam per level:
   - **Level 1** (primary): every 8th/16th in a group of ≥2 carries it,
     as begin / continue / end.
   - **Level 2** (secondary): only 16ths. A level-2 beam with a level-2
     neighbour is begin/continue/end; a lone one becomes a **forward
     hook** (group start) or **backward hook** (otherwise) — that hook
     is the missing "bandeirinha" on the 16th of a dotted-8th + 16th.

`buildNoteXml` now takes a beams array (`[{ number, type }]`); it still
accepts a bare string / null for its other callers. Beaming is skipped
for drum (unpitched) parts, and single beamable notes stay flagged.

### Localized option labels

Etude option labels are localized through a `etudeLabel(group, id,
fallback)` helper in the practice translations sidecar, keyed by option
id under `patterns` / `octaves` / `rhythms`. English is the source of
truth on each option in `practice-studies.js`; PT/ES use the standard
Latin note names players expect (semínima, colcheia, semicolcheia,
colcheia pontuada…). Unknown ids and English fall back to the option's
own label.

### Tight score margins

`renderSheet` sets `EngravingRules.PageLeftMargin` and
`PageRightMargin` to `0.5` after constructing the OSMD instance — enough
to keep the clef from clipping, but without the default gutter.

## Consequences

- Every composite figure (dotted-8th+16th, 16-8-16, 16-16-8, 8-16-16)
  and runs of straight 8ths/16ths now beam correctly, with double beams
  and hooks where the rhythm calls for them.
- Adding a new pattern / note-value means adding a PT + ES entry to
  `ETUDE_LABELS`; a test asserts every option has both.
- Beaming still groups by the quarter-note beat, so it does not yet
  honour 6/8-style dotted-quarter beat units — out of scope (the etude
  is 4/4).

## Open questions / future work

- Compound-meter beam grouping (6/8, 12/8) if a metered etude ships.
- Triplet cells currently quantize to 16ths in the engraving; a proper
  `<time-modification>` + tuplet bracket is a separate change.
