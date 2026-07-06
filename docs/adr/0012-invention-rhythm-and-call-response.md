# ADR 0012 — Two-voice invention: straight rhythm engine + real call-and-response

- **Status**: Accepted
- **Date**: 2026-07-06
- **PR**: claude/invention-rhythm-callresponse

## Context

Three issues in the two-voice invention, from practice feedback:

1. **Accidental syncopation / augmentation dots.** The rhythm generator
   snapped durations to a 0.5 grid and clamped to `[0.5, 4]`, which let
   through dotted values (1.5, 2.5, 3). A dotted note pushes the next
   onset off the beat, so even at swing 0 the line read as syncopated.
2. **"Square" wasn't square.** The square preset (`sparse` template,
   density 0.30) produced a few long, dotted notes rather than a
   consistent stream of on-beat / half-beat notes.
3. **Call-and-response wasn't a dialogue.** Voice 1 played continuously;
   voice 2 merely harmonised the second half of each bar a third below.
   There was no trading of phrases.

## Decision

### Two rhythm families

`generateRhythm` now dispatches by template into two families:

- **Straight** (`straight` / `sparse` / `driving` / the `auto` default):
  a continuous, dot-free line. A cursor walks the bar filling clean cells
  — eighth-pairs, quarters, and (when the template opts into `variety`,
  i.e. `sparse`/square and `auto`) halves and whole notes. Durations are
  always in `{0.5, 1, 2, 4}` and onsets only ever land on a beat or a
  half-beat. **Swing** only leans the eighth-pairs long-short (rendered as
  dotted-8th + 16th); at swing 0 the line is dead straight. This family
  never syncopates.
- **Syncopated** (`syncopated` only): the original slot-based generator
  that deliberately fires off-beat onsets (and swing shifts them). This
  is now the *only* source of syncopation.

So: square = clean with variety (halves/wholes, no dots); swing 0 +
any straight preset = no syncopation; syncopation is opt-in via the
Syncopated preset.

### Real call-and-response

`generateCallAndResponse(rng, { melody, tonic, scale, bars, beatsPerBar })`
returns `{ call, response }` — both voices. It partitions the act into
**call→answer pairs** of 1 or 2 bars (length chosen per pair, the answer
mirroring the call's length). The call voice plays a phrase and then
rests; the answer voice echoes that phrase transposed down into its
register and rests while the call asks again. An answer occasionally
enters a couple of beats early (`~30%`), so the voices briefly overlap in
a stretto/imitation. `generateCounterpoint`'s `call_response` branch
delegates here (returning just the response) so there's one implementation;
`buildTwoVoiceSong` calls it directly to get both voices, replacing voice 1
with the masked "call" line.

## Consequences

- Straight presets are continuous (no rests) and dot-free; the Syncopated
  preset keeps its character. Swing stays meaningful (swung eighths).
- Call-and-response now genuinely trades phrases: whole-bar rests appear
  in the resting voice, verified in a rendered score.
- Determinism preserved (seed → same output); existing Practice tests and
  the lenient `call_response` test still pass.

## Open questions / future work

- Phrase lengths are 1–2 bars; longer arcs (4-bar antecedent/consequent)
  could be a difficulty-scaled option.
- The answer is a straight transposition of the call; inversion or
  tonal-answer adjustment (real vs tonal fugue answer) is a future nicety.
