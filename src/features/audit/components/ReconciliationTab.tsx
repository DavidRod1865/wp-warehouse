/**
 * ReconciliationTab — PO vs. delivery reconciliation per project
 *
 * Shows a project selector then a table of po_line_items with quantities
 * ordered / received / delivered-to-site / on-hand / on-truck and a derived
 * reconciliation state badge.
 */
import { useState, useMemo } from 'react'
import { ProjectSelector } from '../../projects/components/ProjectSelector'
import { useReconciliation } from '../hooks/useReconciliation'
import type { ReconciliationRow } from '../hooks/useReconciliation'

type ReconState = ReconciliationRow['reconciliation_state']

const STATE_BADGE: Record<ReconState, { label: string; cls: string }> = {
  backorder:     { label: 'Backorder',     cls: 'badge badge-warning' },
  complete:      { label: 'Complete',      cls: 'badge badge-success' },
  in_warehouse:  { label: 'In Warehouse',  cls: 'badge badge-neutral' },
  in_transit:    { label: 'In Transit',    cls: 'badge badge-info' },
  over_delivered:{ label: 'Over-Delivered',cls: 'badge badge-error' },
}

function StatePill({ state }: { state: ReconState }) {
  const cfg = STATE_BADGE[state] ?? { label: state, cls: 'badge badge-ghost' }
  return <span className={cfg.cls}>{cfg.label}</span>
}

export function ReconciliationTab() {
  const [projectId, setProjectId] = useState<number | null>(null)
  const { data: rows = [], isLoading } = useReconciliation(projectId)

  // Summary counts per reconciliation_state
  const summary = useMemo(() => {
    const counts: Record<string, number> = {
      backorder: 0,
      complete: 0,
      in_warehouse: 0,
      in_transit: 0,
      over_delivered: 0,
    }
    for (const row of rows) {
      counts[row.reconciliation_state] = (counts[row.reconciliation_state] ?? 0) + 1
    }
    return counts
  }, [rows])

  return (
    <div className="space-y-5">
      {/* Project filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-[var(--ink-2)] shrink-0">Project</label>
        <ProjectSelector
          value={projectId}
          onChange={setProjectId}
          className="select select-bordered select-sm max-w-xs"
        />
        {projectId && (
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => setProjectId(null)}
          >
            Clear
          </button>
        )}
      </div>

      {/* Summary strip */}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(summary).map(([state, count]) => {
            if (count === 0) return null
            const cfg = STATE_BADGE[state as ReconState] ?? { label: state, cls: 'badge badge-ghost' }
            return (
              <span key={state} className={`${cfg.cls} gap-1.5`}>
                {count} {cfg.label}
              </span>
            )
          })}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-md text-[var(--muted)]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-[var(--muted)]">
          {projectId ? 'No PO lines found for this project.' : 'Select a project to view reconciliation data.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="table table-sm w-full">
            <thead>
              <tr className="bg-[var(--panel-2)] text-[var(--ink-2)] text-xs uppercase tracking-wider">
                <th>PO #</th>
                <th>Vendor</th>
                <th>Line</th>
                <th>Description</th>
                <th>Part #</th>
                <th className="text-right">Ordered</th>
                <th className="text-right">Received</th>
                <th className="text-right">Delivered</th>
                <th className="text-right">On Hand</th>
                <th className="text-right">On Truck</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.po_line_item_id} className="hover:bg-[var(--panel-2)]">
                  <td className="font-mono text-xs">{row.po_number}</td>
                  <td className="text-sm text-[var(--ink-2)]">{row.vendor_name ?? '—'}</td>
                  <td className="text-center text-xs text-[var(--muted)]">{row.line_number}</td>
                  <td className="max-w-[200px] truncate text-sm">{row.description}</td>
                  <td className="font-mono text-xs text-[var(--muted)]">{row.part_number ?? '—'}</td>
                  <td className="text-right tabular-nums">{row.quantity_ordered}</td>
                  <td className="text-right tabular-nums">{row.quantity_received}</td>
                  <td className="text-right tabular-nums">{row.qty_delivered_to_site}</td>
                  <td className="text-right tabular-nums">{row.qty_on_hand_warehouse}</td>
                  <td className="text-right tabular-nums">{row.qty_on_truck}</td>
                  <td>
                    <StatePill state={row.reconciliation_state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
