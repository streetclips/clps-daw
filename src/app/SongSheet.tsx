import { useState } from 'react'
import { engine } from '../audio/engine'
import { renderSong } from '../audio/render'
import { songLengthBars } from '../audio/timeline'
import { encodeWav } from '../audio/wav'
import { renameSong, setBpm, setMeter, setScale } from '../model/arrange'
import { METERS, SCALE_MODES } from '../model/constants'
import { serializeSong, songFileName } from '../model/files'
import { noteName } from '../model/scale'
import type { Song } from '../model/schema'
import { cancelPendingSave } from '../state/autosave'
import { deleteSong } from '../state/storage'
import { useStore } from '../state/store'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Segmented'
import { Select } from '../ui/Select'
import { Sheet, SheetRow, SheetSection } from '../ui/Sheet'
import { Slider } from '../ui/Slider'
import { TextField } from '../ui/TextField'
import { formatDuration, formatPercent } from './format'
import { shareFile } from './share'

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

type WavState =
  | { status: 'idle' }
  | { status: 'rendering' }
  | { status: 'ready'; file: File; seconds: number; song: Song }
  | { status: 'failed' }

function ExportControls({ song }: { song: Song }) {
  const [wav, setWav] = useState<WavState>({ status: 'idle' })
  const empty = songLengthBars(song) === 0
  const ready = wav.status === 'ready' && wav.song === song ? wav : null

  const exportJson = () =>
    shareFile(
      new File([serializeSong(song)], songFileName(song.name, 'json'), {
        type: 'application/json',
      }),
    )

  const render = async () => {
    setWav({ status: 'rendering' })
    try {
      const buffer = await renderSong(song)
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
        buffer.getChannelData(i),
      )
      const file = new File(
        [encodeWav(channels, buffer.sampleRate)],
        songFileName(song.name, 'wav'),
        {
          type: 'audio/wav',
        },
      )
      setWav({ status: 'ready', file, seconds: buffer.duration, song })
    } catch (error) {
      console.error('WAV export failed', error)
      setWav({ status: 'failed' })
    }
  }

  return (
    <>
      <SheetRow label="JSON">
        <Button onClick={exportJson}>EXPORT JSON</Button>
      </SheetRow>
      <SheetRow label="WAV">
        {ready ? (
          <Button variant="on" onClick={() => shareFile(ready.file)}>
            SAVE WAV {formatDuration(ready.seconds)}
          </Button>
        ) : (
          <Button disabled={empty || wav.status === 'rendering'} onClick={render}>
            {wav.status === 'rendering' ? 'RENDERING...' : 'RENDER WAV'}
          </Button>
        )}
      </SheetRow>
      {empty && <SheetRow label="">ADD CLIPS TO EXPORT AUDIO</SheetRow>}
      {wav.status === 'failed' && <SheetRow label="">EXPORT FAILED. TRY A SHORTER SONG.</SheetRow>}
    </>
  )
}

export function SongSheet({ song, onClose }: { song: Song; onClose: () => void }) {
  const commit = useStore((state) => state.commit)
  const sealHistory = useStore((state) => state.sealHistory)
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

      <SheetSection>MASTER</SheetSection>
      <Slider
        label="VOLUME"
        value={song.masterVolume}
        min={0}
        max={1}
        precision={2}
        format={formatPercent}
        onChange={(masterVolume) => commit((s) => ({ ...s, masterVolume }), 'masterVolume')}
        onEnd={sealHistory}
      />
      <Slider
        label="REVERB"
        value={song.reverb.size}
        min={0}
        max={1}
        precision={2}
        format={formatPercent}
        onChange={(size) => commit((s) => ({ ...s, reverb: { size } }), 'reverbSize')}
        onEnd={sealHistory}
      />

      <SheetSection>EXPORT</SheetSection>
      <ExportControls song={song} />

      <SheetRow>
        <Button variant="danger" onClick={remove}>
          DELETE SONG
        </Button>
      </SheetRow>
    </Sheet>
  )
}
