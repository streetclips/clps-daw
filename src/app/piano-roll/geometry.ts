import type { Note } from '../../model/schema'

export interface Cell {
  step: number
  row: number
  pitch: number
}

export interface GridLayout {
  stepWidth: number
  rowHeight: number
  rows: readonly number[]
  steps: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function cellAt(layout: GridLayout, x: number, y: number): Cell {
  const step = clamp(Math.floor(x / layout.stepWidth), 0, layout.steps - 1)
  const row = clamp(Math.floor(y / layout.rowHeight), 0, layout.rows.length - 1)
  return { step, row, pitch: layout.rows[row]! }
}

export function resizeHandleWidth(noteWidth: number): number {
  return Math.min(Math.max(noteWidth * 0.35, 10), noteWidth / 2)
}

export function isOnResizeHandle(note: Note, x: number, stepWidth: number): boolean {
  const right = (note.start + note.length) * stepWidth
  return x >= right - resizeHandleWidth(note.length * stepWidth)
}

export function drawnNote(origin: Cell, cell: Cell, steps: number): Note {
  return {
    pitch: origin.pitch,
    start: origin.step,
    length: clamp(cell.step - origin.step + 1, 1, steps - origin.step),
  }
}

export function movedNote(note: Note, origin: Cell, cell: Cell, steps: number): Note {
  return {
    pitch: cell.pitch,
    start: clamp(note.start + cell.step - origin.step, 0, steps - note.length),
    length: note.length,
  }
}

export function resizedNote(note: Note, cell: Cell, steps: number): Note {
  return { ...note, length: clamp(cell.step - note.start + 1, 1, steps - note.start) }
}
