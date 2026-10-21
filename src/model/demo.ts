import { TRACK_COLORS } from './constants'
import { createSong, createTrack } from './factory'
import { newId } from './ids'
import { drumsFromPreset, synthFromPreset } from './presets'
import type { Note, Pattern, Song, Track } from './schema'

type NoteTuple = [pitch: number, start: number, length: number]

const CHORD_ROOTS = [45, 41, 48, 43]
const CHORDS = [
  [57, 60, 64],
  [53, 57, 60],
  [60, 64, 67],
  [55, 59, 62],
]
const MELODY: NoteTuple[][] = [
  [
    [69, 0, 2],
    [72, 2, 2],
    [76, 4, 4],
    [74, 8, 2],
    [72, 10, 2],
    [71, 12, 4],
  ],
  [
    [69, 0, 4],
    [72, 4, 2],
    [77, 6, 2],
    [76, 8, 4],
    [72, 12, 4],
  ],
  [
    [67, 0, 2],
    [72, 2, 2],
    [76, 4, 2],
    [79, 6, 2],
    [76, 8, 4],
    [72, 12, 4],
  ],
  [
    [71, 0, 4],
    [74, 4, 4],
    [79, 8, 2],
    [77, 10, 2],
    [74, 12, 4],
  ],
]
const KICK = 0
const SNARE = 1
const CLOSED_HAT = 2
const OPEN_HAT = 3
const TOM = 4

function pattern(name: string, lengthBars: Pattern['lengthBars'], notes: NoteTuple[]): Pattern {
  return {
    id: newId(),
    name,
    lengthBars,
    notes: notes.map(([pitch, start, length]): Note => ({ pitch, start, length })),
  }
}

function perBar(build: (bar: number) => NoteTuple[]): NoteTuple[] {
  return CHORDS.flatMap((_, bar) =>
    build(bar).map(([pitch, start, length]): NoteTuple => [pitch, bar * 16 + start, length]),
  )
}

function place(track: Track, patterns: Pattern[], bars: number[][]): Track {
  track.patterns = patterns
  track.clips = patterns.flatMap((p, i) =>
    (bars[i] ?? []).map((bar) => ({ id: newId(), patternId: p.id, bar })),
  )
  return track
}

export function createDemoSong(): Song {
  const song = createSong('DEMO')
  song.scale = { root: 9, mode: 'minor' }

  const lead = createTrack('LEAD', TRACK_COLORS[0], synthFromPreset('LEAD'))
  lead.delay = { enabled: true, division: '1/8d', feedback: 0.3, mix: 0.2 }
  lead.reverbSend = 0.25

  const arp = createTrack('ARP', TRACK_COLORS[1], synthFromPreset('BELL'))
  arp.volume = 0.3
  arp.pan = -0.4

  const pad = createTrack('PAD', TRACK_COLORS[2], synthFromPreset('PAD'))
  pad.volume = 0.3
  pad.pan = 0.4
  pad.filter = { enabled: true, type: 'lowpass', cutoff: 1800, resonance: 0.7 }

  const bass = createTrack('BASS', TRACK_COLORS[3], synthFromPreset('BASS'))
  const drums = createTrack('DRUMS', TRACK_COLORS[4], drumsFromPreset('NES'))

  const loop = [[0, 4]]
  place(
    lead,
    [
      pattern(
        'MELODY',
        4,
        perBar((bar) => MELODY[bar] ?? []),
      ),
    ],
    loop,
  )
  place(
    arp,
    [
      pattern(
        'ARP',
        4,
        perBar((bar) =>
          Array.from({ length: 16 }, (_, step): NoteTuple => [
            (CHORDS[bar]?.[step % 3] ?? 57) + 12,
            step,
            1,
          ]),
        ),
      ),
    ],
    loop,
  )
  place(
    pad,
    [
      pattern(
        'CHORDS',
        4,
        perBar((bar) => (CHORDS[bar] ?? []).map((p): NoteTuple => [p, 0, 16])),
      ),
    ],
    loop,
  )
  place(
    bass,
    [
      pattern(
        'BASS',
        4,
        perBar((bar) => {
          const root = CHORD_ROOTS[bar] ?? 45
          return Array.from({ length: 8 }, (_, i): NoteTuple => [root + (i % 2) * 12, i * 2, 2])
        }),
      ),
    ],
    loop,
  )
  place(
    drums,
    [
      pattern('BEAT', 1, [
        [KICK, 0, 1],
        [KICK, 8, 1],
        [SNARE, 4, 1],
        [SNARE, 12, 1],
        ...[0, 2, 4, 6, 8, 10, 12].map((step): NoteTuple => [CLOSED_HAT, step, 1]),
        [OPEN_HAT, 14, 1],
      ]),
      pattern('FILL', 1, [
        [KICK, 0, 1],
        [SNARE, 4, 1],
        [SNARE, 8, 1],
        [SNARE, 10, 1],
        ...[0, 2, 4, 6].map((step): NoteTuple => [CLOSED_HAT, step, 1]),
        ...[12, 13, 14, 15].map((step): NoteTuple => [TOM, step, 1]),
      ]),
    ],
    [
      [0, 1, 2, 4, 5, 6],
      [3, 7],
    ],
  )

  song.tracks = [lead, arp, pad, bass, drums]
  return song
}
