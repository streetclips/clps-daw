import { useEffect, useState, useSyncExternalStore } from 'react'
import { engine } from '../audio/engine'
import type { Pattern } from '../model/schema'
import { NOTE_LENGTHS, useStore } from '../state/store'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { Segmented } from '../ui/Segmented'
import { TopBar, TopBarRow, TopBarTitle } from '../ui/TopBar'
import { PatternMenu } from './PatternMenu'
import styles from './PatternScreen.module.css'
import { PianoRoll } from './piano-roll/PianoRoll'

export function PatternScreen({ trackId, patternId }: { trackId: string; patternId: string }) {
  const song = useStore((state) => state.song)
  const setView = useStore((state) => state.setView)
  const fold = useStore((state) => state.fold)
  const toggleFold = useStore((state) => state.toggleFold)
  const noteLength = useStore((state) => state.noteLength)
  const setNoteLength = useStore((state) => state.setNoteLength)
  const editPattern = useStore((state) => state.editPattern)
  const { playing } = useSyncExternalStore(engine.subscribe, engine.getSnapshot)
  const [menuOpen, setMenuOpen] = useState(false)

  const track = song.tracks.find((t) => t.id === trackId)
  const pattern = track?.patterns.find((p) => p.id === patternId)

  useEffect(() => () => engine.stop(), [])

  useEffect(() => {
    if (!pattern) setView({ screen: 'home' })
  }, [pattern, setView])

  if (!track || !pattern) return null

  const drums = track.instrument.type === 'drums'

  const back = () => {
    engine.stop()
    setView({ screen: 'home' })
  }

  const togglePlay = () => {
    engine.unlock()
    if (playing) engine.stop()
    else engine.play({ mode: 'pattern', trackId, patternId })
  }

  const edit = (change: (pattern: Pattern, steps: number) => Pattern) =>
    editPattern(trackId, patternId, change)

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <TopBar>
          <TopBarRow>
            <IconButton icon="back" label="Back" onClick={back} />
            <TopBarTitle>
              <span style={{ color: `var(--pico-${track.color})` }}>{track.name}</span> ·{' '}
              {pattern.name}
            </TopBarTitle>
            <IconButton
              icon={playing ? 'stop' : 'play'}
              label={playing ? 'Stop' : 'Play'}
              onClick={togglePlay}
            />
          </TopBarRow>
          <TopBarRow>
            {drums ? (
              <span className={styles.lengths} />
            ) : (
              <>
                <Segmented
                  className={styles.lengths}
                  options={NOTE_LENGTHS}
                  value={noteLength}
                  onChange={setNoteLength}
                />
                <Button
                  className={fold ? styles.on : undefined}
                  aria-pressed={fold}
                  onClick={toggleFold}
                >
                  FOLD
                </Button>
              </>
            )}
            <IconButton
              icon="menu"
              label="Pattern menu"
              onClick={() => setMenuOpen((open) => !open)}
            />
          </TopBarRow>
        </TopBar>
        {menuOpen && <PatternMenu drums={drums} onEdit={edit} onClose={() => setMenuOpen(false)} />}
      </div>
      <PianoRoll song={song} track={track} pattern={pattern} />
    </div>
  )
}
