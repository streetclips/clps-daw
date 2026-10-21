import { FORMAT, FORMAT_VERSION } from './constants'
import { newId } from './ids'
import { drumsFromPreset, synthFromPreset } from './presets'
import type { Song, Track } from './schema'

export function createTrack(name: string, color: number, instrument: Track['instrument']): Track {
  return {
    id: newId(),
    name,
    color,
    instrument,
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
    reverbSend: instrument.type === 'drums' ? 0.1 : 0.2,
    filter: { enabled: false, type: 'lowpass', cutoff: 8000, resonance: 0.7 },
    delay: { enabled: false, division: '1/8', feedback: 0.35, mix: 0.25 },
    patterns: [],
    clips: [],
  }
}

export function createSong(name: string, now: Date = new Date()): Song {
  const timestamp = now.toISOString()
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    id: newId(),
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    bpm: 120,
    meter: '4/4',
    scale: { root: 0, mode: 'major' },
    reverb: { size: 0.5 },
    masterVolume: 0.8,
    tracks: [
      createTrack('LEAD', 8, synthFromPreset('LEAD')),
      createTrack('BASS', 9, synthFromPreset('BASS')),
      createTrack('DRUMS', 10, drumsFromPreset('NES')),
    ],
  }
}
