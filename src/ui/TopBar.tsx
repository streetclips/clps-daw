import type { ReactNode } from 'react'
import styles from './TopBar.module.css'

export function TopBar({ children }: { children: ReactNode }) {
  return <header className={styles.bar}>{children}</header>
}

export function TopBarRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>
}

export function TopBarTitle({ children }: { children: ReactNode }) {
  return <h1 className={styles.title}>{children}</h1>
}
