/**
 * PurchaseOrdersPage — Purchase orders directory and management
 *
 * List all POs, filter by project/status, view details, create new
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePurchaseOrders } from '../hooks/usePurchaseOrders'
import { useProjects } from '../../projects/hooks/useProjects'
import { useVendors } from '../../vendors/hooks/useVendors'
import { Icon } from '../../../components/ui/Icon'
import { UploadPoModal } from './UploadPoModal'
import type { PurchaseOrder } from '../types'

interface FilterState {
  status?: string
  project_id?: number
  vendor_id?: number
  search: string
}

type SortKey = 'po_number' | 'vendor' | 'project' | 'po_date' | 'status' | 'received'

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

const STATUS_ORDER: Record<string, number> = {
  draft: 0,
  confirmed: 1,
  partially_received: 2,
  received: 3,
  cancelled: 4,
}

function projectLabel(po: PurchaseOrder): string {
  const name = po.project?.name
  if (!name) return 'Unknown'
  const gc = po.project?.general_contractors?.company_name
  return gc ? `${gc} - ${name}` : name
}

function receivedProgress(po: POWithLineItems): { label: string; ratio: number } {
  const total = po.line_items?.length || 0
  const received = po.line_items?.filter((l) => l.received_status === 'received').length || 0
  return {
    label: total > 0 ? `${received}/${total}` : '—',
    ratio: total > 0 ? received / total : -1,
  }
}

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
      className="inline-block px-2 py-1 rounded text-xs font-medium"
      style={{ background: colors_entry.bg, color: colors_entry.text }}
    >
      {labels[status] || status}
    </span>
  )
}

function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  dir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
  align?: 'left' | 'center' | 'right'
}) {
  const active = activeKey === sortKey
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  const buttonAlign =
    align === 'right'
      ? 'flex-row-reverse ml-auto'
      : align === 'center'
        ? 'mx-auto'
        : ''

  return (
    <th className={`px-4 py-3 font-semibold text-[var(--ink)] ${alignClass}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:opacity-80 ${buttonAlign} ${
          active ? 'theme-accent' : ''
        }`}
      >
        {label}
        <Icon
          name="sortAsc"
          className={`w-3 h-3 opacity-40 ${active ? 'opacity-100' : ''} ${
            active && dir === 'desc' ? 'rotate-180' : ''
          }`}
        />
      </button>
    </th>
  )
}

function PoRow({ po }: { po: POWithLineItems }) {
  const navigate = useNavigate()
  const { label: receivedLabel } = receivedProgress(po)
  const href = `/purchase-orders/${po.id}`

  return (
    <tr
      role="link"
      tabIndex={0}
      className="theme-row-hover border-b border-[var(--line)] cursor-pointer"
      onClick={() => navigate(href)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(href)
        }
      }}
    >
      <td className="theme-accent px-4 py-3 text-sm font-medium">
        {po.po_number}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--ink-2)]">
        {po.vendor?.name || 'Unknown'}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--ink-2)]">
        {projectLabel(po)}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--ink-2)]">
        {po.po_date ? new Date(po.po_date).toLocaleDateString() : '—'}
      </td>
      <td className="px-4 py-3 text-center text-sm text-[var(--muted)]">
        {receivedLabel}
      </td>
      <td className="px-4 py-3 text-center">
        <StatusBadge status={po.status} />
      </td>
    </tr>
  )
}

function sortValue(po: POWithLineItems, key: SortKey): string | number {
  switch (key) {
    case 'po_number':
      return po.po_number
    case 'vendor':
      return po.vendor?.name || ''
    case 'project':
      return projectLabel(po)
    case 'po_date':
      return po.po_date || ''
    case 'status':
      return STATUS_ORDER[po.status] ?? 99
    case 'received':
      return receivedProgress(po).ratio
  }
}

export default function PurchaseOrdersPage() {
  const [filters, setFilters] = useState<FilterState>({ search: '' })
  const [showModal, setShowModal] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('po_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const { data: projects = [] } = useProjects()
  const { data: vendors = [] } = useVendors()
  const { data: pos = [], isLoading } = usePurchaseOrders({
    status: filters.status,
    project_id: filters.project_id,
    vendor_id: filters.vendor_id,
  })

  const sortedProjects = [...projects].sort((a, b) => {
    const al = a.general_contractor ? `${a.general_contractor} - ${a.name}` : a.name
    const bl = b.general_contractor ? `${b.general_contractor} - ${b.name}` : b.name
    return al.localeCompare(bl, undefined, { sensitivity: 'base' })
  })

  const searchLower = filters.search.trim().toLowerCase()
  const filtered = searchLower
    ? pos.filter((po) => {
        const haystack = [
          po.po_number,
          po.notes,
          po.vendor?.name,
          po.project?.name,
          po.project?.general_contractors?.company_name,
          projectLabel(po),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(searchLower)
      })
    : pos

  const displayed = [...filtered].sort((a, b) => {
    const av = sortValue(a, sortKey)
    const bv = sortValue(b, sortKey)

    let cmp = 0
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv
    } else {
      cmp = String(av).localeCompare(String(bv), undefined, {
        sensitivity: 'base',
        numeric: true,
      })
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'po_date' || key === 'received' ? 'desc' : 'asc')
    }
  }

  const hasActiveFilters = Boolean(
    filters.search || filters.status || filters.project_id || filters.vendor_id,
  )
  const statuses = ['draft', 'confirmed', 'partially_received', 'received', 'cancelled']

  return (
    <div className="w-full pb-6">
      <div className="px-6 pt-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--ink)]">Purchase Orders</h1>
          <p className="text-[var(--muted)] mt-1">Manage POs from vendors and track received inventory</p>
        </div>

        {/* Filter Bar */}
        <div className="mb-6 flex gap-3 items-end flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="PO #, vendor, GC, or project..."
              className="form-input w-full"
            />
          </div>

          {/* Project Filter */}
          <div className="min-w-52 max-w-72 flex-1">
            <label className="block text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>
              Project
            </label>
            <select
              value={filters.project_id ?? ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  project_id: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="form-input w-full"
            >
              <option value="">All projects</option>
              {sortedProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.general_contractor
                    ? `${project.general_contractor} - ${project.name}`
                    : project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vendor Filter */}
          <div className="min-w-44 max-w-64">
            <label className="block text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>
              Vendor
            </label>
            <select
              value={filters.vendor_id ?? ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  vendor_id: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="form-input w-full"
            >
              <option value="">All vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </div>

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
              <option value="">All Statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ').charAt(0).toUpperCase() + s.replace(/_/g, ' ').slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* New PO Button */}
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg text-[var(--on-signal)] text-sm font-medium hover:opacity-90"
            style={{ background: 'var(--signal)' }}
          >
            <Icon name="plus" className="w-4 h-4 inline mr-1" />
            New PO
          </button>
        </div>
      </div>

      {/* POs Table — full width of content area */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <SortableTh label="PO #" sortKey="po_number" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableTh label="Vendor" sortKey="vendor" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableTh label="Project" sortKey="project" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableTh label="Issue Date" sortKey="po_date" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableTh
                label="Received"
                sortKey="received"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="center"
              />
              <SortableTh
                label="Status"
                sortKey="status"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="center"
              />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  <span className="loading loading-spinner loading-sm" />
                </td>
              </tr>
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  {hasActiveFilters ? 'No matching purchase orders' : 'No purchase orders yet'}
                </td>
              </tr>
            ) : (
              displayed.map((po) => (
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
