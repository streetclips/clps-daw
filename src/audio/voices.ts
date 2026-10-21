import type { DrumInstrument, Note, SynthInstrument, Track } from '../model/schema'
import { envelopePoints, lfsrNoise, midiToHz, pulseCoefficients } from './dsp'

export interface Voice {
  output: GainNode
  sources: AudioScheduledSourceNode[]
  end: number
}

const SYNTH_PEAK = 0.3
const NOISE_SECONDS = 1
const FADE_SECONDS = 0.01

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()
const pulseWaves = new WeakMap<BaseAudioContext, Map<number, PeriodicWave>>()

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx)
  if (!buffer) {
    const length = Math.round(NOISE_SECONDS * ctx.sampleRate)
    buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    buffer.copyToChannel(lfsrNoise(length), 0)
    noiseBuffers.set(ctx, buffer)
  }
  return buffer
}

function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  let waves = pulseWaves.get(ctx)
  if (!waves) {
    waves = new Map()
    pulseWaves.set(ctx, waves)
  }
  let wave = waves.get(duty)
  if (!wave) {
    const { real, imag } = pulseCoefficients(duty)
    wave = ctx.createPeriodicWave(real, imag)
    waves.set(duty, wave)
  }
  return wave
}

function finishVoice(voice: Voice, onDone?: (voice: Voice) => void): Voice {
  let remaining = voice.sources.length
  for (const source of voice.sources) {
    source.onended = () => {
      remaining -= 1
      if (remaining === 0) {
        voice.output.disconnect()
        onDone?.(voice)
      }
    }
  }
  return voice
}

export function playSynthNote(
  ctx: BaseAudioContext,
  destination: AudioNode,
  instrument: SynthInstrument,
  pitch: number,
  start: number,
  duration: number,
  onDone?: (voice: Voice) => void,
): Voice {
  const oscillator = ctx.createOscillator()
  if (instrument.wave === 'square' && instrument.pulseWidth !== 0.5) {
    oscillator.setPeriodicWave(pulseWave(ctx, instrument.pulseWidth))
  } else {
    oscillator.type = instrument.wave
  }
  oscillator.frequency.value = midiToHz(pitch)

  const output = ctx.createGain()
  const { points, end } = envelopePoints(instrument, start, duration, SYNTH_PEAK)
  for (const point of points) {
    if (point.type === 'set') output.gain.setValueAtTime(point.value, point.time)
    else output.gain.linearRampToValueAtTime(point.value, point.time)
  }

  oscillator.connect(output).connect(destination)
  oscillator.start(start)
  oscillator.stop(end)
  return finishVoice({ output, sources: [oscillator], end }, onDone)
}

function decayGain(ctx: BaseAudioContext, peak: number, start: number, length: number): GainNode {
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(peak, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
  gain.gain.setValueAtTime(0, start + length)
  return gain
}

function noise(ctx: BaseAudioContext, start: number, length: number) {
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx)
  source.start(start, Math.random() * (NOISE_SECONDS - length))
  source.stop(start + length)
  return source
}

function filtered(ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, q = 0.7) {
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = frequency
  filter.Q.value = q
  return filter
}

function sweep(
  ctx: BaseAudioContext,
  type: OscillatorType,
  from: number,
  to: number,
  start: number,
  length: number,
) {
  const oscillator = ctx.createOscillator()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(from, start)
  oscillator.frequency.exponentialRampToValueAtTime(to, start + length * 0.5)
  oscillator.start(start)
  oscillator.stop(start + length)
  return oscillator
}

export function playDrumHit(
  ctx: BaseAudioContext,
  destination: AudioNode,
  instrument: DrumInstrument,
  lane: number,
  start: number,
  onDone?: (voice: Voice) => void,
): Voice {
  const ratio = 2 ** (instrument.tune / 12)
  const output = ctx.createGain()
  output.connect(destination)
  const sources: AudioScheduledSourceNode[] = []
  const part = (source: AudioScheduledSourceNode, chain: AudioNode[], gain: GainNode) => {
    let node: AudioNode = source
    for (const next of chain) node = node.connect(next)
    node.connect(gain).connect(output)
    sources.push(source)
  }

  let length: number
  switch (lane) {
    case 0: {
      length = 0.35 * instrument.decay
      part(
        sweep(ctx, 'sine', 150 * ratio, 45 * ratio, start, length),
        [],
        decayGain(ctx, 0.9, start, length),
      )
      break
    }
    case 1: {
      length = 0.2 * instrument.decay
      part(
        noise(ctx, start, length),
        [filtered(ctx, 'bandpass', 1800)],
        decayGain(ctx, 0.5, start, length),
      )
      part(
        sweep(ctx, 'triangle', 185 * ratio, 160 * ratio, start, length),
        [],
        decayGain(ctx, 0.35, start, length * 0.5),
      )
      break
    }
    case 2:
    case 3: {
      length = (lane === 2 ? 0.05 : 0.3) * instrument.decay
      part(
        noise(ctx, start, length),
        [filtered(ctx, 'highpass', 7000)],
        decayGain(ctx, 0.3, start, length),
      )
      break
    }
    default: {
      length = 0.3 * instrument.decay
      part(
        sweep(ctx, 'triangle', 220 * ratio, 110 * ratio, start, length),
        [],
        decayGain(ctx, 0.7, start, length),
      )
    }
  }

  return finishVoice({ output, sources, end: start + length }, onDone)
}

export function playNote(
  ctx: BaseAudioContext,
  destination: AudioNode,
  instrument: Track['instrument'],
  note: Note,
  start: number,
  stepSeconds: number,
  onDone?: (voice: Voice) => void,
): Voice {
  return instrument.type === 'synth'
    ? playSynthNote(
        ctx,
        destination,
        instrument,
        note.pitch,
        start,
        note.length * stepSeconds,
        onDone,
      )
    : playDrumHit(ctx, destination, instrument, note.pitch, start, onDone)
}

export function stopVoice(voice: Voice, at: number): void {
  const gain = voice.output.gain
  if (typeof gain.cancelAndHoldAtTime === 'function') {
    gain.cancelAndHoldAtTime(at)
  } else {
    gain.cancelScheduledValues(at)
    gain.setValueAtTime(gain.value, at)
  }
  gain.linearRampToValueAtTime(0, at + FADE_SECONDS)
  for (const source of voice.sources) source.stop(at + FADE_SECONDS * 2)
}
