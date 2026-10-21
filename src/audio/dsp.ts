export function midiToHz(pitch: number): number {
  return 440 * 2 ** ((pitch - 69) / 12)
}

export function pulseCoefficients(duty: number, harmonics = 128) {
  const real = new Float32Array(harmonics + 1)
  const imag = new Float32Array(harmonics + 1)
  for (let n = 1; n <= harmonics; n++) {
    real[n] = Math.sin(2 * Math.PI * n * duty) / (Math.PI * n)
    imag[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (Math.PI * n)
  }
  return { real, imag }
}

export const LFSR_PERIOD = 32767

export function lfsrNoise(length: number): Float32Array<ArrayBuffer> {
  const samples = new Float32Array(length)
  let register = 1
  for (let i = 0; i < length; i++) {
    const feedback = (register ^ (register >> 1)) & 1
    register = (register >> 1) | (feedback << 14)
    samples[i] = register & 1 ? 1 : -1
  }
  return samples
}

export interface Adsr {
  attack: number
  decay: number
  sustain: number
  release: number
}

export interface EnvelopePoint {
  type: 'set' | 'linear'
  time: number
  value: number
}

export const MIN_ATTACK = 0.002
export const MIN_RELEASE = 0.01

export function envelopePoints(adsr: Adsr, start: number, duration: number, peak: number) {
  const attack = Math.max(adsr.attack, MIN_ATTACK)
  const release = Math.max(adsr.release, MIN_RELEASE)
  const sustain = peak * adsr.sustain
  const attackEnd = start + attack
  const decayEnd = attackEnd + adsr.decay
  const off = start + duration
  const points: EnvelopePoint[] = [{ type: 'set', time: start, value: 0 }]

  if (off <= attackEnd) {
    points.push({ type: 'linear', time: off, value: peak * (duration / attack) })
  } else if (off <= decayEnd) {
    points.push({ type: 'linear', time: attackEnd, value: peak })
    const progress = (off - attackEnd) / adsr.decay
    points.push({ type: 'linear', time: off, value: peak + (sustain - peak) * progress })
  } else {
    points.push({ type: 'linear', time: attackEnd, value: peak })
    points.push({ type: 'linear', time: decayEnd, value: sustain })
    points.push({ type: 'linear', time: off, value: sustain })
  }

  points.push({ type: 'linear', time: off + release, value: 0 })
  return { points, end: off + release }
}

export function impulseResponse(
  sampleRate: number,
  size: number,
  random: () => number = Math.random,
): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const length = Math.max(1, Math.round((0.3 + size * 2.7) * sampleRate))
  const channels: [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] = [
    new Float32Array(length),
    new Float32Array(length),
  ]
  for (const channel of channels) {
    for (let i = 0; i < length; i++) {
      channel[i] = (random() * 2 - 1) * (1 - i / length) ** 3
    }
  }
  return channels
}
