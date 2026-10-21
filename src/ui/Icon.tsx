const ICONS = {
  back: [
    '....xx..',
    '...xx...',
    '..xx....',
    '.xx.....',
    '..xx....',
    '...xx...',
    '....xx..',
    '........',
  ],
  play: [
    '.x......',
    '.xxx....',
    '.xxxxx..',
    '.xxxxxx.',
    '.xxxxx..',
    '.xxx....',
    '.x......',
    '........',
  ],
  stop: [
    '........',
    '.xxxxxx.',
    '.xxxxxx.',
    '.xxxxxx.',
    '.xxxxxx.',
    '.xxxxxx.',
    '.xxxxxx.',
    '........',
  ],
  menu: [
    '........',
    'xxxxxxxx',
    '........',
    'xxxxxxxx',
    '........',
    'xxxxxxxx',
    '........',
    '........',
  ],
} as const

export type IconName = keyof typeof ICONS

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden="true"
    >
      {ICONS[name].flatMap((row, y) =>
        [...row].map((pixel, x) =>
          pixel === 'x' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null,
        ),
      )}
    </svg>
  )
}
