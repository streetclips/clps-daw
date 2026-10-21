import { STEPS_PER_BAR } from '../model/constants'
import type { Note, Pattern, Song, Track } from '../model/schema'

export interface SongNote {
  track: Track
  note: Note
}

export function secondsPerStep(bpm: number): number {
  return 60 / bpm / 4
}

export function songLengthBars(song: Song): number {
  let bars = 0
  for (const track of song.tracks) {
    for (const clip of track.clips) {
      const pattern = track.patterns.find((p) => p.id === clip.patternId)
      if (pattern) bars = Math.max(bars, clip.bar + pattern.lengthBars)
    }
  }
  return bars
}

export function songLengthSteps(song: Song): number {
  return songLengthBars(song) * STEPS_PER_BAR[song.meter]
}

export function patternNotesAtStep(pattern: Pattern, step: number): Note[] {
  return pattern.notes.filter((note) => note.start === step)
}

export function songNotesAtStep(song: Song, step: number): SongNote[] {
  const stepsPerBar = STEPS_PER_BAR[song.meter]
  const bar = Math.floor(step / stepsPerBar)
  const result: SongNote[] = []
  for (const track of song.tracks) {
    for (const clip of track.clips) {
      if (clip.bar > bar) continue
      const pattern = track.patterns.find((p) => p.id === clip.patternId)
      if (!pattern || bar >= clip.bar + pattern.lengthBars) continue
      for (const note of patternNotesAtStep(pattern, step - clip.bar * stepsPerBar)) {
        result.push({ track, note })
      }
    }
  }
  return result
}

const DELAY_BEATS = { '1/8': 0.5, '1/4': 1, '1/8d': 0.75 } as const

export function delaySeconds(division: Track['delay']['division'], bpm: number): number {
  return (60 / bpm) * DELAY_BEATS[division]
}

export function isTrackAudible(track: Track, anySolo: boolean): boolean {
  return !track.mute && (!anySolo || track.solo)
}
