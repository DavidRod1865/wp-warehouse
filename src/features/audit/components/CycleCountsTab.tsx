/**
 * CycleCountsTab — Cycle count management
 *
 * List view: shows all cycle counts (location, status, date).
 * "Start Count" button: pick a location → create a draft seeded from stock.
 * CycleCountSheet: modal detail for entering physical counts per item.
 *   - Save progress (patches lines)
 *   - Finalize (confirm dialog, calls RPC which adjusts stock)
 */
import { useState } from 'react'
import { useLocations } from '../../inventory/hooks/useLocations'
import {
  useCycleCounts,
  useCycleCountLines,
  type CycleCount,
} from '../hooks/useCycleCounts'
import {
  useCreateCycleCount,
  useUpdateCountedQuantity,
  useFinalizeCycleCount,
  useCancelCycleCount,
} from '../hooks/useCycleCountMutations'
import { useToast } from '../../../components/ui/Toast'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  draft:     'badge badge-warning',
  finalized: 'badge badge-success',
  cancelled: 'badge badge-neutral',
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? 'badge badge-ghost'
  return <span className={cls}>{status}</span>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ── Start Count Modal ─────────────────────────────────────────────────────────

interface StartCountModalProps {
  onClose: () => void
  onCreated: (id: number) => void
}

function StartCountModal({ onClose, onCreated }: StartCountModalProps) {
  const { data: locations = [] } = useLocations({ activeOnly: true })
  const [locationId, setLocationId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const createCount = useCreateCycleCount()
  const { toast } = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!locationId) return
    try {
      const id = await createCount.mutateAsync({ locationId, notes: notes || undefined })
      toast('Cycle count created and seeded from stock.')
      onCreated(id)
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg mb-4">Start Cycle Count</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label"><span className="label-text">Location *</span></label>
            <select
              className="select select-bordered"
              value={locationId ?? ''}
              onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : null)}
              required
            >
              <option value="">Select location…</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.location_type})
                </option>
              ))}
            </select>
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Notes (optional)</span></label>
            <textarea
              className="textarea textarea-bordered"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!locationId || createCount.isPending}
            >
              {createCount.isPending ? <span className="loading loading-spinner loading-xs" /> : null}
              Start Count
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}

// ── Cycle Count Sheet (detail modal) ─────────────────────────────────────────

interface CycleCountSheetProps {
  count: CycleCount
  onClose: () => void
}

function CycleCountSheet({ count, onClose }: CycleCountSheetProps) {
  const { data: lines = [], isLoading } = useCycleCountLines(count.id)
  const updateQty = useUpdateCountedQuantity()
  const finalize = useFinalizeCycleCount()
  const cancelCount = useCancelCycleCount()
  const { toast } = useToast()

  // Local state for edits before saving
  const [edits, setEdits] = useState<Record<number, string>>({})
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false)

  const isDraft = count.status === 'draft'

  function handleQtyChange(lineId: number, value: string) {
    setEdits((prev) => ({ ...prev, [lineId]: value }))
  }

  async function handleSaveProgress() {
    const mutations = Object.entries(edits).map(([lineIdStr, qtyStr]) => {
      const lineId = Number(lineIdStr)
      const qty = parseInt(qtyStr, 10)
      if (isNaN(qty) || qty < 0) return null
      return updateQty.mutateAsync({ lineId, cycleCountId: count.id, quantityCounted: qty })
    }).filter(Boolean)

    try {
      await Promise.all(mutations)
      setEdits({})
      toast('Progress saved.')
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  async function handleFinalize() {
    // Save any pending edits first
    if (Object.keys(edits).length > 0) {
      await handleSaveProgress()
    }
    try {
      const result = await finalize.mutateAsync(count.id)
      toast(`Finalized. ${result.lines_adjusted} lines adjusted, ${result.lines_unchanged} unchanged.`)
      onClose()
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  async function handleCancel() {
    try {
      await cancelCount.mutateAsync(count.id)
      toast('Cycle count cancelled.')
      onClose()
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  // Compute delta for display
  function getDelta(lineId: number, systemQty: number | null) {
    const editVal = edits[lineId]
    const counted = editVal !== undefined ? parseInt(editVal, 10) :
      lines.find((l) => l.id === lineId)?.quantity_counted ?? null
    if (counted === null || isNaN(counted as number)) return null
    return (counted as number) - (systemQty ?? 0)
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-3xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-lg">
              Cycle Count — {count.location?.name ?? `Location ${count.location_id}`}
            </h3>
            <p className="text-sm text-[var(--muted)]">
              Started {formatDate(count.created_at)} · <StatusBadge status={count.status} />
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : lines.length === 0 ? (
          <p className="text-center py-8 text-[var(--muted)]">
            No items found at this location.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="table table-sm">
              <thead className="sticky top-0 bg-[var(--panel)]">
                <tr className="text-xs uppercase tracking-wider text-[var(--ink-2)]">
                  <th>Item</th>
                  <th>Part #</th>
                  <th className="text-right">System Qty</th>
                  <th className="text-right w-28">Counted Qty</th>
                  <th className="text-right">Delta</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const delta = getDelta(line.id, line.quantity_system ?? null)
                  const editVal = edits[line.id] ??
                    (line.quantity_counted !== null ? String(line.quantity_counted) : '')

                  return (
                    <tr key={line.id} className="hover:bg-[var(--panel-2)]">
                      <td className="text-sm">{line.item?.name ?? `Item ${line.item_id}`}</td>
                      <td className="font-mono text-xs text-[var(--muted)]">
                        {line.item?.part_number ?? '—'}
                      </td>
                      <td className="text-right tabular-nums text-sm">
                        {line.quantity_system ?? '—'}
                      </td>
                      <td className="text-right">
                        {isDraft ? (
                          <input
                            type="number"
                            min={0}
                            className="input input-bordered input-xs w-24 text-right"
                            value={editVal}
                            onChange={(e) => handleQtyChange(line.id, e.target.value)}
                            placeholder="—"
                          />
                        ) : (
                          <span className="tabular-nums">
                            {line.quantity_counted ?? '—'}
                          </span>
                        )}
                      </td>
                      <td className="text-right tabular-nums text-sm">
                        {delta !== null ? (
                          <span className={delta === 0 ? 'text-[var(--muted)]' : delta > 0 ? 'text-success' : 'text-error'}>
                            {delta > 0 ? '+' : ''}{delta}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Actions */}
        {isDraft && (
          <div className="flex items-center gap-2 justify-between mt-4 pt-4 border-t border-[var(--line)]">
            <button
              className="btn btn-ghost btn-sm text-error"
              onClick={handleCancel}
              disabled={cancelCount.isPending}
            >
              Cancel Count
            </button>
            <div className="flex gap-2">
              <button
                className="btn btn-outline btn-sm"
                onClick={handleSaveProgress}
                disabled={updateQty.isPending || Object.keys(edits).length === 0}
              >
                {updateQty.isPending ? <span className="loading loading-spinner loading-xs" /> : null}
                Save Progress
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowFinalizeConfirm(true)}
                disabled={finalize.isPending}
              >
                Finalize Count
              </button>
            </div>
          </div>
        )}

        {/* Finalize confirm dialog */}
        {showFinalizeConfirm && (
          <div className="mt-4 p-4 rounded-xl bg-warning/10 border border-warning/30 space-y-3">
            <p className="text-sm font-medium">
              Finalizing will adjust stock levels for all counted items. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowFinalizeConfirm(false)}
              >
                Go Back
              </button>
              <button
                className="btn btn-warning btn-sm"
                onClick={handleFinalize}
                disabled={finalize.isPending}
              >
                {finalize.isPending
                  ? <span className="loading loading-spinner loading-xs" />
                  : null}
                Yes, Finalize
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export function CycleCountsTab() {
  const { data: counts = [], isLoading } = useCycleCounts()
  const [showStartModal, setShowStartModal] = useState(false)
  const [selectedCount, setSelectedCount] = useState<CycleCount | null>(null)

  function handleCreated(id: number) {
    setShowStartModal(false)
    // Open the count sheet immediately for the new draft
    const created = counts.find((c) => c.id === id)
    if (created) setSelectedCount(created)
    // Note: the count list may not have refreshed yet, so we just close the
    // start modal — user can click into the new row once it appears.
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">
          {counts.length} cycle count{counts.length !== 1 ? 's' : ''}
        </p>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowStartModal(true)}
        >
          + Start Count
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-md text-[var(--muted)]" />
        </div>
      ) : counts.length === 0 ? (
        <div className="py-12 text-center text-[var(--muted)]">
          No cycle counts yet. Start one to audit a location.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="table table-sm w-full">
            <thead>
              <tr className="bg-[var(--panel-2)] text-[var(--ink-2)] text-xs uppercase tracking-wider">
                <th>#</th>
                <th>Location</th>
                <th>Status</th>
                <th>Date</th>
                <th>Finalized</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {counts.map((count) => (
                <tr key={count.id} className="hover:bg-[var(--panel-2)]">
                  <td className="font-mono text-xs text-[var(--muted)]">{count.id}</td>
                  <td className="font-medium">{count.location?.name ?? `#${count.location_id}`}</td>
                  <td><StatusBadge status={count.status} /></td>
                  <td className="text-sm text-[var(--ink-2)]">{formatDate(count.created_at)}</td>
                  <td className="text-sm text-[var(--muted)]">
                    {count.finalized_at ? formatDate(count.finalized_at) : '—'}
                  </td>
                  <td className="text-right">
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setSelectedCount(count)}
                    >
                      {count.status === 'draft' ? 'Enter Counts' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showStartModal && (
        <StartCountModal
          onClose={() => setShowStartModal(false)}
          onCreated={handleCreated}
        />
      )}

      {selectedCount && (
        <CycleCountSheet
          count={selectedCount}
          onClose={() => setSelectedCount(null)}
        />
      )}
    </div>
  )
}
