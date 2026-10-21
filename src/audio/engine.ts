import type { Song } from '../model/schema'
import { MixGraph } from './graph'
import { Transport, type PlayPosition, type PlayTarget } from './transport'
import { playNote } from './voices'

export interface EngineSnapshot {
  status: string
  playing: boolean
}

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } }

const PREVIEW_SECONDS = 0.3

class Engine {
  private ctx: AudioContext | null = null
  private graph: MixGraph | null = null
  private transport: Transport | null = null
  private getSong: () => Song | null = () => null
  private snapshot: EngineSnapshot = { status: 'off', playing: false }
  private readonly listeners = new Set<() => void>()

  setSongSource(getSong: () => Song | null): void {
    this.getSong = getSong
  }

  unlock(): void {
    const session = (navigator as AudioSessionNavigator).audioSession
    if (session && session.type !== 'playback') session.type = 'playback'

    if (!this.ctx || this.ctx.state === 'closed') this.create()
    const ctx = this.ctx!
    if (ctx.state !== 'running') void ctx.resume().finally(() => this.publish())

    const silence = ctx.createBufferSource()
    silence.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    silence.connect(ctx.destination)
    silence.start()
    this.publish()
  }

  play(target: PlayTarget): void {
    const song = this.getSong()
    if (!song || !this.transport) return
    this.transport.start(target, song)
    this.publish()
  }

  stop(): void {
    this.transport?.stop()
    this.publish()
  }

  preview(trackId: string, pitch: number): void {
    const { ctx, graph, transport } = this
    const song = this.getSong()
    const track = song?.tracks.find((t) => t.id === trackId)
    if (!ctx || !graph || !transport || !song || !track) return
    graph.sync(song)
    const chain = graph.track(trackId)
    if (!chain) return
    const note = { pitch, start: 0, length: 1 }
    transport.playVoice((onDone) =>
      playNote(
        ctx,
        chain.previewInput,
        track.instrument,
        note,
        ctx.currentTime,
        PREVIEW_SECONDS,
        onDone,
      ),
    )
  }

  position(): PlayPosition | null {
    return this.transport?.position() ?? null
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): EngineSnapshot => this.snapshot

  private create(): void {
    this.transport?.stop()
    this.graph?.dispose()
    const ctx = new AudioContext()
    ctx.onstatechange = () => this.publish()
    this.ctx = ctx
    this.graph = new MixGraph(ctx, ctx.destination)
    this.transport = new Transport(
      ctx,
      this.graph,
      () => this.getSong(),
      () => this.publish(),
    )
  }

  private publish(): void {
    const status = this.ctx?.state ?? 'off'
    const playing = this.transport?.playing ?? false
    if (status === this.snapshot.status && playing === this.snapshot.playing) return
    this.snapshot = { status, playing }
    for (const listener of this.listeners) listener()
  }
}

export const engine = new Engine()
