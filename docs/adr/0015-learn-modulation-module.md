# ADR 0015 — Learn: a Modulation module

- **Status**: Accepted
- **Date**: 2026-07-06
- **PR**: claude/learn-modulation-module
- **Relates to**: ADR 0005 (practice-first), ADR 0013 (invention modulation)

## Context

The Learn curriculum covered scales, chords, progressions, reading,
walking bass, duets and counterpoint — but nothing on **modulation**
(changing key), even though the invention now modulates (ADR 0013) and
the owner asked to "train modulation to various keys, with several
strategies." Modulation is a natural capstone: it builds on chords and
progressions and feeds directly into reading pieces that change key.

## Decision

Add a new **Modulation** group with one module, `modulation`
("Modulation — Changing Key"), organised around one idea: *match the
strategy to the size of the jump.* Steps alternate short theory (each
with an audible demo) and playable exercises:

1. What modulation is / closely vs distantly related keys.
2. **Pivot chord → the dominant** (C→G): Am as the vi/ii hinge, then
   D7→G. Theory + a `progression`-style chord exercise + a melodic line.
3. **Pivot → the relative minor** (C→Am): F pivot, E7→Am.
4. **Direct / "pop" key change** (C→D, up a step): theory + a melody
   that restates the phrase a step higher.
5. **Applied (secondary) dominants**: a V7/x chain around the circle of
   fifths (C→A7→Dm→D7→G).
6. **Distant keys**: enharmonic (diminished-7th) and common-tone pivots.
7. **Cheat sheet**: strategy indexed by the interval of the jump.

The chord examples use the schema's `style: 'progression'` (arrays of
MIDI = block chords) so real pivot chords are shown and heard; two
`style: 'melody'` exercises let the player read a line that actually
travels between keys. New i18n keys (`learn.group.modulation`, EN/PT/ES).

The Learn→Practice bridge maps the Modulation group to the **two-voice
invention** (whose movements modulate and resolve), so "Practice this"
lands somewhere the concept is exercised in context.

## Consequences

- New group renders last — an advanced capstone after Counterpoint;
  `GROUPS` order matches the module's position in `MODULES`.
- Schema, group, bridge-coverage and content tests all pass; a new test
  asserts the module covers pivot / relative-minor / direct / applied /
  distant / cheat-sheet and ships ≥2 melodic exercises.

## Open questions / future work

- Exercises are in C for legibility; a future pass could transpose them
  or add a dedicated Practice "modulation drill" study that generates
  pivots to a chosen target key.
- The distant-key step is theory-only (enharmonic spelling is hard to
  convey in a single diatonic line); a worked example could be added.
