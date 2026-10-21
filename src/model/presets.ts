import type { DrumInstrument, SynthInstrument } from './schema'

type SynthSettings = Omit<SynthInstrument, 'type' | 'preset'>

export const SYNTH_PRESETS = {
  LEAD: {
    wave: 'square',
    pulseWidth: 0.25,
    attack: 0.005,
    decay: 0.1,
    sustain: 0.7,
    release: 0.08,
  },
  BASS: {
    wave: 'triangle',
    pulseWidth: 0.5,
    attack: 0.005,
    decay: 0.05,
    sustain: 0.9,
    release: 0.05,
  },
  PLUCK: {
    wave: 'square',
    pulseWidth: 0.125,
    attack: 0.002,
    decay: 0.15,
    sustain: 0,
    release: 0.05,
  },
  PAD: { wave: 'sawtooth', pulseWidth: 0.5, attack: 0.3, decay: 0.3, sustain: 0.6, release: 0.6 },
  BELL: { wave: 'sine', pulseWidth: 0.5, attack: 0.002, decay: 0.6, sustain: 0.2, release: 0.4 },
  CHIP: { wave: 'square', pulseWidth: 0.5, attack: 0.005, decay: 0, sustain: 1, release: 0.05 },
} as const satisfies Record<string, SynthSettings>

export type SynthPresetName = keyof typeof SYNTH_PRESETS

export const DRUM_PRESETS = {
  NES: { tune: 0, decay: 1 },
} as const satisfies Record<string, Omit<DrumInstrument, 'type' | 'preset'>>

export type DrumPresetName = keyof typeof DRUM_PRESETS

export function synthFromPreset(preset: SynthPresetName): SynthInstrument {
  return { type: 'synth', preset, ...SYNTH_PRESETS[preset] }
}

export function drumsFromPreset(preset: DrumPresetName): DrumInstrument {
  return { type: 'drums', preset, ...DRUM_PRESETS[preset] }
}
