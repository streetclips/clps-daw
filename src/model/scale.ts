import { MAX_PITCH, MIN_PITCH } from './constants'
import type { Song } from './schema'

type Scale = Song['scale']

export const SCALE_INTERVALS: Record<Scale['mode'], readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function pitchClass(pitch: number): number {
  return ((pitch % 12) + 12) % 12
}

export function noteName(pitch: number): string {
  return `${NAMES[pitchClass(pitch)]}${Math.floor(pitch / 12) - 1}`
}

export function isBlackKey(pitch: number): boolean {
  return NAMES[pitchClass(pitch)]!.endsWith('#')
}

export function inScale(pitch: number, scale: Scale): boolean {
  return SCALE_INTERVALS[scale.mode].includes(pitchClass(pitch - scale.root))
}

export function synthRows(scale: Scale, fold: boolean, used: ReadonlySet<number>): number[] {
  const rows: number[] = []
  for (let pitch = MAX_PITCH; pitch >= MIN_PITCH; pitch--) {
    if (!fold || inScale(pitch, scale) || used.has(pitch)) rows.push(pitch)
  }
  return rows
}
