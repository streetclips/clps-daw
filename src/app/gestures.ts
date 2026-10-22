export interface Point {
  x: number
  y: number
}

export const DRAG_THRESHOLD = 6

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function centerOf(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function distanceOf(a: Point, b: Point): number {
  return Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1)
}

export function firstTwo(pointers: Map<number, Point>): [Point, Point] | null {
  const [a, b] = [...pointers.values()]
  return a && b ? [a, b] : null
}
