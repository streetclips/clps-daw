import { z } from 'zod'
import {
  DELAY_DIVISIONS,
  DRUM_LANES,
  FILTER_TYPES,
  FORMAT,
  FORMAT_VERSION,
  MAX_BARS,
  MAX_BPM,
  MAX_PITCH,
  MAX_TRACKS,
  METERS,
  MIN_BPM,
  MIN_PITCH,
  PATTERN_LENGTHS,
  PULSE_WIDTHS,
  SCALE_MODES,
  STEPS_PER_BAR,
  WAVES,
} from './constants'

const id = z.string().min(1).max(64)
const unit = z.number().min(0).max(1)

export const noteSchema = z.object({
  pitch: z.int().min(0).max(MAX_PITCH),
  start: z.int().min(0),
  length: z.int().min(1),
})

export const patternSchema = z.object({
  id,
  name: z.string().max(12),
  lengthBars: z.literal(PATTERN_LENGTHS),
  notes: z.array(noteSchema),
})

export const clipSchema = z.object({
  id,
  patternId: id,
  bar: z
    .int()
    .min(0)
    .max(MAX_BARS - 1),
})

export const synthInstrumentSchema = z.object({
  type: z.literal('synth'),
  preset: z.string().max(12),
  wave: z.enum(WAVES),
  pulseWidth: z.literal(PULSE_WIDTHS),
  attack: z.number().min(0).max(2),
  decay: z.number().min(0).max(2),
  sustain: unit,
  release: z.number().min(0).max(4),
})

export const drumInstrumentSchema = z.object({
  type: z.literal('drums'),
  preset: z.string().max(12),
  tune: z.int().min(-12).max(12),
  decay: z.number().min(0.25).max(2),
})

export const trackSchema = z.object({
  id,
  name: z.string().min(1).max(12),
  color: z.int().min(0).max(15),
  instrument: z.discriminatedUnion('type', [synthInstrumentSchema, drumInstrumentSchema]),
  volume: unit,
  pan: z.number().min(-1).max(1),
  mute: z.boolean(),
  solo: z.boolean(),
  reverbSend: unit,
  filter: z.object({
    enabled: z.boolean(),
    type: z.enum(FILTER_TYPES),
    cutoff: z.number().min(20).max(20000),
    resonance: z.number().min(0.1).max(20),
  }),
  delay: z.object({
    enabled: z.boolean(),
    division: z.enum(DELAY_DIVISIONS),
    feedback: z.number().min(0).max(0.9),
    mix: unit,
  }),
  patterns: z.array(patternSchema),
  clips: z.array(clipSchema),
})

const songShape = z.object({
  format: z.literal(FORMAT),
  version: z.literal(FORMAT_VERSION),
  id,
  name: z.string().min(1).max(40),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  bpm: z.int().min(MIN_BPM).max(MAX_BPM),
  meter: z.enum(METERS),
  scale: z.object({
    root: z.int().min(0).max(11),
    mode: z.enum(SCALE_MODES),
  }),
  reverb: z.object({ size: unit }),
  masterVolume: unit,
  tracks: z.array(trackSchema).max(MAX_TRACKS),
})

export type Note = z.infer<typeof noteSchema>
export type Pattern = z.infer<typeof patternSchema>
export type Clip = z.infer<typeof clipSchema>
export type SynthInstrument = z.infer<typeof synthInstrumentSchema>
export type DrumInstrument = z.infer<typeof drumInstrumentSchema>
export type Track = z.infer<typeof trackSchema>
export type Song = z.infer<typeof songShape>

export interface SongIssue {
  path: (string | number)[]
  message: string
}

export function findSongIssues(song: Song): SongIssue[] {
  const issues: SongIssue[] = []
  const stepsPerBar = STEPS_PER_BAR[song.meter]
  const trackIds = new Set<string>()

  song.tracks.forEach((track, t) => {
    const path = ['tracks', t]
    if (trackIds.has(track.id)) issues.push({ path, message: `Duplicate track id ${track.id}` })
    trackIds.add(track.id)

    const patterns = new Map<string, Pattern>()
    track.patterns.forEach((pattern, p) => {
      const patternPath = [...path, 'patterns', p]
      if (patterns.has(pattern.id)) {
        issues.push({ path: patternPath, message: `Duplicate pattern id ${pattern.id}` })
      }
      patterns.set(pattern.id, pattern)
      const steps = pattern.lengthBars * stepsPerBar
      pattern.notes.forEach((note, n) => {
        const notePath = [...patternPath, 'notes', n]
        if (note.start + note.length > steps) {
          issues.push({ path: notePath, message: 'Note ends after its pattern' })
        }
        const pitchOk =
          track.instrument.type === 'synth'
            ? note.pitch >= MIN_PITCH && note.pitch <= MAX_PITCH
            : note.pitch < DRUM_LANES.length
        if (!pitchOk) issues.push({ path: notePath, message: `Pitch ${note.pitch} out of range` })
      })
    })

    const clipIds = new Set<string>()
    const spans: { start: number; end: number; index: number }[] = []
    track.clips.forEach((clip, c) => {
      const clipPath = [...path, 'clips', c]
      if (clipIds.has(clip.id))
        issues.push({ path: clipPath, message: `Duplicate clip id ${clip.id}` })
      clipIds.add(clip.id)
      const pattern = patterns.get(clip.patternId)
      if (!pattern) {
        issues.push({ path: clipPath, message: `Unknown pattern ${clip.patternId}` })
        return
      }
      const end = clip.bar + pattern.lengthBars
      if (end > MAX_BARS)
        issues.push({ path: clipPath, message: `Clip ends after bar ${MAX_BARS}` })
      spans.push({ start: clip.bar, end, index: c })
    })

    spans.sort((a, b) => a.start - b.start)
    for (let i = 1; i < spans.length; i++) {
      const previous = spans[i - 1]!
      const current = spans[i]!
      if (current.start < previous.end) {
        issues.push({ path: [...path, 'clips', current.index], message: 'Clips overlap' })
      }
    }
  })

  return issues
}

export const songSchema = songShape.superRefine((song, ctx) => {
  for (const issue of findSongIssues(song)) {
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message })
  }
})
