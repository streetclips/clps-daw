import { useStore } from '../state/store'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import styles from './PatternList.module.css'

export function PatternList() {
  const tracks = useStore((state) => state.song.tracks)
  const setView = useStore((state) => state.setView)

  return (
    <Panel title="EDIT PATTERNS">
      {tracks.flatMap((track) =>
        track.patterns.map((pattern) => (
          <div key={pattern.id} className={styles.row}>
            <span className={styles.name}>
              <span style={{ color: `var(--pico-${track.color})` }}>{track.name}</span> ·{' '}
              {pattern.name}
            </span>
            <Button
              onClick={() =>
                setView({ screen: 'pattern', trackId: track.id, patternId: pattern.id })
              }
            >
              EDIT
            </Button>
          </div>
        )),
      )}
    </Panel>
  )
}
