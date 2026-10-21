import type { Song } from '../model/schema'
import { MixGraph } from './graph'
import { secondsPerStep, songLengthSteps, songNotesAtStep } from './timeline'
import { playNote } from './voices'

export const RENDER_SAMPLE_RATE = 44100
export const RENDER_TAIL_SECONDS = 2

export function renderSong(song: Song): Promise<AudioBuffer> {
  const steps = songLengthSteps(song)
  const stepSeconds = secondsPerStep(song.bpm)
  const length = Math.ceil((steps * stepSeconds + RENDER_TAIL_SECONDS) * RENDER_SAMPLE_RATE)
  const ctx = new OfflineAudioContext(2, length, RENDER_SAMPLE_RATE)
  const graph = new MixGraph(ctx, ctx.destination)
  graph.sync(song)

  for (let step = 0; step < steps; step++) {
    for (const { track, note } of songNotesAtStep(song, step)) {
      const chain = graph.track(track.id)
      if (chain) playNote(ctx, chain.input, track.instrument, note, step * stepSeconds, stepSeconds)
    }
  }

  return ctx.startRendering()
}
