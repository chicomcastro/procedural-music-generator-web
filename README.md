# procedural-music-generator-web

Live: https://chicomcastro.github.io/procedural-music-generator-web/

A vanilla-JS web app that plays sampled piano notes via the Web Audio API and (in upcoming phases) generates music procedurally — scales, chord progressions, and melodies driven by a sample-accurate scheduler.

## Run locally

The app loads samples via `fetch`, so it needs an HTTP server (not `file://`):

```bash
cd src && python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Controls

- Mouse / touch on the keys.
- Keyboard: `A S D F G H J` for white keys, `W E T Y U` for black keys.
- `Z` / `X` to shift the keyboard mapping down / up an octave.

## Status

- [x] Phase 1 — Web Audio API core, polyphony, module split
- [x] Phase 2 — QWERTY keyboard input, first-gesture bootstrap
- [x] Phase 3 — Music theory modules (notes, scales, chords) — [tests](https://chicomcastro.github.io/procedural-music-generator-web/theory-tests.html)
- [x] Phase 4 — Lookahead scheduler + transport (metronome)
- [x] Phase 5 — Procedural generators (progression, rhythm, melody)
- [x] Phase 6 — Multi-octave keyboard rendering + Z/X octave shift
- [ ] Phase 7 — Visualizer + UI controls
- [ ] Phase 8 — MIDI / WAV export
