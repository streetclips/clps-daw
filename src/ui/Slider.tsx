import styles from './Slider.module.css'

export type SliderScale = 'linear' | 'square' | 'log'

const STEPS = 1000

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

function toPosition(value: number, min: number, max: number, scale: SliderScale): number {
  const t =
    scale === 'log' ? Math.log(value / min) / Math.log(max / min) : (value - min) / (max - min)
  return Math.round((scale === 'square' ? Math.sqrt(clamp01(t)) : clamp01(t)) * STEPS)
}

function fromPosition(position: number, min: number, max: number, scale: SliderScale): number {
  const p = position / STEPS
  if (scale === 'log') return min * (max / min) ** p
  return min + (scale === 'square' ? p * p : p) * (max - min)
}

export function Slider({
  label,
  value,
  min,
  max,
  precision,
  scale = 'linear',
  format,
  onChange,
  onEnd,
}: {
  label: string
  value: number
  min: number
  max: number
  precision: number
  scale?: SliderScale
  format: (value: number) => string
  onChange: (value: number) => void
  onEnd: () => void
}) {
  const factor = 10 ** precision
  return (
    <label className={styles.row}>
      <span className={styles.label}>{label}</span>
      <input
        className={styles.range}
        type="range"
        min={0}
        max={STEPS}
        step={1}
        value={toPosition(value, min, max, scale)}
        onChange={(event) => {
          const raw = fromPosition(Number(event.currentTarget.value), min, max, scale)
          onChange(Math.round(raw * factor) / factor)
        }}
        onPointerUp={onEnd}
        onKeyUp={onEnd}
      />
      <span className={styles.value}>{format(value)}</span>
    </label>
  )
}
