import { usePwa } from '../pwa/usePwa'
import { Button } from '../ui/Button'
import styles from './UpdateBanner.module.css'

export function UpdateBanner() {
  const { needRefresh, update } = usePwa()
  if (!needRefresh) return null
  return (
    <div className={styles.banner}>
      <span>NEW VERSION</span>
      <Button onClick={update}>RELOAD</Button>
    </div>
  )
}
