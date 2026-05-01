# SeedSong

**Infinite piano melodies from a single seed number.**

[Try it live](https://chicomcastro.github.io/procedural-music-generator-web/) — no install, no sign-up.

SeedSong generates procedural piano music right in your browser using the Web Audio API. Pick a scale, set a tempo, and let the algorithm compose melodies and chord progressions. Every song is determined by a seed number — share it and anyone can hear the exact same piece.

## Features

- **Playable piano** — click, touch, or use your keyboard (A–J white, W/E/T/Y/U black, Z/X to shift octave)
- **Procedural generation** — weighted Markov walk over scale tones with chord-tone bias produces musical-sounding loops
- **Genre presets** — Lo-fi, Jazz, Classical, Blues, Dark, Funk — one click sets tonic, scale, BPM, and bars
- **Seed-based sharing** — same seed = same song. Share a URL and the recipient hears your exact melody with all settings
- **MIDI + WAV export** — download your song to import into a DAW or use as an audio file
- **Visualizer** — piano keys glow in real time as the scheduler triggers notes
- **Zero dependencies** — vanilla JS, no build step, no npm

## Run locally

The app loads samples via `fetch`, so it needs an HTTP server:

```bash
cd src && python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Controls

| Input | Action |
|-------|--------|
| Mouse / touch | Play piano keys |
| `A S D F G H J` | White keys |
| `W E T Y U` | Black keys |
| `Z` / `X` | Shift octave down / up |
| Preset buttons | Set genre-appropriate parameters |
| Share button | Copy URL with all settings to clipboard |

## Architecture

Vanilla JS with ES modules. No bundler, no framework, no dependencies — by design ([ADR-002](docs/decisions.md#adr-002--no-bundler-no-third-party-dependencies)).

```
src/js/
  audio/      AudioContext, sample loading, voices, click
  theory/     Notes, scales, chords (pure functions)
  scheduler/  Lookahead scheduler + transport
  generate/   Progression, rhythm, melody, song (seedable PRNG)
  export/     MIDI (Format 0) + WAV (16-bit PCM)
  ui/         Piano rendering + keyboard input
```

For the reasoning behind the key architectural decisions, see [`docs/decisions.md`](docs/decisions.md).

## Development phases

- [x] Phase 1 — Web Audio API core, polyphony, module split
- [x] Phase 2 — QWERTY keyboard input, first-gesture bootstrap
- [x] Phase 3 — Music theory modules (notes, scales, chords) — [tests](https://chicomcastro.github.io/procedural-music-generator-web/theory-tests.html)
- [x] Phase 4 — Lookahead scheduler + transport (metronome)
- [x] Phase 5 — Procedural generators (progression, rhythm, melody)
- [x] Phase 6 — Multi-octave keyboard rendering + Z/X octave shift
- [x] Phase 7 — Visualizer (keys glow as the scheduler triggers notes)
- [x] Phase 8 — MIDI / WAV export
- [x] Phase 9 — Product polish (branding, i18n, sharing, presets, responsive, a11y)
