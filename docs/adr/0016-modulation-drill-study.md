# ADR 0016 — Practice: Modulation Drill study

- **Status**: Accepted
- **Date**: 2026-07-06
- **PR**: claude/modulation-drill-study
- **Relates to**: ADR 0005 (practice-first), ADR 0013 (invention modulation), ADR 0015 (Learn modulation module)

## Context

ADR 0015 added a Learn module *about* modulation, and its "Practice this"
pointed at the two-voice invention — but the invention only ever makes
one fixed modulation (to the relative minor). There was nowhere to
actually *train* changing key across different targets and strategies.

## Decision

A new **Modulation Drill** practice study (`kind: 'modulation-drill'`),
a single-act sandbox with a params bar above the score:

- **Key** — the home key (start).
- **Destination** — chosen by *relationship*: dominant, subdominant,
  relative minor, up a step, down a step. Teaches "strategy per jump"
  and transposes to any start key.
- **Strategy** — pivot chord, applied (secondary) dominant, or direct.

### Dedicated generator (`src/js/generate/modulation.js`)

The diatonic melody/counterpoint generators can't voice the chromatic
tones a modulation needs, so this generator lays out **explicit chords**
first — establish the home key (I–IV–V–I), execute the strategy, then
cadence in the target — and derives two voices from the chord tones:

- **pivot**: a common chord (same root + quality in both keys, preferring
  a target pre-dominant) held across the seam, then V7→I of the target.
- **applied**: the target's V7 inserted directly (chromatic vs. home).
- **direct**: no connector — restate the cadence in the new key.

The upper voice arpeggiates each chord (so the E7's G♯, the D7's F♯
actually sound); the lower voice spells root+fifth. A double bar marks
the modulation point and the **key signature changes there** — so a
relative-minor move keeps one signature while a move to the dominant
adds a sharp, visible on the page.

### Wiring

- Params bar mirrors the etude bar; Adjust's Key/Scale rows hide for this
  study (Key lives in the bar). New i18n (`practice.destination`,
  `practice.strategy`, EN/PT/ES) and PT/ES option + study-card labels.
- The Learn→Practice bridge now maps the Modulation module and group to
  `modulation-drill` instead of the invention.
- Catalog slot: after the Duet Workshop, grouping the harmony studies.

## Consequences

- Every target × strategy generates a playable two-voice passage that
  establishes home, modulates, and cadences in the new key (unit-tested,
  deterministic per seed). Seed varies the melodic surface; the drill is
  otherwise fully determined by Key × Destination × Strategy.
- The `doubleBarsBefore` on this study marks a modulation, not an act
  boundary — the ADR 0007 divider test special-cases it.

## Open questions / future work

- A "journey" mode chaining several modulations (e.g. around the circle
  of fifths) and an explicit-target-key option (beyond relationships).
- Applied/direct into distant keys could add enharmonic spellings; the
  current voicing is chromatic-but-simple.
