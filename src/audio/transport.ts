import { STEPS_PER_BAR } from '../model/constants'
import type { Song } from '../model/schema'
import type { MixGraph } from './graph'
import {
  patternNotesAtStep,
  patternSteps,
  secondsPerStep,
  songLengthSteps,
  songNotesAtStep,
} from './timeline'
import { playNote, stopVoice, type Voice } from './voices'

export type PlayTarget =
  { mode: 'song'; fromBar: number } | { mode: 'pattern'; trackId: string; patternId: string }

export interface PlayPosition {
  target: PlayTarget
  step: number
}

const TICK_MS = 25
const LOOKAHEAD_SECONDS = 0.12
const START_DELAY_SECONDS = 0.05
const MAX_VOICES = 64

interface ScheduledStep {
  step: number
  time: number
  duration: number
}

export class Transport {
  private readonly ctx: AudioContext
  private readonly graph: MixGraph
  private readonly getSong: () => Song | null
  private readonly onEnd: () => void
  private readonly voices = new Set<Voice>()
  private timer: ReturnType<typeof setInterval> | null = null
  private target: PlayTarget | null = null
  private nextStep = 0
  private nextTime = 0
  private endTime: number | null = null
  private scheduled: ScheduledStep[] = []

  constructor(ctx: AudioContext, graph: MixGraph, getSong: () => Song | null, onEnd: () => void) {
    this.ctx = ctx
    this.graph = graph
    this.getSong = getSong
    this.onEnd = onEnd
  }

  get playing(): boolean {
    return this.target !== null
  }

  start(target: PlayTarget, song: Song): void {
    this.halt()
    this.target = target
    this.nextStep = target.mode === 'song' ? target.fromBar * STEPS_PER_BAR[song.meter] : 0
    this.nextTime = this.ctx.currentTime + START_DELAY_SECONDS
    this.endTime = null
    this.tick()
    if (this.target) this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  stop(): void {
    const now = this.ctx.currentTime
    for (const voice of this.voices) stopVoice(voice, now)
    this.voices.clear()
    this.halt()
  }

  playVoice(start: (onDone: (voice: Voice) => void) => Voice): void {
    if (this.voices.size >= MAX_VOICES) return
    this.voices.add(start((voice) => this.voices.delete(voice)))
  }

  position(): PlayPosition | null {
    if (!this.target) return null
    const now = this.ctx.currentTime - (this.ctx.outputLatency || 0)
    let current = this.scheduled[0]
    for (const entry of this.scheduled) {
      if (entry.time > now) break
      current = entry
    }
    if (!current) return null
    const progress = Math.min(Math.max((now - current.time) / current.duration, 0), 0.999)
    return { target: this.target, step: current.step + progress }
  }

  private halt(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    this.target = null
    this.scheduled = []
  }

  private finish(): void {
    this.halt()
    this.onEnd()
  }

  private tick(): void {
    const song = this.getSong()
    const target = this.target
    if (!song || !target) return this.finish()
    this.graph.sync(song)

    const now = this.ctx.currentTime
    if (this.endTime !== null) {
      if (now >= this.endTime) this.finish()
      return
    }

    const horizon = now + LOOKAHEAD_SECONDS
    while (this.nextTime < horizon) {
      const duration = secondsPerStep(song.bpm)
      if (target.mode === 'song') {
        if (this.nextStep >= songLengthSteps(song)) {
          this.endTime = this.nextTime
          return
        }
        for (const { track, note } of songNotesAtStep(song, this.nextStep)) {
          const chain = this.graph.track(track.id)
          if (!chain) continue
          const time = this.nextTime
          this.playVoice((onDone) =>
            playNote(this.ctx, chain.input, track.instrument, note, time, duration, onDone),
          )
        }
      } else {
        const track = song.tracks.find((t) => t.id === target.trackId)
        const pattern = track?.patterns.find((p) => p.id === target.patternId)
        const chain = track && this.graph.track(track.id)
        if (!track || !pattern || !chain) return this.finish()
        this.nextStep %= patternSteps(pattern, song.meter)
        for (const note of patternNotesAtStep(pattern, this.nextStep)) {
          const time = this.nextTime
          this.playVoice((onDone) =>
            playNote(this.ctx, chain.previewInput, track.instrument, note, time, duration, onDone),
          )
        }
      }

      this.scheduled.push({ step: this.nextStep, time: this.nextTime, duration })
      if (this.scheduled.length > 64) this.scheduled.shift()
      this.nextStep += 1
      this.nextTime += duration
    }
  }
}
