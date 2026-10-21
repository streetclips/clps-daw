# CLPS DAW — Design

A hobby DAW for composing songs on an iPhone. Client-only React SPA, plain Web Audio API, 8-bit look.
This document is the single source of truth for product and architecture decisions. When a decision
changes, update it here in the same commit as the code.

## Decisions

| #   | Topic              | Decision                                                                                     |
| --- | ------------------ | -------------------------------------------------------------------------------------------- |
| 1   | Note editor        | Piano roll on a step grid (1/16 steps)                                                       |
| 2   | Song structure     | Patterns placed as clips on a track timeline                                                 |
| 3   | Sounds             | `sine`, `square`, `triangle`, `sawtooth` oscillators + noise for drums                       |
| 4   | Import             | JSON projects only. Audio import is v2                                                       |
| 5   | Device             | iPhone (iOS 17+), portrait only                                                              |
| 6   | Stack              | Vite + React + TypeScript + Zustand + CSS Modules + pnpm + Vitest. No audio libraries        |
| 7   | Pattern copies     | Clips link to a shared pattern by default; MAKE UNIQUE detaches one                          |
| 8   | Tracks             | Up to 8 tracks, polyphonic. Noise tracks are drum tracks with fixed lanes                    |
| 9   | Storage            | Many songs in IndexedDB, autosaved. JSON is the backup and transfer format                   |
| 10  | Hosting            | GitHub Pages (public repo `streetclips/clps-daw`, MIT)                                       |
| 11  | Axes               | Time runs left → right in both the piano roll and the track view                             |
| 12  | Instruments        | Presets + editor (wave, pulse width, ADSR)                                                   |
| 13  | Mixer              | Volume, pan, mute, solo per track + effects                                                  |
| 14  | Time               | One BPM per song, meter per song (`4/4`, `3/4`, `6/8`), 1/16 grid, no swing, no triplets     |
| 15  | Look               | PICO-8 palette, Press Start 2P font, English UI                                              |
| 16  | Install            | PWA, used from the Home Screen                                                               |
| 17  | Pitch range        | C1–C8 for every synth track; song scale highlights rows, FOLD hides out-of-scale rows        |
| 18  | Gestures           | One finger edits, two fingers pan, pinch zooms horizontally                                  |
| 19  | Effects            | Filter + delay per track; one shared reverb bus with a send per track; no automation         |
| 20  | Playback           | Piano roll PLAY loops the open pattern alone; track view PLAY plays the song from the cursor |
| 21  | Track view editing | Tap empty bar = new pattern; tap clip = open; drag = move; long press = clip menu            |
| 22  | Undo               | Undo/redo, 100 steps, in memory only                                                         |
| 23  | Multi-note edits   | No selection. Pattern menu acts on all notes (transpose, shift, clear)                       |
| 24  | v1 scope           | No live recording, no MIDI, no loop range                                                    |
| 25  | Limits             | 128 bars, 60–240 BPM, WAV 44.1 kHz 16-bit stereo + 2 s tail                                  |
| 26  | Tests              | Vitest on the UI-free core; CI runs typecheck, lint, format check, tests                     |
| 27  | Delivery           | Push to `main` → GitHub Actions → Pages at `https://streetclips.github.io/clps-daw/`         |
| 28  | Build order        | Five phases, each ending on an iPhone milestone (see [Phases](#phases))                      |
| 29  | Workflow           | Phase by phase: deploy, test on the iPhone, continue                                         |
| 30  | Docs               | This file + `CLAUDE.md`                                                                      |

## Architecture

```
┌──────────────────────────── React UI (src/app, src/ui) ────────────────────────────┐
│  SongsScreen ──▶ SongScreen (track view) ──▶ PatternScreen (piano roll)            │
│                    │ sheets: TrackSheet (instrument · mixer · fx), SongSheet        │
└───────────────┬──────────────────────────────────────────────┬─────────────────────┘
                │ actions / selectors                          │ play · stop · preview
┌───────────────▼──────────────┐                ┌──────────────▼──────────────────────┐
│ Store (Zustand)              │  song snapshot │ Audio engine (src/audio)             │
│ song · history · view        ├───────────────▶│ scheduler · voices · track graph     │
└───────┬──────────────────────┘                │ offline render → WAV encoder         │
        │ debounced autosave                    └──────────────────────────────────────┘
┌───────▼──────────────────────┐
│ Storage (IndexedDB)          │   Files: JSON import/export · WAV export (share sheet)
└──────────────────────────────┘
```

The model (`src/model`) is plain data plus pure functions, with no React and no Web Audio. The
engine is a singleton outside React; the UI calls it, and it reads the latest song from the store.

## Data model (JSON format v1)

The exported JSON file is the `Song` object below. Zod schemas in `src/model/schema.ts` are the
executable version of this section.

```
Song
├─ format: "clps-daw"          version: 1
├─ id · name (≤40) · createdAt · updatedAt (ISO 8601)
├─ bpm: 60–240                 quarter notes per minute, in every meter
├─ meter: "4/4" | "3/4" | "6/8"
├─ scale: { root: 0–11, mode: "major" | "minor" | "pentatonic" | "chromatic" }
├─ reverb: { size: 0–1 }       shared reverb bus
├─ masterVolume: 0–1
└─ tracks: Track[] (≤8)
   ├─ id · name (≤12) · color (PICO-8 index 0–15)
   ├─ instrument: Synth | Drums
   │  ├─ Synth { type: "synth", preset, wave, pulseWidth: 0.125|0.25|0.5, attack, decay, sustain, release }
   │  └─ Drums { type: "drums", preset, tune: -12–12 semitones, decay: 0.25–2 }
   ├─ volume: 0–1 · pan: -1–1 · mute · solo · reverbSend: 0–1
   ├─ filter: { enabled, type: "lowpass" | "highpass", cutoff: 20–20000 Hz, resonance: 0.1–20 }
   ├─ delay:  { enabled, division: "1/8" | "1/4" | "1/8d", feedback: 0–0.9, mix: 0–1 }
   ├─ patterns: Pattern[]
   │  └─ { id, name (≤12), lengthBars: 1 | 2 | 4, notes: Note[] }
   │     └─ Note { pitch, start (step), length (steps ≥1) }
   └─ clips: Clip[]
      └─ { id, patternId, bar (0-based start bar) }
```

Rules (enforced on import):

1. A step is a 1/16 note. Steps per bar: `4/4` → 16, `3/4` → 12, `6/8` → 12.
2. Synth `pitch` is a MIDI note in 24–108 (C1–C8, C4 = 60). Drum `pitch` is a lane index:
   0 kick, 1 snare, 2 closed hat, 3 open hat, 4 tom.
3. A note ends inside its pattern: `start + length ≤ lengthBars × stepsPerBar`.
4. A clip references a pattern of its own track. Clips of one track never overlap, and every clip
   ends at or before bar 128.
5. Linked copies are clips sharing a `patternId`. MAKE UNIQUE clones the pattern and repoints the
   clip. Deleting the last clip of a pattern deletes the pattern.
6. Changing the meter trims notes that no longer fit (undoable).
7. `version` changes only together with a migration step in `parseSong` (`src/model/parse.ts`).
   Import always creates a new song with a new id.

A new song starts with three tracks: LEAD (square, 25 % pulse), BASS (triangle), DRUMS.

## Audio engine

### Graph

```
song voices ──▶ input (mute/solo) ─┐
preview + pattern-loop voices ─────┴▶ filter ─▶ delay (dry + wet/feedback) ─▶ volume ─▶ pan ─┬─▶ masterIn
                                                                                            └─▶ send ─▶ reverbBus
reverbBus = ConvolverNode (generated impulse response, length from reverb.size) ─▶ masterIn
masterIn ─▶ masterVolume ─▶ limiter (DynamicsCompressorNode) ─▶ destination
```

- Disabled filter (`allpass`) and delay (wet and feedback at 0) are bypassed.
- Mute/solo: a track is silent when muted, or when any track is soloed and it is not. Previews and
  the pattern loop enter after the mute gain, so they stay audible on muted tracks.
- One graph builder serves both `AudioContext` (live) and `OfflineAudioContext` (WAV export).
- Parameter changes during playback ramp with `setTargetAtTime`; adding or removing a track
  rebuilds only that track's chain.

### Scheduler

- Lookahead clock: a 25 ms timer schedules every note that starts within the next 120 ms, on
  `AudioContext.currentTime`. Step duration = `60 / bpm / 4` s.
- Each tick reads the latest song, so edits apply to notes not yet scheduled.
- Modes: song (from the cursor bar to the last clip, then stop) and pattern loop (the open pattern
  only, through its track chain, ignoring mute/solo).
- The playhead is drawn with `requestAnimationFrame` from `currentTime − outputLatency`.
- STOP fades every active voice out in 10 ms and stops it.

### Voices

- Synth: `OscillatorNode` (square with 12.5 % or 25 % pulse uses a `PeriodicWave`) → ADSR `GainNode`.
- Drums share one noise buffer generated with a 15-bit LFSR, like the NES noise channel:

| Lane       | Sound                                  |
| ---------- | -------------------------------------- |
| kick       | sine, pitch sweep 150 → 45 Hz          |
| snare      | band-passed noise + triangle at 185 Hz |
| closed hat | high-passed noise (7 kHz), 50 ms       |
| open hat   | high-passed noise (7 kHz), 300 ms      |
| tom        | triangle, pitch sweep 220 → 110 Hz     |

`tune` shifts the pitched parts; `decay` scales every envelope.

### Presets

| Preset | Wave          | Attack | Decay | Sustain | Release |
| ------ | ------------- | ------ | ----- | ------- | ------- |
| LEAD   | square 25 %   | 0.005  | 0.10  | 0.70    | 0.08    |
| BASS   | triangle      | 0.005  | 0.05  | 0.90    | 0.05    |
| PLUCK  | square 12.5 % | 0.002  | 0.15  | 0.00    | 0.05    |
| PAD    | sawtooth      | 0.30   | 0.30  | 0.60    | 0.60    |
| BELL   | sine          | 0.002  | 0.60  | 0.20    | 0.40    |
| CHIP   | square 50 %   | 0.005  | 0.00  | 1.00    | 0.05    |

Choosing a preset copies its values into the track; the editor then changes them freely.

## UI

### Screens

1. **SONGS**: list sorted by last edit, NEW SONG, IMPORT JSON.
2. **SONG** (track view): top bar with back, name, PLAY/STOP, BPM, undo/redo, song menu. One row per
   track (header with name, color, M, S), bars to the right, a ruler that sets the cursor.
3. **PATTERN** (piano roll): top bar with back, pattern name, PLAY (loop), note length
   (1/16, 1/8, 1/4, 1/2, 1 bar), FOLD, undo/redo, pattern menu (transpose ±1/±12, shift ±1 step, clear).
4. **TRACK sheet**: preset, wave, pulse width, ADSR, volume, pan, reverb send, filter, delay, delete.
5. **SONG sheet**: name, BPM, meter, scale, reverb size, export JSON, export WAV, delete.

### Layout (base viewport 390 × 844 pt, inside safe areas)

| View       | Measure                                                              |
| ---------- | -------------------------------------------------------------------- |
| Piano roll | key column 44 pt · rows 28 pt (44 pt with FOLD) · default zoom 1 bar |
| Track view | header column 72 pt · rows 56 pt · bar 48 pt by default              |
| Buttons    | at least 44 × 44 pt                                                  |

Landscape shows a "ROTATE TO PORTRAIT" overlay (iOS cannot lock orientation from the web).

### Gestures

- Piano roll, one finger: tap empty cell = add a note of the current length; tap note = delete;
  drag note = move (pitch and time); drag the end of a note = resize; drag from an empty cell =
  draw a note with the dragged length. Notes and key-column taps play a preview.
- Track view, one finger: tap empty bar = new pattern of the selected length (1, 2, 4 bars) and open
  it; tap clip = open; drag clip = move along its track; long press clip = DUPLICATE (linked copy
  right after), MAKE UNIQUE, DELETE.
- Both views: two fingers pan, pinch zooms the time axis.
- A one-finger edit applies on release. When a second finger lands, the edit is cancelled, so a
  two-finger pan never leaves stray notes.

### Look

- PICO-8 palette, black background. Track colors in order: 8, 9, 10, 11, 12, 14, 13, 15.
- Press Start 2P (OFL), bundled with the app; sizes in multiples of 8 px where possible.
- Square corners, 2 px borders, hard offset shadows, pixel SVG icons with `crispEdges`.

## Storage and files

- IndexedDB (`idb-keyval`): one entry per song, keyed by id. Autosave 500 ms after the last change.
  Call `navigator.storage.persist()` on first launch.
- Undo/redo keeps up to 100 song snapshots in memory. One gesture = one undo step.
- Export JSON: `<name>.json`. Export WAV: render offline, then a SAVE button opens the share sheet.
- Import: `<input type="file" accept=".json,application/json">`, validate, migrate, store as new song.

## iOS notes

Verified on 2026-10-21 against WebKit sources, MDN and WebKit bugs.

1. **Silent switch**: Web Audio is muted by the ringer switch unless
   `navigator.audioSession.type = 'playback'` is set before creating or resuming the context
   (iOS 17+). Side effect: it pauses other apps' music.
   [MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioSession)
2. **Unlock**: create or `resume()` the `AudioContext` inside a `pointerup`/`click` handler; a touch
   `pointerdown` is not a user activation. Recover the `interrupted` state (calls, lock screen) on
   the next gesture and check `ctx.state` instead of trusting the `resume()` promise.
3. **Saving files**: `<a download>` is unreliable in Home Screen apps. Use
   `navigator.share({ files: [file] })` with no `text`/`title`, called directly from a tap (it needs
   transient activation, so render first, then ask for a second tap). Fallback: `<a download>` with an
   `application/octet-stream` blob. Ignore `AbortError`.
4. **Storage**: Home Screen apps are exempt from Safari's 7-day storage cap, and their storage is
   separate from Safari's. Songs move between them only through JSON.
5. **Orientation**: manifest `orientation` and `screen.orientation.lock()` are not supported.
6. **Display**: `fullscreen` falls back to `standalone`. Use `viewport-fit=cover` with
   `env(safe-area-inset-*)`.
7. **Offline render memory**: a 5-minute stereo render needs about 170 MB. Create one
   `OfflineAudioContext` per export, never in a loop.
8. **`latencyHint` is ignored**; `outputLatency` exists from iOS 18.4. Leave the live context at its
   default sample rate.
9. **Insecure contexts**: over plain HTTP (LAN dev server) there is no service worker, no Web Share
   and no `crypto.randomUUID`. Ids use `crypto.getRandomValues`.

## Limits

| Limit        | Value                                     |
| ------------ | ----------------------------------------- |
| Tracks       | 8                                         |
| Song length  | 128 bars                                  |
| BPM          | 60–240                                    |
| Pitch range  | C1–C8 (MIDI 24–108)                       |
| Undo history | 100 steps                                 |
| Live voices  | 64 at once; extra notes are skipped       |
| WAV          | 44.1 kHz, 16-bit, stereo, song + 2 s tail |

Worst case (128 bars of 4/4 at 60 BPM ≈ 8.5 min) needs about 270 MB to export. If it fails, only
the export fails and the song is untouched.

## Phases

| #   | Phase                                                    | iPhone milestone                                  |
| --- | -------------------------------------------------------- | ------------------------------------------------- |
| 1   | Skeleton, PWA, deploy, data model                        | Open the URL and install it                       |
| 2   | Audio engine: scheduler, waves, noise, silent-switch fix | A test pattern plays with the phone on silent     |
| 3   | Piano roll: grid, gestures, scale/FOLD, loop, preview    | Compose a pattern                                 |
| 4   | Track view, linked clips, storage, undo                  | Compose a song; it is still there after reopening |
| 5   | Instruments, mixer, effects, JSON and WAV import/export  | Save the WAV to Files                             |

## v2 backlog

Audio import, MIDI import/export, live recording from an on-screen keyboard, loop range, multi-note
selection, automation, tempo changes, swing and triplets, track reordering, persisted undo history.
