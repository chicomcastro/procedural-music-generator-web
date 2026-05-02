# Architectural Decisions

A compressed log of the load-bearing calls made across phases 1–9. PR descriptions hold the granular rationale; this file is the index for someone arriving cold.

Format follows a stripped-down [ADR](https://adr.github.io/): Context · Decision · Consequences · Alternatives considered.

---

## ADR-001 · Web Audio API as the sole audio path

**Status:** Accepted (Phase 1)

**Context.** The original prototype used `HTMLAudioElement` per note. It produced three latent bugs (`currentTime = 10` past the buffer end, `volume -= 0.1` drifting below 0, single-instance reuse killing polyphony) and a fundamental ceiling: `HTMLAudioElement.play()` is async, returns a Promise, and cannot drive a groove at 140 BPM without audible jitter. Every later phase (scheduler, generators, export) needs sample-accurate timing.

**Decision.** Replace HTMLAudio wholesale in Phase 1. All audio flows through a single `AudioContext` with a master `GainNode` → `DynamicsCompressorNode` → destination graph.

**Consequences.**
- Bugs disappeared by construction — no patching required.
- Polyphony, envelopes, and sample-accurate scheduling are trivial.
- Multi-octave (Phase 6) came almost for free via `AudioBufferSourceNode.playbackRate`.
- Pays a one-time autoplay-policy cost: `AudioContext.resume()` must be triggered from a user gesture.
- iOS Safari requires a one-sample silent buffer "primer" inside the first gesture handler.

**Alternatives.** Patch the HTMLAudio bugs and live with timing jitter — would have blocked the scheduler, generators, and export. Rejected.

---

## ADR-002 · No bundler, no third-party dependencies

**Status:** Accepted (Phase 1, reaffirmed in 3 and 8)

**Context.** Modern browsers natively load `<script type="module">`. Adding Vite/webpack pays for itself when there are real dependencies; we have none.

**Decision.** Static files only. No `package.json`, no `node_modules`, no build step. Re-evaluate only if a load-bearing dependency appears (e.g. `@tonejs/midi`).

**Consequences.**
- Zero install. `cd src && python3 -m http.server` is the entire dev workflow.
- GitHub Pages deploy is just `actions/upload-pages-artifact` over `src/`.
- Phase 3 (theory) is ~150 lines instead of one line + a Tonal.js import.
- Phase 8's MIDI writer is ~80 lines hand-rolled instead of one `@tonejs/midi` call.
- We pay the maintenance cost of those ~230 lines forever.
- Cannot use TypeScript, JSX, npm packages, or anything requiring transformation.

**Alternatives.** Add Vite + npm — premature given no deps, and adds a friction floor for contributors.

---

## ADR-003 · MIDI numbers as the universal internal note representation

**Status:** Accepted (Phase 3)

**Context.** Notes need to flow between the theory engine, generators, scheduler, sampler lookup, visualizer, and MIDI export. Strings (`"C#4"`/`"Db4"`) suffer enharmonic ambiguity and require parsing at every boundary; frequencies (Hz) are hard to do arithmetic on; scale-degree integers lose absolute pitch.

**Decision.** Pass integer MIDI numbers everywhere. Convert to/from name strings only at I/O boundaries (UI labels, MIDI export).

**Consequences.**
- `transpose(midi, n) = midi + n`. Octave detection is `Math.floor(midi / 12)`. No edge cases.
- `pitchClass(midi) = midi % 12` is the universal modular operation; scales, chords, and `isInScale` use it directly.
- `SampleLibrary.getPlaybackFor(midi)` is pure lookup.
- Enharmonic spelling (`C#4` vs `Db4`) is a **display** concern — `midiToName` takes a `{ flats }` flag.
- Loses key-signature context — for music *notation* this would be a real problem, but we don't render staves.

**Alternatives.** A `Note` class with `{ pitchClass, octave, accidental }` — extra ceremony, no benefit for this codebase.

---

## ADR-004 · Lookahead scheduler against `AudioContext.currentTime`

**Status:** Accepted (Phase 4)

**Context.** `setInterval`/`setTimeout` drift by tens of milliseconds and worsen when the tab is backgrounded; `requestAnimationFrame` is locked to display refresh and pauses entirely when the tab is hidden. Neither can drive musical timing on its own.

**Decision.** Implement Chris Wilson's "[A Tale of Two Clocks](https://web.dev/articles/audio-scheduling)" pattern. A `setInterval(tick, 25)` polls; inside `tick`, a while-loop schedules every event whose start time falls within `audioCtx.currentTime + 0.1s` via `source.start(when)`. The audio clock is sample-accurate; the JS clock is just a queueing trigger.

**Consequences.**
- Timing jitter is bounded by the AudioContext's sample period (~22µs at 44.1kHz), not by the JS event loop.
- Live BPM changes apply on the next scheduled note — no jerk — because `Transport.beatDuration` is a getter computed from the current `bpm`.
- Phase 5 generators plug into a single `onBeat(beat, when)` callback; no audio coupling.
- Background-tab throttling (≥1s `setInterval` interval) can cause stutter when the tab is hidden. Acknowledged; not fixed.

**Alternatives.** Pure `setInterval` for both polling *and* trigger — drifts audibly past 80 BPM. `AudioWorklet` scheduler — overkill, but the natural next step if background tabs ever matter.

---

## ADR-005 · A new `AudioBufferSourceNode` per attack

**Status:** Accepted (Phase 1, formalised in Phase 5)

**Context.** `AudioBufferSourceNode` is single-use by spec — it can be `start()`ed exactly once. The original code reused a single `Audio` element per note; this is what killed polyphony and same-note retriggers.

**Decision.** Each note attack constructs a new `AudioBufferSourceNode` + `GainNode` (the "Voice"), wires it to the master gain, and lets the `onended` callback disconnect. For procedural notes, the gain ramp at `when + duration` auto-releases the voice; for piano input, the caller invokes `release()` on key-up.

**Consequences.**
- Polyphony is free. Same-key retrigger fades the previous voice over 50ms while the new attack rises.
- No node pooling, no allocation churn worth caring about — the GC handles voices of ~0.5–4s lifetimes fine.
- The Voice module accepts the same `(ctx, destination, opts)` signature for both live and `OfflineAudioContext` use; Phase 8's WAV export reuses it with zero modification.

**Alternatives.** Pool source nodes — adds bookkeeping for no measured gain.

---

## ADR-006 · Pitch-shift samples via `playbackRate` instead of loading multi-octave assets

**Status:** Accepted (Phase 1, exercised in Phase 6)

**Context.** The repo ships 12 piano samples (C3–B3). Generators emit MIDI numbers across ~3 octaves. Either we load 36+ samples (~20MB), pitch-shift the existing 12, or switch to oscillator synthesis.

**Decision.** Pitch-shift via `AudioBufferSourceNode.playbackRate`. `SampleLibrary.getPlaybackFor(midi)` returns `{ buffer, playbackRate }` using nearest-neighbor lookup over loaded samples.

**Consequences.**
- Zero extra assets, instant first-load.
- Quality is good within ±6 semitones of a sample, acceptable to ±12, charmingly toy beyond that. We constrain melody range to keep within ±9 most of the time.
- Note duration scales inversely with `playbackRate`, so high notes are shorter — matters less than expected because the gain envelope dominates perceived length.

**Alternatives.** Load 48+ samples — best quality, ~20MB load. Defer to a productisation phase. Switch to synthesis (`OscillatorNode` + filter + envelope) — would change the timbre but unlocks any pitch; reasonable as a *selectable* instrument later.

---

## ADR-007 · Weighted Markov generators with a seedable PRNG

**Status:** Accepted (Phase 5)

**Context.** "Procedurally generated music" spans uniform-random noodling all the way to RNN-trained models. We need something that:
- produces musically plausible 4–8 bar loops,
- runs in ~1ms per generation in vanilla JS,
- supports `Generate` button → shareable seed → reproducible result.

**Decision.** Weighted random walk over scale tones with chord-tone bias on strong beats. Distance weighting favours stepwise motion (±1–2 semitones at ~3.0) over leaps (>7 semitones at ~0.1). Final note resolves to tonic. Driven by [`mulberry32`](https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32) — a 5-line seedable PRNG.

**Consequences.**
- Output sounds musical. Stepwise motion + chord tones + tonic resolution covers 80% of what makes a phrase feel intentional.
- Same seed → identical song. Filenames in Phase 8 use the seed, so MIDI/WAV exports are referenceable.
- No long-range structure (no verse/chorus). Acceptable for short loops; expected ceiling.
- The transition matrix is implicit in `distanceWeight(c, prev)` — easy to tune, hard to reason about formally.

**Alternatives.** Uniform random — sounds aimless. RNN-driven — overshoots the project's complexity budget by an order of magnitude. Grammar-based / L-system — interesting but adds a DSL; revisit if structural composition becomes a goal.

---

## ADR-008 · `OfflineAudioContext` for WAV export, hand-rolled SMF for MIDI

**Status:** Accepted (Phase 8)

**Context.** Two separate questions — one audio, one symbolic.

For WAV: `MediaRecorder` records the live `AudioContext` in real time and outputs WebM/Opus by default. `OfflineAudioContext` re-renders faster than real time, deterministically, and produces a clean `AudioBuffer`.

For MIDI: `@tonejs/midi` is excellent and well-tested. Adding it forces a bundler — see ADR-002.

**Decision.** WAV export uses `OfflineAudioContext` + a hand-written 16-bit PCM encoder. MIDI export is ~80 lines of hand-rolled Format-0 SMF writer. Both reuse `Voice.js` and `SampleLibrary` unchanged.

**Consequences.**
- WAV is faster than real time, byte-identical for a given seed (modulo sub-sample noise), no codec ambiguity.
- MIDI is portable, deterministic, and `@tonejs/midi` doesn't gatecrash the dependency surface.
- We own ~150 total lines of binary format code we have to keep correct. Both formats are stable enough that this is fine forever.
- AudioBuffers are reused across `AudioContext` and `OfflineAudioContext` — supported by the spec, confirmed working in Chrome/Firefox/Safari.

**Alternatives.** `MediaRecorder` for WAV — realtime-only and codec-fragile. `@tonejs/midi` for MIDI — would require dropping ADR-002.

---

## ADR-009 · Shareable URLs with full state in query params

**Status:** Accepted (Phase 9)

**Context.** The seed-based PRNG (ADR-007) already makes songs reproducible, but sharing requires the user to communicate seed + BPM + scale + tonic + bars + time signature out-of-band. This is the app's strongest differentiator — and it was invisible.

**Decision.** Encode all generation parameters (`seed`, `bpm`, `time`, `tonic`, `scale`, `bars`) in URL query params. `history.replaceState` updates the URL on every parameter change; a "Share" button copies the full URL to clipboard. On load, `applyUrlParams()` reads the search string and populates controls before the first `regenerateSong` call.

**Consequences.**
- A shared URL reproduces the exact song + tempo + feel. No side-channel needed.
- URL stays stable — same seed + params = same URL = same bookmark.
- Browser back/forward doesn't cycle through parameter changes (replaceState, not pushState). Acceptable — music parameters aren't navigation.
- Clipboard API requires secure context (HTTPS or localhost); GitHub Pages satisfies this.

**Alternatives.** `pushState` per change — pollutes browser history. Fragment (`#`) encoding — less readable and not sent to server if we ever add analytics.

---

## ADR-010 · Genre presets as data attributes on buttons

**Status:** Accepted (Phase 9)

**Context.** New users face a cold-start problem: 5+ dropdowns, no intuition about which combinations sound good. Presets solve this by offering curated starting points.

**Decision.** HTML buttons with `data-bpm`, `data-scale`, `data-tonic`, `data-bars`, `data-time` attributes. JS reads the dataset and sets all controls + transport in one handler. Active preset is highlighted; any manual parameter change clears it.

**Consequences.**
- Adding a preset is one HTML line — no JS changes needed.
- Presets are opinionated but not locked — user can tweak any parameter after clicking.
- No runtime cost; data attributes are parsed on click, not at load.

**Alternatives.** JSON config file — extra fetch for a flat list. JS object map — works but duplicates what HTML data attributes do natively.

---

## ADR-011 · Mixer console with vertical faders

**Status:** Accepted (Phase 9)

**Context.** Volume, EQ, reverb/delay controls were scattered across different sections. User requested a mixing-console layout.

**Decision.** Consolidated into a dedicated Mixer section with vertical fader channel strips (MEL, CHD, BASS, DRM, CLK, REV, DLY, HI, MID, LO, MAIN). Used CSS `transform: rotate(-90deg)` for vertical range inputs (`writing-mode` approach failed cross-browser). Each channel has label, pan knob, fader, value display, mute and solo buttons.

**Consequences.**
- Single mental model for all audio controls.
- Vertical faders needed absolute positioning with rotation transform.
- Pan knobs use percentage-based `left` positioning.

**Alternatives.** `writing-mode: vertical-lr` (failed in Safari), custom canvas-drawn faders (overkill for range inputs).

---

## ADR-012 · Per-track StereoPannerNode for panning

**Status:** Accepted (Phase 9)

**Context.** User requested stereo positioning per track, like a real mixer.

**Decision.** Create one `StereoPannerNode` per track (melody, chord, bass, drum, click) during `AudioEngine.init()`. All track audio routes through its panner before reaching `masterGain`. Pan range −1 (left) to +1 (right).

**Consequences.**
- Near-zero CPU overhead (`StereoPannerNode` is lightweight).
- Click track also gets its own panner for independent positioning.
- Double-click pan knob resets to center.

**Alternatives.** Manual gain-based panning with two channels (more code, same result).

---

## ADR-013 · Three-mode click track

**Status:** Accepted (Phase 9)

**Context.** User wanted more granular metronome control than on/off.

**Decision.** Cycle button with 3 modes: off → all beats (accent on downbeat) → downbeat only. Replaces the old checkbox. Click routes through its own mixer channel (CLK) with volume and pan.

**Consequences.**
- Click is now a first-class mixer channel.
- SVG metronome icon replaces emoji.
- Mode stored as `data-mode` attribute (0/1/2).

**Alternatives.** Two separate checkboxes (cluttered UI). Dropdown select (slower interaction).

---

## ADR-014 · Piano keyboard with measured black key positioning

**Status:** Accepted (Phase 9)

**Context.** Black keys were positioned using CSS gaps between subgroups, which broke at different key widths. User reported misalignment.

**Decision.** Each black key is absolutely positioned using pixel values calculated from the measured white key `offsetWidth` (via `requestAnimationFrame` after DOM render). Offsets: C#=0.75, D#=1.75, F#=3.75, G#=4.75, A#=5.75 white-key-widths from octave start.

**Consequences.**
- Perfect alignment at any screen size.
- Keys use `box-sizing: border-box` for predictable widths.
- Range extended to 6 octaves (C1–B6) to cover bass notes.

**Alternatives.** Percentage-based positioning (broke due to flex container width mismatch). Fixed pixel offsets (broke on mobile).

---

## ADR-015 · Two-phase product roadmap

**Status:** Accepted (Phase 9)

**Context.** App evolved from a procedural music playground. User wants to enable composition on top of generated material (locked bars was the first step).

**Decision.** Phase 1 — evolve the current playground (song sections, chord picker, melody contour, better lock workflow, note editing). Phase 2 — new `editor.html` with timeline/arrangement, per-section seeds, full piano roll, undo/redo.

**Consequences.**
- Phase 1 features must be backward-compatible with current single-page app.
- Phase 2 creates a separate entry point sharing JS modules.
- No attempt to become a full DAW — the differentiator is seed-based procedural generation as a composition starting point.

**Alternatives.** Evolve into a full DAW (rejected — years of work, crowded market). Stay as playground only (rejected — user wants composition workflow).

---

## Decisions explicitly *not* made

These came up during planning but were postponed; recording them so the next contributor doesn't redo the analysis.

- **AudioWorklet scheduler.** Would fix background-tab throttling. Not implemented because backgrounded music is rare and the cost is real.
- **Voice leading (`voiceLead(prev, next)`).** Would smooth chord transitions in Phase 5. Skipped because block chords down an octave hide most of the awkwardness; revisit if arpeggios land.
- **Roman-numeral parser for chord progressions.** `chordFromDegree` walks the scale by thirds and lets quality emerge — handles modes uniformly and avoids parsing ambiguity. Add a parser only when secondary dominants / borrowed chords appear.
- **TypeScript.** Forces a bundler (ADR-002). Re-evaluate if the codebase doubles.
