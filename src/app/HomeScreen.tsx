import { usePwa } from '../pwa/usePwa'
import { Button } from '../ui/Button'
import { Panel, StatusRow } from '../ui/Panel'
import styles from './HomeScreen.module.css'
import { PatternList } from './PatternList'
import { hasAudioSession, isStandalone } from './platform'
import { SoundTest } from './SoundTest'

export function HomeScreen() {
  const { offlineReady, needRefresh, update } = usePwa()
  const installed = isStandalone()
  const audioSession = hasAudioSession()

  return (
    <main className={styles.screen}>
      <header>
        <h1 className={styles.title}>CLPS DAW</h1>
        <p className={styles.subtitle}>POCKET 8-BIT DAW</p>
      </header>

      {needRefresh && (
        <div className={styles.update}>
          <span>NEW VERSION</span>
          <Button onClick={update}>RELOAD</Button>
        </div>
      )}

      <Panel title="SYSTEM CHECK">
        <StatusRow
          label="INSTALLED"
          value={installed ? 'YES' : 'NO'}
          status={installed ? 'ok' : 'bad'}
        />
        <StatusRow
          label="OFFLINE"
          value={offlineReady ? 'READY' : 'WAIT'}
          status={offlineReady ? 'ok' : 'pending'}
        />
        <StatusRow
          label="AUDIO SESSION"
          value={audioSession ? 'OK' : 'MISSING'}
          status={audioSession ? 'ok' : 'bad'}
        />
      </Panel>

      {!installed && <p className={styles.hint}>TO INSTALL: SHARE &gt; ADD TO HOME SCREEN</p>}

      <SoundTest />

      <PatternList />

      <footer className={styles.version}>
        v{__APP_VERSION__} · {__BUILD_SHA__}
      </footer>
    </main>
  )
}
