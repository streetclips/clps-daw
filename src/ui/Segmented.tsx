import styles from './Segmented.module.css'

interface SegmentedProps<T extends string> {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      className={className ? `${styles.segmented} ${className}` : styles.segmented}
      role="radiogroup"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          className={option === value ? `${styles.option} ${styles.selected}` : styles.option}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
