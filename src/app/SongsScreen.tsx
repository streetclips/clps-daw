import { useEffect, useState } from 'react'
import { createDemoSong } from '../model/demo'
import { createSong } from '../model/factory'
import { listSongs, loadSong, saveSong, seedSong, type SongSummary } from '../state/storage'
import { useStore } from '../state/store'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import { isStandalone } from './platform'
import styles from './SongsScreen.module.css'

function formatDate(iso: string): string {
  const date = new Date(iso)
  const day = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${day} ${time}`
}

function nextSongName(songs: SongSummary[]): string {
  const names = new Set(songs.map((song) => song.name))
  let number = songs.length + 1
  while (names.has(`SONG ${number}`)) number++
  return `SONG ${number}`
}

export function SongsScreen() {
  const openSong = useStore((state) => state.openSong)
  const [songs, setSongs] = useState<SongSummary[] | null>(null)

  useEffect(() => {
    let active = true
    seedSong(createDemoSong)
      .then(listSongs)
      .then((list) => {
        if (active) setSongs(list)
      })
      .catch((error: unknown) => console.error('Could not list songs', error))
    return () => {
      active = false
    }
  }, [])

  const create = async () => {
    const song = createSong(nextSongName(songs ?? []))
    await saveSong(song)
    openSong(song)
  }

  const open = async (id: string) => {
    const song = await loadSong(id)
    if (song) openSong(song)
  }

  return (
    <main className={styles.screen}>
      <header>
        <h1 className={styles.title}>CLPS DAW</h1>
        <p className={styles.subtitle}>POCKET 8-BIT DAW</p>
      </header>

      <Button onClick={create}>+ NEW SONG</Button>

      <Panel title="SONGS">
        {songs === null && <span className={styles.empty}>LOADING...</span>}
        {songs?.length === 0 && <span className={styles.empty}>NO SONGS YET</span>}
        {songs?.map((song) => (
          <button key={song.id} type="button" className={styles.song} onClick={() => open(song.id)}>
            <span className={styles.name}>{song.name}</span>
            <span className={styles.date}>{formatDate(song.updatedAt)}</span>
          </button>
        ))}
      </Panel>

      {!isStandalone() && <p className={styles.hint}>TO INSTALL: SHARE &gt; ADD TO HOME SCREEN</p>}

      <footer className={styles.version}>
        v{__APP_VERSION__} · {__BUILD_SHA__}
      </footer>
    </main>
  )
}
