import {
  MAX_BARS,
  MAX_BPM,
  MAX_TRACKS,
  MIN_BPM,
  PATTERN_LENGTHS,
  STEPS_PER_BAR,
  TRACK_COLORS,
  type Meter,
} from './constants'
import { createTrack } from './factory'
import { newId } from './ids'
import { drumsFromPreset, synthFromPreset } from './presets'
import type { Clip, Pattern, Song, Track } from './schema'

export type TrackKind = Track['instrument']['type']

export function patternOf(track: Track, patternId: string): Pattern | undefined {
  return track.patterns.find((pattern) => pattern.id === patternId)
}

export function clipLength(track: Track, clip: Clip): number {
  return patternOf(track, clip.patternId)?.lengthBars ?? 1
}

export function clipAt(track: Track, bar: number): Clip | undefined {
  return track.clips.find((clip) => clip.bar <= bar && bar < clip.bar + clipLength(track, clip))
}

export function linkCount(track: Track, patternId: string): number {
  return track.clips.filter((clip) => clip.patternId === patternId).length
}

export function canPlaceClip(track: Track, bar: number, length: number, ignoreClipId?: string) {
  if (bar < 0 || bar + length > MAX_BARS) return false
  return track.clips.every(
    (clip) =>
      clip.id === ignoreClipId ||
      clip.bar + clipLength(track, clip) <= bar ||
      bar + length <= clip.bar,
  )
}

export function freeBarsAt(track: Track, bar: number): number {
  if (clipAt(track, bar)) return 0
  const next = Math.min(MAX_BARS, ...track.clips.filter((c) => c.bar > bar).map((c) => c.bar))
  return next - bar
}

function updateTrack(song: Song, trackId: string, update: (track: Track) => Track): Song {
  let changed = false
  const tracks = song.tracks.map((track) => {
    if (track.id !== trackId) return track
    const next = update(track)
    if (next !== track) changed = true
    return next
  })
  return changed ? { ...song, tracks } : song
}

export function patchTrack(
  song: Song,
  trackId: string,
  patch: Partial<Omit<Track, 'id' | 'patterns' | 'clips'>>,
): Song {
  return updateTrack(song, trackId, (track) => ({ ...track, ...patch }))
}

function nextPatternName(track: Track): string {
  const numbers = track.patterns.map((p) => Number(/^P(\d+)$/.exec(p.name)?.[1] ?? 0))
  return `P${Math.max(0, ...numbers) + 1}`
}

export function createPatternClip(
  song: Song,
  trackId: string,
  bar: number,
  lengthBars: Pattern['lengthBars'],
): { song: Song; patternId: string } | null {
  const track = song.tracks.find((t) => t.id === trackId)
  if (!track) return null
  const free = freeBarsAt(track, bar)
  const length = [...PATTERN_LENGTHS].reverse().find((l) => l <= lengthBars && l <= free)
  if (!length) return null
  const pattern: Pattern = {
    id: newId(),
    name: nextPatternName(track),
    lengthBars: length,
    notes: [],
  }
  const clip: Clip = { id: newId(), patternId: pattern.id, bar }
  return {
    song: updateTrack(song, trackId, (t) => ({
      ...t,
      patterns: [...t.patterns, pattern],
      clips: [...t.clips, clip],
    })),
    patternId: pattern.id,
  }
}

export function moveClip(song: Song, trackId: string, clipId: string, bar: number): Song {
  return updateTrack(song, trackId, (track) => {
    const clip = track.clips.find((c) => c.id === clipId)
    if (!clip || clip.bar === bar || !canPlaceClip(track, bar, clipLength(track, clip), clipId)) {
      return track
    }
    return { ...track, clips: track.clips.map((c) => (c.id === clipId ? { ...c, bar } : c)) }
  })
}

export function duplicateClip(song: Song, trackId: string, clipId: string): Song {
  return updateTrack(song, trackId, (track) => {
    const clip = track.clips.find((c) => c.id === clipId)
    if (!clip) return track
    const length = clipLength(track, clip)
    for (let bar = clip.bar + length; bar + length <= MAX_BARS; bar++) {
      if (canPlaceClip(track, bar, length)) {
        return {
          ...track,
          clips: [...track.clips, { id: newId(), patternId: clip.patternId, bar }],
        }
      }
    }
    return track
  })
}

export function makeClipUnique(song: Song, trackId: string, clipId: string): Song {
  return updateTrack(song, trackId, (track) => {
    const clip = track.clips.find((c) => c.id === clipId)
    const pattern = clip && patternOf(track, clip.patternId)
    if (!clip || !pattern || linkCount(track, pattern.id) <= 1) return track
    const copy: Pattern = {
      ...pattern,
      id: newId(),
      name: nextPatternName(track),
      notes: pattern.notes.map((note) => ({ ...note })),
    }
    return {
      ...track,
      patterns: [...track.patterns, copy],
      clips: track.clips.map((c) => (c.id === clipId ? { ...c, patternId: copy.id } : c)),
    }
  })
}

export function deleteClip(song: Song, trackId: string, clipId: string): Song {
  return updateTrack(song, trackId, (track) => {
    const clip = track.clips.find((c) => c.id === clipId)
    if (!clip) return track
    const clips = track.clips.filter((c) => c.id !== clipId)
    const orphan = !clips.some((c) => c.patternId === clip.patternId)
    return {
      ...track,
      clips,
      patterns: orphan ? track.patterns.filter((p) => p.id !== clip.patternId) : track.patterns,
    }
  })
}

export function addTrack(song: Song, kind: TrackKind): Song {
  if (song.tracks.length >= MAX_TRACKS) return song
  const used = new Set(song.tracks.map((t) => t.color))
  const color =
    TRACK_COLORS.find((c) => !used.has(c)) ??
    TRACK_COLORS[song.tracks.length % TRACK_COLORS.length]!
  const base = kind === 'drums' ? 'DRUMS' : 'SYNTH'
  const names = new Set(song.tracks.map((t) => t.name))
  let name = base
  for (let i = 2; names.has(name); i++) name = `${base} ${i}`
  const instrument = kind === 'drums' ? drumsFromPreset('NES') : synthFromPreset('LEAD')
  return { ...song, tracks: [...song.tracks, createTrack(name, color, instrument)] }
}

export function removeTrack(song: Song, trackId: string): Song {
  const tracks = song.tracks.filter((t) => t.id !== trackId)
  return tracks.length === song.tracks.length ? song : { ...song, tracks }
}

export function cleanName(name: string, maxLength: number): string {
  return name.trim().toUpperCase().slice(0, maxLength)
}

export function renameSong(song: Song, name: string): Song {
  const clean = cleanName(name, 40)
  return clean && clean !== song.name ? { ...song, name: clean } : song
}

export function renameTrack(song: Song, trackId: string, name: string): Song {
  const clean = cleanName(name, 12)
  const track = song.tracks.find((t) => t.id === trackId)
  return clean && track && clean !== track.name ? patchTrack(song, trackId, { name: clean }) : song
}

export function setBpm(song: Song, bpm: number): Song {
  const next = Math.min(Math.max(Math.round(bpm), MIN_BPM), MAX_BPM)
  return next === song.bpm ? song : { ...song, bpm: next }
}

export function setScale(song: Song, scale: Song['scale']): Song {
  return scale.root === song.scale.root && scale.mode === song.scale.mode
    ? song
    : { ...song, scale }
}

export function setMeter(song: Song, meter: Meter): Song {
  if (meter === song.meter) return song
  const stepsPerBar = STEPS_PER_BAR[meter]
  return {
    ...song,
    meter,
    tracks: song.tracks.map((track) => ({
      ...track,
      patterns: track.patterns.map((pattern) => {
        const steps = pattern.lengthBars * stepsPerBar
        return {
          ...pattern,
          notes: pattern.notes
            .filter((note) => note.start < steps)
            .map((note) => ({ ...note, length: Math.min(note.length, steps - note.start) })),
        }
      }),
    })),
  }
}
