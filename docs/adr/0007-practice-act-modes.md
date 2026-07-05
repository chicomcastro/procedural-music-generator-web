# ADR 0007 — Practice: movements vs. exercises (act modes)

- **Status**: Accepted
- **Date**: 2026-07-05
- **PR**: claude/practice-act-modes
- **Extends**: ADR 0005 (practice-first)

## Context

Every Practice study is structured as a list of "acts", rendered as one
continuous score with double bars between acts. Real use surfaced that
this conflates two different things:

1. **Movements of one piece** — the Two-voice Invention's Exposition →
   Development → Recapitulation is *musically* one performance: you play
   it top to bottom, the key modulates between movements, the double
   bars are real. The continuous score is right.

2. **Bundles of unrelated drills** — the Walking-Bass Workout's acts are
   "quarter pulse @ 80", "ii–V–I @ 100", "12-bar blues @ 130": three
   different exercises with different progressions and different tempos.
   Nobody plays them as one continuous piece; you drill one at a time.
   Rendering them as one long score is awkward, and it hides an actual
   bug: **the whole score plays at act I's tempo** (`actBpm` only takes
   the first act's value), so "blues @ 130" was silently playing at 80.

The same applies to the Scale Etude (each pattern is its own drill) and
the Modal Vamp (one mode per act — you drill one mode at a time).

## Decision

Each study declares an **`actMode`**:

- **`'movements'`** (default) — current behaviour. One continuous score,
  passive act rail, double bars, per-act key changes. Studies:
  Two-voice Invention, Solo Etude (it mirrors the invention), Duet
  Workshop (single act; unaffected).
- **`'exercises'`** — the act rail becomes **tabs**. Only the selected
  act is generated, rendered and played — at **its own tempo** (fixing
  the tempo lie). The selection persists per study (`prefs.actIdx`) and
  rides the share URL (`act=N`). Studies: Walking-Bass Workout, Scale
  Etude, Modal Vamp.

### Why tabs instead of splitting the catalog

Splitting the workout into three catalog cards was considered and
rejected: it triples catalog surface (against ADR 0005's "fewer
surfaces, more depth"), multiplies prefs/favorites/share plumbing, and
loses the pedagogical grouping (the three walking-bass drills belong
together — they're one *practice program*, just not one *piece*).

### Implementation shape

The five song builders all iterate `study.acts`, so exercise mode needs
no builder changes: the dispatcher hands them a filtered study
(`{ ...study, acts: [acts[actIdx]] }`). Single-act side effects come out
right automatically — one key signature, no double bars, the act's own
tempo, and a shorter score that fits the music-stand mode (ADR 0006) in
fewer pages.

Eyebrow copy changes from "3 acts" to "3 exercises" for the three
converted studies (EN/PT/ES).

## Consequences

- **Backwards compatible**: `actMode` defaults to `'movements'`;
  existing prefs gain `actIdx: 0` via backfill; old share URLs (no
  `act=`) open exercise-mode studies on their first exercise.
- **Tempo display is now honest** for exercise-mode studies.
- Favorites snapshot the selected exercise (actIdx joins the favorite
  key), so "blues @ 130 in Bb" can be favorited independently of the
  pulse drill.

## Open questions / future work

- Per-movement tempo *within* movements mode (the invention declares
  80/90/84 but plays at 80 throughout). Requires per-act bpm scheduling
  in playback; deferred — the declared tempos are close and the score
  doesn't advertise them per act.
