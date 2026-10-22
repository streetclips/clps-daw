import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react'
import { engine } from '../../audio/engine'
import { isTrackAudible } from '../../audio/timeline'
import {
  canPlaceClip,
  clipAt,
  clipLength,
  createPatternClip,
  moveClip,
  patchTrack,
  patternOf,
} from '../../model/arrange'
import { MAX_BARS, MAX_TRACKS, STEPS_PER_BAR } from '../../model/constants'
import type { Pattern, Song } from '../../model/schema'
import { useStore } from '../../state/store'
import { centerOf, clamp, distanceOf, DRAG_THRESHOLD, firstTwo, type Point } from '../gestures'
import styles from './TrackView.module.css'

const HEADER_WIDTH = 80
const RULER_HEIGHT = 24
const ROW_HEIGHT = 56
const CLIP_INSET = 6
const DEFAULT_BAR_WIDTH = 48
const MIN_BAR_WIDTH = 12
const MAX_BAR_WIDTH = 160
const LONG_PRESS_MS = 500
const FOLLOW_AT = 0.25

type Gesture =
  | { kind: 'idle' }
  | { kind: 'ignore' }
  | { kind: 'background'; pointerId: number; start: Point; ruler: boolean }
  | { kind: 'scroll'; pointerId: number; origin: Point; scrollLeft: number; scrollTop: number }
  | {
      kind: 'pending'
      pointerId: number
      start: Point
      trackId: string
      bar: number
      clipId: string | null
      timer: ReturnType<typeof setTimeout> | null
    }
  | {
      kind: 'drag'
      pointerId: number
      trackId: string
      clipId: string
      originBar: number
      clipBar: number
      length: number
    }
  | {
      kind: 'pan'
      center: Point
      distance: number
      scrollTop: number
      barWidth: number
      anchorBar: number
    }

interface Draft {
  trackId: string
  clipId: string
  bar: number
  length: number
  valid: boolean
}

interface TrackViewProps {
  song: Song
  onOpenTrack: (trackId: string) => void
  onOpenClipMenu: (trackId: string, clipId: string) => void
  onAddTrack: () => void
}

const ClipBlock = memo(function ClipBlock({
  pattern,
  left,
  top,
  barWidth,
  stepsPerBar,
  color,
  className,
}: {
  pattern: Pattern
  left: number
  top: number
  barWidth: number
  stepsPerBar: number
  color: string
  className: string
}) {
  const width = pattern.lengthBars * barWidth
  const stepWidth = barWidth / stepsPerBar
  const pitches = pattern.notes.map((n) => n.pitch)
  const low = Math.min(...pitches)
  const range = Math.max(Math.max(...pitches) - low, 1)
  const noteArea = ROW_HEIGHT - CLIP_INSET * 2 - 20
  return (
    <div
      className={className}
      style={{ left, top, width, height: ROW_HEIGHT - CLIP_INSET * 2, background: color }}
    >
      <span className={styles.clipName}>{pattern.name}</span>
      {pattern.notes.map((note) => (
        <span
          key={`${note.pitch}-${note.start}`}
          className={styles.miniNote}
          style={{
            left: note.start * stepWidth,
            width: Math.max(note.length * stepWidth - 1, 1),
            top: 14 + (1 - (note.pitch - low) / range) * noteArea,
          }}
        />
      ))}
    </div>
  )
})

export function TrackView({ song, onOpenTrack, onOpenClipMenu, onAddTrack }: TrackViewProps) {
  const commit = useStore((state) => state.commit)
  const setView = useStore((state) => state.setView)
  const cursorBar = useStore((state) => state.cursorBar)
  const setCursorBar = useStore((state) => state.setCursorBar)
  const newPatternBars = useStore((state) => state.newPatternBars)

  const viewportRef = useRef<HTMLDivElement>(null)
  const lanesRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<Gesture>({ kind: 'idle' })
  const draftRef = useRef<Draft | null>(null)
  const pendingScroll = useRef<Point | null>(null)

  const [draft, setDraftState] = useState<Draft | null>(null)
  const [barWidth, setBarWidth] = useState(DEFAULT_BAR_WIDTH)

  const stepsPerBar = STEPS_PER_BAR[song.meter]
  const canAdd = song.tracks.length < MAX_TRACKS
  const lanesWidth = MAX_BARS * barWidth
  const lanesHeight = (song.tracks.length + (canAdd ? 1 : 0)) * ROW_HEIGHT
  const anySolo = song.tracks.some((track) => track.solo)
  const labelEvery = barWidth >= 32 ? 1 : 4

  const setDraft = (next: Draft | null) => {
    draftRef.current = next
    setDraftState(next)
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (viewport && pendingScroll.current) {
      viewport.scrollLeft = pendingScroll.current.x
      viewport.scrollTop = pendingScroll.current.y
      pendingScroll.current = null
    }
  })

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        setBarWidth((width) =>
          clamp(width * Math.exp(-event.deltaY * 0.01), MIN_BAR_WIDTH, MAX_BAR_WIDTH),
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
  }, [])

  useEffect(() => {
    let frame = requestAnimationFrame(function update() {
      const playhead = playheadRef.current
      const viewport = viewportRef.current
      const position = engine.position()
      if (playhead && viewport) {
        const visible = position?.target.mode === 'song'
        playhead.style.display = visible ? 'block' : 'none'
        if (visible) {
          const x = (position.step / stepsPerBar) * barWidth
          playhead.style.transform = `translateX(${x}px)`
          const width = viewport.clientWidth - HEADER_WIDTH
          if (x < viewport.scrollLeft || x > viewport.scrollLeft + width * 0.9) {
            viewport.scrollLeft = x - width * FOLLOW_AT
          }
        }
      }
      frame = requestAnimationFrame(update)
    })
    return () => cancelAnimationFrame(frame)
  }, [barWidth, stepsPerBar])

  const localPoint = (clientX: number, clientY: number): Point => {
    const rect = lanesRef.current!.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const regionAt = (clientX: number, clientY: number): 'header' | 'ruler' | 'lanes' => {
    const rect = viewportRef.current!.getBoundingClientRect()
    if (clientX - rect.left < HEADER_WIDTH) return 'header'
    if (clientY - rect.top < RULER_HEIGHT) return 'ruler'
    return 'lanes'
  }

  const barAt = (x: number) => clamp(Math.floor(x / barWidth), 0, MAX_BARS - 1)

  const cancelLongPress = () => {
    const current = gesture.current
    if (current.kind === 'pending' && current.timer !== null) clearTimeout(current.timer)
  }

  const startPan = () => {
    const viewport = viewportRef.current
    const pair = firstTwo(pointers.current)
    if (!viewport || !pair) return
    cancelLongPress()
    const center = centerOf(...pair)
    const rect = viewport.getBoundingClientRect()
    gesture.current = {
      kind: 'pan',
      center,
      distance: distanceOf(...pair),
      scrollTop: viewport.scrollTop,
      barWidth,
      anchorBar: (viewport.scrollLeft + center.x - rect.left - HEADER_WIDTH) / barWidth,
    }
    setDraft(null)
  }

  const updatePan = (pan: Extract<Gesture, { kind: 'pan' }>) => {
    const viewport = viewportRef.current
    const pair = firstTwo(pointers.current)
    if (!viewport || !pair) return
    const center = centerOf(...pair)
    const nextWidth = clamp(
      (pan.barWidth * distanceOf(...pair)) / pan.distance,
      MIN_BAR_WIDTH,
      MAX_BAR_WIDTH,
    )
    const rect = viewport.getBoundingClientRect()
    const next = {
      x: pan.anchorBar * nextWidth - (center.x - rect.left - HEADER_WIDTH),
      y: pan.scrollTop - (center.y - pan.center.y),
    }
    if (nextWidth !== barWidth) {
      pendingScroll.current = next
      setBarWidth(nextWidth)
    } else {
      viewport.scrollLeft = next.x
      viewport.scrollTop = next.y
    }
  }

  const openPattern = (trackId: string, patternId: string) =>
    setView({ screen: 'pattern', trackId, patternId })

  const forgetPointers = () => {
    cancelLongPress()
    pointers.current.clear()
    gesture.current = { kind: 'idle' }
    if (draftRef.current) setDraft(null)
  }

  const startScroll = (pointerId: number, origin: Point) => {
    const viewport = viewportRef.current
    if (!viewport) return
    gesture.current = {
      kind: 'scroll',
      pointerId,
      origin,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    }
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.isPrimary) forgetPointers()
    const region = regionAt(event.clientX, event.clientY)
    if (region === 'header' && pointers.current.size === 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) return startPan()
    if (pointers.current.size > 2 || gesture.current.kind !== 'idle') return

    const start = { x: event.clientX, y: event.clientY }
    const local = localPoint(event.clientX, event.clientY)
    const track = song.tracks[Math.floor(local.y / ROW_HEIGHT)]
    if (region === 'ruler' || !track || local.x >= lanesWidth) {
      gesture.current = {
        kind: 'background',
        pointerId: event.pointerId,
        start,
        ruler: region === 'ruler',
      }
      return
    }
    const bar = barAt(local.x)
    const clip = clipAt(track, bar)
    const pointerId = event.pointerId
    const timer = clip
      ? setTimeout(() => {
          const current = gesture.current
          if (current.kind === 'pending' && current.pointerId === pointerId) {
            pointers.current.delete(pointerId)
            gesture.current = { kind: 'idle' }
            const viewport = viewportRef.current
            if (viewport?.hasPointerCapture(pointerId)) viewport.releasePointerCapture(pointerId)
            onOpenClipMenu(track.id, clip.id)
          }
        }, LONG_PRESS_MS)
      : null
    gesture.current = {
      kind: 'pending',
      pointerId,
      start,
      trackId: track.id,
      bar,
      clipId: clip?.id ?? null,
      timer,
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const current = gesture.current
    if (current.kind === 'pan') return updatePan(current)

    if (current.kind === 'scroll' && current.pointerId === event.pointerId) {
      const viewport = viewportRef.current
      if (!viewport) return
      viewport.scrollLeft = current.scrollLeft - (event.clientX - current.origin.x)
      viewport.scrollTop = current.scrollTop - (event.clientY - current.origin.y)
      return
    }

    if (
      (current.kind === 'pending' || current.kind === 'background') &&
      current.pointerId === event.pointerId
    ) {
      if (
        Math.hypot(event.clientX - current.start.x, event.clientY - current.start.y) <
        DRAG_THRESHOLD
      ) {
        return
      }
      cancelLongPress()
      if (current.kind === 'background') return startScroll(current.pointerId, current.start)
      const track = song.tracks.find((t) => t.id === current.trackId)
      const clip = track?.clips.find((c) => c.id === current.clipId)
      if (!track || !clip) return startScroll(current.pointerId, current.start)
      gesture.current = {
        kind: 'drag',
        pointerId: current.pointerId,
        trackId: track.id,
        clipId: clip.id,
        originBar: current.bar,
        clipBar: clip.bar,
        length: clipLength(track, clip),
      }
    }

    const drag = gesture.current
    if (drag.kind !== 'drag' || drag.pointerId !== event.pointerId) return
    const track = song.tracks.find((t) => t.id === drag.trackId)
    if (!track) return
    const bar = clamp(
      drag.clipBar + barAt(localPoint(event.clientX, event.clientY).x) - drag.originBar,
      0,
      MAX_BARS - drag.length,
    )
    setDraft({
      trackId: drag.trackId,
      clipId: drag.clipId,
      bar,
      length: drag.length,
      valid: canPlaceClip(track, bar, drag.length, drag.clipId),
    })
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return
    const current = gesture.current
    const own = 'pointerId' in current && current.pointerId === event.pointerId
    cancelLongPress()

    if (own && current.kind === 'background' && current.ruler) {
      setCursorBar(barAt(localPoint(event.clientX, event.clientY).x))
    } else if (own && current.kind === 'pending') {
      const track = song.tracks.find((t) => t.id === current.trackId)
      const clip = track?.clips.find((c) => c.id === current.clipId)
      if (track && clip) {
        openPattern(track.id, clip.patternId)
      } else if (track) {
        const created = createPatternClip(song, track.id, current.bar, newPatternBars)
        if (created) {
          commit(() => created.song)
          openPattern(track.id, created.patternId)
        }
      }
    } else if (own && current.kind === 'drag') {
      const result = draftRef.current
      if (result?.valid) commit((s) => moveClip(s, result.trackId, result.clipId, result.bar))
    }

    gesture.current = pointers.current.size === 0 ? { kind: 'idle' } : { kind: 'ignore' }
    setDraft(null)
  }

  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    cancelLongPress()
    gesture.current = pointers.current.size === 0 ? { kind: 'idle' } : { kind: 'ignore' }
    setDraft(null)
  }

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
          gridTemplateColumns: `${HEADER_WIDTH}px ${lanesWidth}px`,
          gridTemplateRows: `${RULER_HEIGHT}px ${lanesHeight}px`,
        }}
      >
        <div className={styles.corner} />
        <div className={styles.ruler}>
          {Array.from({ length: MAX_BARS / labelEvery }, (_, i) => (
            <span
              key={i}
              className={styles.barLabel}
              style={{ left: i * labelEvery * barWidth + 4 }}
            >
              {i * labelEvery + 1}
            </span>
          ))}
          <span className={styles.cursorMark} style={{ left: cursorBar * barWidth }} />
        </div>
        <div className={styles.headers}>
          {song.tracks.map((track) => (
            <div key={track.id} className={styles.header} style={{ height: ROW_HEIGHT }}>
              <button
                type="button"
                className={styles.trackName}
                style={{ color: `var(--pico-${track.color})` }}
                onClick={() => onOpenTrack(track.id)}
              >
                {track.name}
              </button>
              <div className={styles.toggles}>
                <button
                  type="button"
                  aria-pressed={track.mute}
                  className={track.mute ? `${styles.toggle} ${styles.muted}` : styles.toggle}
                  onClick={() => commit((s) => patchTrack(s, track.id, { mute: !track.mute }))}
                >
                  M
                </button>
                <button
                  type="button"
                  aria-pressed={track.solo}
                  className={track.solo ? `${styles.toggle} ${styles.soloed}` : styles.toggle}
                  onClick={() => commit((s) => patchTrack(s, track.id, { solo: !track.solo }))}
                >
                  S
                </button>
              </div>
            </div>
          ))}
          {canAdd && (
            <div className={styles.header} style={{ height: ROW_HEIGHT }}>
              <button type="button" className={styles.add} onClick={onAddTrack}>
                + TRACK
              </button>
            </div>
          )}
        </div>
        <div
          ref={lanesRef}
          className={styles.lanes}
          style={{ '--bar': `${barWidth}px`, '--row': `${ROW_HEIGHT}px` } as CSSProperties}
        >
          <div className={styles.lines} />
          {song.tracks.map((track, row) => {
            const color = `var(--pico-${track.color})`
            const audible = isTrackAudible(track, anySolo)
            return track.clips.map((clip) => {
              const pattern = patternOf(track, clip.patternId)
              if (!pattern) return null
              const dragging = draft?.clipId === clip.id
              const classes = [styles.clip]
              if (!audible) classes.push(styles.silent)
              if (dragging) classes.push(styles.draft)
              if (dragging && !draft.valid) classes.push(styles.invalid)
              return (
                <ClipBlock
                  key={clip.id}
                  pattern={pattern}
                  left={(dragging ? draft.bar : clip.bar) * barWidth}
                  top={row * ROW_HEIGHT + CLIP_INSET}
                  barWidth={barWidth}
                  stepsPerBar={stepsPerBar}
                  color={color}
                  className={classes.join(' ')}
                />
              )
            })
          })}
          <div
            className={styles.cursor}
            style={{ transform: `translateX(${cursorBar * barWidth}px)` }}
          />
          <div ref={playheadRef} className={styles.playhead} />
        </div>
      </div>
    </div>
  )
}
