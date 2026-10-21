import { MAX_PITCH, MIN_PITCH, STEPS_PER_BAR } from './constants'
import type { Note, Pattern, Song } from './schema'

export interface NoteRef {
  pitch: number
  start: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function patternSteps(pattern: Pattern, meter: Song['meter']): number {
  return pattern.lengthBars * STEPS_PER_BAR[meter]
}

function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch)
}

function overlaps(a: Note, b: Note): boolean {
  return a.pitch === b.pitch && a.start < b.start + b.length && b.start < a.start + a.length
}

function isRef(note: Note, ref: NoteRef): boolean {
  return note.pitch === ref.pitch && note.start === ref.start
}

export function noteAt(pattern: Pattern, pitch: number, step: number): Note | undefined {
  return pattern.notes.find(
    (note) => note.pitch === pitch && note.start <= step && step < note.start + note.length,
  )
}

export function addNote(pattern: Pattern, note: Note, steps: number): Pattern {
  const start = clamp(note.start, 0, steps - 1)
  const placed = { pitch: note.pitch, start, length: clamp(note.length, 1, steps - start) }
  return {
    ...pattern,
    notes: sortNotes([...pattern.notes.filter((n) => !overlaps(n, placed)), placed]),
  }
}

export function removeNote(pattern: Pattern, ref: NoteRef): Pattern {
  return { ...pattern, notes: pattern.notes.filter((note) => !isRef(note, ref)) }
}

export function moveNote(pattern: Pattern, ref: NoteRef, to: NoteRef, steps: number): Pattern {
  const note = pattern.notes.find((n) => isRef(n, ref))
  if (!note) return pattern
  const start = clamp(to.start, 0, Math.max(steps - note.length, 0))
  return addNote(removeNote(pattern, ref), { pitch: to.pitch, start, length: note.length }, steps)
}

export function resizeNote(pattern: Pattern, ref: NoteRef, length: number, steps: number): Pattern {
  const note = pattern.notes.find((n) => isRef(n, ref))
  if (!note) return pattern
  return addNote(removeNote(pattern, ref), { ...note, length }, steps)
}

export function transposePattern(pattern: Pattern, semitones: number): Pattern {
  const fits = pattern.notes.every(
    (note) => note.pitch + semitones >= MIN_PITCH && note.pitch + semitones <= MAX_PITCH,
  )
  if (!fits || pattern.notes.length === 0) return pattern
  return {
    ...pattern,
    notes: pattern.notes.map((note) => ({ ...note, pitch: note.pitch + semitones })),
  }
}

export function shiftPattern(pattern: Pattern, offset: number, steps: number): Pattern {
  if (pattern.notes.length === 0) return pattern
  const empty: Pattern = { ...pattern, notes: [] }
  return pattern.notes.reduce((result, note) => {
    const start = (((note.start + offset) % steps) + steps) % steps
    return addNote(result, { ...note, start, length: Math.min(note.length, steps - start) }, steps)
  }, empty)
}

export function clearPattern(pattern: Pattern): Pattern {
  return pattern.notes.length === 0 ? pattern : { ...pattern, notes: [] }
}

export function updatePattern(
  song: Song,
  trackId: string,
  patternId: string,
  update: (pattern: Pattern) => Pattern,
): Song {
  let changed = false
  const tracks = song.tracks.map((track) => {
    if (track.id !== trackId) return track
    const patterns = track.patterns.map((pattern) => {
      if (pattern.id !== patternId) return pattern
      const next = update(pattern)
      if (next !== pattern) changed = true
      return next
    })
    return changed ? { ...track, patterns } : track
  })
  return changed ? { ...song, tracks } : song
}
