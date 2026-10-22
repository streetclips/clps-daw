import type { Song } from '../model/schema'
import { saveSong } from './storage'
import { useStore } from './store'

const SAVE_DELAY_MS = 500

let timer: ReturnType<typeof setTimeout> | null = null
let pending: Song | null = null

function flush(): void {
  if (timer !== null) clearTimeout(timer)
  timer = null
  if (!pending) return
  const song = pending
  pending = null
  saveSong(song).catch((error: unknown) => console.error('Autosave failed', error))
}

export function cancelPendingSave(): void {
  if (timer !== null) clearTimeout(timer)
  timer = null
  pending = null
}

export function startAutosave(): void {
  useStore.subscribe((state, previous) => {
    if (state.song === previous.song || !previous.song) return
    if (state.song?.id !== previous.song.id) {
      flush()
      return
    }
    pending = state.song
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(flush, SAVE_DELAY_MS)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
}
