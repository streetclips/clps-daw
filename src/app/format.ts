export function formatSeconds(value: number): string {
  return value < 1 ? `${Math.round(value * 1000)}MS` : `${value.toFixed(2)}S`
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function formatPan(value: number): string {
  if (Math.abs(value) < 0.005) return 'C'
  return `${value < 0 ? 'L' : 'R'}${Math.round(Math.abs(value) * 100)}`
}

export function formatHz(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : `${Math.round(value)}`
}

export function formatSemitones(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}

export function formatDuration(seconds: number): string {
  const whole = Math.round(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
