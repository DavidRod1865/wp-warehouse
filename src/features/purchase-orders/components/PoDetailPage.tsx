/**
 * PoDetailPage — View and manage a single purchase order
 *
 * Shows PO header, line items with received status, actions
 * (confirm, edit, delete draft, revert cancelled).
 */
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { usePurchaseOrder } from '../hooks/usePurchaseOrders'
import {
  useConfirmPo,
  useDeletePo,
  useRevertCancelledPo,
  getPoFileUrl,
} from '../hooks/usePoMutations'
import { Icon } from '../../../components/ui/Icon'
import { useToast } from '../../../components/ui/Toast'
import { DeleteConfirmDialog } from '../../../components/ui/DeleteConfirmDialog'
import { EditPoModal } from './EditPoModal'

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    draft: { bg: 'var(--panel-2)', text: 'var(--muted)' },
    confirmed: { bg: 'color-mix(in oklab, var(--ok) 20%, var(--panel))', text: 'var(--ok)' },
    partially_received: { bg: 'color-mix(in oklab, var(--warning) 20%, var(--panel))', text: 'var(--warning)' },
    received: { bg: 'color-mix(in oklab, var(--success) 20%, var(--panel))', text: 'var(--success)' },
    cancelled: { bg: 'color-mix(in oklab, var(--danger) 20%, var(--panel))', text: 'var(--danger)' },
  }

  const colors_entry = colors[status] || colors.draft
  const labels: Record<string, string> = {
    draft: 'Draft',
    confirmed: 'Confirmed',
    partially_received: 'Partial',
    received: 'Received',
    cancelled: 'Cancelled',
  }

  return (
    <span
      className="inline-block px-3 py-1.5 rounded-lg text-sm font-medium"
      style={{ background: colors_entry.bg, color: colors_entry.text }}
    >
      {labels[status] || status}
    </span>
  )
}

function ReceivedStatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'var(--panel-2)', text: 'var(--muted)' },
    partial: { bg: 'color-mix(in oklab, var(--warning) 20%, var(--panel))', text: 'var(--warning)' },
    received: { bg: 'color-mix(in oklab, var(--success) 20%, var(--panel))', text: 'var(--success)' },
    over_received: { bg: 'color-mix(in oklab, var(--danger) 20%, var(--panel))', text: 'var(--danger)' },
  }

  const colors_entry = colors[status] || colors.pending
  const labels: Record<string, string> = {
    pending: 'Pending',
    partial: 'Partial',
    received: 'Received',
    over_received: 'Over Received',
  }

  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: colors_entry.bg, color: colors_entry.text }}
    >
      {labels[status] || status}
    </span>
  )
}

export default function PoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [downloading, setDownloading] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showRevert, setShowRevert] = useState(false)
  const [revertTarget, setRevertTarget] = useState<'draft' | 'confirmed'>('confirmed')

  const poId = id ? Number(id) : null
  const { data: po, isLoading } = usePurchaseOrder(poId!)
  const confirmPo = useConfirmPo()
  const deletePo = useDeletePo()
  const revertPo = useRevertCancelledPo()

  if (!poId) {
    return <div>Invalid PO ID</div>
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (!po) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <button
          onClick={() => navigate('/purchase-orders')}
          className="inline-flex items-center gap-2 text-[var(--signal)] hover:underline mb-6"
        >
          <Icon name="arrow-left" className="w-4 h-4" />
          Back to Purchase Orders
        </button>
        <div className="text-center text-[var(--muted)] py-12">Purchase order not found</div>
      </div>
    )
  }

  const lineItems = po.line_items || []
  const hasReceivedInventory = lineItems.some((l) => l.quantity_received > 0)
  const canEdit = po.status !== 'cancelled'
  const canDelete = po.status === 'draft'
  const canConfirm = po.status === 'draft'
  const canRevert = po.status === 'cancelled' && !hasReceivedInventory
  const needsAuditOnCancel = po.status === 'cancelled' && hasReceivedInventory

  const handleConfirm = async () => {
    try {
      await confirmPo.mutateAsync(poId)
      toast('PO confirmed', 'success')
    } catch {
      toast('Failed to confirm PO', 'error')
    }
  }

  const handleDelete = async () => {
    try {
      await deletePo.mutateAsync({
        id: poId,
        status: po.status,
        pdf_storage_path: po.pdf_storage_path,
      })
      toast('Draft PO deleted', 'success')
      navigate('/purchase-orders')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete PO', 'error')
    } finally {
      setShowDelete(false)
    }
  }

  const handleRevert = async () => {
    try {
      await revertPo.mutateAsync({
        id: poId,
        targetStatus: revertTarget,
        lineItems,
      })
      toast(`PO restored to ${revertTarget}`, 'success')
      setShowRevert(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to revert PO', 'error')
    }
  }

  const handleDownloadPdf = async () => {
    if (!po.pdf_storage_path) return
    setDownloading(true)
    try {
      const url = await getPoFileUrl(po.pdf_storage_path)
      window.open(url, '_blank')
    } catch {
      toast('Failed to download PDF', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const receivedCount = lineItems.filter((l) => l.received_status === 'received').length

  const computedLineTotal = lineItems.reduce((sum, line) => {
    if (line.unit_price == null) return sum
    return sum + Number(line.unit_price) * Number(line.quantity_ordered)
  }, 0)
  const hasLinePrices = lineItems.some((l) => l.unit_price != null)
  const lumpSum =
    po.lump_sum_amount != null ? Number(po.lump_sum_amount) : null

  const formatMoney = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <button
        onClick={() => navigate('/purchase-orders')}
        className="inline-flex items-center gap-2 text-[var(--signal)] hover:underline mb-6"
      >
        <Icon name="arrow-left" className="w-4 h-4" />
        Back to Purchase Orders
      </button>

      {/* Audit banner for cancelled POs with received inventory */}
      {needsAuditOnCancel && (
        <div
          className="mb-6 rounded-xl border p-4 flex items-start gap-3"
          style={{
            borderColor: 'color-mix(in oklab, var(--warning) 40%, var(--line))',
            background: 'color-mix(in oklab, var(--warning) 12%, var(--panel))',
          }}
        >
          <Icon name="alert" className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-[var(--ink)]">Inventory received against a cancelled PO</div>
            <p className="text-sm text-[var(--ink-2)] mt-1">
              Goods were already received on this order, so it cannot be reverted automatically.
              Use Audit → Reconciliation for project{' '}
              <span className="font-medium">{po.project?.name || po.project_id}</span>{' '}
              to decide where that stock should go.
            </p>
            <Link
              to="/audit"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-[var(--signal)] hover:underline"
            >
              Open Audit
              <Icon name="arrow-right" className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-[var(--panel)] rounded-xl border border-[var(--line)] p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-[var(--ink)] mb-2">{po.po_number}</h1>
            <div className="text-sm text-[var(--muted)]">
              {po.po_date
                ? `PO issued: ${new Date(po.po_date).toLocaleDateString()}`
                : 'No issue date'}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <StatusBadge status={po.status} />
            {canEdit && (
              <button
                onClick={() => setShowEdit(true)}
                className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--panel-2)] text-sm font-medium"
              >
                <Icon name="edit" className="w-4 h-4 inline mr-2" />
                Edit PO
              </button>
            )}
            {canConfirm && (
              <button
                onClick={handleConfirm}
                disabled={confirmPo.isPending}
                className="px-4 py-2 rounded-lg text-[var(--on-signal)] text-sm font-medium hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--signal)' }}
              >
                <Icon name="check" className="w-4 h-4 inline mr-2" />
                Confirm PO
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setShowDelete(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
                style={{
                  background: 'color-mix(in oklab, var(--danger) 14%, var(--panel))',
                  color: 'var(--danger)',
                }}
              >
                Delete PO
              </button>
            )}
            {canRevert && (
              <button
                onClick={() => setShowRevert(true)}
                className="px-4 py-2 rounded-lg text-[var(--on-signal)] text-sm font-medium hover:opacity-90"
                style={{ background: 'var(--signal)' }}
              >
                <Icon name="refresh" className="w-4 h-4 inline mr-2" />
                Revert cancel
              </button>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-[var(--line)]">
          <div>
            <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
              Project
            </div>
            <div className="text-[var(--ink)] font-medium">
              <Link to={`/projects/${po.project_id}`} className="text-[var(--signal)] hover:underline">
                {po.project?.general_contractors?.company_name
                  ? `${po.project.general_contractors.company_name} - ${po.project.name}`
                  : po.project?.name || 'Unknown'}
              </Link>
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
              Vendor
            </div>
            <div className="text-[var(--ink)] font-medium">
              <Link to={`/vendors/${po.vendor_id}`} className="text-[var(--signal)] hover:underline">
                {po.vendor?.name || 'Unknown'}
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--line)] grid grid-cols-2 md:grid-cols-3 gap-6">
          <div>
            <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
              Lines Received
            </div>
            <div className="text-lg font-medium text-[var(--ink)]">
              {receivedCount}/{lineItems.length}
            </div>
          </div>
          {(lumpSum != null || hasLinePrices) && (
            <div>
              <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
                {lumpSum != null ? 'Lump sum' : 'Line total'}
              </div>
              <div className="text-lg font-medium text-[var(--ink)]">
                {lumpSum != null
                  ? formatMoney(lumpSum)
                  : formatMoney(computedLineTotal)}
              </div>
            </div>
          )}
        </div>

        {po.notes && (
          <div className="mt-4 pt-4 border-t border-[var(--line)]">
            <div className="text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>
              Notes
            </div>
            <p className="text-sm text-[var(--ink-2)]">{po.notes}</p>
          </div>
        )}

        {po.pdf_storage_path && (
          <div className="mt-4 pt-4 border-t border-[var(--line)]">
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--line)] hover:bg-[var(--panel-2)] text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Icon name="download" className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        )}
      </div>

      {/* Line Items Table */}
      <div className="bg-[var(--panel)] rounded-xl border border-[var(--line)] overflow-hidden">
        <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-2)] flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Line Items</h2>
          {lumpSum != null && (
            <span className="text-sm text-[var(--muted)]">
              Priced as lump sum — line unit prices not set
            </span>
          )}
        </div>

        {lineItems.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">No line items</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">#</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Description</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Part Number</th>
                  <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Qty Ordered</th>
                  <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Qty Received</th>
                  <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Unit Price</th>
                  <th className="px-4 py-3 text-center font-semibold text-[var(--ink)]">Status</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((line) => (
                  <tr key={line.id} className="border-b border-[var(--line)] hover:bg-[var(--panel-2)]">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--ink)]">{line.line_number}</td>
                    <td className="px-4 py-3 text-sm text-[var(--ink-2)]">{line.description}</td>
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">{line.part_number || '—'}</td>
                    <td className="px-4 py-3 text-sm text-right text-[var(--ink)]">
                      {line.quantity_ordered}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-[var(--ink)]">
                      {line.quantity_received}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-[var(--ink-2)]">
                      {line.unit_price != null ? `$${Number(line.unit_price).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ReceivedStatusBadge status={line.received_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEdit && (
        <EditPoModal po={po} onClose={() => setShowEdit(false)} />
      )}

      <DeleteConfirmDialog
        open={showDelete}
        itemType={`PO ${po.po_number}`}
        itemName={po.po_number}
        description={
          <>
            This permanently deletes <b className="text-[var(--ink)]">{po.po_number}</b> and its
            line items. This cannot be undone.
          </>
        }
        loading={deletePo.isPending}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />

      {showRevert && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-10"
          style={{
            background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowRevert(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--panel)] rounded-xl w-full max-w-md overflow-hidden"
            style={{ boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)' }}
          >
            <div className="px-6 pt-5 pb-4">
              <h3 className="text-lg font-semibold">Revert cancellation</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Restore <b className="text-[var(--ink)]">{po.po_number}</b> to an active status.
                No inventory has been received, so either option is safe.
              </p>
              <div className="mt-4 space-y-2">
                <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--line)] cursor-pointer hover:bg-[var(--panel-2)]">
                  <input
                    type="radio"
                    name="revert-target"
                    checked={revertTarget === 'confirmed'}
                    onChange={() => setRevertTarget('confirmed')}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium text-[var(--ink)]">Confirmed</span>
                    <span className="block text-xs text-[var(--muted)] mt-0.5">
                      Ready for receiving again
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--line)] cursor-pointer hover:bg-[var(--panel-2)]">
                  <input
                    type="radio"
                    name="revert-target"
                    checked={revertTarget === 'draft'}
                    onChange={() => setRevertTarget('draft')}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium text-[var(--ink)]">Draft</span>
                    <span className="block text-xs text-[var(--muted)] mt-0.5">
                      Needs review before confirming
                    </span>
                  </span>
                </label>
              </div>
            </div>
            <div
              className="flex justify-end gap-2 px-6 py-3.5 border-t border-[var(--line)]"
              style={{ background: 'color-mix(in oklab, var(--panel-2) 50%, var(--panel))' }}
            >
              <button
                className="px-3.5 py-2 rounded-lg text-[var(--ink-2)] text-sm font-medium hover:bg-[var(--panel-2)]"
                onClick={() => setShowRevert(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="px-3.5 py-2 rounded-lg text-[var(--on-signal)] text-sm font-medium hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--signal)' }}
                onClick={handleRevert}
                disabled={revertPo.isPending}
                type="button"
              >
                {revertPo.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  `Restore as ${revertTarget}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
