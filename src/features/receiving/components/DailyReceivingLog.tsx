/**
 * DailyReceivingLog (Phase 4) — Audit log for a single day's receiving activity
 *
 * Shows location names (not Sortly folder names) for Phase 4+ rows.
 * Gracefully falls back to legacy destination_folder_name for old rows.
 * PDF export updated to use location names.
 *
 * No Sortly imports.
 */
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDailyReceivingLog, useDatesWithEntries } from '../hooks/useDailyReceivingLog'
import { useLocations } from '../../inventory/hooks/useLocations'
import { Icon } from '../../../components/ui/Icon'
import { generateReceivingLogPDF } from '../utils/generateReceivingLogPDF'
import { ACTION_STYLES } from '../utils/actionStyles'
import type { ReceivingEntryWithItems, ReceivingItem } from '../types'

function formatLongDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const TODAY = () => new Date().toISOString().split('T')[0]

export function DailyReceivingLog() {
  const [date, setDate] = useState<string>(TODAY())

  const { data: log, isLoading } = useDailyReceivingLog(date)
  const { data: datesWithEntries = [] } = useDatesWithEntries()

  // Load all locations so we can look up location names for Phase 4+ rows
  const { data: allLocations = [] } = useLocations()
  const locationNameMap = useMemo(
    () => new Map(allLocations.map((l) => [l.id, l.name])),
    [allLocations]
  )

  const entries = useMemo<ReceivingEntryWithItems[]>(
    () => log?.entries ?? [],
    [log]
  )

  const stats = useMemo(() => {
    let unitsReceived = 0
    let lineItemsActive = 0
    let lineItemsSkipped = 0
    let updated = 0
    let created = 0
    const vendors = new Set<string>()
    const destinations = new Set<string>()

    for (const entry of entries) {
      vendors.add(entry.vendor)
      for (const item of entry.items) {
        if (item.action === 'skip') {
          lineItemsSkipped += 1
          continue
        }
        lineItemsActive += 1
        unitsReceived += item.quantity_received
        if (item.action === 'update') updated += 1
        if (item.action === 'create') created += 1
        // Phase 4+: use location name; legacy: use destination_folder_name
        const dest = item.destination_location_id
          ? locationNameMap.get(item.destination_location_id)
          : item.destination_folder_name
        if (dest) destinations.add(dest)
      }
    }

    return {
      unitsReceived,
      lineItemsActive,
      lineItemsSkipped,
      updated,
      created,
      vendorCount: vendors.size,
      destinationCount: destinations.size,
      entryCount: entries.length,
    }
  }, [entries, locationNameMap])

  const handlePrint = () => {
    if (log) generateReceivingLogPDF(log, locationNameMap)
  }

  const isToday = date === TODAY()

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div
            className="text-[var(--muted)] uppercase"
            style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.06em' }}
          >
            Daily log {isToday && <span style={{ color: 'var(--signal)' }}>· Today</span>}
          </div>
          <h2
            className="text-[var(--ink)] mt-0.5"
            style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.3px' }}
          >
            {formatLongDate(date)}
          </h2>
          <div className="text-[var(--muted)] mt-0.5" style={{ fontSize: 13 }}>
            {stats.entryCount === 0
              ? 'No receipts logged for this day.'
              : `${stats.entryCount} receipt${stats.entryCount !== 1 ? 's' : ''} from ${stats.vendorCount} vendor${stats.vendorCount !== 1 ? 's' : ''}.`}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DateNavigator date={date} datesWithEntries={datesWithEntries} onChange={setDate} />
          <button
            onClick={handlePrint}
            disabled={stats.entryCount === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-[var(--on-signal)] disabled:opacity-40 transition-opacity"
            style={{ background: 'var(--signal)' }}
          >
            <Icon name="download" className="w-3.5 h-3.5" />
            Download PDF
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--line)]" style={{ background: 'var(--panel-2)' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Units received" value={isLoading ? '—' : stats.unitsReceived.toLocaleString()} accent />
            <Stat
              label="Line items"
              value={isLoading ? '—' : stats.lineItemsActive.toLocaleString()}
              subtext={stats.lineItemsSkipped > 0 ? `${stats.lineItemsSkipped} skipped` : undefined}
            />
            <Stat
              label="Vendors"
              value={isLoading ? '—' : stats.vendorCount.toLocaleString()}
              subtext={`${stats.destinationCount} destination${stats.destinationCount !== 1 ? 's' : ''}`}
            />
            <Stat
              label="Inventory impact"
              value={isLoading ? '—' : `${stats.updated} updated · ${stats.created} created`}
              small
            />
          </div>
        </div>

        <div className="px-5 py-3 border-b border-[var(--line)] flex items-center justify-between">
          <div className="font-medium text-[var(--ink)]" style={{ fontSize: 13, letterSpacing: '-0.1px' }}>
            Entries
          </div>
          {stats.entryCount > 0 && (
            <span className="text-[var(--muted)]" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
              {stats.entryCount} total
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState />
        ) : (
          <EntriesTable entries={entries} locationNameMap={locationNameMap} />
        )}
      </div>
    </div>
  )
}

// ── Date navigator ──────────────────────────────────────────────────────────────

function DateNavigator({
  date,
  datesWithEntries,
  onChange,
}: {
  date: string
  datesWithEntries: string[]
  onChange: (d: string) => void
}) {
  const sorted = useMemo(() => [...datesWithEntries].sort(), [datesWithEntries])
  const prevWithEntries = useMemo(
    () => [...sorted].reverse().find((d) => d < date),
    [sorted, date]
  )
  const nextWithEntries = useMemo(() => sorted.find((d) => d > date), [sorted, date])

  return (
    <div className="flex items-center rounded-lg border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
      <button
        onClick={() => onChange(prevWithEntries ?? shiftDate(date, -1))}
        title={prevWithEntries ? `Previous day with entries: ${prevWithEntries}` : 'Previous day'}
        className="px-2.5 py-2 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
      >
        <Icon name="chevron-left" className="w-3.5 h-3.5" />
      </button>
      <input
        type="date"
        value={date}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-2 text-sm bg-transparent border-x border-[var(--line)] outline-none text-[var(--ink-2)]"
        style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
      />
      <button
        onClick={() => onChange(nextWithEntries ?? shiftDate(date, 1))}
        title={nextWithEntries ? `Next day with entries: ${nextWithEntries}` : 'Next day'}
        className="px-2.5 py-2 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
      >
        <Icon name="chevron-right" className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── Stat ──────────────────────────────────────────────────────────────────────

function Stat({
  label, value, subtext, accent, small,
}: {
  label: string; value: string; subtext?: string; accent?: boolean; small?: boolean
}) {
  return (
    <div>
      <div
        className="text-[var(--muted)]"
        style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase' }}
      >
        {label}
      </div>
      <div
        className="mt-1"
        style={{
          fontFamily: 'var(--serif)',
          fontSize: small ? 16 : 24,
          fontWeight: 500,
          letterSpacing: '-0.3px',
          color: accent ? 'var(--signal)' : 'var(--ink)',
          lineHeight: 1.15,
        }}
      >
        {value}
      </div>
      {subtext && (
        <div className="text-[var(--muted)] mt-0.5" style={{ fontSize: 11.5 }}>
          {subtext}
        </div>
      )}
    </div>
  )
}

// ── Entries table ──────────────────────────────────────────────────────────────

function EntriesTable({
  entries,
  locationNameMap,
}: {
  entries: ReceivingEntryWithItems[]
  locationNameMap: Map<number, string>
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr
            className="border-b border-[var(--line)] text-[var(--muted)]"
            style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase' }}
          >
            <th className="text-left font-medium px-5 py-2.5" style={{ width: 90 }}>Time</th>
            <th className="text-left font-medium px-3 py-2.5">Vendor</th>
            <th className="text-left font-medium px-3 py-2.5">PO</th>
            <th className="text-left font-medium px-3 py-2.5">Destination</th>
            <th className="text-right font-medium px-3 py-2.5" style={{ width: 90 }}>Items</th>
            <th className="text-right font-medium px-3 py-2.5" style={{ width: 90 }}>Units</th>
            <th className="text-left font-medium px-5 py-2.5" style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              locationNameMap={locationNameMap}
              isExpanded={expanded.has(entry.id)}
              onToggle={() => toggle(entry.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EntryRow({
  entry,
  locationNameMap,
  isExpanded,
  onToggle,
}: {
  entry: ReceivingEntryWithItems
  locationNameMap: Map<number, string>
  isExpanded: boolean
  onToggle: () => void
}) {
  const time = new Date(entry.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })

  const activeItems = entry.items.filter((i) => i.action !== 'skip')
  const units = activeItems.reduce((sum, i) => sum + i.quantity_received, 0)

  // Phase 4+: show location name; legacy: fall back to project_name / destination_type
  const destination =
    (entry.destination_location_id ? locationNameMap.get(entry.destination_location_id) : null) ??
    entry.project_name ??
    (entry.destination_type === 'warehouse' ? 'Main Warehouse' : '—')

  return (
    <>
      <tr
        className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--panel-2)] transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-5 py-3 text-[var(--muted)]" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
          {time}
        </td>
        <td className="px-3 py-3">
          <div className="font-medium text-[var(--ink)]">{entry.vendor}</div>
        </td>
        <td className="px-3 py-3" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)' }}>
          {entry.po_number || '—'}
        </td>
        <td className="px-3 py-3 text-[var(--ink-2)] text-sm">{destination}</td>
        <td className="px-3 py-3 text-right" style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
          {activeItems.length}
        </td>
        <td className="px-3 py-3 text-right font-medium" style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--signal)' }}>
          {units}
        </td>
        <td className="px-5 py-3 text-right text-[var(--muted)]">
          <Icon
            name="chevron-right"
            className="w-3.5 h-3.5 inline-block transition-transform"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
        </td>
      </tr>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.tr
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <td colSpan={7} className="px-5 py-0" style={{ background: 'var(--panel-2)' }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <ExpandedItems entry={entry} locationNameMap={locationNameMap} />
              </motion.div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  )
}

function ExpandedItems({
  entry,
  locationNameMap,
}: {
  entry: ReceivingEntryWithItems
  locationNameMap: Map<number, string>
}) {
  if (entry.items.length === 0) {
    return (
      <div className="py-3 text-sm text-[var(--muted)]">
        No line items recorded for this receipt.
      </div>
    )
  }

  return (
    <div className="py-3 pb-4">
      <table className="w-full text-xs">
        <thead>
          <tr
            className="text-[var(--muted)]"
            style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase' }}
          >
            <th className="text-left font-medium py-1.5 pr-3">Item</th>
            <th className="text-left font-medium py-1.5 px-2">Part #</th>
            <th className="text-left font-medium py-1.5 px-2">Destination</th>
            <th className="text-left font-medium py-1.5 px-2">Action</th>
            <th className="text-right font-medium py-1.5 pl-2">Received</th>
          </tr>
        </thead>
        <tbody>
          {entry.items.map((item) => (
            <ItemRow key={item.id} item={item} locationNameMap={locationNameMap} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ItemRow({
  item,
  locationNameMap,
}: {
  item: ReceivingItem
  locationNameMap: Map<number, string>
}) {
  const badge = ACTION_STYLES[item.action] ?? ACTION_STYLES.pending

  // Phase 4+: prefer location name; legacy: fall back to destination_folder_name
  const destinationName =
    (item.destination_location_id ? locationNameMap.get(item.destination_location_id) : null) ??
    item.destination_folder_name ??
    '—'

  return (
    <tr className="border-t border-[var(--line)]">
      <td className="py-2 pr-3 text-[var(--ink)] font-medium">{item.item_name}</td>
      <td className="py-2 px-2 text-[var(--muted)]" style={{ fontFamily: 'var(--mono)' }}>
        {item.part_number || '—'}
      </td>
      <td className="py-2 px-2 text-[var(--muted)] text-xs">{destinationName}</td>
      <td className="py-2 px-2">
        <span
          className="px-1.5 py-0.5 rounded-full font-medium"
          style={{ fontSize: 10, color: badge.color, background: badge.bg }}
        >
          {badge.label}
        </span>
      </td>
      <td
        className="py-2 pl-2 text-right font-medium"
        style={{ fontFamily: 'var(--mono)', color: 'var(--signal)' }}
      >
        +{item.quantity_received}
      </td>
    </tr>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="px-5 py-10">
      <div className="text-center mb-6">
        <p className="text-base font-medium text-[var(--ink-2)]">No receipts logged for this day</p>
        <p className="text-sm mt-1 text-[var(--muted)]">
          Use the navigator above to find a day with activity, or log a new receipt at the top of the page.
        </p>
      </div>
      <div className="mx-auto max-w-[640px] space-y-2" style={{ opacity: 0.35 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 rounded-lg"
            style={{ border: '1px dashed var(--line-2)', background: 'var(--panel)' }}
          >
            <div className="w-12 h-3 rounded" style={{ background: 'var(--line)' }} />
            <div className="flex-1 h-3 rounded" style={{ background: 'var(--line)', maxWidth: 180 }} />
            <div className="w-16 h-3 rounded" style={{ background: 'var(--line)' }} />
            <div className="w-12 h-3 rounded" style={{ background: 'var(--line)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
