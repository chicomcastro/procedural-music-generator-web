# ADR 0002 — Compose: tempo ramps at section boundaries

- **Status**: Accepted
- **Date**: 2026-06-25
- **PR**: claude/compose-tempo-ramps
- **Supersedes / Extends**: ADR 0001 (transitions)

## Context

ADR 0001 shipped three transition modes (hard / crossfade / gap) but explicitly deferred tempo ramps:

> A tempo ramp between sections of different BPMs is musically the right thing, but it requires re-timing the entire downstream schedule […]. That's a substantial refactor.

With the four-PR roadmap closed, this ADR is the followup. The user explicitly asked for tempo ramps to be tackled next.

## Decision

Add a fourth `transitionIn` value: **`'tempo-ramp'`**. Semantics:

> The LAST `transitionBars` of the OUTGOING section linearly interpolate beat-duration from the outgoing section's bpm to the incoming section's bpm. The incoming section then starts at its own bpm.

So `transitionBars` on the incoming section configures the *ramp length*. If section N is at 110 bpm and section N+1 is at 130 bpm and N+1.transitionIn === 'tempo-ramp', N+1.transitionBars = 4, then the last 4 beats of N walk smoothly from 110 → 130, and N+1 starts at exactly 130.

### Why this shape

Putting the ramp at the END of the OUTGOING section (rather than the START of the INCOMING) sounds more natural to most listeners — the lead-in to the new tempo feels like an organic build, while putting the ramp on the incoming section sounds like the new section is "uncertain about its tempo".

Keeping the same field (`transitionIn`) and the same `transitionBars` knob keeps the UI surface tiny: one dropdown gains a new option, no new sliders.

### Math

For a ramp of K beats from bpm₀ to bpm₁:

- beat-duration at offset `s` (in beats) inside the ramp: `bd(s) = 60 / (bpm₀ + (bpm₁ − bpm₀) * (s / K))`
- elapsed time from ramp start to offset `s` (closed form, *not* discrete summation):
  `t(s) = (60K / (bpm₁ − bpm₀)) * ln((bpm₀ + (bpm₁ − bpm₀) * (s / K)) / bpm₀)`
- when bpm₀ === bpm₁, the limit collapses to `t(s) = s * 60 / bpm₀` (no-op).

Total ramp duration `t(K) = (60K / (bpm₁ − bpm₀)) * ln(bpm₁ / bpm₀)`.

The compose-side delta vs. a hard transition: `(t(K) − K * 60 / bpm₀)` — negative when ramping up (faster than the outgoing section would have been), positive when ramping down.

### Implementation

`computeSectionStarts` previously assumed one `beatDur` per section. Tempo-ramp breaks that. We extend each `starts[i]` entry with:

- `start`, `length`, `beatDur` (constant outside any ramp)
- new: `rampInBeats` — when set, the LAST `rampInBeats` beats of this section use a varying tempo, transitioning to the NEXT section's bpm

A new helper `timeOffsetForBeat(starts, sectionIdx, beat)` returns the absolute time offset from `start` for an event at beat `beat` within section `sectionIdx`. For beats outside any ramp, it's the trivial `beat * beatDur`; for beats inside the ramp window, it uses the closed-form `t(s)` above.

Both live playback (`playComposition`) and offline render (`renderCompositionMix` / `renderCompositionStem`) walk events through `timeOffsetForBeat`. The progress timer continues to use `starts[i].start + starts[i].length` for section boundaries — the length is recomputed to include the ramp delta.

## Consequences

**Backwards compatible**: every section's `transitionIn` defaults to `'hard'`. Existing projects load unchanged.

**Crossfade + tempo-ramp interaction**: they are mutually exclusive on a single boundary (the picker is a `<select>`). Combining them is a future ADR — would require simultaneous beat-time warping AND overlap envelopes.

**Cursor + progress**: the progress bar reads `elapsed_seconds / totalSec`. Since totalSec accounts for ramp lengths, the progress remains linear in time, which is what the listener perceives. The per-section "active" highlight switches based on which section's `[start, start+length]` window contains the current elapsed time — still correct under tempo-ramp.

**Score rendering**: not in scope. The Compose view doesn't render OSMD; the underlying `generateSong` events keep their `atBeat` field intact (timing is applied at playback). No score-engraving change needed.

## Open questions / future work

- **Pivot/pilot notes** — ADR 0003. Independent of this ramp; can ride alongside.
- **Curve shape** — currently linear bpm interpolation. Exponential / equal-power variants documented as TBD.
- **Multi-ramp** — chaining two tempo ramps across three sections at once works trivially because each ramp is local to one boundary. Not separately implemented; comes for free.
