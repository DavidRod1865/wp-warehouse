/**
 * DriverTimeline — Gantt-like schedule strip for today's deliveries.
 *
 * Groups deliveries by driver (+ unassigned), maps each to a
 * time slot block with status-based color. Shows a "now" marker.
 * All data from useDeliveries — no hardcoded rows.
 */
import type { Delivery } from '../../features/deliveries/types'

interface TimelineProps {
  deliveries: Delivery[]
  drivers: { id: string; name: string }[]
}

const START_H = 7
const END_H = 19
const SPAN = END_H - START_H
const HOURS = Array.from({ length: END_H - START_H + 1 }, (_, i) => START_H + i)

function toPct(h: number) {
  return ((h - START_H) / SPAN) * 100
}

function fmtHour(h: number) {
  return `${h > 12 ? h - 12 : h}${h < 12 ? 'a' : 'p'}`
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const statusColors: Record<string, string> = {
  delivered: 'var(--ok)',
  in_transit: 'var(--signal)',
  pending: 'var(--muted)',
  draft: 'var(--ink-2)',
  cancelled: 'var(--faint)',
}

export function DriverTimeline({ deliveries, drivers }: TimelineProps) {
  const now = new Date()
  const nowH = now.getHours() + now.getMinutes() / 60

  // Build rows: group deliveries by driver
  const driverMap = new Map<string, { name: string; runs: Delivery[] }>()
  for (const d of drivers) {
    driverMap.set(d.id, { name: d.name, runs: [] })
  }
  // Add unassigned bucket
  driverMap.set('unassigned', { name: 'Unassigned', runs: [] })

  for (const del of deliveries) {
    const driverId = del.driver_id || 'unassigned'
    const bucket = driverMap.get(driverId)
    if (bucket) {
      bucket.runs.push(del)
    } else {
      // Driver not in list — create entry
      driverMap.set(driverId, { name: 'Unknown', runs: [del] })
    }
  }

  // Remove empty rows
  const rows = Array.from(driverMap.entries()).filter(([, v]) => v.runs.length > 0)

  // Derive time slot for each delivery (use started_at or created_at)
  function getSlot(del: Delivery) {
    const date = del.started_at || del.created_at
    const dt = new Date(date)
    const h = dt.getHours() + dt.getMinutes() / 60
    return { h, dur: 1.0 } // Default 1hr duration since we don't track end time
  }

  const totalRuns = deliveries.length
  const activeDrivers = rows.filter(([k]) => k !== 'unassigned').length

  if (rows.length === 0) {
    return (
      <div
        className="border border-[var(--line)] rounded-xl bg-[var(--panel)]"
        style={{ padding: '16px 20px 18px', marginBottom: 18 }}
      >
        <div
          className="font-medium text-[var(--ink)]"
          style={{ fontFamily: 'var(--serif)', fontSize: 15 }}
        >
          Today &middot; driver schedule
        </div>
        <div
          className="text-[var(--muted)] mt-1"
          style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
        >
          No deliveries scheduled for today
        </div>
      </div>
    )
  }

  return (
    <div
      className="border border-[var(--line)] rounded-xl bg-[var(--panel)]"
      style={{ padding: '16px 20px 18px', marginBottom: 18 }}
    >
      {/* Header */}
      <div className="flex items-center mb-3">
        <div>
          <div
            className="font-medium text-[var(--ink)]"
            style={{ fontFamily: 'var(--serif)', fontSize: 15 }}
          >
            Today &middot; driver schedule
          </div>
          <div
            className="text-[var(--muted)] mt-0.5"
            style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
          >
            {totalRuns} run{totalRuns !== 1 ? 's' : ''} &middot; {activeDrivers} driver
            {activeDrivers !== 1 ? 's' : ''} on shift
          </div>
        </div>

        {/* Legend */}
        <div className="ml-auto flex items-center gap-3" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          {[
            { color: 'var(--ok)', label: 'done' },
            { color: 'var(--signal)', label: 'en route' },
            { color: 'var(--danger)', label: 'late' },
            { color: 'var(--ink-2)', label: 'scheduled', opacity: 0.35 },
          ].map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span
                className="w-[9px] h-[9px] rounded-sm"
                style={{ background: l.color, opacity: l.opacity ?? 1 }}
              />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Hour ruler */}
      <div className="relative h-5 border-b border-[var(--line)]" style={{ marginLeft: 110 }}>
        {HOURS.map((h) => (
          <div
            key={h}
            className="absolute top-0 bottom-0 border-l border-[var(--line)]"
            style={{ left: `${toPct(h)}%`, opacity: 0.5 }}
          >
            <span
              className="absolute text-[var(--muted)]"
              style={{
                left: 4,
                top: 2,
                fontFamily: 'var(--mono)',
                fontSize: 10,
              }}
            >
              {fmtHour(h)}
            </span>
          </div>
        ))}
      </div>

      {/* Driver rows */}
      {rows.map(([driverId, { name, runs }]) => (
        <div key={driverId} className="relative h-[34px] flex items-center">
          {/* Driver label */}
          <div className="w-[110px] pr-3 flex items-center gap-2 shrink-0">
            <span
              className="w-[22px] h-[22px] rounded-full text-white grid place-items-center font-semibold"
              style={{
                fontSize: 9,
                background:
                  driverId === 'unassigned'
                    ? 'var(--muted)'
                    : 'linear-gradient(135deg, #4a5578, #1a2338)',
              }}
            >
              {driverId === 'unassigned' ? '?' : getInitials(name)}
            </span>
            <div className="text-xs font-medium truncate">{name}</div>
          </div>

          {/* Timeline */}
          <div className="flex-1 relative h-full">
            {/* Gridlines */}
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute top-0 bottom-0 border-l border-[var(--line)]"
                style={{ left: `${toPct(h)}%`, opacity: 0.35 }}
              />
            ))}

            {/* Now marker */}
            {nowH >= START_H && nowH <= END_H && (
              <div
                className="absolute border-l-2 border-[var(--signal)]"
                style={{ left: `${toPct(nowH)}%`, top: -6, bottom: -6, pointerEvents: 'none' }}
              />
            )}

            {/* Delivery blocks */}
            {runs.map((del) => {
              const slot = getSlot(del)
              const left = toPct(slot.h)
              const width = (slot.dur / SPAN) * 100
              const color = statusColors[del.status] || 'var(--ink-2)'
              const isDone = del.status === 'delivered'
              const isScheduled = del.status === 'draft' || del.status === 'pending'

              return (
                <div
                  key={del.id}
                  className="absolute flex items-center px-1.5 overflow-hidden whitespace-nowrap text-ellipsis"
                  style={{
                    left: `${Math.max(0, left)}%`,
                    width: `${Math.max(2, width)}%`,
                    top: 6,
                    bottom: 6,
                    background: color,
                    opacity: isScheduled ? 0.35 : isDone ? 0.8 : 1,
                    borderRadius: 4,
                    color: isScheduled ? 'var(--ink-2)' : '#fff',
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                  title={`${del.delivery_number} — ${del.projects?.name || del.to_address?.company_name || 'Delivery'}`}
                >
                  {del.projects?.name || del.delivery_number}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
