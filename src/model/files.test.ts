import { describe, expect, it } from 'vitest'
import { createDemoSong } from './demo'
import { importSong, serializeSong, songFileName } from './files'
import { SongFormatError } from './parse'

describe('serializeSong and importSong', () => {
  it('round-trips a song as a new copy', () => {
    const song = createDemoSong()
    const now = new Date('2026-10-22T08:00:00.000Z')
    const imported = importSong(serializeSong(song), now)

    expect(imported.id).not.toBe(song.id)
    expect(imported.updatedAt).toBe(now.toISOString())
    expect({ ...imported, id: song.id, updatedAt: song.updatedAt }).toEqual(song)
  })

  it('rejects text that is not JSON', () => {
    expect(() => importSong('not json')).toThrow(SongFormatError)
  })

  it('rejects JSON that is not a song', () => {
    expect(() => importSong('{"hello":1}')).toThrow(/not a CLPS DAW song/)
  })
})

describe('songFileName', () => {
  it('turns the song name into a safe file name', () => {
    expect(songFileName('MY FIRST TUNE!', 'wav')).toBe('my-first-tune.wav')
    expect(songFileName('***', 'json')).toBe('song.json')
  })
})
