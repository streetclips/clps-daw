import { deleteClip, duplicateClip, linkCount, makeClipUnique, patternOf } from '../model/arrange'
import type { Clip, Song, Track } from '../model/schema'
import { useStore } from '../state/store'
import { Button } from '../ui/Button'
import { Sheet, SheetRow } from '../ui/Sheet'

export function ClipMenu({
  track,
  clip,
  onClose,
}: {
  track: Track
  clip: Clip
  onClose: () => void
}) {
  const commit = useStore((state) => state.commit)
  const setView = useStore((state) => state.setView)
  const pattern = patternOf(track, clip.patternId)
  if (!pattern) return null
  const links = linkCount(track, pattern.id)

  const run = (change: (song: Song) => Song) => {
    commit(change)
    onClose()
  }

  return (
    <Sheet
      title={
        <>
          <span style={{ color: `var(--pico-${track.color})` }}>{track.name}</span> · {pattern.name}
          {links > 1 && ` (${links} LINKED)`}
        </>
      }
      onClose={onClose}
    >
      <SheetRow>
        <Button
          onClick={() => setView({ screen: 'pattern', trackId: track.id, patternId: pattern.id })}
        >
          EDIT
        </Button>
        <Button onClick={() => run((song) => duplicateClip(song, track.id, clip.id))}>
          DUPLICATE
        </Button>
      </SheetRow>
      <SheetRow>
        <Button
          disabled={links <= 1}
          onClick={() => run((song) => makeClipUnique(song, track.id, clip.id))}
        >
          MAKE UNIQUE
        </Button>
        <Button variant="danger" onClick={() => run((song) => deleteClip(song, track.id, clip.id))}>
          DELETE
        </Button>
      </SheetRow>
    </Sheet>
  )
}
