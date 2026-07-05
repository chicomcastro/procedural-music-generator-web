# ADR 0005 — Product vision: practice-first

- **Status**: Accepted
- **Date**: 2026-07-05
- **PR**: claude/adr-0005-product-vision
- **Scope**: product direction (not a code change)

## Context

The repository has grown into **three products sharing one navigation**:

| Embedded product | Views | Implicit audience |
|---|---|---|
| Generative toy / consumption | Generator, Explore (feed + Wrapped), Radio | Casual curious visitors |
| Creation tool | Compose (sections, transitions, stems, mix) | Hobby producers |
| Practice shelf | Practice, Learn | Amateur instrumentalists who read notation |

Each pulls design decisions in a different direction (frictionless feed vs. DAW density vs. clean printable notation), which is why the app feels inconsistent as a whole: consistency comes from choosing, and no choice had been made.

Two signals identified the real product:

1. **Depth of investment.** Practice/Learn contain the most careful code in the repo: per-clef tessituras calibrated to real instruments, method-book patterns, counterpoint modes, difficulty scaling, printing, reproducible share URLs, full i18n.
2. **The confirmed real user.** The owner and his wife practicing duets together. The only feature request born from genuine use (the Duet Workshop, ADR 0004) was a practice feature — and 80% of what it needed already existed in Practice.

The README and repo description sell products 1 and 2 ("DAW-style UI, full mixer, MIDI/WAV export") while the app's soul is product 3.

## Decision

**SeedSong is a practice-first tool, built primarily for its owners: a couple of amateur instrumentalists who practice together.**

### Vision

> SeedSong turns a number into a playable piece of sheet music — at our level, for our instruments, in our clefs — so no practice session ever repeats the last one. An infinite shelf of duets.

### Target audience

- **Primary**: the project's owners — two amateur string players who read bass/treble clef and practice together (duets as the primary case, solo as the special case).
- **Generalization** (if ever opened up): pairs who practice together — couples, friends, teacher + student. Not producers, not casual listeners.

### Ambition

Personal tool, polished for its two users. No market pressure, no monetization, no growth targets. The success metric for every decision: **does this make our practice session together better?**

### Product principles

1. **The sheet music is the product.** Screen or paper. Audio is backing/support, never the destination.
2. **Every piece is a seed.** Reproducible, shareable by link, favoritable. "Play seed 4217 with me" is the core interaction.
3. **Two players first.** Every feature considers the duet as the primary case; solo is the derived case.
4. **Difficulty is a dial, not a wall.** Everything scales from first-read to challenge.
5. **Fewer surfaces, more depth.** A feature that doesn't serve the practice session must justify its navigation slot.

### Non-goals

- Music production (competing with DAWs) — the audio engine stays simple on purpose.
- Casual generated-music consumption (competing with AI-music services).
- Monetization, accounts, growth.

## Consequences — what happens to each area

| Area | Decision |
|---|---|
| **Practice** | Becomes the home view and flagship. Duet Workshop featured first. |
| **Learn** | Kept as the theory track that feeds practice. Bridge CTAs: module → "generate a study of this". |
| **Generator** | Demoted from destination to engine + advanced playground. Leaves primary navigation. |
| **Explore** | Removed from navigation (code kept initially; delete later if unmissed). A consumption feed doesn't serve two-player practice. |
| **Radio** | Same as Explore. |
| **Compose** | Frozen, not deleted. Candidate future repositioning: "Recital" — assembling multi-movement practice programs (the transitions / tempo-ramps / pivot notes from ADRs 0001–0003 fit that framing). Decide after real use. |
| **Settings** | Kept. |
| **README / repo description** | Rewritten to state the practice-first identity (ships with the navigation change so the statement matches reality). |

Removals are **navigation-level first** (reversible); code deletion only after the owners confirm nothing is missed.

## Roadmap

- **PR M** (this one): this ADR — the decision record.
- **PR N**: practice-first navigation — Practice as default view, Explore/Radio out of the nav, Generator demoted; README rewritten to match.
- **PR O**: Learn → Practice bridge (CTAs from scale/progression modules into generated studies).
- **PR P+**: duet-session polish driven by real use — e.g. full-screen "music stand" score mode, per-part MIDI export, whatever the next practice session shows is missing.

## Open questions

- Does Compose earn the "Recital" repositioning or eventual deletion? Answer with usage, not speculation.
- Should the Explore taste data (likes) ever feed practice material selection? Only if a real session ever wants "more pieces like that one".
