import type { Song, Track } from '../model/schema'
import { impulseResponse } from './dsp'
import { delaySeconds, isTrackAudible } from './timeline'

export interface TrackChain {
  input: GainNode
  previewInput: AudioNode
  filter: BiquadFilterNode
  delay: DelayNode
  feedback: GainNode
  wet: GainNode
  volume: GainNode
  pan: StereoPannerNode
  send: GainNode
}

const MAX_DELAY_SECONDS = 2

export class MixGraph {
  private readonly ctx: BaseAudioContext
  private readonly masterInput: GainNode
  private readonly masterVolume: GainNode
  private readonly limiter: DynamicsCompressorNode
  private readonly reverbInput: GainNode
  private readonly convolver: ConvolverNode
  private reverbSize: number | null = null
  private syncedSong: Song | null = null
  private readonly chains = new Map<string, TrackChain>()

  constructor(ctx: BaseAudioContext, destination: AudioNode) {
    this.ctx = ctx
    this.masterInput = ctx.createGain()
    this.masterVolume = ctx.createGain()
    this.limiter = ctx.createDynamicsCompressor()
    this.limiter.threshold.value = -3
    this.limiter.knee.value = 0
    this.limiter.ratio.value = 20
    this.limiter.attack.value = 0.003
    this.limiter.release.value = 0.1
    this.masterInput.connect(this.masterVolume).connect(this.limiter).connect(destination)

    this.reverbInput = ctx.createGain()
    this.convolver = ctx.createConvolver()
    this.reverbInput.connect(this.convolver).connect(this.masterInput)
  }

  track(trackId: string): TrackChain | undefined {
    return this.chains.get(trackId)
  }

  sync(song: Song): void {
    if (song === this.syncedSong) return
    this.syncedSong = song
    this.setParam(this.masterVolume.gain, song.masterVolume)
    if (this.reverbSize !== song.reverb.size) {
      this.reverbSize = song.reverb.size
      this.convolver.buffer = this.impulse(song.reverb.size)
    }

    const ids = new Set(song.tracks.map((track) => track.id))
    for (const [id, chain] of this.chains) {
      if (!ids.has(id)) {
        this.disconnect(chain)
        this.chains.delete(id)
      }
    }

    const anySolo = song.tracks.some((track) => track.solo)
    for (const track of song.tracks) {
      let chain = this.chains.get(track.id)
      if (!chain) {
        chain = this.createChain()
        this.chains.set(track.id, chain)
      }
      this.updateChain(chain, track, song.bpm, anySolo)
    }
  }

  dispose(): void {
    for (const chain of this.chains.values()) this.disconnect(chain)
    this.chains.clear()
    this.masterInput.disconnect()
    this.masterVolume.disconnect()
    this.limiter.disconnect()
    this.reverbInput.disconnect()
    this.convolver.disconnect()
  }

  private createChain(): TrackChain {
    const ctx = this.ctx
    const input = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    const delayIn = ctx.createGain()
    const delay = ctx.createDelay(MAX_DELAY_SECONDS)
    const feedback = ctx.createGain()
    const wet = ctx.createGain()
    const volume = ctx.createGain()
    const pan = ctx.createStereoPanner()
    const send = ctx.createGain()

    input.connect(filter).connect(delayIn)
    delayIn.connect(volume)
    delayIn.connect(delay).connect(wet).connect(volume)
    delay.connect(feedback).connect(delay)
    volume.connect(pan)
    pan.connect(this.masterInput)
    pan.connect(send).connect(this.reverbInput)

    return { input, previewInput: filter, filter, delay, feedback, wet, volume, pan, send }
  }

  private updateChain(chain: TrackChain, track: Track, bpm: number, anySolo: boolean): void {
    this.setParam(chain.input.gain, isTrackAudible(track, anySolo) ? 1 : 0)

    const filterType = track.filter.enabled ? track.filter.type : 'allpass'
    if (chain.filter.type !== filterType) chain.filter.type = filterType
    this.setParam(chain.filter.frequency, track.filter.cutoff)
    this.setParam(chain.filter.Q, track.filter.resonance)

    this.setParam(chain.delay.delayTime, delaySeconds(track.delay.division, bpm))
    this.setParam(chain.feedback.gain, track.delay.enabled ? track.delay.feedback : 0)
    this.setParam(chain.wet.gain, track.delay.enabled ? track.delay.mix : 0)

    this.setParam(chain.volume.gain, track.volume)
    this.setParam(chain.pan.pan, track.pan)
    this.setParam(chain.send.gain, track.reverbSend)
  }

  private disconnect(chain: TrackChain): void {
    for (const node of Object.values(chain) as AudioNode[]) node.disconnect()
  }

  private impulse(size: number): AudioBuffer {
    const [left, right] = impulseResponse(this.ctx.sampleRate, size)
    const buffer = this.ctx.createBuffer(2, left.length, this.ctx.sampleRate)
    buffer.copyToChannel(left, 0)
    buffer.copyToChannel(right, 1)
    return buffer
  }

  private setParam(param: AudioParam, value: number): void {
    if (this.ctx.state === 'running') param.setTargetAtTime(value, this.ctx.currentTime, 0.015)
    else param.value = value
  }
}
