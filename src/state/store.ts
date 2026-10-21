import { create } from 'zustand'
import { STEPS_PER_BAR } from '../model/constants'
import { createDemoSong } from '../model/demo'
import { patternSteps, updatePattern } from '../model/edit'
import type { Pattern, Song } from '../model/schema'

export type View = { screen: 'home' } | { screen: 'pattern'; trackId: string; patternId: string }

export const NOTE_LENGTHS = ['1/16', '1/8', '1/4', '1/2', '1'] as const
export type NoteLength = (typeof NOTE_LENGTHS)[number]

export function noteLengthSteps(length: NoteLength, meter: Song['meter']): number {
  return { '1/16': 1, '1/8': 2, '1/4': 4, '1/2': 8, '1': STEPS_PER_BAR[meter] }[length]
}

interface AppState {
  song: Song
  view: View
  noteLength: NoteLength
  fold: boolean
  setView: (view: View) => void
  setNoteLength: (length: NoteLength) => void
  toggleFold: () => void
  editPattern: (
    trackId: string,
    patternId: string,
    edit: (pattern: Pattern, steps: number) => Pattern,
  ) => void
}

export const useStore = create<AppState>()((set) => ({
  song: createDemoSong(),
  view: { screen: 'home' },
  noteLength: '1/8',
  fold: false,
  setView: (view) => set({ view }),
  setNoteLength: (noteLength) => set({ noteLength }),
  toggleFold: () => set((state) => ({ fold: !state.fold })),
  editPattern: (trackId, patternId, edit) =>
    set((state) => ({
      song: updatePattern(state.song, trackId, patternId, (pattern) =>
        edit(pattern, patternSteps(pattern, state.song.meter)),
      ),
    })),
}))
