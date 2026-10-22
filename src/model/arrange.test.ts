import { describe, expect, it } from 'vitest'
import {
  addTrack,
  canPlaceClip,
  clipAt,
  createPatternClip,
  deleteClip,
  duplicateClip,
  freeBarsAt,
  linkCount,
  makeClipUnique,
  moveClip,
  removeTrack,
  renameSong,
  renameTrack,
  setBpm,
  setMeter,
} from './arrange'
import { createSong } from './factory'
import { findSongIssues, type Song, type Track } from './schema'

function songWithClips(): Song {
  const song = createSong('ARRANGE')
  const lead = song.tracks[0]!
  lead.patterns.push(
    { id: 'p1', name: 'P1', lengthBars: 2, notes: [{ pitch: 60, start: 0, length: 4 }] },
    { id: 'p2', name: 'P2', lengthBars: 1, notes: [] },
  )
  lead.clips.push(
    { id: 'a', patternId: 'p1', bar: 0 },
    { id: 'b', patternId: 'p1', bar: 4 },
    { id: 'c', patternId: 'p2', bar: 8 },
  )
  return song
}

const lead = (song: Song): Track => song.tracks[0]!

describe('clip lookup', () => {
  it('finds the clip covering a bar', () => {
    const track = lead(songWithClips())

    expect(clipAt(track, 1)?.id).toBe('a')
    expect(clipAt(track, 2)).toBeUndefined()
    expect(clipAt(track, 8)?.id).toBe('c')
  })

  it('counts linked clips', () => {
    expect(linkCount(lead(songWithClips()), 'p1')).toBe(2)
  })

  it('measures the free space before the next clip', () => {
    const track = lead(songWithClips())

    expect(freeBarsAt(track, 2)).toBe(2)
    expect(freeBarsAt(track, 1)).toBe(0)
    expect(freeBarsAt(track, 9)).toBe(119)
  })

  it('rejects overlapping or out-of-song placements', () => {
    const track = lead(songWithClips())

    expect(canPlaceClip(track, 2, 2)).toBe(true)
    expect(canPlaceClip(track, 3, 2)).toBe(false)
    expect(canPlaceClip(track, 127, 2)).toBe(false)
    expect(canPlaceClip(track, 1, 2, 'a')).toBe(true)
  })
})

describe('createPatternClip', () => {
  it('creates a numbered pattern and its clip', () => {
    const result = createPatternClip(songWithClips(), 't', 0, 4)
    expect(result).toBeNull()

    const song = songWithClips()
    const created = createPatternClip(song, lead(song).id, 12, 4)!
    const track = lead(created.song)

    expect(track.patterns.at(-1)).toMatchObject({
      id: created.patternId,
      name: 'P3',
      lengthBars: 4,
    })
    expect(track.clips.at(-1)).toMatchObject({ patternId: created.patternId, bar: 12 })
    expect(findSongIssues(created.song)).toEqual([])
  })

  it('shrinks the pattern to the free space', () => {
    const song = songWithClips()

    expect(
      lead(createPatternClip(song, lead(song).id, 2, 4)!.song).patterns.at(-1)?.lengthBars,
    ).toBe(2)
    expect(
      lead(createPatternClip(song, lead(song).id, 3, 4)!.song).patterns.at(-1)?.lengthBars,
    ).toBe(1)
  })

  it('does nothing on an occupied bar', () => {
    const song = songWithClips()

    expect(createPatternClip(song, lead(song).id, 0, 1)).toBeNull()
  })
})

describe('moveClip', () => {
  it('moves a clip to free bars', () => {
    const song = songWithClips()

    expect(clipAt(lead(moveClip(song, lead(song).id, 'c', 10)), 10)?.id).toBe('c')
  })

  it('refuses to overlap another clip', () => {
    const song = songWithClips()

    expect(moveClip(song, lead(song).id, 'c', 5)).toBe(song)
  })
})

describe('duplicateClip', () => {
  it('places a linked copy at the next free bars', () => {
    const song = songWithClips()
    const track = lead(duplicateClip(song, lead(song).id, 'a'))

    expect(track.clips.at(-1)).toMatchObject({ patternId: 'p1', bar: 2 })
    expect(linkCount(track, 'p1')).toBe(3)
  })

  it('skips occupied bars', () => {
    const base = songWithClips()
    const song = moveClip(base, lead(base).id, 'c', 6)
    const track = lead(duplicateClip(song, lead(song).id, 'b'))

    expect(track.clips.at(-1)).toMatchObject({ patternId: 'p1', bar: 7 })
  })
})

describe('makeClipUnique', () => {
  it('gives the clip its own copy of the pattern', () => {
    const song = songWithClips()
    const track = lead(makeClipUnique(song, lead(song).id, 'b'))
    const clip = track.clips.find((c) => c.id === 'b')!
    const copy = track.patterns.find((p) => p.id === clip.patternId)!

    expect(copy.name).toBe('P3')
    expect(copy.notes).toEqual([{ pitch: 60, start: 0, length: 4 }])
    expect(linkCount(track, 'p1')).toBe(1)
  })

  it('leaves clips that are already unique alone', () => {
    const song = songWithClips()

    expect(makeClipUnique(song, lead(song).id, 'c')).toBe(song)
  })
})

describe('deleteClip', () => {
  it('keeps a pattern that other clips still use', () => {
    const track = lead(deleteClip(songWithClips(), lead(songWithClips()).id, 'a'))

    expect(track.patterns.map((p) => p.id)).toContain('p1')
  })

  it('deletes the pattern with its last clip', () => {
    const song = songWithClips()
    const track = lead(deleteClip(song, lead(song).id, 'c'))

    expect(track.patterns.map((p) => p.id)).toEqual(['p1'])
  })
})

describe('tracks', () => {
  it('adds tracks with unused colors and unique names', () => {
    const song = addTrack(addTrack(createSong('T'), 'synth'), 'drums')

    expect(song.tracks.map((t) => t.name)).toEqual(['LEAD', 'BASS', 'DRUMS', 'SYNTH', 'DRUMS 2'])
    expect(new Set(song.tracks.map((t) => t.color)).size).toBe(5)
  })

  it('stops at 8 tracks', () => {
    let song = createSong('FULL')
    for (let i = 0; i < 10; i++) song = addTrack(song, 'synth')

    expect(song.tracks).toHaveLength(8)
  })

  it('removes a track', () => {
    const song = createSong('R')

    expect(removeTrack(song, song.tracks[1]!.id).tracks.map((t) => t.name)).toEqual([
      'LEAD',
      'DRUMS',
    ])
  })
})

describe('song settings', () => {
  it('cleans names', () => {
    const song = createSong('OLD')

    expect(renameSong(song, '  my tune ').name).toBe('MY TUNE')
    expect(renameSong(song, '   ')).toBe(song)
    expect(renameTrack(song, song.tracks[0]!.id, 'a very long track name').tracks[0]!.name).toBe(
      'A VERY LONG ',
    )
  })

  it('clamps the tempo', () => {
    const song = createSong('BPM')

    expect(setBpm(song, 300).bpm).toBe(240)
    expect(setBpm(song, 10).bpm).toBe(60)
  })

  it('trims notes that do not fit a shorter meter', () => {
    const song = createSong('METER')
    song.tracks[0]!.patterns.push({
      id: 'p',
      name: 'P1',
      lengthBars: 1,
      notes: [
        { pitch: 60, start: 8, length: 8 },
        { pitch: 62, start: 13, length: 1 },
      ],
    })
    const next = setMeter(song, '3/4')

    expect(next.tracks[0]!.patterns[0]!.notes).toEqual([{ pitch: 60, start: 8, length: 4 }])
    expect(findSongIssues(next)).toEqual([])
  })
})
