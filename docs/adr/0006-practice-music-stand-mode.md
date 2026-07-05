# ADR 0006 — Practice: music-stand mode

- **Status**: Accepted
- **Date**: 2026-07-05
- **PR**: claude/practice-stand-mode
- **Extends**: ADR 0005 (this is the roadmap's "PR P" — the first polish item driven by real duet use)

## Context

The owners read the generated score from a device propped on a music stand while playing. The regular Practice layout is built for *configuring* a study (controls, catalog, playback bar), not for *reading* one from a meter away:

- The score shares the screen with chrome (sidebar, header, controls).
- A full piece doesn't fit one screen, and touching a tablet mid-piece to scroll is not an option when both hands hold an instrument.
- Screens sleep mid-piece.

## Decision

Add a **music-stand mode** to the Practice study player: a full-screen, paper-like reading surface with page turning, zoom, and a screen wake lock.

### Mechanics

**Full-screen via CSS class, not DOM surgery.** Entering stand mode adds `practice-stand-mode` to `<body>`; CSS pins `#practice-sheet` to the viewport (fixed, inset 0, white background) above everything else. This mirrors the existing `practice-printing` pattern and — critically — never moves the sheet container in the DOM, so the OSMD instance bound to it stays valid. OSMD is initialised with `autoResize: true`, so the container's new size triggers a re-render on its own; we additionally set the stand zoom explicitly.

**Page turning = stepped scrolling.** OSMD renders one continuous score into the container. Stand mode keeps `overflow: hidden` and steps `scrollTop` by one viewport height per turn. Page count is `ceil(scrollHeight / clientHeight)`. This was chosen over OSMD's own `pageFormat` pagination because it needs no re-initialisation, works with any zoom level, and degrades gracefully.

**Page-turn inputs** (all equivalent):
- Tap zones: right third of the screen = next, left third = previous.
- Keys: `ArrowRight` / `ArrowLeft`, `PageDown` / `PageUp`, `Space` (next).
- The key set is deliberate: **Bluetooth page-turn pedals** (AirTurn, PageFlip, Donner) emulate exactly these keys, so pedal support comes for free.

**Zoom**: `+` / `−` buttons step `practiceOSMD.zoom` between 0.5× and 2.5× and re-render. Persisted globally (`prefs.standZoom`) — the right size for a given stand distance doesn't change per study. On exit, the regular width-based zoom heuristic is restored.

**Wake lock**: `navigator.wakeLock.request('screen')` on enter, released on exit; re-acquired on `visibilitychange` (the lock is lost when the tab is backgrounded). Wrapped in try/catch — unsupported browsers just keep their normal sleep behaviour.

**Browser fullscreen**: requested on enter (`requestFullscreen`) and exited on leave, both best-effort. Leaving browser fullscreen (Esc) also exits stand mode so the two never desync. Our own CSS overlay is the real mechanism; the Fullscreen API is progressive enhancement.

**Playback stays available**: the toolbar keeps a play/stop button wired to the existing `playSong`/`stopPlayback`, so one partner can hear the piece while reading.

### UI

- Entry: a "stand" icon button in the study header, next to print/share/favorite.
- In stand mode: a slim auto-fading toolbar at the bottom (page indicator, prev/next, zoom, play, exit). Exit also via `Escape`.

## Consequences

- **No new view, no new route** — stand mode is a state of the Practice study player. Deep links, prefs, and the catalog are untouched.
- The sheet container gets a scroll-position reset when entering/exiting so pages always start aligned.
- jsdom tests can exercise everything except real OSMD rendering (page math is tested against stubbed `scrollHeight`/`clientHeight`).

## Open questions / future work

- **Auto page turn during playback** — the playback timer knows elapsed/total; mapping that to scroll position would turn pages hands-free while the backing plays. Deferred until real sessions ask for it.
- **Two-device sync** — each partner reads their own part on their own tablet, pages synced. Way out of scope; noted for dreaming purposes.
