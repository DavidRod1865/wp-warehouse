/**
 * PurchaseOrdersPage — Purchase orders directory and management
 *
 * List all POs, filter by project/status, view details, create new
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePurchaseOrders } from '../hooks/usePurchaseOrders'
import { Icon } from '../../../components/ui/Icon'
import { UploadPoModal } from './UploadPoModal'
import type { PurchaseOrder } from '../types'

interface FilterState {
  status?: string
  search: string
}

interface POWithLineItems extends PurchaseOrder {
  line_items?: Array<{
    id: number
    po_id: number
    line_number: number
    description: string
    part_number: string | null
    item_id: number | null
    quantity_ordered: number
    unit_price: number | null
    quantity_received: number
    received_status: 'pending' | 'partial' | 'received' | 'over_received'
    notes: string | null
    created_at: string
    updated_at: string
  }>
}

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
      className="inline-block px-2 py-1 rounded text-xs font-medium"
      style={{ background: colors_entry.bg, color: colors_entry.text }}
    >
      {labels[status] || status}
    </span>
  )
}

function PoRow({ po }: { po: POWithLineItems }) {
  const totalLines = po.line_items?.length || 0
  const receivedLines = po.line_items?.filter((l) => l.received_status === 'received').length || 0

  return (
    <tr className="border-b border-[var(--line)] hover:bg-[var(--panel-2)] transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-[var(--ink)]">
        <Link to={`/purchase-orders/${po.id}`} className="text-[var(--signal)] hover:underline">
          {po.po_number}
        </Link>
      </td>
      <td className="px-4 py-3 text-sm text-[var(--ink-2)]">
        {po.vendor?.name || 'Unknown'}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--ink-2)]">
        {po.project?.name || 'Unknown'}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--ink-2)]">
        {po.po_date ? new Date(po.po_date).toLocaleDateString() : '—'}
      </td>
      <td className="px-4 py-3 text-center">
        <StatusBadge status={po.status} />
      </td>
      <td className="px-4 py-3 text-center text-sm text-[var(--muted)]">
        {totalLines > 0 ? `${receivedLines}/${totalLines}` : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          to={`/purchase-orders/${po.id}`}
          className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-[var(--panel-2)] transition-colors"
          title="View details"
        >
          <Icon name="arrow-right" className="w-4 h-4 text-[var(--ink-2)]" />
        </Link>
      </td>
    </tr>
  )
}

export default function PurchaseOrdersPage() {
  const [filters, setFilters] = useState<FilterState>({ search: '' })
  const [showModal, setShowModal] = useState(false)

  const { data: pos = [], isLoading } = usePurchaseOrders({
    status: filters.status,
    search: filters.search,
  })

  const statuses = ['draft', 'confirmed', 'partially_received', 'received', 'cancelled']

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--ink)]">Purchase Orders</h1>
        <p className="text-[var(--muted)] mt-1">Manage POs from vendors and track receipts</p>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 flex gap-3 items-end flex-wrap">
        {/* Status Filter */}
        <div>
          <label className="block text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>
            Status
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
            className="form-input"
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="flex-1 min-w-64">
          <label className="block text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>
            Search
          </label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="PO number or notes..."
            className="form-input w-full"
          />
        </div>

        {/* New PO Button */}
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
          style={{ background: 'var(--signal)' }}
        >
          <Icon name="plus" className="w-4 h-4 inline mr-1" />
          New PO
        </button>
      </div>

      {/* POs Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">PO #</th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Vendor</th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Project</th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Date</th>
              <th className="px-4 py-3 text-center font-semibold text-[var(--ink)]">Status</th>
              <th className="px-4 py-3 text-center font-semibold text-[var(--ink)]">Received</th>
              <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">
                  <span className="loading loading-spinner loading-sm" />
                </td>
              </tr>
            ) : pos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">
                  {filters.search || filters.status ? 'No matching purchase orders' : 'No purchase orders yet'}
                </td>
              </tr>
            ) : (
              pos.map((po) => (
                <PoRow key={po.id} po={po} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Upload Modal */}
      {showModal && <UploadPoModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
