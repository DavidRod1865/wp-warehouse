/**
 * SparkLine — Mini SVG line chart for stat cards and tables.
 */
interface SparkLineProps {
  data: number[]
  color?: string
  width?: number
  height?: number
  className?: string
}

export function SparkLine({
  data,
  color = 'var(--signal)',
  width = 64,
  height = 22,
  className,
}: SparkLineProps) {
  if (!data.length) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const lastY = height - ((data[data.length - 1] - min) / range) * height

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ overflow: 'visible' }}
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={width} cy={lastY} r="2" fill={color} />
    </svg>
  )
}
