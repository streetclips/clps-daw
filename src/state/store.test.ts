import { beforeEach, describe, expect, it } from 'vitest'
import { setBpm } from '../model/arrange'
import { createSong } from '../model/factory'
import { HISTORY_LIMIT, useStore } from './store'

describe('history', () => {
  beforeEach(() => useStore.getState().openSong(createSong('HISTORY')))

  const bpm = () => useStore.getState().song?.bpm

  it('undoes and redoes commits', () => {
    const { commit, undo, redo } = useStore.getState()
    commit((song) => setBpm(song, 100))
    commit((song) => setBpm(song, 90))

    undo()
    expect(bpm()).toBe(100)
    undo()
    expect(bpm()).toBe(120)
    redo()
    expect(bpm()).toBe(100)
  })

  it('ignores commits that change nothing', () => {
    useStore.getState().commit((song) => song)

    expect(useStore.getState().past).toHaveLength(0)
  })

  it('drops the redo stack after a new edit', () => {
    const { commit, undo } = useStore.getState()
    commit((song) => setBpm(song, 100))
    undo()
    commit((song) => setBpm(song, 80))

    expect(useStore.getState().future).toHaveLength(0)
  })

  it(`keeps at most ${HISTORY_LIMIT} steps`, () => {
    const { commit } = useStore.getState()
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) commit((song) => setBpm(song, 60 + (i % 150)))

    expect(useStore.getState().past).toHaveLength(HISTORY_LIMIT)
  })

  it('starts a fresh history when another song opens', () => {
    useStore.getState().commit((song) => setBpm(song, 100))
    useStore.getState().openSong(createSong('OTHER'))

    expect(useStore.getState().past).toHaveLength(0)
  })
})
