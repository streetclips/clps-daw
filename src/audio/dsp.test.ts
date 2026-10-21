import { describe, expect, it } from 'vitest'
import {
  envelopePoints,
  impulseResponse,
  LFSR_PERIOD,
  lfsrNoise,
  midiToHz,
  MIN_ATTACK,
  pulseCoefficients,
} from './dsp'

const adsr = { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 }

describe('midiToHz', () => {
  it('tunes A4 to 440 Hz and C4 to middle C', () => {
    expect(midiToHz(69)).toBe(440)
    expect(midiToHz(60)).toBeCloseTo(261.63, 2)
  })
})

describe('pulseCoefficients', () => {
  it('turns a 50 % duty cycle into the odd-harmonic square series', () => {
    const { real, imag } = pulseCoefficients(0.5, 8)

    for (let n = 1; n <= 8; n++) {
      expect(real[n]).toBeCloseTo(0, 6)
      expect(imag[n]).toBeCloseTo(n % 2 === 1 ? 2 / (n * Math.PI) : 0, 6)
    }
  })

  it('leaves the DC term empty', () => {
    const { real, imag } = pulseCoefficients(0.25)

    expect(real[0]).toBe(0)
    expect(imag[0]).toBe(0)
  })
})

describe('lfsrNoise', () => {
  const samples = lfsrNoise(LFSR_PERIOD * 2)

  it('only produces full-scale samples', () => {
    expect(samples.every((s) => s === 1 || s === -1)).toBe(true)
  })

  it('repeats with the 15-bit LFSR period', () => {
    for (let i = 0; i < 200; i++) expect(samples[i + LFSR_PERIOD]).toBe(samples[i])
  })

  it('is balanced over one period', () => {
    const sum = samples.slice(0, LFSR_PERIOD).reduce((total, s) => total + s, 0)

    expect(Math.abs(sum)).toBe(1)
  })
})

describe('envelopePoints', () => {
  it('rises, decays, holds the sustain and releases for a long note', () => {
    const { points, end } = envelopePoints(adsr, 1, 0.5, 0.3)

    expect(points).toEqual([
      { type: 'set', time: 1, value: 0 },
      { type: 'linear', time: 1.01, value: 0.3 },
      { type: 'linear', time: 1.11, value: 0.15 },
      { type: 'linear', time: 1.5, value: 0.15 },
      { type: 'linear', time: 1.7, value: 0 },
    ])
    expect(end).toBeCloseTo(1.7)
  })

  it('releases from the attack ramp when the note is shorter than the attack', () => {
    const { points } = envelopePoints({ ...adsr, attack: 0.1 }, 0, 0.05, 0.4)

    expect(points[1]).toEqual({ type: 'linear', time: 0.05, value: 0.2 })
    expect(points).toHaveLength(3)
  })

  it('releases from the decay ramp when the note ends during the decay', () => {
    const { points } = envelopePoints(adsr, 0, 0.06, 1)

    expect(points[2]?.time).toBeCloseTo(0.06)
    expect(points[2]?.value).toBeCloseTo(0.75)
  })

  it('applies a minimum attack to avoid clicks', () => {
    const { points } = envelopePoints({ ...adsr, attack: 0 }, 0, 1, 1)

    expect(points[1]?.time).toBe(MIN_ATTACK)
  })
})

describe('impulseResponse', () => {
  it('lasts from 0.3 s to 3 s depending on size', () => {
    expect(impulseResponse(1000, 0)[0]).toHaveLength(300)
    expect(impulseResponse(1000, 1)[1]).toHaveLength(3000)
  })

  it('fades out to silence', () => {
    const [left] = impulseResponse(1000, 0.5, () => 1)

    expect(left[0]).toBe(1)
    expect(left[left.length - 1]).toBeLessThan(0.0001)
  })
})
