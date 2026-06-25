/**
 * StatCard — Dashboard stat card with large number, sparkline, and subtitle.
 */
import type { ReactNode } from 'react'
import { SparkLine } from './SparkLine'

interface StatCardProps {
  label: string
  value: number | string
  unit?: string
  subtitle?: ReactNode
  sparkData?: number[]
  sparkColor?: string
  dotColor?: string
  pill?: string
  hot?: boolean
  loading?: boolean
  onClick?: () => void
  active?: boolean
}

export function StatCard({
  label,
  value,
  unit,
  subtitle,
  sparkData,
  sparkColor = 'var(--signal)',
  dotColor = 'var(--signal)',
  pill,
  hot = false,
  loading = false,
  onClick,
  active = false,
}: StatCardProps) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-[var(--radius)] border border-[var(--line)]
        bg-[var(--panel)] p-[18px] shadow-[var(--shadow-sm)]
        ${onClick ? 'cursor-pointer hover:shadow-[var(--shadow)] transition-shadow' : ''}
        ${active ? 'ring-2 ring-[var(--signal)]' : ''}
      `}
      onClick={onClick}
    >
      {/* Label */}
      <div className="flex items-center gap-2 text-xs text-[var(--muted)] font-medium">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: dotColor }}
        />
        {label}
      </div>

      {/* Sparkline (top-right) */}
      {sparkData && sparkData.length > 0 && (
        <div className="absolute right-3.5 top-[18px]">
          <SparkLine data={sparkData} color={sparkColor} />
        </div>
      )}

      {/* Value */}
      <div className="flex items-baseline gap-2.5 mt-2">
        {loading ? (
          <div className="w-12 h-9 bg-[var(--panel-2)] rounded animate-pulse" />
        ) : (
          <div
            className={`font-[var(--serif)] text-[38px] font-medium tracking-tight leading-none ${
              hot ? 'text-[var(--warn)]' : 'text-[var(--ink)]'
            }`}
            style={{ fontFamily: 'var(--serif)' }}
          >
            {value}
          </div>
        )}
        {unit && (
          <div
            className="text-[11px] text-[var(--muted)]"
            style={{ fontFamily: 'var(--mono)' }}
          >
            {unit}
          </div>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div className="mt-1.5 text-[12.5px] text-[var(--muted)] leading-snug">
          {subtitle}
        </div>
      )}

      {/* Pill */}
      {pill && (
        <div className="mt-2.5">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--panel-2)] text-[var(--muted)]"
            style={{ fontFamily: 'var(--mono)', fontSize: '10px' }}
          >
            {pill}
          </span>
        </div>
      )}
    </div>
  )
}
