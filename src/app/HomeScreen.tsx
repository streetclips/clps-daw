import { usePwa } from '../pwa/usePwa'
import { Button } from '../ui/Button'
import styles from './HomeScreen.module.css'
import { hasAudioSession, isStandalone } from './platform'

type Status = 'ok' | 'bad' | 'pending'

function StatusRow({ label, value, status }: { label: string; value: string; status: Status }) {
  return (
    <div className={styles.row}>
      <span>{label}</span>
      <span className={styles[status]}>{value}</span>
    </div>
  )
}

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

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>SYSTEM CHECK</h2>
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
      </section>

      {!installed && <p className={styles.hint}>TO INSTALL: SHARE &gt; ADD TO HOME SCREEN</p>}

      <footer className={styles.version}>
        v{__APP_VERSION__} · {__BUILD_SHA__}
      </footer>
    </main>
  )
}
