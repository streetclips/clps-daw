import styles from './TextField.module.css'

export function TextField({
  value,
  maxLength,
  label,
  onCommit,
}: {
  value: string
  maxLength: number
  label: string
  onCommit: (value: string) => void
}) {
  return (
    <input
      key={value}
      className={styles.input}
      aria-label={label}
      defaultValue={value}
      maxLength={maxLength}
      autoCapitalize="characters"
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="done"
      onBlur={(event) => onCommit(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}
