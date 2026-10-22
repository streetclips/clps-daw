import { useEffect, useState, useSyncExternalStore } from 'react'
import { engine } from '../audio/engine'
import { PATTERN_LENGTHS } from '../model/constants'
import type { Song } from '../model/schema'
import { useStore } from '../state/store'
import { IconButton } from '../ui/IconButton'
import { Segmented } from '../ui/Segmented'
import { TopBar, TopBarRow, TopBarTitle } from '../ui/TopBar'
import { ClipMenu } from './ClipMenu'
import { SongSheet } from './SongSheet'
import styles from './SongScreen.module.css'
import { TrackView } from './track-view/TrackView'
import { AddTrackSheet, TrackSheet } from './TrackSheet'
import { UndoRedo } from './UndoRedo'

type OpenSheet =
  | { kind: 'song' }
  | { kind: 'addTrack' }
  | { kind: 'track'; trackId: string }
  | { kind: 'clip'; trackId: string; clipId: string }

const BAR_OPTIONS = PATTERN_LENGTHS.map(String) as ['1', '2', '4']

export function SongScreen({ song }: { song: Song }) {
  const closeSong = useStore((state) => state.closeSong)
  const cursorBar = useStore((state) => state.cursorBar)
  const newPatternBars = useStore((state) => state.newPatternBars)
  const setNewPatternBars = useStore((state) => state.setNewPatternBars)
  const { playing } = useSyncExternalStore(engine.subscribe, engine.getSnapshot)
  const [sheet, setSheet] = useState<OpenSheet | null>(null)

  useEffect(() => () => engine.stop(), [])

  const close = () => setSheet(null)
  const sheetTrack =
    sheet && 'trackId' in sheet ? song.tracks.find((t) => t.id === sheet.trackId) : undefined
  const sheetClip =
    sheet?.kind === 'clip' ? sheetTrack?.clips.find((c) => c.id === sheet.clipId) : undefined

  const back = () => {
    engine.stop()
    closeSong()
  }

  const togglePlay = () => {
    engine.unlock()
    if (playing) engine.stop()
    else engine.play({ mode: 'song', fromBar: cursorBar })
  }

  return (
    <div className={styles.screen}>
      <TopBar>
        <TopBarRow>
          <IconButton icon="back" label="Songs" onClick={back} />
          <TopBarTitle>{song.name}</TopBarTitle>
          <UndoRedo />
          <IconButton
            icon={playing ? 'stop' : 'play'}
            label={playing ? 'Stop' : 'Play'}
            onClick={togglePlay}
          />
        </TopBarRow>
        <TopBarRow>
          <span className={styles.info}>
            {song.bpm} BPM · {song.meter}
          </span>
          <span className={styles.newLabel}>NEW</span>
          <Segmented
            className={styles.newBars}
            options={BAR_OPTIONS}
            value={String(newPatternBars) as '1' | '2' | '4'}
            onChange={(bars) => setNewPatternBars(Number(bars) as 1 | 2 | 4)}
          />
          <IconButton
            icon="menu"
            label="Song settings"
            onClick={() => setSheet({ kind: 'song' })}
          />
        </TopBarRow>
      </TopBar>
      <TrackView
        song={song}
        onOpenTrack={(trackId) => setSheet({ kind: 'track', trackId })}
        onOpenClipMenu={(trackId, clipId) => setSheet({ kind: 'clip', trackId, clipId })}
        onAddTrack={() => setSheet({ kind: 'addTrack' })}
      />
      {sheet?.kind === 'song' && <SongSheet song={song} onClose={close} />}
      {sheet?.kind === 'addTrack' && <AddTrackSheet onClose={close} />}
      {sheet?.kind === 'track' && sheetTrack && <TrackSheet track={sheetTrack} onClose={close} />}
      {sheetTrack && sheetClip && <ClipMenu track={sheetTrack} clip={sheetClip} onClose={close} />}
    </div>
  )
}
