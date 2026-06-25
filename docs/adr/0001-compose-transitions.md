# ADR 0001 — Compose: smooth transitions between sections

- **Status**: Accepted
- **Date**: 2026-06-25
- **PR**: claude/compose-transitions

## Context

`ComposeView` plays the timeline by scheduling each section back-to-back: section N's last beat lands at time T, section N+1's first beat lands at time T + epsilon. Two side-effects are audible and unpleasant:

1. A **hard cut** when the chord or key of the two adjacent sections differs (Verse in C → Chorus in F sounds like a tape splice).
2. A **tempo step** when adjacent sections have different BPMs (110 → 130 is jarring).

The user's gap inventory (the conversation that led to this PR) called out "sem transições entre sections — tocam back-to-back, mudança de bpm/key é abrupta".

## Decision

Ship **per-section configurable transitions**. Each section carries a `transitionIn` field declaring how it joins the previous section, plus a `transitionBars` length (defaulted per type). Three modes:

| Mode | Behavior |
| --- | --- |
| `hard` (default) | Current behavior. Section N+1 starts the instant N ends. |
| `crossfade` | Overlap N's tail with N+1's head over `transitionBars * beatDur` seconds. Both sections fade linearly — N from full → 0, N+1 from 0 → full. |
| `gap` | Insert `transitionBars` of silence between N and N+1. Acts as a breath / "section divider" beat. |

`transitionBars` defaults to **1** for both `crossfade` and `gap` (one beat of overlap or silence). User can override per section.

### Why not tempo ramps now

A tempo ramp between sections of different BPMs is musically the right thing, but it requires re-timing the entire downstream schedule: section N+1's notes, the progress timer, the OSMD cursor, and the offline-render timeline all need to walk a non-linear beat curve. That's a substantial refactor of `playComposition` + `renderCompositionMix` + the progress driver.

Crossfade + gap give the user 80% of the audible improvement (smoothed joins, optional breath) at 20% of the implementation cost. Tempo ramps are tracked as a future ADR.

### Why not pilot notes now

A pilot/pivot note (e.g. sustained tonic of the incoming key over the last beat of the outgoing section) is musically interesting but requires choosing the right pitch — a procedural decision that depends on both sections' tonal centers, voice ranges, and the human ear's expectations. That's a separate generation problem and arguably belongs at the section level rather than at the join.

## Consequences

**Backwards compatible**: existing projects load with `transitionIn: 'hard'` (default), playback is identical to before.

**Per-section UI**: each section card gets a "Transition" picker in its editor pane (after the existing Voice picker). Surface a small chip on the section header summarising the transition (`⇢ Crossfade 1b`, `⇢ Gap 1b`, no chip for `hard`).

**Live + offline parity**: `playComposition` (live) and `renderCompositionMix` / `renderCompositionStem` (offline WAV) both walk the section list with the same accumulated-time calculation:

```
sectionStarts[N+1].start = sectionStarts[N].start + sectionStarts[N].length + delta
```

where `delta = +bars` for gap, `delta = -bars` for crossfade, `delta = 0` for hard.

**Crossfade gain**: implemented via inline `linearRampToValueAtTime` envelopes on each event's `gain`, scaled by `(1 - progress)` for the outgoing section and `progress` for the incoming one. Cheaper than wrapping every section in a section-level GainNode (no extra graph nodes per event) and works identically in the live AudioContext and OfflineAudioContext.

## Open questions / future work

- **Tempo ramp** — own ADR. Will require a beat-time function instead of constant `beatDur`.
- **Pilot/pivot note** — own ADR. Needs a "harmonic intent" parameter on sections.
- **Crossfade curve** — currently linear. An equal-power (`cos/sin`) crossfade would be smoother for some material; we can add a curve picker later if learners ask.
