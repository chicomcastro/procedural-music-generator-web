# ADR 0004 — Practice: Duet Workshop study

- **Status**: Accepted
- **Date**: 2026-06-25
- **PR**: claude/practice-duet-workshop

## Context

The user asked for a way to generate dynamic duets to play with their partner, with control over:

- Which scales are allowed
- Which chord progression is used
- Which rhythm figures (note values) are allowed
- A "play together" focus — i.e. printable / readable sheet music

A scan of the codebase turned up that **most of this already exists** inside `Practice → Two-voice Invention`:

- Two independent voices generated via `generateCounterpoint` (`src/js/generate/counterpoint.js`)
- Scale override (`scaleId`), clef-per-voice picker, duet style (parallel thirds / sixths / contrary / call-and-response / free)
- Multi-language UI, persistence, share-URL deep-links, favorites
- OSMD-rendered MusicXML output, printable via the dedicated print path

The gaps for the partnered-practice use-case are:

1. **Rhythm vocabulary is too coarse**. The user gets 4 presets (`square`, `walking`, `flowing`, `syncopated`) that mix density + template; they can't say "only quarter and half notes, no eighths" — which is exactly the kind of constraint you want when one of the readers is a beginner.
2. **Chord progression is baked into the study's "acts"**. The user can't pick `ii-V-I` if they're working on a jazz fakebook; the invention drops them into `pop` → `minor_loop` → `fifties`, fixed by act.
3. **No "single-part view"**. Both voices always render on the sheet; a player wanting to focus on their own line has to mentally ignore the other staff. Same problem for printing — you can't easily hand each musician their own page.

## Decision

Ship a new Practice study **"Duet Workshop"** (`kind: 'duet-workshop'`) alongside the existing two-voice invention. The new study reuses the same generator pipeline (`buildTwoVoiceSong`) but exposes three additional controls:

### 1. Rhythm vocabulary — multi-toggle chips

A row of chips representing allowed note values:

- **Eighth** (0.5 beats)
- **Quarter** (1 beat)
- **Dotted quarter** (1.5 beats)
- **Half** (2 beats)
- **Dotted half** (3 beats)
- **Whole** (4 beats)

Default selection: `['quarter', 'half', 'eighth']` — a forgiving first-read vocabulary.

The selection is enforced by a post-processing pass `filterRhythmToVocab(onsets, allowed)` that runs after `generateRhythm`:

1. Drop onsets whose `atBeat` is off-beat (`atBeat % 1 !== 0`) when `eighth` is not in the allowed set.
2. Walk the remaining onsets and recompute each `durationBeats` as the gap to the next onset (or end of section).
3. Snap each duration to the largest allowed value `≤ gap`. If `gap` is smaller than every allowed duration, fall back to the smallest allowed.

The filter is deterministic and idempotent. It runs once per voice — voice 2 (the counterpoint) inherits the rhythmic shape of voice 1 inside `generateCounterpoint`, so applying the same vocab filter to both keeps them locked rhythmically while honoring the user's choice.

### 2. Progression picker — dropdown

Replaces the act's hard-coded `progression` field. Maps to the same `PROGRESSIONS` table used everywhere else in the codebase:

| ID | Label |
|----|-------|
| `pop` | I–V–vi–IV (default) |
| `fifties` | I–vi–IV–V (50s / doo-wop) |
| `jazz_ii_V_I` | ii–V–I |
| `minor_loop` | i–VI–III–VII |
| `pachelbel` | Pachelbel |
| `twelve_bar` | 12-bar blues |

The picker overrides `act.progression` only for the duet-workshop kind; existing studies are untouched.

### 3. Part view — segmented toggle

Three states:

- **Both voices** (default): render `melody` + `melody2` as two staves
- **Voice 1**: render only the `melody` staff
- **Voice 2**: render only the `melody2` staff

This is **display-only**. Audio playback always emits both voices, so each partner can practice their own part while hearing the other as backing.

Implementation: passed to `songToMusicXML` as a filtered `tracks` array. The MusicXML serializer already supports arbitrary track subsets — no change needed to the serializer.

## Implementation

- `src/js/ui/practice-studies.js` gains the new study definition + `RHYTHM_VOCAB`, `RHYTHM_VOCAB_DEFAULTS`, `PROGRESSION_OPTIONS`, `PART_VIEW_OPTIONS` constants.
- `src/js/ui/PracticeView.js`:
  - Extends `buildTwoVoiceSong` to accept `rhythmVocab` (Set of allowed duration IDs) and `progressionOverride` (string ID); when the study kind is `'duet-workshop'` these win over the act defaults.
  - Adds `filterRhythmToVocab(onsets, allowed, totalBeats)` helper.
  - `populateControls` renders the three new control elements only for `'duet-workshop'`; they stay hidden for other studies (no visual regression to the existing inventionn).
  - `regenerate()` filters `tracks` by the active part-view setting before calling `songToMusicXML`.
  - Persistence: three new keys on the per-study prefs (`rhythmVocab`, `progressionId`, `partView`).
- `src/app.html`: adds the new DOM nodes inside `#practice-controls`, hidden by default (revealed by `populateControls` for the duet-workshop study).
- `src/styles.css`: chip group styling reused from existing chip components.
- `src/js/ui/practice-translations.js`: PT / EN / ES labels for the new controls.

The new study has a **single act** — the user is composing their own piece, not following a structured 3-act etude. This simplifies the rail (a single "Duet" pill rather than the 3-act exposition / development / recapitulation pattern).

## Consequences

**Discoverability**: the new study appears in the Practice catalog under the `counterpoint` category, right next to the two-voice invention. The inventione still ships with its locked progression sequence — users who want guided practice keep that experience; users who want to explore freely get the workshop.

**File-format compatibility**: all new prefs are scoped to the new study's `byStudy[id]` blob, so existing users' prefs JSON is untouched.

**Share URLs**: the new pref fields ride along on the share URL via `buildShareUrl` / `applyShareParams`. Rhythm vocab serializes as a comma-separated string (`vocab=quarter,half,eighth`); progression and partView as plain strings.

**Audio vs. display**: part view only hides staves, never silences voices. A separate "solo" toggle (audio-mute one voice) could ship in a follow-up if users actually need it — easier to add later than to back out if it confuses people.

## Open questions / future work

- **Triplets and sixteenths**: not in the initial vocab. `generateRhythm` produces a half-beat grid, so adding finer subdivisions would require extending the generator's slot resolution. Out of scope for this ADR; the current vocab already covers the bulk of beginner-to-intermediate duet repertoire.
- **Per-voice rhythm vocab**: today's vocab applies to both voices uniformly. A "voice 1 quarters, voice 2 eighths" mode would unlock more interesting textures but adds a layer of UI; defer until requested.
- **Custom progressions**: typing in a degree string (`I-V-iv-IV-V/V-I`) instead of picking from the dropdown. Useful for advanced harmony practice but bigger UI surface than this ADR's scope.
- **MIDI export per part**: currently the share URL captures the seed + params so a duet can be reproduced exactly elsewhere. A "download Voice 2 MIDI" button would let a player practice with a backing track loaded in their DAW. Worth a follow-up if anyone asks.
