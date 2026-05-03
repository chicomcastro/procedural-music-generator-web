# SeedSong Product Backlog

Three-phase roadmap to evolve SeedSong from a procedural music playground into an assisted composition tool.

**Motivation:** The seed-based generation is the differentiator — no DAW does this. The locked-bars feature was the first step toward composition. This backlog extends that vision: first make exploration richer (Phase 1), then enable multi-voice composition and professional export (Phase 2), then build a full arrangement editor (Phase 3).

**Principles:**
- Phase 1 is backward-compatible with the current single-page app
- Phase 2 extends the app with multi-voice generation and sheet music visualization
- Phase 3 creates a separate entry point (`editor.html`) sharing JS modules
- No attempt to become a full DAW — the value is "seed → refine → export"
- Quick wins first, structural changes after

---

## Phase 1 — Creative Playground

Evolve the current exploration experience. Same interface, enhanced features.

---

### 1.1 · Mood Presets

**Status:** Done
**Priority:** P0 | **Size:** S

**Context:** The existing genre presets (Lo-fi, Jazz, etc.) proved the concept works — one click transforms the whole feel. But they're genre-locked. Users want emotional/energy-based presets too.

**Objective:** Add curated "mood" presets (Chill, Energetic, Melancholic, Dreamy, Aggressive, etc.) that bundle density, swing, scale, tempo, voice, reverb, and delay into one click. Lower the barrier for non-musicians and surface the generator's range.

**Implementation notes:**
- Same mechanism as current presets (`data-*` attributes on buttons)
- Add a second row of preset buttons or a dropdown grouped by category
- Presets are opinionated but not locked — user can tweak after clicking
- File: `src/app.html` (buttons), `src/js/main.js` (listeners)

---

### 1.2 · Chord Progression Picker

**Status:** Done
**Priority:** P0 | **Size:** S

**Context:** Currently the chord progression is randomly selected from 6 hardcoded options in `PROGRESSIONS` (in `src/js/generate/progression.js`). The seed determines which one. Users can't choose or even see which progression is playing.

**Objective:** Let users choose or pin a specific chord progression. Show the active progression name (e.g., "I-V-vi-IV") and allow cycling through options without changing seed. Pinned progressions survive regeneration.

**Implementation notes:**
- Add a `<select>` or button group in the Generator section
- Options: "Auto (from seed)" + each named progression
- When pinned, `generateSong` uses the selected progression instead of deriving from seed
- Display current progression in `#song-info`
- File: `src/js/generate/progression.js`, `src/js/generate/song.js`, `src/app.html`

---

### 1.3 · Song Structure (Sections)

**Status:** Done
**Priority:** P0 | **Size:** L

**Context:** Songs currently loop a single N-bar phrase forever. Real music has intro, verse, chorus, bridge, outro — sections with contrasting energy and melodic material. This is the single biggest upgrade for making generated music feel "real."

**Objective:** Extend `generateSong` to produce multi-section songs (intro/verse/chorus/outro) by chaining multiple 4/8-bar generations with contrasting parameters (different density, progression, octave range) derived from the same seed.

**Implementation notes:**
- Seed derives sub-seeds for each section (e.g., `mulberry32(seed + sectionIndex)`)
- Each section can have different density, progression, octave shift
- Score canvas shows section boundaries with labels
- Transport/progress bar reflects total song length
- Sections could be: Intro (4 bars, sparse) → Verse (8 bars) → Chorus (8 bars, dense) → Verse → Chorus → Outro (4 bars, fade)
- Locked bars persist per-section
- File: `src/js/generate/song.js` (major refactor), `src/js/ui/ScoreCanvas.js`

---

### 1.4 · Melody Contour Control

**Status:** Done
**Priority:** P1 | **Size:** M

**Context:** `melody.js` uses `distanceWeight` to bias note selection toward or away from the previous note. But there's no directional control — melodies wander randomly within the scale.

**Objective:** Add a contour parameter (ascending, descending, arc, wave, flat) that biases the melody generator, giving users directional control without manual note editing.

**Implementation notes:**
- New `<select>` in Generator section: Auto / Ascending / Descending / Arc / Wave / Flat
- Contour affects the weight calculation in `generateMelody`: ascending adds upward bias, arc peaks at midpoint, etc.
- "Auto" lets the seed decide (current behavior)
- Combine with density for powerful results: sparse + ascending = building tension
- File: `src/js/generate/melody.js`, `src/app.html`

---

### 1.5 · Rhythm Pattern Templates

**Status:** Done
**Priority:** P1 | **Size:** M

**Context:** `rhythm.js` generates onset patterns with pure probability based on density. This produces usable but sometimes aimless rhythms. Real music uses recognizable rhythmic archetypes.

**Objective:** Replace pure-random rhythm generation with selectable rhythm archetypes (straight, syncopated, sparse, driving, waltz) that constrain `generateRhythm` onset patterns. Users can still tweak density/swing on top.

**Implementation notes:**
- Templates define which beat subdivisions are likely vs. unlikely
- E.g., "driving" emphasizes on-beats, "syncopated" emphasizes off-beats
- Density still controls how many of the template slots are filled
- New `<select>` in Generator section
- File: `src/js/generate/rhythm.js`, `src/app.html`

---

### 1.6 · Lock/Unlock Bar Ranges

**Status:** Done
**Priority:** P1 | **Size:** S

**Context:** Users can click individual bars in the score canvas to lock them. With 8+ bars and song sections coming, clicking each bar is tedious. The lock workflow needs to scale.

**Objective:** Support shift-click range selection, "Lock All" / "Unlock All" buttons, and a visual bar tray showing lock state at a glance.

**Implementation notes:**
- Shift+click: select range from last clicked bar to current
- Buttons below score canvas: 🔒 Lock All | 🔓 Unlock All | 🔄 Invert
- Visual: locked bars get a small lock icon overlay
- File: `src/js/ui/ScoreCanvas.js`, `src/app.html`, `src/js/main.js`

---

### 1.7 · More Voices + Per-Track Voice

**Status:** Done
**Priority:** P1 | **Size:** M

**Context:** Currently one voice applies globally (melody, chords, and live piano all use the same voice). `SynthVoice.js` already has piano, pad, pluck, bass, organ, strings, marimba, bell presets. But chords-as-pluck and melody-as-pluck is limiting.

**Objective:** Allow independent voice selection for melody vs. chords. Add 2-3 new voices (electric piano, FM keys, soft lead). Bass and drums keep their fixed voices.

**Implementation notes:**
- Split `#voice` select into `#melody-voice` and `#chord-voice`
- Default chord voice to 'pad' or 'strings' for contrast
- New presets in `SynthVoice.js`: electric piano (FM), soft lead (filtered saw)
- Presets should set both voices to good combinations
- File: `src/js/audio/SynthVoice.js`, `src/app.html`, `src/js/main.js`

---

### 1.8 · Shareable Seed URLs with Preview

**Status:** Done
**Priority:** P1 | **Size:** M

**Context:** Share button already copies a URL with seed + parameters. But when pasted into chat/social, it's just a bare URL — no preview image, no title, no description.

**Objective:** Add Open Graph meta tags and generate a client-side preview image (mini piano roll or waveform rendered to canvas → data URL) so links look good when shared.

**Implementation notes:**
- OG tags in `<head>`: title, description, image
- Challenge: OG tags are read by crawlers that don't execute JS
- Options: (a) static OG tags with generic image, (b) serverless function that renders preview, (c) client-side "copy image" button
- Start with (a) + (c) — add a "Copy preview" button that renders the score canvas to clipboard
- File: `src/app.html`, `src/js/ui/ScoreCanvas.js`

---

### 1.9 · Multi-Track MIDI Export

**Status:** Done
**Priority:** P0 | **Size:** M

**Context:** Current MIDI export uses Format 0 (single track, all events interleaved). DAW users importing the file get one track with melody, chords, bass, and drums mixed together — tedious to separate.

**Objective:** Upgrade `songToMidi` to Format 1 with separate tracks per instrument (melody, chords, bass, drums), each on its own MIDI channel. Include track names.

**Implementation notes:**
- MIDI Format 1: header declares N tracks, each track is an independent chunk
- Channel assignment: melody=0, chords=1, bass=2, drums=9 (GM standard)
- Add track name meta events (0xFF 0x03)
- Tempo meta event goes in track 0 (conductor track)
- File: `src/js/export/midi.js`

---

### 1.10 · Score Canvas Note Editing

**Status:** Done
**Priority:** P1 | **Size:** L

**Context:** The score canvas currently displays notes read-only (with drag-to-rearrange within a bar). Users want to click a note to select it, drag to change pitch/time, and resize to change duration. This bridges Phase 1 into Phase 2.

**Objective:** Add basic note editing in the existing score canvas: click to select, drag to move (pitch + time), drag edges to resize, delete with Backspace. Edited notes auto-lock their bar.

**Implementation notes:**
- Extend existing `hitTest` logic in `ScoreCanvas.js`
- Selected note gets a highlight outline
- Dragging modifies `ev.midi` (pitch) and `ev.atBeat` (time)
- Edge-dragging modifies `ev.durationBeats`
- Backspace deletes selected note
- Changes mutate `currentSong.events` directly and auto-lock the bar
- No undo yet (that's Phase 2 item 16)
- File: `src/js/ui/ScoreCanvas.js`, `src/js/main.js`

---

### 1.11 · Community Seed Gallery

**Status:** Nice to have
**Priority:** P3 | **Size:** L

**Context:** The current gallery is a hardcoded array in `Gallery.js`. Users can't contribute their own seeds. A community gallery would drive engagement and discovery.

**Objective:** Let users publish saved songs to a shared gallery. Browse, search, and one-click load community seeds.

**Implementation notes:**
- Backend options: Firebase Realtime DB, Supabase, or a simple JSON API
- Minimal data per entry: name, seed, parameters, author (optional), votes
- Gallery UI: grid of cards with preview info, sort by newest/popular
- Rate limiting and moderation considerations
- Could start with GitHub-based: PRs to add seeds to a JSON file
- File: `src/js/ui/Gallery.js`, new backend

---

### 1.12 · Reverb Presets + Chorus Effect

**Status:** Done
**Priority:** P2 | **Size:** M

**Context:** Current reverb uses a single synthesized impulse response. No chorus/flanger effects. More variety in spatial effects would greatly expand the sonic palette.

**Objective:** Add selectable reverb presets (room, hall, cathedral) by varying impulse response parameters. Add a chorus effect node to the effects chain.

**Implementation notes:**
- Generate different impulse responses with varying length, decay, and early reflections
- Chorus: use a modulated delay line (DelayNode + OscillatorNode LFO modulating delayTime)
- Add chorus send fader to mixer (like REV/DLY)
- File: `src/js/audio/Effects.js`, `src/app.html`

---

### 1.13 · Canvas Zoom & Piano Keyboard

**Status:** In progress
**Priority:** P0 | **Size:** M

**Context:** The score canvas shows notes at a fixed zoom level. With longer songs and more sections, it's hard to see individual notes. There's also no pitch reference — users can't tell which note is which without playing it.

**Objective:** Add horizontal and vertical zoom controls (Ctrl+wheel, Shift+wheel, buttons) with pan when zoomed. Render a vertical piano keyboard along the left edge of the canvas showing note names aligned with the pitch axis.

**Implementation notes:**
- Zoom state: `zoomX`, `zoomY`, `scrollOffsetX`, `scrollOffsetY`
- Ctrl/Meta+wheel = zoom X, Shift+wheel = zoom Y, plain wheel = scroll when zoomed
- Piano gutter: increase `pad.left`, draw white/black keys, label C notes
- Auto-scroll during playback to keep playhead visible
- Zoom buttons (+, -, 1:1) in score-bar-actions
- File: `src/js/ui/ScoreCanvas.js`, `src/app.html`

---

### 1.14 · Track Visibility Toggles

**Status:** In progress
**Priority:** P0 | **Size:** S

**Context:** The canvas shows melody, chords, and bass simultaneously. When analyzing a specific part, the other tracks are visual noise. Users need to isolate individual tracks.

**Objective:** Add toggle buttons to show/hide melody, chords, and bass tracks on the score canvas. Active tracks are highlighted, inactive are hidden from rendering.

**Implementation notes:**
- `visibleTracks` Set in ScoreCanvas state
- Toggle buttons with colored indicators matching track colors
- Persist visibility state in localStorage settings
- File: `src/js/ui/ScoreCanvas.js`, `src/app.html`, `src/js/main.js`

---

### 1.15 · Per-Track MIDI Export

**Status:** In progress
**Priority:** P0 | **Size:** S

**Context:** Current MIDI export outputs all tracks in one file. Musicians often want just the melody or just the bass line to import into their DAW on a specific track.

**Objective:** Add buttons to export individual MIDI tracks (melody, chords, bass, drums) as separate files. Reuse existing multi-track MIDI infrastructure with a track filter parameter.

**Implementation notes:**
- Add optional `tracks` filter to `songToMidi`
- Per-track export buttons in Export panel
- Log each export in export log
- File: `src/js/export/midi.js`, `src/app.html`, `src/js/main.js`

---

### 1.16 · MusicXML Export

**Status:** In progress
**Priority:** P1 | **Size:** M

**Context:** MusicXML is the standard interchange format for notation software (MuseScore, Finale, Sibelius). Exporting generated songs as MusicXML enables users to import into professional notation tools for further editing, printing, and arrangement.

**Objective:** Export the generated song as a MusicXML file with separate parts for melody, chords, bass, and drums. Include proper pitch, duration, rest, key, time signature, and tempo information.

**Implementation notes:**
- New file: `src/js/export/musicxml.js`
- Build XML with template literals (no library)
- Duration-to-type mapping for standard note values + dotted notes
- Fill gaps with rests, handle chord voicings with `<chord/>` tag
- Drums use `<unpitched>` elements and percussion clef
- File: `src/js/export/musicxml.js`, `src/app.html`, `src/js/main.js`

---

### 1.17 · Unified Panel Headers & Mobile Layout

**Status:** Done
**Priority:** P1 | **Size:** M

**Context:** Tab panel headers (Mixer, History, Export, Gallery) had inconsistent styling. Mobile layout had horizontal overflow and tiny text.

**Objective:** Standardize all panel headers with `.panel-header` pattern. Add export log with localStorage persistence. Improve mobile responsiveness with scaled-up fonts and transport dropdown.

---

## Phase 2 — Multi-Voice & Sheet Music

Extend the generator with multi-voice (duet) capabilities and sheet music visualization.

---

### 2.1 · Duet / Multi-Voice Generation

**Status:** To do
**Priority:** P0 | **Size:** XL

**Context:** Currently the generator produces a single melody line. Real compositions often have two or more independent melodic voices (duets, counterpoint). This is the single most requested feature for making SeedSong useful for actual composition.

**Objective:** Allow generating a second melodic voice that complements the first. The second voice should follow counterpoint principles: contrary motion, consonant intervals, independent rhythm while sharing the harmonic framework.

**Implementation notes:**
- Extend `generateSong` to accept a `voices` parameter (1 or 2)
- Second voice derives from `seed + offset` for related but independent material
- Counterpoint rules: prefer 3rds/6ths, avoid parallel 5ths/octaves, contrary motion bias
- Second voice uses a different octave range and voice preset
- New track type: `melody2` alongside existing `melody`
- Canvas renders both melodies with distinct colors
- Mixer gets a second melody channel (MEL2)
- Per-voice export in MIDI and MusicXML
- File: `src/js/generate/melody.js`, `src/js/generate/song.js`, `src/js/audio/AudioEngine.js`

---

### 2.2 · Sheet Music Visualization

**Status:** To do
**Priority:** P0 | **Size:** XL

**Context:** The piano roll is great for seeing rhythm and pitch patterns, but musicians think in standard notation. A sheet music view would make SeedSong immediately useful for practice, education, and composition.

**Objective:** Render the generated song as standard music notation (treble/bass clef, note heads, stems, beams, rests, bar lines) in a new "Score" tab or as an alternative canvas view.

**Implementation notes:**
- New canvas-based renderer or SVG-based approach
- Staff lines, clef symbols, key/time signatures
- Note head shapes (whole, half, quarter, eighth, sixteenth)
- Stems, flags, beams for grouped eighth/sixteenth notes
- Rest symbols for gaps
- Multiple staves: treble for melody, bass for bass, grand staff option
- Separate parts view (one staff per instrument)
- Could use a library like VexFlow or build from scratch
- File: new `src/js/ui/SheetCanvas.js` or `src/js/ui/SheetMusic.js`

---

### 2.3 · Voice Independence Controls

**Status:** To do
**Priority:** P1 | **Size:** M

**Context:** With two voices, users need control over how independent the second voice is — from tight harmony (thirds apart) to fully independent counterpoint.

**Objective:** Add controls for voice 2: independence level (locked harmony → free counterpoint), interval preference, rhythm correlation with voice 1.

**Implementation notes:**
- Independence slider: 0 = parallel thirds, 1 = fully independent
- Interval preference: select preferred intervals (3rds, 6ths, etc.)
- Rhythm correlation: how much voice 2's rhythm mirrors voice 1
- File: `src/js/generate/melody.js`, `src/app.html`

---

## Phase 3 — Assisted Composition Tool

New `editor.html` view for arranging and refining generated material.

---

### 3.1 · Editor View Scaffold

**Status:** To do
**Priority:** P0 | **Size:** L

**Context:** The current app is a single-page exploration tool. Composition requires a different paradigm: a timeline with draggable section blocks, not a single looping phrase.

**Objective:** Create `editor.html` with a timeline/arrangement canvas showing sections as colored blocks. "Send to Editor" button in the main app exports the current song structure. Shared JS modules (audio, theory, generate), separate UI entry point.

**Implementation notes:**
- `editor.html` + `editor.js` as new entry point
- Reuse: AudioEngine, SynthVoice, Voice, Effects, Click, SampleLibrary, all generate/* modules
- New: TimelineCanvas (horizontal arrangement view), SectionBlock (data model)
- Layout: toolbar top, timeline center, properties panel right, mixer bottom
- File: `src/editor.html`, `src/js/editor/main.js`, `src/js/editor/TimelineCanvas.js`

---

### 3.2 · Per-Section Seed & Parameters

**Status:** To do
**Priority:** P0 | **Size:** L

**Context:** In the editor, each section block should be independently configurable. The same seed with different parameters produces related but contrasting material — perfect for verse vs. chorus.

**Objective:** Each section block in the editor has its own seed, scale, density, progression, voice, and contour settings. Changing one section does not affect others. Sections regenerate independently.

**Implementation notes:**
- Section data model: `{ id, name, seed, scale, tonic, density, swing, progression, voice, bars, events }`
- Properties panel shows selected section's parameters
- "Regenerate" button per section
- "Link seed" option: derive sub-seeds from a master seed
- File: `src/js/editor/SectionBlock.js`, `src/js/editor/PropertiesPanel.js`

---

### 3.3 · Piano Roll Note Editor

**Status:** To do
**Priority:** P0 | **Size:** XL

**Context:** The score canvas in the main app has basic note display. The editor needs a full piano roll: add notes, edit pitch/time/duration, select multiple, copy/paste within a section.

**Objective:** Full piano-roll editor: add notes by clicking empty space, drag to move, drag edges to resize, delete with right-click or Backspace. Grid snapping with configurable quantize (1/4, 1/8, 1/16, 1/32). Multi-select with lasso or shift-click.

**Implementation notes:**
- Vertical axis: MIDI pitch (piano keys on left edge)
- Horizontal axis: beats (grid lines)
- Snap quantize selector in toolbar
- Velocity editing: vertical position within note, or separate velocity lane
- Zoom: scroll wheel for time zoom, shift+scroll for pitch zoom
- File: `src/js/editor/PianoRollCanvas.js`

---

### 3.4 · Undo/Redo History Stack

**Status:** To do
**Priority:** P0 | **Size:** M

**Context:** Once users start manually editing notes, undo/redo becomes essential. Without it, mistakes are permanent and users won't invest time in careful editing.

**Objective:** Command-pattern undo/redo (Ctrl+Z / Ctrl+Shift+Z) for the editor view, tracking note edits, section moves, parameter changes. Visual indicator showing undo depth.

**Implementation notes:**
- Command interface: `{ execute(), undo(), description }`
- Stack of executed commands, pointer to current position
- Commands: MoveNote, ResizeNote, DeleteNote, AddNote, MoveSection, ChangeParameter
- Max stack depth ~100
- File: `src/js/editor/History.js`

---

### 3.5 · Multi-Track Arrangement

**Status:** To do
**Priority:** P1 | **Size:** XL

**Context:** The editor timeline starts with sections as horizontal blocks. For more complex arrangements, users need parallel tracks (melody on one track, harmony on another, bass on a third).

**Objective:** Editor timeline supports multiple parallel tracks (melody, harmony, bass, percussion) each with independent mute/solo/volume. Sections can be dragged between tracks.

**Implementation notes:**
- Each track is a horizontal lane in the timeline
- Track header on left: name, mute/solo/volume
- Sections can span one track or be split across tracks
- Playback renders all tracks simultaneously
- File: `src/js/editor/TimelineCanvas.js`, `src/js/editor/Track.js`

---

### 3.6 · Stem Export (WAV per Track)

**Status:** To do
**Priority:** P1 | **Size:** M

**Context:** Musicians using DAWs want separate audio files per instrument for further mixing/mastering. Current WAV export renders everything to a single stereo file.

**Objective:** Export individual WAV files per track using `OfflineAudioContext` rendering, one pass per track. Zip them together for download.

**Implementation notes:**
- Render each track in isolation: mute all others, render to OfflineAudioContext
- Use JSZip (or manual ZIP construction to maintain no-deps policy) to bundle
- Name files: `seedsong_melody.wav`, `seedsong_chords.wav`, etc.
- Progress indicator for multi-pass rendering
- File: `src/js/export/wav.js`, potentially `src/js/export/zip.js`

---

### 3.7 · Section Copy/Paste & Variations

**Status:** To do
**Priority:** P2 | **Size:** M

**Context:** Composition often involves repeating sections with small variations. Copy-paste gets the structure; "Generate Variation" adds freshness.

**Objective:** Copy a section and paste it elsewhere in the timeline. "Generate Variation" takes a section's seed and produces a related-but-different version (seed + offset or parameter tweak).

**Implementation notes:**
- Ctrl+C / Ctrl+V for sections in timeline
- "Variation" button in section context menu
- Variation strategies: seed+1, density±0.1, swap progression, transpose ±2
- Variations auto-name: "Verse", "Verse (var.1)", "Verse (var.2)"
- File: `src/js/editor/TimelineCanvas.js`, `src/js/editor/SectionBlock.js`

---

### 3.8 · Project Save/Load (JSON)

**Status:** To do
**Priority:** P1 | **Size:** M

**Context:** The main app saves to localStorage. The editor needs proper file-based persistence — users will invest significant time in arrangements and need to save/restore across sessions and devices.

**Objective:** Serialize the full editor state (sections, note edits, arrangement, track layout, parameters) to a JSON file. Import to restore. Enables work-in-progress persistence beyond localStorage.

**Implementation notes:**
- JSON schema: `{ version, name, masterSeed, bpm, timeSignature, tracks: [{ name, sections: [{ seed, params, events }] }] }`
- File > Save Project / File > Open Project
- Auto-save to localStorage as backup
- Version field for forward compatibility
- File: `src/js/editor/ProjectFile.js`
