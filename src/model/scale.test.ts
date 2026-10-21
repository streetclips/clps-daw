import { describe, expect, it } from 'vitest'
import { inScale, isBlackKey, noteName, synthRows } from './scale'

const cMajor = { root: 0, mode: 'major' } as const
const aMinor = { root: 9, mode: 'minor' } as const

describe('noteName', () => {
  it('names notes with C4 as MIDI 60', () => {
    expect(noteName(60)).toBe('C4')
    expect(noteName(24)).toBe('C1')
    expect(noteName(108)).toBe('C8')
    expect(noteName(70)).toBe('A#4')
  })
})

describe('isBlackKey', () => {
  it('detects sharps', () => {
    expect(isBlackKey(61)).toBe(true)
    expect(isBlackKey(64)).toBe(false)
  })
})

describe('inScale', () => {
  it('follows the root and the mode', () => {
    expect([57, 60, 64].every((p) => inScale(p, aMinor))).toBe(true)
    expect(inScale(61, aMinor)).toBe(false)
    expect(inScale(66, cMajor)).toBe(false)
  })

  it('accepts every note in chromatic mode', () => {
    expect(inScale(61, { root: 0, mode: 'chromatic' })).toBe(true)
  })
})

describe('synthRows', () => {
  it('lists C8 down to C1 when unfolded', () => {
    const rows = synthRows(cMajor, false, new Set())

    expect(rows).toHaveLength(85)
    expect(rows[0]).toBe(108)
    expect(rows.at(-1)).toBe(24)
  })

  it('keeps only scale notes when folded', () => {
    expect(synthRows(cMajor, true, new Set())).toHaveLength(50)
  })

  it('keeps out-of-scale rows that hold notes when folded', () => {
    expect(synthRows(cMajor, true, new Set([61]))).toContain(61)
  })
})
