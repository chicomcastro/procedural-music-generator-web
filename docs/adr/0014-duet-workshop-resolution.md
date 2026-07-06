# ADR 0014 — Duet Workshop: resolve to the tonic

- **Status**: Accepted
- **Date**: 2026-07-06
- **PR**: claude/duet-workshop-resolution
- **Relates to**: ADR 0004 (duet workshop), ADR 0013 (invention cadence)

## Context

The Duet Workshop laid its chosen progression evenly across its single
8-bar movement and simply stopped on the progression's raw last chord —
`pop` ended on IV, `fifties` on V, `pachelbel` on V — so the piece never
came to rest. The invention got a proper cadence in ADR 0013; the
workshop should feel finished too.

## Decision

For `kind === 'duet-workshop'`, land the final chord on the **tonic
(I)** when the chosen progression doesn't already end there:

```js
if (study.kind === 'duet-workshop' && degrees.at(-1) !== 1) {
  degrees = [...degrees.slice(0, -1), 1];
}
```

The melody generator already targets the tonic on its last note, so with
the final chord now I the whole texture cadences home. Replacing (rather
than appending) the last degree keeps the chords bar-aligned (2 bars each
for the common 4-chord progressions) and preserves the rest of the
picked progression. Progressions that already end on I (e.g.
`jazz_ii_V_I`, a ii–V–I) are left untouched.

Scope is the workshop only — the invention manages its own per-movement
cadences and pivots (ADR 0013), so this must not touch it.

## Consequences

- Every workshop generation ends on the tonic, for any picked
  progression and key (verified by tests across five progressions × two
  keys).
- The cadence type follows what precedes the tonic (authentic when the
  penultimate is V, plagal when IV, etc.) — always a resolution, never a
  hanging loop end.

## Open questions / future work

- A guaranteed *authentic* cadence (forcing V just before the final I)
  would override two chords of a short progression, so it's left out to
  respect the user's picked chords. Revisit if a stronger close is wanted.
