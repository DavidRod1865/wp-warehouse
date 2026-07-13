/**
 * PoDetailPage — View and manage a single purchase order
 *
 * Shows PO header, line items with received status, actions (confirm, cancel)
 */
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { usePurchaseOrder } from '../hooks/usePurchaseOrders'
import { useConfirmPo, useCancelPo, getPoFileUrl } from '../hooks/usePoMutations'
import { Icon } from '../../../components/ui/Icon'
import { useToast } from '../../../components/ui/Toast'

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    draft: { bg: 'var(--panel-2)', text: 'var(--muted)' },
    confirmed: { bg: 'color-mix(in oklab, var(--signal) 20%, var(--panel))', text: 'var(--signal)' },
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

  const poId = id ? Number(id) : null
  const { data: po, isLoading } = usePurchaseOrder(poId!)
  const confirmPo = useConfirmPo()
  const cancelPo = useCancelPo()

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

  const handleConfirm = async () => {
    try {
      await confirmPo.mutateAsync(poId)
      toast('PO confirmed', 'success')
    } catch (err) {
      toast('Failed to confirm PO', 'error')
    }
  }

  const handleCancel = async () => {
    try {
      await cancelPo.mutateAsync(poId)
      toast('PO cancelled', 'success')
    } catch (err) {
      toast('Failed to cancel PO', 'error')
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

  const lineItems = po.line_items || []
  const receivedCount = lineItems.filter((l: any) => l.received_status === 'received').length

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate('/purchase-orders')}
        className="inline-flex items-center gap-2 text-[var(--signal)] hover:underline mb-6"
      >
        <Icon name="arrow-left" className="w-4 h-4" />
        Back to Purchase Orders
      </button>

      {/* Header Card */}
      <div className="bg-[var(--panel)] rounded-xl border border-[var(--line)] p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--ink)] mb-2">{po.po_number}</h1>
            <div className="flex items-center gap-3">
              <StatusBadge status={po.status} />
              <span className="text-sm text-[var(--muted)]">
                Created {new Date(po.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {po.status === 'draft' && (
              <>
                <button
                  onClick={handleConfirm}
                  disabled={confirmPo.isPending}
                  className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--signal)' }}
                >
                  <Icon name="check" className="w-4 h-4 inline mr-2" />
                  Confirm
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelPo.isPending}
                  className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--panel-2)] text-sm font-medium disabled:opacity-50"
                >
                  <Icon name="x" className="w-4 h-4 inline mr-2" />
                  Cancel
                </button>
              </>
            )}
            {po.status !== 'cancelled' && po.status !== 'received' && (
              <button
                onClick={handleCancel}
                disabled={cancelPo.isPending}
                className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--panel-2)] text-sm font-medium disabled:opacity-50"
              >
                <Icon name="x" className="w-4 h-4 inline mr-2" />
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-[var(--line)]">
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
          <div>
            <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
              Project
            </div>
            <div className="text-[var(--ink)] font-medium">
              <Link to={`/projects/${po.project_id}`} className="text-[var(--signal)] hover:underline">
                {po.project?.name || 'Unknown'}
              </Link>
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
              PO Date
            </div>
            <div className="text-[var(--ink)] font-medium">
              {po.po_date ? new Date(po.po_date).toLocaleDateString() : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
              Lines Received
            </div>
            <div className="text-[var(--ink)] font-medium">
              {receivedCount}/{lineItems.length}
            </div>
          </div>
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
        <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-2)]">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Line Items</h2>
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
                {lineItems.map((line: any) => (
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
                      {line.unit_price ? `$${line.unit_price.toFixed(2)}` : '—'}
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
    </div>
  )
}
