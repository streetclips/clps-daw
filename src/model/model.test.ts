import { describe, expect, it } from 'vitest'
import { createSong } from './factory'
import { newId } from './ids'
import { parseSong, SongFormatError } from './parse'
import { findSongIssues, songSchema, type Note, type Song } from './schema'

function songWithPattern(notes: Note[], bars: number[] = [0], lengthBars: 1 | 2 | 4 = 1): Song {
  const song = createSong('TEST', new Date('2026-10-21T10:00:00.000Z'))
  const lead = song.tracks[0]!
  lead.patterns.push({ id: 'p1', name: 'P1', lengthBars, notes })
  lead.clips.push(...bars.map((bar, i) => ({ id: `c${i}`, patternId: 'p1', bar })))
  return song
}

function issueMessages(song: Song): string[] {
  return findSongIssues(song).map((issue) => issue.message)
}

describe('createSong', () => {
  it('builds a valid song with LEAD, BASS and DRUMS tracks', () => {
    const song = createSong('MY SONG')

    expect(songSchema.safeParse(song).success).toBe(true)
    expect(song.tracks.map((track) => track.name)).toEqual(['LEAD', 'BASS', 'DRUMS'])
    expect(song.tracks.map((track) => track.instrument.type)).toEqual(['synth', 'synth', 'drums'])
  })
})

describe('parseSong', () => {
  it('round-trips a song through JSON', () => {
    const song = songWithPattern([{ pitch: 60, start: 0, length: 4 }], [0, 1])

    expect(parseSong(JSON.parse(JSON.stringify(song)))).toEqual(song)
  })

  it('rejects files that are not songs', () => {
    expect(() => parseSong({ hello: 'world' })).toThrow(SongFormatError)
    expect(() => parseSong(null)).toThrow(SongFormatError)
  })

  it('rejects songs from a newer format version', () => {
    const song = { ...createSong('NEW'), version: 2 }

    expect(() => parseSong(song)).toThrow(/newer version/)
  })

  it('rejects songs that break the schema', () => {
    const song = { ...createSong('FAST'), bpm: 300 }

    expect(() => parseSong(song)).toThrow(SongFormatError)
  })
})

describe('findSongIssues', () => {
  it('accepts a note that ends exactly at the end of its pattern', () => {
    expect(issueMessages(songWithPattern([{ pitch: 60, start: 15, length: 1 }]))).toEqual([])
  })

  it('rejects a note that ends after its pattern', () => {
    expect(issueMessages(songWithPattern([{ pitch: 60, start: 15, length: 2 }]))).toEqual([
      'Note ends after its pattern',
    ])
  })

  it('uses 12 steps per bar in 3/4', () => {
    const song = songWithPattern([{ pitch: 60, start: 12, length: 1 }])
    song.meter = '3/4'

    expect(issueMessages(song)).toEqual(['Note ends after its pattern'])
  })

  it('rejects synth pitches outside C1–C8', () => {
    expect(issueMessages(songWithPattern([{ pitch: 23, start: 0, length: 1 }]))).toEqual([
      'Pitch 23 out of range',
    ])
  })

  it('rejects drum lanes that do not exist', () => {
    const song = createSong('DRUMS')
    const drums = song.tracks[2]!
    drums.patterns.push({
      id: 'p1',
      name: 'P1',
      lengthBars: 1,
      notes: [{ pitch: 5, start: 0, length: 1 }],
    })

    expect(issueMessages(song)).toEqual(['Pitch 5 out of range'])
  })

  it('rejects overlapping clips in a track', () => {
    expect(issueMessages(songWithPattern([], [0, 1], 2))).toEqual(['Clips overlap'])
  })

  it('accepts linked clips placed back to back', () => {
    expect(issueMessages(songWithPattern([], [0, 2, 4], 2))).toEqual([])
  })

  it('rejects clips that end after bar 128', () => {
    expect(issueMessages(songWithPattern([], [126], 4))).toEqual(['Clip ends after bar 128'])
  })

  it('rejects clips that point to a pattern of another track', () => {
    const song = createSong('LINKS')
    song.tracks[0]!.clips.push({ id: 'c1', patternId: 'missing', bar: 0 })

    expect(issueMessages(song)).toEqual(['Unknown pattern missing'])
  })
})

describe('newId', () => {
  it('returns 12 lowercase alphanumeric characters', () => {
    expect(newId()).toMatch(/^[0-9a-z]{12}$/)
  })
})
