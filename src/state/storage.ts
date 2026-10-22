import { createStore, del, get, set, values } from 'idb-keyval'
import { parseSong } from '../model/parse'
import type { Song } from '../model/schema'

export interface SongSummary {
  id: string
  name: string
  updatedAt: string
}

const songs = createStore('clps-daw', 'songs')
const SEEDED_KEY = 'clps-daw:seeded'

function readSong(raw: unknown): Song | null {
  try {
    return parseSong(raw)
  } catch (error) {
    console.warn('Skipping unreadable song', error)
    return null
  }
}

export async function listSongs(): Promise<SongSummary[]> {
  const all = await values<unknown>(songs)
  return all
    .map(readSong)
    .filter((song): song is Song => song !== null)
    .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function loadSong(id: string): Promise<Song | null> {
  const raw = await get<unknown>(id, songs)
  return raw === undefined ? null : readSong(raw)
}

export async function saveSong(song: Song): Promise<void> {
  await set(song.id, { ...song, updatedAt: new Date().toISOString() }, songs)
}

export async function deleteSong(id: string): Promise<void> {
  await del(id, songs)
}

let seeding: Promise<void> | null = null

export function seedSong(create: () => Song): Promise<void> {
  seeding ??= (async () => {
    if (localStorage.getItem(SEEDED_KEY)) return
    localStorage.setItem(SEEDED_KEY, '1')
    if ((await values(songs)).length === 0) await saveSong(create())
  })()
  return seeding
}

export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch (error) {
    console.warn('Persistent storage request failed', error)
  }
}
