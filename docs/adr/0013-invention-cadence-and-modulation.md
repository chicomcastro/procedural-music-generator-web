# ADR 0013 — Two-voice invention: resolved ending + prepared modulation

- **Status**: Accepted
- **Date**: 2026-07-06
- **PR**: claude/invention-cadence-modulation
- **Relates to**: ADR 0007 (act modes)

## Context

Two musical complaints about the two-voice invention:

1. **No resolution.** The Recapitulation used the `fifties`
   progression `[1, 6, 4, 5]`, which ends on **V** — the piece stopped
   on the dominant, leaving it hanging.
2. **Abrupt key change.** The Development had `keyShift: 9` with the
   comment "relative minor", but its scale defaulted to **major**, so it
   was actually in the tonic's **relative *major* a major sixth up**
   (e.g. C major → A **major**, +3 sharps). The key signature jumped
   `0 → 3 → 0` with no preparation.

## Decision

Follow the classic invention arc — tonic → related key → home — with
diatonic **common-chord (pivot) modulation** and an **authentic
cadence** at the end. All fully diatonic, so the (scale-constrained)
melody and counterpoint never fight the harmony.

- **Development is the true relative minor.** `params.scale =
  'natural_minor'` with `keyShift: 9`, so it shares the tonic's key
  signature (no jump) and is clearly related.
- **Each seam dovetails on a shared chord.** New progressions land each
  movement on the *next* movement's tonic:
  - `inv_exposition` `[1, 4, 5, 6]` — I–IV–V–**vi**; the closing vi IS
    the relative-minor tonic, so it becomes the development's i.
  - `inv_development` `[1, 6, 7, 3]` — i–VI–VII–**III**; the closing III
    is the tonic major, pivoting home.
  - `inv_recapitulation` `[1, 4, 5, 1]` — I–IV–V–**I**, an authentic
    cadence.
- The melody already targeted the tonic on its final note; with the
  final chord now I, the whole texture resolves.

In C major this renders as: `C F G Am │ Am F G C │ C F G C`, one shared
key signature throughout, ending V→I.

## Consequences

- The piece resolves home and the two modulations are prepared by a
  pivot chord held across the double bar — verified by tests (single key
  signature, tonic final chord + last melody note, matching pivot chords
  at both seams) for several keys.
- The pivots are relationship-based (they depend only on the acts'
  `keyShift` deltas, all relative), so they hold for any study key.
- The Development is Aeolian (natural minor, no raised leading tone) —
  the smoothest relative-minor colour. A harmonic-minor variant would add
  a leading-tone accidental; deferred unless wanted.

## Open questions / future work

- A stronger dominant preparation (an applied V/x with its leading tone)
  would need the diatonic generators to allow chromatic passing tones —
  a larger change to melody/counterpoint, out of scope here.
