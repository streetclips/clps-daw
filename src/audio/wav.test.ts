import { describe, expect, it } from 'vitest'
import { encodeWav } from './wav'

function ascii(view: DataView, offset: number, length: number): string {
  return String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)))
}

describe('encodeWav', () => {
  const left = new Float32Array([0, 1, -1, 2])
  const right = new Float32Array([0.5, -0.5, 0, -2])
  const view = new DataView(encodeWav([left, right], 44100))

  it('writes a 16-bit PCM stereo header', () => {
    expect(ascii(view, 0, 4)).toBe('RIFF')
    expect(ascii(view, 8, 4)).toBe('WAVE')
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(24, true)).toBe(44100)
    expect(view.getUint32(28, true)).toBe(44100 * 4)
    expect(view.getUint16(34, true)).toBe(16)
    expect(ascii(view, 36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(16)
    expect(view.getUint32(4, true)).toBe(36 + 16)
  })

  it('interleaves channels and clamps samples', () => {
    const samples = Array.from({ length: 8 }, (_, i) => view.getInt16(44 + i * 2, true))

    expect(samples).toEqual([0, 16383, 32767, -16384, -32768, 0, 32767, -32768])
  })
})
