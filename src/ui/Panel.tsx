import type { ReactNode } from 'react'
import styles from './Panel.module.css'

export type Status = 'ok' | 'bad' | 'pending'

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </section>
  )
}

export function StatusRow({
  label,
  value,
  status,
}: {
  label: string
  value: string
  status: Status
}) {
  return (
    <div className={styles.row}>
      <span>{label}</span>
      <span className={styles[status]}>{value}</span>
    </div>
  )
}
