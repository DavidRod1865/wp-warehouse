/**
 * ReceiptReview — Step 3 of the receiving workflow (Phase 4)
 *
 * Summary includes:
 *  - Destination location (not Sortly folder)
 *  - PO progress preview (if PO linked)
 *  - Per-item: PO line ordered/received-after-this, action badge
 *
 * Confirm → confirm_receipt RPC (atomic: stock + PO + ledger).
 */
import { useState } from 'react'
import { Icon } from '../../../components/ui/Icon'
import { useConfirmReceipt } from '../hooks/useReceivingMutations'
import { ACTION_STYLES } from '../utils/actionStyles'
import type { ReceivingLineItem, ConfirmReceiptParams } from '../types'

interface ReceiptReviewProps {
  vendor: string
  vendorId: number | null
  poId: number | null
  poNumber: string
  dateReceived: string
  destinationLocationId: number | null
  destinationLocationName: string | null
  projectId: number | null
  projectName: string | null
  notes: string
  items: ReceivingLineItem[]
  onBack: () => void
  onConfirmed: () => void
}

export function ReceiptReview({
  vendor,
  vendorId,
  poId,
  poNumber,
  dateReceived,
  destinationLocationId,
  destinationLocationName,
  projectId,
  projectName,
  notes,
  items,
  onBack,
  onConfirmed,
}: ReceiptReviewProps) {
  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const confirmMutation = useConfirmReceipt(setProgressMsg)

  const activeItems = items.filter((i) => i.action !== 'skip' && i.action !== 'pending')
  const updateItems = activeItems.filter((i) => i.action === 'update')
  const createItems = activeItems.filter((i) => i.action === 'create')
  const skippedItems = items.filter((i) => i.action === 'skip')
  const pendingItems = items.filter((i) => i.action === 'pending')

  // PO progress summary
  const poLinkedItems = activeItems.filter((i) => i.po_line_suggestion != null)
  const poTotalOrdered = poLinkedItems.reduce((s, i) => s + (i.po_line_suggestion?.quantity_ordered ?? 0), 0)
  const poTotalAlreadyReceived = poLinkedItems.reduce((s, i) => s + (i.po_line_suggestion?.quantity_already_received ?? 0), 0)
  const poTotalAfterThis = poTotalAlreadyReceived + poLinkedItems.reduce((s, i) => s + i.quantity_received, 0)

  const handleConfirm = async () => {
    if (!destinationLocationId) return

    const params: ConfirmReceiptParams = {
      vendor,
      vendor_id: vendorId,
      po_id: poId,
      po_number: poNumber || null,
      date_received: dateReceived,
      destination_type: projectId ? 'project' : 'warehouse',
      destination_location_id: destinationLocationId,
      project_name: projectName,
      project_id: projectId,
      notes: notes || null,
      items: activeItems,
    }

    try {
      await confirmMutation.mutateAsync(params)
      onConfirmed()
    } catch {
      // Error displayed via mutation state
    }
  }

  const isProcessing = confirmMutation.isPending
  const canConfirm = !isProcessing && activeItems.length > 0 && !!destinationLocationId

  return (
    <div className="space-y-5">
      {/* Header summary */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <SummaryField label="Vendor" value={vendor} />
          {poNumber && <SummaryField label="PO Number" value={poNumber} />}
          <SummaryField
            label="Date Received"
            value={new Date(dateReceived + 'T00:00').toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          />
          <SummaryField
            label="Destination"
            value={destinationLocationName ?? '—'}
          />
          {projectName && <SummaryField label="Project" value={projectName} />}
        </div>
      </div>

      {/* PO progress preview (only when PO linked) */}
      {poId && poLinkedItems.length > 0 && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <div
            className="text-[var(--muted)] mb-3"
            style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase' }}
          >
            PO Progress after this receipt
          </div>
          <div className="flex items-center gap-4">
            <div>
              <span
                className="text-2xl font-medium"
                style={{ fontFamily: 'var(--serif)', color: 'var(--ink)' }}
              >
                {poTotalAfterThis}
              </span>
              <span className="text-sm text-[var(--muted)] ml-1">/ {poTotalOrdered} ordered</span>
            </div>
            {poTotalAfterThis > poTotalOrdered && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded"
                style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
              >
                OVER by {poTotalAfterThis - poTotalOrdered}
              </span>
            )}
            {poTotalAfterThis === poTotalOrdered && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded"
                style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}
              >
                PO will be fully received
              </span>
            )}
          </div>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (poTotalAfterThis / Math.max(poTotalOrdered, 1)) * 100)}%`,
                background: poTotalAfterThis > poTotalOrdered ? 'var(--warn)' : 'var(--ok)',
              }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-3 flex-wrap">
        <StatBadge count={updateItems.length} label="Update" color={ACTION_STYLES.update.color} bg={ACTION_STYLES.update.bg} />
        <StatBadge count={createItems.length} label="Create" color={ACTION_STYLES.create.color} bg={ACTION_STYLES.create.bg} />
        {skippedItems.length > 0 && (
          <StatBadge count={skippedItems.length} label="Skipped" color={ACTION_STYLES.skip.color} bg={ACTION_STYLES.skip.bg} />
        )}
        {pendingItems.length > 0 && (
          <StatBadge count={pendingItems.length} label="Unlinked" color={ACTION_STYLES.pending.color} bg={ACTION_STYLES.pending.bg} />
        )}
      </div>

      {/* Warnings */}
      {pendingItems.length > 0 && (
        <div
          className="flex items-start gap-2 px-4 py-3 rounded-lg text-sm"
          style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
        >
          <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <b>{pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''}</b> not linked —
            go back to link them or they will not be received.
          </div>
        </div>
      )}

      {!destinationLocationId && (
        <div
          className="flex items-start gap-2 px-4 py-3 rounded-lg text-sm"
          style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
        >
          <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" />
          No destination location selected — go back to Step 1 and choose one.
        </div>
      )}

      {/* Items table */}
      <div className="rounded-xl border border-[var(--line)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b border-[var(--line)] text-[var(--muted)]"
                style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase' }}
              >
                <th className="text-left font-medium px-4 py-2.5">Item</th>
                <th className="text-left font-medium px-3 py-2.5">Part #</th>
                <th className="text-left font-medium px-3 py-2.5">Action</th>
                <th className="text-right font-medium px-3 py-2.5" style={{ width: 70 }}>Received</th>
                <th className="text-left font-medium px-3 py-2.5">PO Progress</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const badge = ACTION_STYLES[item.action]
                const poLine = item.po_line_suggestion
                const afterThis = poLine
                  ? poLine.quantity_already_received + item.quantity_received
                  : null

                return (
                  <tr
                    key={item.tempId}
                    className="border-b border-[var(--line)] last:border-0"
                    style={{ opacity: item.action === 'skip' || item.action === 'pending' ? 0.4 : 1 }}
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-[var(--ink)]">{item.item_name}</span>
                      {item.item_name_linked && item.item_name_linked !== item.item_name && (
                        <div
                          className="text-xs mt-0.5"
                          style={{ color: 'var(--muted)', fontFamily: 'var(--mono)' }}
                        >
                          → {item.item_name_linked}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>
                      {item.part_number || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ color: badge.color, background: badge.bg }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td
                      className="px-3 py-2.5 text-right font-medium"
                      style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--signal)' }}
                    >
                      {item.quantity_received}
                    </td>
                    <td className="px-3 py-2.5">
                      {poLine && afterThis !== null ? (
                        <span
                          className="text-xs"
                          style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}
                        >
                          {afterThis} / {poLine.quantity_ordered}
                          {afterThis > poLine.quantity_ordered && (
                            <span
                              className="ml-1 font-medium"
                              style={{ color: 'var(--warn)' }}
                            >
                              OVER
                            </span>
                          )}
                          {afterThis === poLine.quantity_ordered && (
                            <span
                              className="ml-1 font-medium"
                              style={{ color: 'var(--ok)' }}
                            >
                              ✓
                            </span>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Progress */}
      {isProcessing && progressMsg && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm"
          style={{ background: 'var(--info-soft)', color: 'var(--info)' }}
        >
          <span className="loading loading-spinner loading-sm" />
          {progressMsg}
        </div>
      )}

      {/* Error */}
      {confirmMutation.isError && (
        <div
          className="flex items-start gap-2 px-4 py-3 rounded-lg text-sm"
          style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
        >
          <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <b>Failed to confirm receipt.</b>{' '}
            {confirmMutation.error?.message || 'An error occurred.'}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-[var(--line)]">
        <button
          onClick={onBack}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[var(--line)] text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--panel-2)] disabled:opacity-40"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--signal)' }}
        >
          {isProcessing ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <Icon name="check" className="w-4 h-4" />
          )}
          Confirm receipt ({activeItems.length} item{activeItems.length !== 1 ? 's' : ''})
        </button>
      </div>
    </div>
  )
}

// ── Helpers ──

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span
        className="text-[var(--muted)]"
        style={{ fontFamily: 'var(--mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em' }}
      >
        {label}
      </span>
      <div className="font-medium text-[var(--ink)] mt-0.5">{value}</div>
    </div>
  )
}

function StatBadge({ count, label, color, bg }: { count: number; label: string; color: string; bg: string }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
      style={{ color, background: bg }}
    >
      <span style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>{count}</span>
      {label}
    </div>
  )
}
