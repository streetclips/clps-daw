import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'danger' | 'on'
}

export function Button({ className, variant, ...props }: ButtonProps) {
  const classes = [styles.button, variant && styles[variant], className].filter(Boolean)
  return <button type="button" className={classes.join(' ')} {...props} />
}
