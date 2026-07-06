# ADR 0011 — Scale Etude: params bar vs. Adjust, and the score right-clip

- **Status**: Accepted
- **Date**: 2026-07-06
- **PR**: claude/etude-params-reorg
- **Extends**: ADR 0008 (parametric scale etude), ADR 0009 (start note), ADR 0010 (engraving)

## Context

Two issues after ADR 0010 shipped:

1. **The score clipped on the right.** ADR 0010 trimmed OSMD's page
   margins to kill the dead space on the *left*. But `.practice-sheet`
   carried `padding: 14px` on all four sides and `overflow: hidden`.
   OSMD sizes its `<svg>` to the element's `clientWidth` (which counts
   padding) yet lays the SVG out inside the content box — so the SVG
   overshot the right edge by the left-padding width and got clipped.
   The old large right margin had hidden it; the trim exposed it.

2. **The wrong knobs were front-and-center.** The params bar above the
   score held Pattern / Octaves / Note-value / Start-note. But *which
   scale* and *which key* you're drilling are the defining musical
   choices — they were buried in Adjust — while octave count and start
   register are register knobs that belong with the other fine-tuning.

## Decision

### Fix the right-clip

`.practice-sheet` loses its horizontal padding (`padding: 14px 0`). The
score's inset now comes entirely from OSMD's own symmetric page margins
(`EngravingRules.PageLeftMargin = PageRightMargin = 1.5`), so the SVG
width equals the content-box width and nothing overflows. Verified in a
headless Chromium render: SVG left/right edges land exactly on the sheet
box (no clip) at a 390 px mobile viewport.

### Params bar vs. Adjust

For `kind === 'scale-etude'` the params bar above the score now holds
the four *musical* choices, ordered outer→inner — **Key · Scale ·
Pattern · Note-value** — keeping the responsive 4→2→1 grid. The two
*register* knobs — **Octaves** and **Start note** — move down into the
Adjust panel.

- New `#practice-etude-scale` / `#practice-etude-key` selects live in the
  bar; they write the same `scaleId` / `keyPc` prefs the Adjust controls
  used, and changing Key resets the start note to default (as before).
- The Adjust panel's own Key + Scale rows (`#practice-key-field`,
  `#practice-scale-field`) are hidden for the etude to avoid duplicate
  controls; other studies keep them.
- `#practice-etude-octaves-field` / `#practice-etude-start-field` are
  relocated into the Adjust panel body (same ids, so the existing
  populate + show/hide logic is unchanged).

## Consequences

- No behavioural change to generation, prefs, share URLs, or favorites —
  only where the controls render. Existing links/snapshots still apply.
- Other study kinds are untouched: they never show the etude bar and
  keep Key + Scale in Adjust.

## Open questions / future work

- The etude's Scale still defaults to "Auto (per act)", which reads oddly
  now that Scale is a headline control for a single-act study. Leaving
  the default as-is (it resolves to major) to avoid changing behaviour;
  revisit if it confuses in practice.
