import { useEffect, useState, useSyncExternalStore } from 'react'
import { engine } from '../audio/engine'
import { STEPS_PER_BAR } from '../model/constants'
import { createDemoSong } from '../model/demo'
import { Button } from '../ui/Button'
import { StatusRow, Panel, type Status } from '../ui/Panel'
import styles from './SoundTest.module.css'

const demo = createDemoSong()
const stepsPerBar = STEPS_PER_BAR[demo.meter]

const SYNTH_PADS = [
  { track: 0, pitch: 69, wave: 'SQR' },
  { track: 1, pitch: 81, wave: 'SIN' },
  { track: 2, pitch: 57, wave: 'SAW' },
  { track: 3, pitch: 45, wave: 'TRI' },
]
const DRUM_PADS = ['KICK', 'SNR', 'CHH', 'OHH', 'TOM']
const DRUM_TRACK = 4

function statusOf(status: string): Status {
  if (status === 'running') return 'ok'
  if (status === 'closed') return 'bad'
  return 'pending'
}

function formatPosition(step: number): string {
  const bar = Math.floor(step / stepsPerBar) + 1
  const beat = (Math.floor(step) % stepsPerBar) + 1
  return `BAR ${bar} · ${String(beat).padStart(2, '0')}`
}

function Position() {
  const [label, setLabel] = useState('')

  useEffect(() => {
    let frame = requestAnimationFrame(function update() {
      const position = engine.position()
      setLabel(position ? formatPosition(position.step) : '')
      frame = requestAnimationFrame(update)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return <span className={styles.position}>{label}</span>
}

function preview(trackIndex: number, pitch: number) {
  const track = demo.tracks[trackIndex]
  if (!track) return
  engine.unlock()
  engine.preview(track.id, pitch)
}

export function SoundTest() {
  const { status, playing } = useSyncExternalStore(engine.subscribe, engine.getSnapshot)

  useEffect(() => engine.setSongSource(() => demo), [])

  const togglePlay = () => {
    engine.unlock()
    if (playing) engine.stop()
    else engine.play({ mode: 'song', fromBar: 0 })
  }

  return (
    <Panel title="SOUND TEST">
      <StatusRow label="AUDIO" value={status.toUpperCase()} status={statusOf(status)} />
      <div className={styles.transport}>
        <Button onClick={togglePlay}>{playing ? 'STOP' : 'PLAY DEMO'}</Button>
        {playing && <Position />}
      </div>
      <div className={styles.synths}>
        {SYNTH_PADS.map(({ track, pitch, wave }) => (
          <Button key={track} className={styles.pad} onClick={() => preview(track, pitch)}>
            <span>{demo.tracks[track]?.name}</span>
            <span className={styles.wave}>{wave}</span>
          </Button>
        ))}
      </div>
      <div className={styles.drums}>
        {DRUM_PADS.map((name, lane) => (
          <Button key={name} className={styles.pad} onClick={() => preview(DRUM_TRACK, lane)}>
            {name}
          </Button>
        ))}
      </div>
      <p className={styles.hint}>TURN ON SILENT MODE, THEN PLAY</p>
    </Panel>
  )
}
