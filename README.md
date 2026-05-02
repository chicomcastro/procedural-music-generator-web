# SeedSong

**Infinite piano melodies from a single seed number.**

[Try it live](https://chicomcastro.github.io/procedural-music-generator-web/) — no install, no sign-up.

SeedSong generates procedural music right in your browser using the Web Audio API. Pick a scale, set a tempo, choose a mood, and let the algorithm compose multi-section songs with melody, chords, bass, and drums. Every song is determined by a seed number — share it and anyone can hear the exact same piece.

## Features

- **DAW-style layout** — fixed score canvas, tabbed controls (Generator / Mixer / History / Export / Gallery), sticky transport bar
- **Multi-section songs** — intro, verse, chorus, outro with contrasting energy — not just looping phrases
- **Playable piano** — click, touch, or use your keyboard (A–J white, W/E/T/Y/U black, Z/X to shift octave)
- **Procedural generation** — weighted Markov walk over scale tones with chord-tone bias and selectable contour/rhythm templates
- **Genre & mood presets** — Lo-fi, Jazz, Classical, Blues, Chill, Energetic, Dreamy — one click sets everything
- **Full mixer console** — per-track volume, pan, mute/solo, 3-band EQ, reverb presets (room/hall/cathedral), delay, chorus
- **Seed-based sharing** — same seed = same song. Share a URL and the recipient hears your exact melody with all settings
- **Multi-track MIDI + WAV export** — Format 1 MIDI with separate tracks per instrument, or render to WAV
- **Score canvas editing** — click to select notes, drag to move, resize edges, delete with Backspace
- **Settings persistence** — mixer volumes, EQ, effects, and active tab survive page reloads
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
  audio/      AudioContext, sample loading, voices, effects, click
  theory/     Notes, scales, chords (pure functions)
  scheduler/  Lookahead scheduler + transport
  generate/   Progression, rhythm, melody, song (seedable PRNG)
  export/     MIDI (Format 1 multi-track) + WAV (16-bit PCM)
  ui/         Piano, score canvas, history, gallery, theme, shortcuts
```

For the reasoning behind the key architectural decisions, see [`docs/decisions.md`](docs/decisions.md).


