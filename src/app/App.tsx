import { useStore } from '../state/store'
import { RotateOverlay } from '../ui/RotateOverlay'
import { PatternScreen } from './PatternScreen'
import { SongScreen } from './SongScreen'
import { SongsScreen } from './SongsScreen'
import { UpdateBanner } from './UpdateBanner'

export function App() {
  const view = useStore((state) => state.view)
  const song = useStore((state) => state.song)

  return (
    <>
      {!song ? (
        <SongsScreen />
      ) : view.screen === 'pattern' ? (
        <PatternScreen
          key={view.patternId}
          song={song}
          trackId={view.trackId}
          patternId={view.patternId}
        />
      ) : (
        <SongScreen song={song} />
      )}
      <UpdateBanner />
      <RotateOverlay />
    </>
  )
}
