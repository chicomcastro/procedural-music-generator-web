# ADR 0009 — Scale Etude: start note + control cleanup

- **Status**: Accepted
- **Date**: 2026-07-05
- **PR**: claude/etude-start-octave
- **Extends**: ADR 0008 (parametric scale etude)

## Context

Two pieces of feedback on the parametric Scale Etude:

1. **No control over the starting octave.** The drill always rooted the
   tonic at the lowest occurrence of the key's pitch class at-or-above
   the clef's tessitura anchor (`tonicMidiFor(anchor, pc)`). For a
   cellist that means the C etude started on C3, never on the cello's
   low open C string (C2). Players want to pick the register — starting
   on an open string is the whole point of a technique drill.

2. **Seed and Intensity do nothing here.** The etude is fully
   deterministic from scale × pattern × octaves × note-value —
   `buildScaleEtudeSong` never reads `seed`. `intensity` only scales
   MIDI velocity (uniform playback volume), which carries no meaning in
   a self-played technique study. Both controls are noise in this study.

## Decision

### Start-note selector

Add a **Start note** dropdown to the etude bar (fourth control after
Pattern / Octaves / Note value). It lists every octave of the key's
tonic from the instrument's lowest playable note up through two
octaves, each labelled in scientific pitch notation (C2, C3, C4…).

Lowest-note floor per clef = the instrument's lowest open string:

| Clef | Floor | Instrument reference |
|------|-------|----------------------|
| bass | 36 (C2) | cello C string |
| alto | 48 (C3) | viola C string |
| treble | 55 (G3) | violin G string |

The selected start note becomes the tonic MIDI directly. The clamp
range for the drill widens to `[min(clefRange.lo, start), max(clefRange.hi, start + patternSpan)]`
so a low-string start isn't yanked back up by the old range guard, while
notes still can't run off either end.

Default (and the value when the stored start note isn't valid for the
current key+clef — e.g. after changing either) is the previous
behaviour: the lowest tonic at-or-above the clef anchor. So existing
users see no change until they touch the new control.

`CLEF_RANGES` is untouched — the etude computes its own widened range,
so walking-bass / invention / etc. keep their conservative bounds.

### Control cleanup

For `kind === 'scale-etude'` only, the **Seed** (input + reroll) and
**Intensity** fields are hidden. Other studies keep them. This is a
visibility change; the prefs fields stay (harmless) so nothing else
needs migrating.

## Consequences

- **Share URLs** gain `start=<midi>`; favorites snapshot it. Omitted
  when the start note is the default, so old links stay clean.
- **Two-octave + low start**: e.g. bass-clef C major starting on C2
  spans C2→C4 (24 semitones) — inside the widened range, no clamping.
- The start-note options recompute on key or clef change; an
  out-of-range stored value falls back to the default silently.

## Open questions / future work

- Naming convention: labels use scientific pitch (middle C = C4, cello
  low string = C2), consistent with the rest of the app. Some players
  call the cello string C1 (Yamaha convention). Not exposing a toggle
  for this unless it causes confusion in practice.
- Applying a start-note control to the other single-line studies
  (solo etude, modal vamp) if the same need shows up there.
