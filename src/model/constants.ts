export const FORMAT = 'clps-daw'
export const FORMAT_VERSION = 1

export const MAX_TRACKS = 8
export const MAX_BARS = 128
export const MIN_BPM = 60
export const MAX_BPM = 240
export const MIN_PITCH = 24
export const MAX_PITCH = 108

export const METERS = ['4/4', '3/4', '6/8'] as const
export type Meter = (typeof METERS)[number]
export const STEPS_PER_BAR: Record<Meter, number> = { '4/4': 16, '3/4': 12, '6/8': 12 }

export const SCALE_MODES = ['major', 'minor', 'pentatonic', 'chromatic'] as const
export const WAVES = ['sine', 'square', 'triangle', 'sawtooth'] as const
export const PULSE_WIDTHS = [0.125, 0.25, 0.5] as const
export const DRUM_LANES = ['kick', 'snare', 'closedHat', 'openHat', 'tom'] as const
export const PATTERN_LENGTHS = [1, 2, 4] as const
export const FILTER_TYPES = ['lowpass', 'highpass'] as const
export const DELAY_DIVISIONS = ['1/8', '1/4', '1/8d'] as const
export const TRACK_COLORS = [8, 9, 10, 11, 12, 14, 13, 15] as const
