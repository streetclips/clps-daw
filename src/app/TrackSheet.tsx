import { engine } from '../audio/engine'
import { addTrack, patchTrack, removeTrack, renameTrack, type TrackKind } from '../model/arrange'
import { DELAY_DIVISIONS, PULSE_WIDTHS, WAVES } from '../model/constants'
import { SYNTH_PRESETS, synthFromPreset, type SynthPresetName } from '../model/presets'
import type { DrumInstrument, Song, SynthInstrument, Track } from '../model/schema'
import { useStore } from '../state/store'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Segmented'
import { Select } from '../ui/Select'
import { Sheet, SheetRow, SheetSection } from '../ui/Sheet'
import { Slider } from '../ui/Slider'
import { TextField } from '../ui/TextField'
import { formatHz, formatPan, formatPercent, formatSeconds, formatSemitones } from './format'

const CUSTOM = 'CUSTOM'
const PRESET_OPTIONS = [...Object.keys(SYNTH_PRESETS), CUSTOM].map((name) => ({
  value: name,
  label: name,
}))
const WAVE_LABELS = { sine: 'SIN', square: 'SQR', triangle: 'TRI', sawtooth: 'SAW' } as const
const WAVE_BY_LABEL = Object.fromEntries(WAVES.map((wave) => [WAVE_LABELS[wave], wave])) as Record<
  (typeof WAVE_LABELS)[SynthInstrument['wave']],
  SynthInstrument['wave']
>
const PULSE_LABELS = { 0.125: '12%', 0.25: '25%', 0.5: '50%' } as const
const PULSE_BY_LABEL = Object.fromEntries(
  PULSE_WIDTHS.map((width) => [PULSE_LABELS[width], width]),
) as Record<(typeof PULSE_LABELS)[SynthInstrument['pulseWidth']], SynthInstrument['pulseWidth']>
const FILTER_LABELS = { lowpass: 'LOW', highpass: 'HIGH' } as const
const DELAY_LABELS = { '1/8': '1/8', '1/4': '1/4', '1/8d': '1/8D' } as const
const DELAY_BY_LABEL = Object.fromEntries(
  DELAY_DIVISIONS.map((division) => [DELAY_LABELS[division], division]),
) as Record<(typeof DELAY_LABELS)[Track['delay']['division']], Track['delay']['division']>
const DRUM_PADS = ['KICK', 'SNR', 'CHH', 'OHH', 'TOM']

type Patch = Partial<Omit<Track, 'id' | 'patterns' | 'clips'>>

function useTrackEditor(track: Track) {
  const commit = useStore((state) => state.commit)
  const sealHistory = useStore((state) => state.sealHistory)
  const update = (patch: Patch, key?: string) =>
    commit((song: Song) => patchTrack(song, track.id, patch), key && `${track.id}:${key}`)
  return { commit, update, seal: sealHistory }
}

function SynthControls({ track, instrument }: { track: Track; instrument: SynthInstrument }) {
  const { update, seal } = useTrackEditor(track)
  const edit = (changes: Partial<SynthInstrument>, key?: string) =>
    update({ instrument: { ...instrument, ...changes, preset: CUSTOM } }, key)
  const preset = instrument.preset in SYNTH_PRESETS ? instrument.preset : CUSTOM

  return (
    <>
      <SheetRow label="PRESET">
        <Select
          label="Preset"
          options={PRESET_OPTIONS}
          value={preset}
          onChange={(name) => {
            if (name !== CUSTOM) update({ instrument: synthFromPreset(name as SynthPresetName) })
          }}
        />
      </SheetRow>
      <SheetRow label="WAVE">
        <Segmented
          options={Object.values(WAVE_LABELS)}
          value={WAVE_LABELS[instrument.wave]}
          onChange={(label) => edit({ wave: WAVE_BY_LABEL[label] })}
        />
      </SheetRow>
      {instrument.wave === 'square' && (
        <SheetRow label="PULSE">
          <Segmented
            options={Object.values(PULSE_LABELS)}
            value={PULSE_LABELS[instrument.pulseWidth]}
            onChange={(label) => edit({ pulseWidth: PULSE_BY_LABEL[label] })}
          />
        </SheetRow>
      )}
      <Slider
        label="ATTACK"
        value={instrument.attack}
        min={0}
        max={2}
        precision={3}
        scale="square"
        format={formatSeconds}
        onChange={(attack) => edit({ attack }, 'attack')}
        onEnd={seal}
      />
      <Slider
        label="DECAY"
        value={instrument.decay}
        min={0}
        max={2}
        precision={3}
        scale="square"
        format={formatSeconds}
        onChange={(decay) => edit({ decay }, 'decay')}
        onEnd={seal}
      />
      <Slider
        label="SUSTAIN"
        value={instrument.sustain}
        min={0}
        max={1}
        precision={2}
        format={formatPercent}
        onChange={(sustain) => edit({ sustain }, 'sustain')}
        onEnd={seal}
      />
      <Slider
        label="RELEASE"
        value={instrument.release}
        min={0}
        max={4}
        precision={3}
        scale="square"
        format={formatSeconds}
        onChange={(release) => edit({ release }, 'release')}
        onEnd={seal}
      />
    </>
  )
}

function DrumControls({ track, instrument }: { track: Track; instrument: DrumInstrument }) {
  const { update, seal } = useTrackEditor(track)
  const edit = (changes: Partial<DrumInstrument>, key: string) =>
    update({ instrument: { ...instrument, ...changes } }, key)

  return (
    <>
      <Slider
        label="TUNE"
        value={instrument.tune}
        min={-12}
        max={12}
        precision={0}
        format={formatSemitones}
        onChange={(tune) => edit({ tune }, 'tune')}
        onEnd={seal}
      />
      <Slider
        label="DECAY"
        value={instrument.decay}
        min={0.25}
        max={2}
        precision={2}
        format={(value) => `x${value.toFixed(2)}`}
        onChange={(decay) => edit({ decay }, 'decay')}
        onEnd={seal}
      />
    </>
  )
}

function MixControls({ track }: { track: Track }) {
  const { update, seal } = useTrackEditor(track)
  return (
    <>
      <Slider
        label="VOLUME"
        value={track.volume}
        min={0}
        max={1}
        precision={2}
        format={formatPercent}
        onChange={(volume) => update({ volume }, 'volume')}
        onEnd={seal}
      />
      <Slider
        label="PAN"
        value={track.pan}
        min={-1}
        max={1}
        precision={2}
        format={formatPan}
        onChange={(pan) => update({ pan }, 'pan')}
        onEnd={seal}
      />
      <Slider
        label="REVERB"
        value={track.reverbSend}
        min={0}
        max={1}
        precision={2}
        format={formatPercent}
        onChange={(reverbSend) => update({ reverbSend }, 'reverbSend')}
        onEnd={seal}
      />
    </>
  )
}

function FilterControls({ track }: { track: Track }) {
  const { update, seal } = useTrackEditor(track)
  const filter = track.filter
  const edit = (changes: Partial<Track['filter']>, key?: string) =>
    update({ filter: { ...filter, ...changes } }, key)

  return (
    <>
      <SheetRow label="FILTER">
        <Button
          variant={filter.enabled ? 'on' : undefined}
          onClick={() => edit({ enabled: !filter.enabled })}
        >
          {filter.enabled ? 'ON' : 'OFF'}
        </Button>
        <Segmented
          options={Object.values(FILTER_LABELS)}
          value={FILTER_LABELS[filter.type]}
          onChange={(label) => edit({ type: label === 'LOW' ? 'lowpass' : 'highpass' })}
        />
      </SheetRow>
      <Slider
        label="CUTOFF"
        value={filter.cutoff}
        min={20}
        max={20000}
        precision={0}
        scale="log"
        format={formatHz}
        onChange={(cutoff) => edit({ cutoff }, 'cutoff')}
        onEnd={seal}
      />
      <Slider
        label="RESO"
        value={filter.resonance}
        min={0.1}
        max={20}
        precision={1}
        scale="square"
        format={(value) => value.toFixed(1)}
        onChange={(resonance) => edit({ resonance }, 'resonance')}
        onEnd={seal}
      />
    </>
  )
}

function DelayControls({ track }: { track: Track }) {
  const { update, seal } = useTrackEditor(track)
  const delay = track.delay
  const edit = (changes: Partial<Track['delay']>, key?: string) =>
    update({ delay: { ...delay, ...changes } }, key)

  return (
    <>
      <SheetRow label="DELAY">
        <Button
          variant={delay.enabled ? 'on' : undefined}
          onClick={() => edit({ enabled: !delay.enabled })}
        >
          {delay.enabled ? 'ON' : 'OFF'}
        </Button>
        <Segmented
          options={Object.values(DELAY_LABELS)}
          value={DELAY_LABELS[delay.division]}
          onChange={(label) => edit({ division: DELAY_BY_LABEL[label] })}
        />
      </SheetRow>
      <Slider
        label="FEEDBACK"
        value={delay.feedback}
        min={0}
        max={0.9}
        precision={2}
        format={formatPercent}
        onChange={(feedback) => edit({ feedback }, 'feedback')}
        onEnd={seal}
      />
      <Slider
        label="MIX"
        value={delay.mix}
        min={0}
        max={1}
        precision={2}
        format={formatPercent}
        onChange={(mix) => edit({ mix }, 'mix')}
        onEnd={seal}
      />
    </>
  )
}

export function TrackSheet({
  track,
  song,
  onClose,
}: {
  track: Track
  song: Song
  onClose: () => void
}) {
  const { commit } = useTrackEditor(track)
  const instrument = track.instrument

  const preview = (pitch: number) => {
    engine.unlock()
    engine.preview(track.id, pitch)
  }

  const remove = () => {
    commit((s) => removeTrack(s, track.id))
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
          onCommit={(name) => commit((s) => renameTrack(s, track.id, name))}
        />
      </SheetRow>
      <SheetRow label="TEST">
        {instrument.type === 'synth' ? (
          <Button onClick={() => preview(60 + song.scale.root)}>PLAY NOTE</Button>
        ) : (
          DRUM_PADS.map((name, lane) => (
            <Button key={name} onClick={() => preview(lane)}>
              {name}
            </Button>
          ))
        )}
      </SheetRow>

      <SheetSection>INSTRUMENT</SheetSection>
      {instrument.type === 'synth' ? (
        <SynthControls track={track} instrument={instrument} />
      ) : (
        <DrumControls track={track} instrument={instrument} />
      )}

      <SheetSection>MIX</SheetSection>
      <MixControls track={track} />

      <SheetSection>EFFECTS</SheetSection>
      <FilterControls track={track} />
      <DelayControls track={track} />

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
