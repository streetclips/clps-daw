import { describe, expect, it } from 'vitest'
import {
  cellAt,
  drawnNote,
  isOnResizeHandle,
  movedNote,
  resizedNote,
  resizeHandleWidth,
  type Cell,
} from './geometry'

const layout = { stepWidth: 20, rowHeight: 30, rows: [72, 71, 69, 67], steps: 16 }

function cell(step: number, row: number): Cell {
  return { step, row, pitch: layout.rows[row]! }
}

describe('cellAt', () => {
  it('maps a point to a step and a row pitch', () => {
    expect(cellAt(layout, 45, 65)).toEqual({ step: 2, row: 2, pitch: 69 })
  })

  it('clamps points outside the grid', () => {
    expect(cellAt(layout, 900, -5)).toEqual({ step: 15, row: 0, pitch: 72 })
  })
})

describe('resize handle', () => {
  it('is at least 10 px but never more than half the note', () => {
    expect(resizeHandleWidth(20)).toBe(10)
    expect(resizeHandleWidth(100)).toBe(35)
    expect(resizeHandleWidth(12)).toBe(6)
  })

  it('covers the right end of a note', () => {
    const note = { pitch: 72, start: 2, length: 2 }

    expect(isOnResizeHandle(note, 75, 20)).toBe(true)
    expect(isOnResizeHandle(note, 50, 20)).toBe(false)
  })
})

describe('drag results', () => {
  it('draws a note from the origin to the finger', () => {
    expect(drawnNote(cell(3, 1), cell(6, 2), 16)).toEqual({ pitch: 71, start: 3, length: 4 })
    expect(drawnNote(cell(3, 1), cell(1, 1), 16)).toEqual({ pitch: 71, start: 3, length: 1 })
  })

  it('moves a note by the drag offset and keeps it inside the pattern', () => {
    const note = { pitch: 72, start: 4, length: 4 }

    expect(movedNote(note, cell(5, 0), cell(7, 3), 16)).toEqual({ pitch: 67, start: 6, length: 4 })
    expect(movedNote(note, cell(5, 0), cell(15, 0), 16)).toEqual({
      pitch: 72,
      start: 12,
      length: 4,
    })
  })

  it('resizes a note up to the pattern end', () => {
    const note = { pitch: 72, start: 10, length: 1 }

    expect(resizedNote(note, cell(12, 0), 16).length).toBe(3)
    expect(resizedNote(note, cell(2, 0), 16).length).toBe(1)
  })
})
