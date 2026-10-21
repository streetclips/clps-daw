import { describe, expect, it } from 'vitest'
import { createDemoSong } from '../model/demo'
import { createSong } from '../model/factory'
import { findSongIssues, type Song } from '../model/schema'
import {
  delaySeconds,
  isTrackAudible,
  secondsPerStep,
  songLengthBars,
  songLengthSteps,
  songNotesAtStep,
} from './timeline'

function linkedSong(meter: Song['meter'] = '4/4'): Song {
  const song = createSong('LINKED')
  song.meter = meter
  const lead = song.tracks[0]!
  lead.patterns.push({
    id: 'p1',
    name: 'P1',
    lengthBars: 1,
    notes: [{ pitch: 60, start: 0, length: 4 }],
  })
  lead.clips.push({ id: 'a', patternId: 'p1', bar: 0 }, { id: 'b', patternId: 'p1', bar: 2 })
  return song
}

describe('timing', () => {
  it('makes a step a sixteenth note', () => {
    expect(secondsPerStep(120)).toBe(0.125)
  })

  it('syncs the delay to the tempo', () => {
    expect(delaySeconds('1/8', 120)).toBe(0.25)
    expect(delaySeconds('1/8d', 120)).toBe(0.375)
    expect(delaySeconds('1/4', 60)).toBe(1)
  })
})

describe('song length', () => {
  it('ends with the last clip', () => {
    expect(songLengthBars(linkedSong())).toBe(3)
    expect(songLengthSteps(linkedSong('3/4'))).toBe(36)
  })

  it('is zero for a song without clips', () => {
    expect(songLengthBars(createSong('EMPTY'))).toBe(0)
  })
})

describe('songNotesAtStep', () => {
  it('plays every linked copy of a pattern', () => {
    const song = linkedSong()

    expect(songNotesAtStep(song, 0)).toHaveLength(1)
    expect(songNotesAtStep(song, 16)).toHaveLength(0)
    expect(songNotesAtStep(song, 32)).toHaveLength(1)
  })

  it('uses 12 steps per bar in 3/4', () => {
    const song = linkedSong('3/4')

    expect(songNotesAtStep(song, 24)).toHaveLength(1)
    expect(songNotesAtStep(song, 32)).toHaveLength(0)
  })
})

describe('isTrackAudible', () => {
  const track = createSong('MIX').tracks[0]!

  it('silences muted tracks', () => {
    expect(isTrackAudible({ ...track, mute: true }, false)).toBe(false)
  })

  it('silences tracks without solo when another track is soloed', () => {
    expect(isTrackAudible(track, true)).toBe(false)
    expect(isTrackAudible({ ...track, solo: true }, true)).toBe(true)
  })

  it('keeps a muted track silent even when soloed', () => {
    expect(isTrackAudible({ ...track, mute: true, solo: true }, true)).toBe(false)
  })
})

describe('createDemoSong', () => {
  it('is a valid 8-bar song', () => {
    const song = createDemoSong()

    expect(findSongIssues(song)).toEqual([])
    expect(songLengthBars(song)).toBe(8)
  })
})
