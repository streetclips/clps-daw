import { describe, expect, it } from 'vitest'
import {
  addNote,
  clearPattern,
  moveNote,
  noteAt,
  removeNote,
  resizeNote,
  shiftPattern,
  transposePattern,
  updatePattern,
} from './edit'
import { createSong } from './factory'
import type { Note, Pattern } from './schema'

const STEPS = 16

function pattern(...notes: Note[]): Pattern {
  return { id: 'p', name: 'P', lengthBars: 1, notes }
}

describe('addNote', () => {
  it('keeps notes sorted by start and pitch', () => {
    const result = addNote(
      pattern({ pitch: 60, start: 4, length: 1 }),
      { pitch: 64, start: 0, length: 1 },
      STEPS,
    )

    expect(result.notes.map((n) => n.start)).toEqual([0, 4])
  })

  it('trims a note that would run past the pattern', () => {
    expect(addNote(pattern(), { pitch: 60, start: 14, length: 4 }, STEPS).notes).toEqual([
      { pitch: 60, start: 14, length: 2 },
    ])
  })

  it('replaces overlapping notes of the same pitch', () => {
    const result = addNote(
      pattern({ pitch: 60, start: 0, length: 8 }),
      { pitch: 60, start: 4, length: 2 },
      STEPS,
    )

    expect(result.notes).toEqual([{ pitch: 60, start: 4, length: 2 }])
  })

  it('allows chords', () => {
    const result = addNote(
      pattern({ pitch: 60, start: 0, length: 4 }),
      { pitch: 64, start: 0, length: 4 },
      STEPS,
    )

    expect(result.notes).toHaveLength(2)
  })
})

describe('noteAt', () => {
  it('finds the note covering a step', () => {
    const p = pattern({ pitch: 60, start: 2, length: 3 })

    expect(noteAt(p, 60, 4)).toEqual({ pitch: 60, start: 2, length: 3 })
    expect(noteAt(p, 60, 5)).toBeUndefined()
    expect(noteAt(p, 62, 3)).toBeUndefined()
  })
})

describe('removeNote', () => {
  it('removes the note at a pitch and start', () => {
    expect(
      removeNote(pattern({ pitch: 60, start: 2, length: 1 }), { pitch: 60, start: 2 }).notes,
    ).toEqual([])
  })
})

describe('moveNote', () => {
  it('moves a note in time and pitch, keeping its length', () => {
    const result = moveNote(
      pattern({ pitch: 60, start: 0, length: 4 }),
      { pitch: 60, start: 0 },
      { pitch: 67, start: 8 },
      STEPS,
    )

    expect(result.notes).toEqual([{ pitch: 67, start: 8, length: 4 }])
  })

  it('stops at the end of the pattern', () => {
    const result = moveNote(
      pattern({ pitch: 60, start: 0, length: 4 }),
      { pitch: 60, start: 0 },
      { pitch: 60, start: 15 },
      STEPS,
    )

    expect(result.notes).toEqual([{ pitch: 60, start: 12, length: 4 }])
  })
})

describe('resizeNote', () => {
  it('changes the length within the pattern', () => {
    const p = pattern({ pitch: 60, start: 12, length: 1 })

    expect(resizeNote(p, { pitch: 60, start: 12 }, 3, STEPS).notes[0]?.length).toBe(3)
    expect(resizeNote(p, { pitch: 60, start: 12 }, 9, STEPS).notes[0]?.length).toBe(4)
  })
})

describe('transposePattern', () => {
  it('moves every note by the interval', () => {
    const result = transposePattern(
      pattern({ pitch: 60, start: 0, length: 1 }, { pitch: 64, start: 1, length: 1 }),
      12,
    )

    expect(result.notes.map((n) => n.pitch)).toEqual([72, 76])
  })

  it('does nothing when a note would leave C1–C8', () => {
    const p = pattern({ pitch: 105, start: 0, length: 1 })

    expect(transposePattern(p, 12)).toBe(p)
  })
})

describe('shiftPattern', () => {
  it('rotates notes around the pattern end', () => {
    const result = shiftPattern(
      pattern({ pitch: 60, start: 15, length: 1 }, { pitch: 62, start: 0, length: 2 }),
      1,
      STEPS,
    )

    expect(result.notes).toEqual([
      { pitch: 60, start: 0, length: 1 },
      { pitch: 62, start: 1, length: 2 },
    ])
  })

  it('shifts left and trims notes that would wrap', () => {
    const result = shiftPattern(pattern({ pitch: 60, start: 0, length: 2 }), -1, STEPS)

    expect(result.notes).toEqual([{ pitch: 60, start: 15, length: 1 }])
  })
})

describe('clearPattern', () => {
  it('removes every note', () => {
    expect(clearPattern(pattern({ pitch: 60, start: 0, length: 1 })).notes).toEqual([])
  })
})

describe('updatePattern', () => {
  it('returns the same song when nothing changes', () => {
    const song = createSong('SAME')
    song.tracks[0]!.patterns.push(pattern())

    expect(updatePattern(song, song.tracks[0]!.id, 'p', clearPattern)).toBe(song)
  })

  it('replaces only the edited pattern', () => {
    const song = createSong('EDIT')
    const lead = song.tracks[0]!
    lead.patterns.push(pattern())
    const next = updatePattern(song, lead.id, 'p', (p) =>
      addNote(p, { pitch: 60, start: 0, length: 1 }, STEPS),
    )

    expect(next.tracks[0]!.patterns[0]!.notes).toHaveLength(1)
    expect(song.tracks[0]!.patterns[0]!.notes).toHaveLength(0)
    expect(next.tracks[1]).toBe(song.tracks[1])
  })
})
