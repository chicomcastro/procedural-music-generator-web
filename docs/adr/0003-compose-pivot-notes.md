# ADR 0003 — Compose: pivot/pilot notes at section boundaries

- **Status**: Accepted
- **Date**: 2026-06-25
- **PR**: claude/compose-pivot-notes
- **Extends**: ADR 0001 (transitions), ADR 0002 (tempo ramps)

## Context

ADR 0001 closed the four-PR transition roadmap leaving an explicit followup:

> Pivot/pilot notes — ADR 0003. Independent of [the tempo] ramp; can ride alongside.

When two adjacent sections sit in *different keys* (different tonic, or different scale), the ear has nothing to hold on to across the transition. Crossfade smooths *loudness*; tempo-ramp smooths *time*; neither smooths *harmony*. The classical fix is the **pivot note** — a single pitch common to both keys, sounded across the boundary so the listener's ear has a fixed reference while the harmony reframes.

Musicians sometimes also call this a "pilot" note (the note that "lands" the new key in advance). For our purposes the term is interchangeable; the feature is one toggle that does the harmonically right thing automatically.

## Decision

Add a per-section boolean field **`pivotNote: boolean`** (default `false`). When `true` on section *N*, a single soft sustained note is scheduled spanning the boundary between section *N-1* and section *N*. The pitch is computed automatically from the scale intersection of the two sections.

### Pitch selection algorithm

For sections with tonics `t_prev`, `t_curr` (semitones, 0–11) and scales `s_prev`, `s_curr`:

1. Compute pitch-class sets `PC_prev = { (t_prev + i) mod 12 : i ∈ intervals(s_prev) }` and `PC_curr` analogously.
2. Intersect: `common = PC_prev ∩ PC_curr`.
3. From `common`, score candidates by their scale-degree role in the **incoming** key:
   - tonic (`PC = t_curr`) → 100
   - perfect fifth (`PC = (t_curr + 7) mod 12`) → 80
   - perfect fourth (`(t_curr + 5) mod 12`) → 60
   - third (major or minor, `(t_curr + 3) mod 12` or `(t_curr + 4) mod 12`) → 40
   - any other → 10
4. Pick the highest-scored pitch class. If `common` is empty (won't happen with our scale set, but guard anyway), fall back to `t_curr` (the new tonic).
5. Anchor the note at `MIDI = 60 + pitch_class + 12` — one octave above middle C, the same "pad register" the composition voices use.

The chosen pitch is a deterministic function of `(t_prev, s_prev, t_curr, s_curr)` — no RNG involvement. Two sections with the same parameters will always produce the same pivot.

### Schedule

The pivot starts **1 beat** before the boundary (inside the outgoing section's tail) and lasts **2 beats total**, so 1 beat overhangs into the incoming section. Beat duration is the *outgoing* section's `beatDur` for the pre-boundary half and the *incoming* `beatDur` for the post-boundary half. With `tempo-ramp` active, the pre-boundary half uses the ramp's instantaneous bd.

Volume is intentionally low (peak `0.04` linear gain) and the envelope is a sine wave so the pivot sits *under* the texture, not over it.

### Why this shape

- **One toggle, no knobs**: anything more configurable (which pitch? which octave? volume?) adds UI surface for a feature most users will set once. The automatic selection always produces a harmonically valid choice given the surrounding scales.
- **Field on the incoming section**: matches `transitionIn` — both fields describe what happens *into* this section.
- **Independent of `transitionIn`**: pivot can be combined with hard / crossfade / gap / tempo-ramp. They affect different audio dimensions (loudness, time, harmony).
- **Soft + low-velocity**: the pivot is a *cue*, not a melody. If it's audible enough to compete with the lead voice, it changes the composition rather than aiding the transition.

## Consequences

**Backwards compatible**: existing projects load with `pivotNote = false`. No behaviour change for users who don't toggle it.

**File format**: `.seedsong.json` gains an optional `pivotNote: boolean` per section. Older files without the field load fine — `normalizeSection` defaults it to `false`.

**Live + offline parity**: both `playComposition` and `renderCompositionMix` / `renderCompositionStem` schedule the pivot the same way. Mix exports therefore include the pivot; stem exports don't (the pivot isn't a stem — it's a transition cue tied to the boundary, not to a single instrument).

**Test surface**: pivot pitch is deterministic, so we can assert exact MIDI values for known scale pairs. Schedule timing is verifiable via `OfflineAudioContext` length probing (same pattern as ADR 0002's duration math test).

## Open questions / future work

- **Per-pivot pitch override** — let the user pick a specific note when the auto-selection isn't what they want. Out of scope for this ADR; the auto-pick is good enough for the 90% case.
- **Multiple pivots / arpeggiated pivot** — sustaining a single note is the conservative choice. A short arpeggio of the common-tone triad would be richer but invites musical-style choices that don't belong in the core engine.
- **Pivot at the very start of the composition** — the first section has no predecessor; `pivotNote` is ignored for section 0 (the toggle isn't shown).
