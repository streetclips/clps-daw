import { z } from 'zod'
import { FORMAT, FORMAT_VERSION } from './constants'
import { songSchema, type Song } from './schema'

export class SongFormatError extends Error {
  override name = 'SongFormatError'
}

export function parseSong(input: unknown): Song {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('format' in input) ||
    input.format !== FORMAT
  ) {
    throw new SongFormatError('This file is not a CLPS DAW song')
  }
  const version = 'version' in input ? input.version : undefined
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new SongFormatError('This song has an unknown format version')
  }
  if (version > FORMAT_VERSION) {
    throw new SongFormatError('This song was made with a newer version of CLPS DAW')
  }
  const result = songSchema.safeParse(input)
  if (!result.success) {
    throw new SongFormatError(`Invalid song:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
