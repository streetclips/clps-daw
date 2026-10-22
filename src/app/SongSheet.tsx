import { engine } from '../audio/engine'
import { renameSong, setBpm, setMeter, setScale } from '../model/arrange'
import { METERS, SCALE_MODES } from '../model/constants'
import { noteName } from '../model/scale'
import type { Song } from '../model/schema'
import { cancelPendingSave } from '../state/autosave'
import { deleteSong } from '../state/storage'
import { useStore } from '../state/store'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Segmented'
import { Select } from '../ui/Select'
import { Sheet, SheetRow } from '../ui/Sheet'
import { TextField } from '../ui/TextField'

const MODE_LABELS = { major: 'MAJ', minor: 'MIN', pentatonic: 'PENTA', chromatic: 'CHROM' } as const
type ModeLabel = (typeof MODE_LABELS)[keyof typeof MODE_LABELS]
const MODE_BY_LABEL = Object.fromEntries(
  SCALE_MODES.map((mode) => [MODE_LABELS[mode], mode]),
) as Record<ModeLabel, Song['scale']['mode']>
const ROOTS = Array.from({ length: 12 }, (_, root) => ({
  value: String(root),
  label: noteName(root + 60).replace(/\d/, ''),
}))
const BPM_STEPS = [-10, -1, 1, 10]

export function SongSheet({ song, onClose }: { song: Song; onClose: () => void }) {
  const commit = useStore((state) => state.commit)
  const closeSong = useStore((state) => state.closeSong)

  const remove = async () => {
    if (!window.confirm(`DELETE ${song.name}? THIS CANNOT BE UNDONE.`)) return
    engine.stop()
    cancelPendingSave()
    await deleteSong(song.id)
    closeSong()
  }

  return (
    <Sheet title="SONG" onClose={onClose}>
      <SheetRow label="NAME">
        <TextField
          label="Song name"
          value={song.name}
          maxLength={40}
          onCommit={(name) => commit((s) => renameSong(s, name))}
        />
      </SheetRow>
      <SheetRow label={`BPM ${song.bpm}`}>
        {BPM_STEPS.map((step) => (
          <Button key={step} onClick={() => commit((s) => setBpm(s, s.bpm + step))}>
            {step > 0 ? `+${step}` : step}
          </Button>
        ))}
      </SheetRow>
      <SheetRow label="METER">
        <Segmented
          options={METERS}
          value={song.meter}
          onChange={(meter) => commit((s) => setMeter(s, meter))}
        />
      </SheetRow>
      <SheetRow label="KEY">
        <Select
          label="Key"
          options={ROOTS}
          value={String(song.scale.root)}
          onChange={(root) => commit((s) => setScale(s, { ...s.scale, root: Number(root) }))}
        />
      </SheetRow>
      <SheetRow label="SCALE">
        <Segmented
          options={Object.values(MODE_LABELS)}
          value={MODE_LABELS[song.scale.mode]}
          onChange={(label) =>
            commit((s) => setScale(s, { ...s.scale, mode: MODE_BY_LABEL[label] }))
          }
        />
      </SheetRow>
      <SheetRow>
        <Button variant="danger" onClick={remove}>
          DELETE SONG
        </Button>
      </SheetRow>
    </Sheet>
  )
}
