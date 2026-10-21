import { useStore } from '../state/store'
import { RotateOverlay } from '../ui/RotateOverlay'
import { HomeScreen } from './HomeScreen'
import { PatternScreen } from './PatternScreen'

export function App() {
  const view = useStore((state) => state.view)

  return (
    <>
      {view.screen === 'pattern' ? (
        <PatternScreen key={view.patternId} trackId={view.trackId} patternId={view.patternId} />
      ) : (
        <HomeScreen />
      )}
      <RotateOverlay />
    </>
  )
}
