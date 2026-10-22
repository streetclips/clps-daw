import { clearPattern, shiftPattern, transposePattern } from '../model/edit'
import type { Pattern } from '../model/schema'
import { Button } from '../ui/Button'
import styles from './PatternScreen.module.css'

type Edit = (pattern: Pattern, steps: number) => Pattern

const TRANSPOSE = [-12, -1, 1, 12]

export function PatternMenu({
  drums,
  onEdit,
  onClose,
}: {
  drums: boolean
  onEdit: (edit: Edit) => void
  onClose: () => void
}) {
  return (
    <div className={styles.menu}>
      {!drums && (
        <div className={styles.menuRow}>
          <span className={styles.menuLabel}>TRANSPOSE</span>
          {TRANSPOSE.map((semitones) => (
            <Button key={semitones} onClick={() => onEdit((p) => transposePattern(p, semitones))}>
              {semitones > 0 ? `+${semitones}` : semitones}
            </Button>
          ))}
        </div>
      )}
      <div className={styles.menuRow}>
        <span className={styles.menuLabel}>SHIFT</span>
        <Button onClick={() => onEdit((p, steps) => shiftPattern(p, -1, steps))}>&lt;</Button>
        <Button onClick={() => onEdit((p, steps) => shiftPattern(p, 1, steps))}>&gt;</Button>
      </div>
      <div className={styles.menuRow}>
        <Button variant="danger" onClick={() => onEdit(clearPattern)}>
          CLEAR
        </Button>
        <span className={styles.menuLabel} />
        <Button onClick={onClose}>CLOSE</Button>
      </div>
    </div>
  )
}
