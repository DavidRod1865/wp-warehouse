/**
 * ReceiptReview — Step 3 of the receiving workflow
 *
 * Summary table of all items, action badges, quantity changes.
 * Confirm button triggers the Sortly + Supabase mutation.
 */
import { useState } from 'react'
import { Icon } from '../../../components/ui/Icon'
import { useConfirmReceipt } from '../hooks/useReceivingMutations'
import { ACTION_STYLES } from '../utils/actionStyles'
import type { ReceivingLineItem, DestinationType, ConfirmReceiptParams } from '../types'

interface ReceiptReviewProps {
  vendor: string
  poNumber: string
  dateReceived: string
  destinationType: DestinationType
  destinationFolderId: number | null
  projectId: number | null
  projectName: string | null
  notes: string
  items: ReceivingLineItem[]
  onBack: () => void
  onConfirmed: () => void
}

export function ReceiptReview({
  vendor,
  poNumber,
  dateReceived,
  destinationType,
  destinationFolderId,
  projectId,
  projectName,
  notes,
  items,
  onBack,
  onConfirmed,
}: ReceiptReviewProps) {
  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const confirmMutation = useConfirmReceipt(setProgressMsg)

  const activeItems = items.filter((i) => i.action !== 'skip')
  const updateItems = activeItems.filter((i) => i.action === 'update')
  const createItems = activeItems.filter((i) => i.action === 'create')
  const skippedItems = items.filter((i) => i.action === 'skip')
  const pendingItems = activeItems.filter((i) => i.action === 'pending')

  const destinationNames = new Set(
    activeItems.map((i) => i.destination_folder_name).filter(Boolean)
  )
  const destinationLabel = destinationNames.size === 1
    ? [...destinationNames][0]!
    : destinationNames.size > 1
      ? 'Multiple destinations'
      : (projectName || 'Main Warehouse')

  const handleConfirm = async () => {
    if (!destinationFolderId) return

    const params: ConfirmReceiptParams = {
      vendor,
      po_number: poNumber || null,
      date_received: dateReceived,
      destination_type: destinationType,
      destination_folder_id: destinationFolderId,
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

  return (
    <div className="space-y-5">
      {/* Header summary */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-[var(--muted)]" style={{ fontFamily: 'var(--mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Vendor
            </span>
            <div className="font-medium text-[var(--ink)] mt-0.5">{vendor}</div>
          </div>
          {poNumber && (
            <div>
              <span className="text-[var(--muted)]" style={{ fontFamily: 'var(--mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                PO Number
              </span>
              <div className="font-medium text-[var(--ink)] mt-0.5">{poNumber}</div>
            </div>
          )}
          <div>
            <span className="text-[var(--muted)]" style={{ fontFamily: 'var(--mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Date Received
            </span>
            <div className="font-medium text-[var(--ink)] mt-0.5">
              {new Date(dateReceived + 'T00:00').toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </div>
          </div>
          <div>
            <span className="text-[var(--muted)]" style={{ fontFamily: 'var(--mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Destination
            </span>
            <div className="font-medium text-[var(--ink)] mt-0.5">
              {destinationLabel}
            </div>
          </div>
        </div>
      </div>

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

      {/* Warning for unlinked items */}
      {pendingItems.length > 0 && (
        <div
          className="flex items-start gap-2 px-4 py-3 rounded-lg text-sm"
          style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
        >
          <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <b>{pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''}</b> not linked to inventory.
            Go back to link them or they will be skipped.
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="rounded-xl border border-[var(--line)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b border-[var(--line)] text-[var(--muted)]"
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10.5,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                }}
              >
                <th className="text-left font-medium px-4 py-2.5">Item</th>
                <th className="text-left font-medium px-3 py-2.5">Part #</th>
                <th className="text-left font-medium px-3 py-2.5">Destination</th>
                <th className="text-left font-medium px-3 py-2.5">Action</th>
                <th className="text-right font-medium px-3 py-2.5" style={{ width: 70 }}>Ordered</th>
                <th className="text-right font-medium px-3 py-2.5" style={{ width: 70 }}>Shipped</th>
                <th className="text-right font-medium px-3 py-2.5" style={{ width: 50 }}>B/O</th>
                <th className="text-right font-medium px-3 py-2.5" style={{ width: 70 }}>Current</th>
                <th className="text-right font-medium px-3 py-2.5" style={{ width: 70 }}>New Qty</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const badge = ACTION_STYLES[item.action]
                const currentQty = item.sortly_current_quantity !== null
                  ? Math.round(item.sortly_current_quantity)
                  : null
                const newQty = item.action === 'update' && currentQty !== null
                  ? currentQty + item.quantity_received
                  : item.action === 'create'
                    ? item.quantity_received
                    : null

                return (
                  <tr
                    key={item.tempId}
                    className="border-b border-[var(--line)] last:border-0"
                    style={{ opacity: item.action === 'skip' ? 0.4 : 1 }}
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-[var(--ink)]">{item.item_name}</span>
                      {item.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{ background: 'var(--panel-2)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>
                      {item.part_number || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {item.destination_folder_name ? (() => {
                        const isCross = projectName !== null && item.destination_folder_name !== projectName
                        return (
                          <span
                            className="text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
                            style={isCross
                              ? {
                                  color: 'var(--warn)',
                                  background: 'var(--warn-soft)',
                                  border: '1px solid color-mix(in oklab, var(--warn) 30%, var(--line))',
                                }
                              : { color: 'var(--muted)' }
                            }
                          >
                            {item.destination_folder_name}
                          </span>
                        )
                      })() : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ color: badge.color, background: badge.bg }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right" style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--muted)' }}>
                      {item.quantity_ordered}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium" style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--signal)' }}>
                      {item.quantity_shipped.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right" style={{ fontFamily: 'var(--mono)', fontSize: 13, color: item.back_order > 0 ? 'var(--warn)' : 'var(--muted)' }}>
                      {item.back_order > 0 ? item.back_order : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right" style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
                      {currentQty ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium" style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
                      {newQty !== null ? newQty : '—'}
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
          disabled={isProcessing || activeItems.length === 0}
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
