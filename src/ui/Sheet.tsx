import type { ReactNode } from 'react'
import { Button } from './Button'
import styles from './Sheet.module.css'
import { useEscape } from './useEscape'

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  useEscape(onClose)

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <section className={styles.sheet} onClick={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <Button onClick={onClose}>CLOSE</Button>
        </header>
        {children}
      </section>
    </div>
  )
}

export function SheetRow({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      {label !== undefined && <span className={styles.label}>{label}</span>}
      {children}
    </div>
  )
}

export function SheetSection({ children }: { children: ReactNode }) {
  return <h3 className={styles.section}>{children}</h3>
}
