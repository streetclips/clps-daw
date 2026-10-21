import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react'
import { engine } from '../../audio/engine'
import { STEPS_PER_BAR } from '../../model/constants'
import {
  addNote,
  moveNote,
  noteAt,
  patternSteps,
  removeNote,
  resizeNote,
  type NoteRef,
} from '../../model/edit'
import { inScale, isBlackKey, noteName, pitchClass, synthRows } from '../../model/scale'
import type { Note, Pattern, Song, Track } from '../../model/schema'
import { noteLengthSteps, useStore } from '../../state/store'
import {
  cellAt,
  drawnNote,
  isOnResizeHandle,
  movedNote,
  resizedNote,
  type Cell,
  type GridLayout,
} from './geometry'
import styles from './PianoRoll.module.css'

const KEY_WIDTH = 44
const RULER_HEIGHT = 20
const ROW_HEIGHT = 28
const TALL_ROW_HEIGHT = 44
const DRAG_THRESHOLD = 6
const MIN_ZOOM_BARS = 0.25
const MIDDLE_C = 60
const DRUM_NAMES = ['KICK', 'SNR', 'CHH', 'OHH', 'TOM']
const DRUM_ROWS = [0, 1, 2, 3, 4]

type Draft = { kind: 'add'; note: Note } | { kind: 'move' | 'resize'; from: NoteRef; note: Note }

interface Point {
  x: number
  y: number
}

type DragMode = 'draw' | 'move' | 'resize'

type Gesture =
  | { kind: 'idle' }
  | { kind: 'ignore' }
  | { kind: 'key'; pointerId: number; pitch: number; previewed: boolean }
  | {
      kind: 'pending'
      pointerId: number
      start: Point
      origin: Cell
      hit: Note | undefined
      resize: boolean
    }
  | { kind: 'drag'; pointerId: number; origin: Cell; hit: Note | undefined; mode: DragMode }
  | {
      kind: 'pan'
      center: Point
      distance: number
      scrollTop: number
      zoom: number
      anchorStep: number
    }

type Scale = Song['scale']

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function centerOf(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function previewPitch(trackId: string, pitch: number, unlock: boolean): boolean {
  if (unlock) engine.unlock()
  else if (engine.getSnapshot().status !== 'running') return false
  engine.preview(trackId, pitch)
  return true
}

const Ruler = memo(function Ruler({ bars, barWidth }: { bars: number; barWidth: number }) {
  return (
    <div className={styles.ruler}>
      {Array.from({ length: bars }, (_, bar) => (
        <span key={bar} className={styles.barLabel} style={{ left: bar * barWidth + 4 }}>
          {bar + 1}
        </span>
      ))}
    </div>
  )
})

const Keys = memo(function Keys({
  rows,
  rowHeight,
  scale,
  drums,
}: {
  rows: readonly number[]
  rowHeight: number
  scale: Scale
  drums: boolean
}) {
  return (
    <div className={styles.keys}>
      {rows.map((pitch) => {
        const classes = [styles.key]
        if (!drums) {
          if (isBlackKey(pitch)) classes.push(styles.black)
          if (pitchClass(pitch) === scale.root) classes.push(styles.root)
          else if (!inScale(pitch, scale)) classes.push(styles.out)
        }
        return (
          <div key={pitch} className={classes.join(' ')} style={{ height: rowHeight }}>
            {drums ? DRUM_NAMES[pitch] : noteName(pitch)}
          </div>
        )
      })}
    </div>
  )
})

const Stripes = memo(function Stripes({
  rows,
  rowHeight,
  scale,
  drums,
}: {
  rows: readonly number[]
  rowHeight: number
  scale: Scale
  drums: boolean
}) {
  return rows.map((pitch) => {
    const classes = [styles.stripe]
    if (!drums && !inScale(pitch, scale)) classes.push(styles.stripeOut)
    if (!drums && pitchClass(pitch) === 0) classes.push(styles.octave)
    return <div key={pitch} className={classes.join(' ')} style={{ height: rowHeight }} />
  })
})

function NoteBlock({
  note,
  row,
  layout,
  color,
  draft = false,
}: {
  note: Note
  row: number
  layout: GridLayout
  color: string
  draft?: boolean
}) {
  return (
    <div
      className={draft ? `${styles.note} ${styles.draft}` : styles.note}
      style={{
        left: note.start * layout.stepWidth,
        top: row * layout.rowHeight,
        width: note.length * layout.stepWidth,
        height: layout.rowHeight,
        background: color,
      }}
    />
  )
}

export function PianoRoll({
  song,
  track,
  pattern,
}: {
  song: Song
  track: Track
  pattern: Pattern
}) {
  const fold = useStore((state) => state.fold)
  const noteLength = useStore((state) => state.noteLength)
  const editPattern = useStore((state) => state.editPattern)

  const viewportRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<Gesture>({ kind: 'idle' })
  const draftRef = useRef<Draft | null>(null)
  const pendingScroll = useRef<Point | null>(null)
  const initialScrollDone = useRef(false)

  const [draft, setDraftState] = useState<Draft | null>(null)
  const [zoom, setZoom] = useState(1)
  const [viewportWidth, setViewportWidth] = useState(0)

  const drums = track.instrument.type === 'drums'
  const stepsPerBar = STEPS_PER_BAR[song.meter]
  const beatSteps = song.meter === '6/8' ? 6 : 4
  const steps = patternSteps(pattern, song.meter)
  const usedPitches = useMemo(() => new Set(pattern.notes.map((n) => n.pitch)), [pattern.notes])
  const rows = useMemo(
    () => (drums ? DRUM_ROWS : synthRows(song.scale, fold, usedPitches)),
    [drums, song.scale, fold, usedPitches],
  )
  const rowIndex = useMemo(() => new Map(rows.map((pitch, i) => [pitch, i])), [rows])
  const rowHeight = drums || fold ? TALL_ROW_HEIGHT : ROW_HEIGHT
  const maxZoom = pattern.lengthBars
  const visibleBars = Math.min(zoom, maxZoom)
  const stepWidth =
    viewportWidth > KEY_WIDTH ? (viewportWidth - KEY_WIDTH) / (visibleBars * stepsPerBar) : 24
  const layout: GridLayout = { stepWidth, rowHeight, rows, steps }
  const gridWidth = steps * stepWidth
  const gridHeight = rows.length * rowHeight
  const color = `var(--pico-${track.color})`

  const setDraft = (next: Draft | null) => {
    draftRef.current = next
    setDraftState(next)
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setViewportWidth(entry.contentRect.width)
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    if (pendingScroll.current) {
      viewport.scrollLeft = pendingScroll.current.x
      viewport.scrollTop = pendingScroll.current.y
      pendingScroll.current = null
    }
    if (!initialScrollDone.current && viewportWidth > 0) {
      initialScrollDone.current = true
      const pitches = pattern.notes.map((n) => n.pitch)
      const target = pitches.length
        ? pitches.reduce((sum, p) => sum + p, 0) / pitches.length
        : MIDDLE_C
      const closest = rows.reduce(
        (best, pitch, i) => (Math.abs(pitch - target) < Math.abs(rows[best]! - target) ? i : best),
        0,
      )
      viewport.scrollTop = closest * rowHeight - (viewport.clientHeight - RULER_HEIGHT) / 2
    }
  })

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        setZoom((current) =>
          clamp(Math.min(current, maxZoom) * Math.exp(event.deltaY * 0.01), MIN_ZOOM_BARS, maxZoom),
        )
      } else if (event.shiftKey) {
        viewport.scrollLeft += event.deltaY
      } else {
        viewport.scrollLeft += event.deltaX
        viewport.scrollTop += event.deltaY
      }
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [maxZoom])

  useEffect(() => {
    let frame = requestAnimationFrame(function update() {
      const playhead = playheadRef.current
      const position = engine.position()
      if (playhead) {
        const visible =
          position?.target.mode === 'pattern' && position.target.patternId === pattern.id
        playhead.style.display = visible ? 'block' : 'none'
        if (visible) playhead.style.transform = `translateX(${position.step * stepWidth}px)`
      }
      frame = requestAnimationFrame(update)
    })
    return () => cancelAnimationFrame(frame)
  }, [pattern.id, stepWidth])

  const localPoint = (clientX: number, clientY: number): Point => {
    const rect = gridRef.current!.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const regionAt = (clientX: number, clientY: number): 'ruler' | 'keys' | 'grid' => {
    const rect = viewportRef.current!.getBoundingClientRect()
    if (clientY - rect.top < RULER_HEIGHT) return 'ruler'
    if (clientX - rect.left < KEY_WIDTH) return 'keys'
    return 'grid'
  }

  const twoPointers = (): [Point, Point] | null => {
    const [a, b] = [...pointers.current.values()]
    return a && b ? [a, b] : null
  }

  const startPan = () => {
    const viewport = viewportRef.current
    const pair = twoPointers()
    if (!viewport || !pair) return
    const center = centerOf(...pair)
    const rect = viewport.getBoundingClientRect()
    gesture.current = {
      kind: 'pan',
      center,
      distance: Math.max(Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y), 1),
      scrollTop: viewport.scrollTop,
      zoom: visibleBars,
      anchorStep: (viewport.scrollLeft + center.x - rect.left - KEY_WIDTH) / stepWidth,
    }
    setDraft(null)
  }

  const updatePan = (pan: Extract<Gesture, { kind: 'pan' }>) => {
    const viewport = viewportRef.current
    const pair = twoPointers()
    if (!viewport || !pair) return
    const center = centerOf(...pair)
    const distance = Math.max(Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y), 1)
    const nextZoom = clamp((pan.zoom * pan.distance) / distance, MIN_ZOOM_BARS, maxZoom)
    const nextStepWidth = (viewportWidth - KEY_WIDTH) / (nextZoom * stepsPerBar)
    const rect = viewport.getBoundingClientRect()
    const next = {
      x: pan.anchorStep * nextStepWidth - (center.x - rect.left - KEY_WIDTH),
      y: pan.scrollTop - (center.y - pan.center.y),
    }
    if (nextZoom !== visibleBars) {
      pendingScroll.current = next
      setZoom(nextZoom)
    } else {
      viewport.scrollLeft = next.x
      viewport.scrollTop = next.y
    }
  }

  const draftFor = (drag: Extract<Gesture, { kind: 'drag' }>, cell: Cell): Draft => {
    if (drag.mode === 'draw' || !drag.hit) {
      const note = drawnNote(drag.origin, cell, steps)
      return { kind: 'add', note: drums ? { ...note, length: 1 } : note }
    }
    const from = { pitch: drag.hit.pitch, start: drag.hit.start }
    return drag.mode === 'move'
      ? { kind: 'move', from, note: movedNote(drag.hit, drag.origin, cell, steps) }
      : { kind: 'resize', from, note: resizedNote(drag.hit, cell, steps) }
  }

  const commit = (next: Draft) => {
    if (next.kind === 'add') {
      editPattern(track.id, pattern.id, (p, s) => addNote(p, next.note, s))
    } else if (next.kind === 'move') {
      editPattern(track.id, pattern.id, (p, s) => moveNote(p, next.from, next.note, s))
    } else {
      editPattern(track.id, pattern.id, (p, s) => resizeNote(p, next.from, next.note.length, s))
    }
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) return startPan()
    if (pointers.current.size > 2 || gesture.current.kind !== 'idle') return

    const region = regionAt(event.clientX, event.clientY)
    const local = localPoint(event.clientX, event.clientY)
    if (
      region === 'ruler' ||
      local.y >= gridHeight ||
      (region === 'grid' && local.x >= gridWidth)
    ) {
      gesture.current = { kind: 'ignore' }
      return
    }
    const cell = cellAt(layout, local.x, local.y)
    if (region === 'keys') {
      const previewed = previewPitch(track.id, cell.pitch, false)
      gesture.current = { kind: 'key', pointerId: event.pointerId, pitch: cell.pitch, previewed }
      return
    }
    const hit = noteAt(pattern, cell.pitch, cell.step)
    gesture.current = {
      kind: 'pending',
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: cell,
      hit,
      resize: hit ? isOnResizeHandle(hit, local.x, stepWidth) : false,
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const current = gesture.current
    if (current.kind === 'pan') return updatePan(current)
    if (
      (current.kind !== 'pending' && current.kind !== 'drag') ||
      current.pointerId !== event.pointerId
    ) {
      return
    }
    if (
      current.kind === 'pending' &&
      Math.hypot(event.clientX - current.start.x, event.clientY - current.start.y) < DRAG_THRESHOLD
    ) {
      return
    }

    let drag: Extract<Gesture, { kind: 'drag' }>
    if (current.kind === 'pending') {
      const mode: DragMode = !current.hit ? 'draw' : current.resize && !drums ? 'resize' : 'move'
      drag = {
        kind: 'drag',
        pointerId: current.pointerId,
        origin: current.origin,
        hit: current.hit,
        mode,
      }
      gesture.current = drag
      if (mode === 'draw') previewPitch(track.id, current.origin.pitch, false)
    } else {
      drag = current
    }

    const local = localPoint(event.clientX, event.clientY)
    const next = draftFor(drag, cellAt(layout, local.x, local.y))
    const previous = draftRef.current
    if (drag.mode === 'move' && previous && previous.note.pitch !== next.note.pitch) {
      previewPitch(track.id, next.note.pitch, false)
    }
    setDraft(next)
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return
    const current = gesture.current
    const own = 'pointerId' in current && current.pointerId === event.pointerId

    if (own && current.kind === 'key' && !current.previewed) {
      previewPitch(track.id, current.pitch, true)
    } else if (own && current.kind === 'pending') {
      engine.unlock()
      if (current.hit) {
        const ref = { pitch: current.hit.pitch, start: current.hit.start }
        editPattern(track.id, pattern.id, (p) => removeNote(p, ref))
      } else {
        const note = {
          pitch: current.origin.pitch,
          start: current.origin.step,
          length: drums ? 1 : noteLengthSteps(noteLength, song.meter),
        }
        editPattern(track.id, pattern.id, (p, s) => addNote(p, note, s))
        engine.preview(track.id, note.pitch)
      }
    } else if (own && current.kind === 'drag' && draftRef.current) {
      engine.unlock()
      commit(draftRef.current)
    }

    gesture.current = pointers.current.size === 0 ? { kind: 'idle' } : { kind: 'ignore' }
    setDraft(null)
  }

  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    gesture.current = pointers.current.size === 0 ? { kind: 'idle' } : { kind: 'ignore' }
    setDraft(null)
  }

  const hidden = draft && draft.kind !== 'add' ? draft.from : null
  const draftRow = draft ? rowIndex.get(draft.note.pitch) : undefined

  return (
    <div
      ref={viewportRef}
      className={styles.viewport}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        className={styles.content}
        style={{
          gridTemplateColumns: `${KEY_WIDTH}px ${gridWidth}px`,
          gridTemplateRows: `${RULER_HEIGHT}px ${gridHeight}px`,
        }}
      >
        <div className={styles.corner} />
        <Ruler bars={pattern.lengthBars} barWidth={stepsPerBar * stepWidth} />
        <Keys rows={rows} rowHeight={rowHeight} scale={song.scale} drums={drums} />
        <div
          ref={gridRef}
          className={styles.grid}
          style={
            {
              '--step': `${stepWidth}px`,
              '--beat': `${beatSteps * stepWidth}px`,
              '--bar': `${stepsPerBar * stepWidth}px`,
            } as CSSProperties
          }
        >
          <Stripes rows={rows} rowHeight={rowHeight} scale={song.scale} drums={drums} />
          <div className={styles.lines} />
          {pattern.notes.map((note) => {
            const row = rowIndex.get(note.pitch)
            if (row === undefined) return null
            if (hidden && hidden.pitch === note.pitch && hidden.start === note.start) return null
            return (
              <NoteBlock
                key={`${note.pitch}-${note.start}`}
                note={note}
                row={row}
                layout={layout}
                color={color}
              />
            )
          })}
          {draft && draftRow !== undefined && (
            <NoteBlock note={draft.note} row={draftRow} layout={layout} color={color} draft />
          )}
          <div ref={playheadRef} className={styles.playhead} />
        </div>
      </div>
    </div>
  )
}
