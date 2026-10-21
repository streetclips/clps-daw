import { writeFileSync } from 'node:fs'
import { crc32, deflateSync } from 'node:zlib'

const SIZE = 16
const BACKGROUND = '#1D2B53'
const PEAK = '#FFF1E8'
const BARS = [
  { x: 1, height: 5, color: '#FF004D' },
  { x: 5, height: 9, color: '#FFA300' },
  { x: 9, height: 6, color: '#00E436' },
  { x: 13, height: 11, color: '#29ADFF' },
]
const BAR_WIDTH = 2
const BOTTOM = 13

function pixelMap() {
  const map = Array.from({ length: SIZE }, () => Array(SIZE).fill(BACKGROUND))
  for (const { x, height, color } of BARS) {
    for (let dx = 0; dx < BAR_WIDTH; dx++) {
      for (let y = BOTTOM - height + 1; y <= BOTTOM; y++) map[y][x + dx] = color
      map[BOTTOM - height - 1][x + dx] = PEAK
    }
  }
  return map
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function png(size, scale, padding) {
  const map = pixelMap()
  const rows = []
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 3)
    for (let px = 0; px < size; px++) {
      const x = Math.floor((px - padding) / scale)
      const y = Math.floor((py - padding) / scale)
      const inside = x >= 0 && y >= 0 && x < SIZE && y < SIZE
      const [r, g, b] = hexToRgb(inside ? map[y][x] : BACKGROUND)
      row.set([r, g, b], 1 + px * 3)
    }
    rows.push(row)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function svg() {
  const map = pixelMap()
  const rects = []
  map.forEach((row, y) =>
    row.forEach((color, x) => {
      if (color !== BACKGROUND)
        rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`)
    }),
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" shape-rendering="crispEdges"><rect width="${SIZE}" height="${SIZE}" fill="${BACKGROUND}"/>${rects.join('')}</svg>\n`
}

const outputs = [
  { file: 'pwa-192x192.png', size: 192, scale: 12, padding: 0 },
  { file: 'pwa-512x512.png', size: 512, scale: 32, padding: 0 },
  { file: 'maskable-icon-512x512.png', size: 512, scale: 20, padding: 96 },
  { file: 'apple-touch-icon-180x180.png', size: 180, scale: 10, padding: 10 },
]

for (const { file, size, scale, padding } of outputs) {
  writeFileSync(new URL(`../public/${file}`, import.meta.url), png(size, scale, padding))
}
writeFileSync(new URL('../public/icon.svg', import.meta.url), svg())
console.log(`Generated ${outputs.length + 1} icons in public/`)
