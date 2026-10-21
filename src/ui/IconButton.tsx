import type { ButtonHTMLAttributes } from 'react'
import { Button } from './Button'
import { Icon, type IconName } from './Icon'
import styles from './IconButton.module.css'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  label: string
}

export function IconButton({ icon, label, className, ...props }: IconButtonProps) {
  return (
    <Button
      aria-label={label}
      className={className ? `${styles.iconButton} ${className}` : styles.iconButton}
      {...props}
    >
      <Icon name={icon} />
    </Button>
  )
}
