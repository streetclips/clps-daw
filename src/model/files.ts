import { newId } from './ids'
import { parseSong, SongFormatError } from './parse'
import type { Song } from './schema'

export function serializeSong(song: Song): string {
  return `${JSON.stringify(song, null, 2)}\n`
}

export function importSong(text: string, now: Date = new Date()): Song {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new SongFormatError('This file is not valid JSON')
  }
  const song = parseSong(raw)
  return { ...song, id: newId(), updatedAt: now.toISOString() }
}

export function songFileName(name: string, extension: 'json' | 'wav'): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'song'}.${extension}`
}
