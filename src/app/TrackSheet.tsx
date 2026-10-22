import { addTrack, removeTrack, renameTrack, type TrackKind } from '../model/arrange'
import type { Track } from '../model/schema'
import { useStore } from '../state/store'
import { Button } from '../ui/Button'
import { Sheet, SheetRow } from '../ui/Sheet'
import { TextField } from '../ui/TextField'

export function TrackSheet({ track, onClose }: { track: Track; onClose: () => void }) {
  const commit = useStore((state) => state.commit)

  const remove = () => {
    commit((song) => removeTrack(song, track.id))
    onClose()
  }

  return (
    <Sheet
      title={<span style={{ color: `var(--pico-${track.color})` }}>{track.name}</span>}
      onClose={onClose}
    >
      <SheetRow label="NAME">
        <TextField
          label="Track name"
          value={track.name}
          maxLength={12}
          onCommit={(name) => commit((song) => renameTrack(song, track.id, name))}
        />
      </SheetRow>
      <SheetRow>
        <Button variant="danger" onClick={remove}>
          DELETE TRACK
        </Button>
      </SheetRow>
    </Sheet>
  )
}

export function AddTrackSheet({ onClose }: { onClose: () => void }) {
  const commit = useStore((state) => state.commit)

  const add = (kind: TrackKind) => {
    commit((song) => addTrack(song, kind))
    onClose()
  }

  return (
    <Sheet title="ADD TRACK" onClose={onClose}>
      <SheetRow>
        <Button onClick={() => add('synth')}>SYNTH</Button>
        <Button onClick={() => add('drums')}>DRUMS</Button>
      </SheetRow>
    </Sheet>
  )
}
