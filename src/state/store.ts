import { create } from 'zustand'
import { STEPS_PER_BAR } from '../model/constants'
import { patternSteps, updatePattern } from '../model/edit'
import type { Pattern, Song } from '../model/schema'

export type View =
  | { screen: 'songs' }
  | { screen: 'song' }
  | { screen: 'pattern'; trackId: string; patternId: string }

export const NOTE_LENGTHS = ['1/16', '1/8', '1/4', '1/2', '1'] as const
export type NoteLength = (typeof NOTE_LENGTHS)[number]

export function noteLengthSteps(length: NoteLength, meter: Song['meter']): number {
  return { '1/16': 1, '1/8': 2, '1/4': 4, '1/2': 8, '1': STEPS_PER_BAR[meter] }[length]
}

export const HISTORY_LIMIT = 100

interface AppState {
  song: Song | null
  past: Song[]
  future: Song[]
  view: View
  cursorBar: number
  newPatternBars: Pattern['lengthBars']
  noteLength: NoteLength
  fold: boolean
  openSong: (song: Song) => void
  closeSong: () => void
  commit: (update: (song: Song) => Song) => void
  undo: () => void
  redo: () => void
  editPattern: (
    trackId: string,
    patternId: string,
    edit: (pattern: Pattern, steps: number) => Pattern,
  ) => void
  setView: (view: View) => void
  setCursorBar: (bar: number) => void
  setNewPatternBars: (bars: Pattern['lengthBars']) => void
  setNoteLength: (length: NoteLength) => void
  toggleFold: () => void
}

export const useStore = create<AppState>()((set, get) => ({
  song: null,
  past: [],
  future: [],
  view: { screen: 'songs' },
  cursorBar: 0,
  newPatternBars: 1,
  noteLength: '1/8',
  fold: false,
  openSong: (song) => set({ song, past: [], future: [], view: { screen: 'song' }, cursorBar: 0 }),
  closeSong: () => set({ song: null, past: [], future: [], view: { screen: 'songs' } }),
  commit: (update) =>
    set((state) => {
      if (!state.song) return state
      const next = update(state.song)
      if (next === state.song) return state
      return { song: next, past: [...state.past, state.song].slice(-HISTORY_LIMIT), future: [] }
    }),
  undo: () =>
    set((state) => {
      const previous = state.past.at(-1)
      if (!previous || !state.song) return state
      return {
        song: previous,
        past: state.past.slice(0, -1),
        future: [state.song, ...state.future],
      }
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0]
      if (!next || !state.song) return state
      return { song: next, past: [...state.past, state.song], future: state.future.slice(1) }
    }),
  editPattern: (trackId, patternId, edit) =>
    get().commit((song) =>
      updatePattern(song, trackId, patternId, (pattern) =>
        edit(pattern, patternSteps(pattern, song.meter)),
      ),
    ),
  setView: (view) => set({ view }),
  setCursorBar: (cursorBar) => set({ cursorBar }),
  setNewPatternBars: (newPatternBars) => set({ newPatternBars }),
  setNoteLength: (noteLength) => set({ noteLength }),
  toggleFold: () => set((state) => ({ fold: !state.fold })),
}))
