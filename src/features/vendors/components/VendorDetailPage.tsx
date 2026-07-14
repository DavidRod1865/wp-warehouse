/**
 * VendorDetailPage — View a single vendor
 *
 * Tabs:
 *  - Purchase Orders (existing)
 *  - Receipts (Phase 4: receiving entries linked to this vendor)
 *  - Backorders (Phase 4: PO lines pending/partial for this vendor's confirmed POs)
 */
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useVendors } from '../hooks/useVendors'
import { usePurchaseOrders } from '../../purchase-orders/hooks/usePurchaseOrders'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../../../components/ui/Icon'
import type { ReceivingEntry } from '../../receiving/types'

// ── Status badge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    draft: { bg: 'var(--panel-2)', text: 'var(--muted)' },
    confirmed: { bg: 'color-mix(in oklab, var(--ok) 20%, var(--panel))', text: 'var(--ok)' },
    partially_received: { bg: 'color-mix(in oklab, var(--warning) 20%, var(--panel))', text: 'var(--warning)' },
    received: { bg: 'color-mix(in oklab, var(--success) 20%, var(--panel))', text: 'var(--success)' },
    cancelled: { bg: 'color-mix(in oklab, var(--danger) 20%, var(--panel))', text: 'var(--danger)' },
  }
  const entry = colors[status] || colors.draft
  const labels: Record<string, string> = {
    draft: 'Draft', confirmed: 'Confirmed', partially_received: 'Partial',
    received: 'Received', cancelled: 'Cancelled',
  }

  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: entry.bg, color: entry.text }}
    >
      {labels[status] || status}
    </span>
  )
}

// ── Receipts for a vendor ───────────────────────────────────────────────────────

function useVendorReceipts(vendorName: string | undefined) {
  return useQuery({
    queryKey: ['vendor-receipts', vendorName],
    queryFn: async () => {
      if (!vendorName) return []
      const { data, error } = await supabase
        .from('receiving_log_entries')
        .select('*')
        .ilike('vendor', `%${vendorName}%`)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data || []) as ReceivingEntry[]
    },
    enabled: !!vendorName,
    staleTime: 2 * 60 * 1000,
  })
}

// ── Backorders for a vendor ─────────────────────────────────────────────────────

interface BackorderLine {
  po_id: number
  po_number: string
  line_id: number
  description: string
  part_number: string | null
  quantity_ordered: number
  quantity_received: number
  received_status: string
}

function useVendorBackorders(vendorId: number | undefined) {
  return useQuery({
    queryKey: ['vendor-backorders', vendorId],
    queryFn: async () => {
      if (!vendorId) return []
      const { data, error } = await supabase
        .from('po_line_items')
        .select(`
          id,
          description,
          part_number,
          quantity_ordered,
          quantity_received,
          received_status,
          purchase_orders!inner(id, po_number, vendor_id, status)
        `)
        .in('received_status', ['pending', 'partial'])
        .eq('purchase_orders.vendor_id', vendorId)
        .in('purchase_orders.status', ['confirmed', 'partially_received'])
        .order('id', { ascending: true })
      if (error) throw error
      return ((data || []) as unknown as Array<{
        id: number
        description: string
        part_number: string | null
        quantity_ordered: number
        quantity_received: number
        received_status: string
        purchase_orders: { id: number; po_number: string; vendor_id: number; status: string }
      }>).map((row) => ({
        po_id: row.purchase_orders.id,
        po_number: row.purchase_orders.po_number,
        line_id: row.id,
        description: row.description,
        part_number: row.part_number,
        quantity_ordered: row.quantity_ordered,
        quantity_received: row.quantity_received,
        received_status: row.received_status,
      }) as BackorderLine)
    },
    enabled: !!vendorId,
    staleTime: 2 * 60 * 1000,
  })
}

// ── Main page ───────────────────────────────────────────────────────────────────

type TabId = 'purchase_orders' | 'receipts' | 'backorders'

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('purchase_orders')

  const vendorId = id ? id : null
  const { data: vendors = [] } = useVendors()
  const vendor = vendorId ? vendors.find((v) => String(v.id) === vendorId) : undefined

  const { data: pos = [] } = usePurchaseOrders({ vendor_id: vendor?.id })
  const { data: receipts = [], isLoading: receiptsLoading } = useVendorReceipts(vendor?.name)
  const { data: backorders = [], isLoading: backordersLoading } = useVendorBackorders(vendor?.id)

  if (!vendorId) return <div>Invalid vendor ID</div>

  if (!vendor) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <button
          onClick={() => navigate('/vendors')}
          className="inline-flex items-center gap-2 text-[var(--signal)] hover:underline mb-6"
        >
          <Icon name="arrow-left" className="w-4 h-4" />
          Back to Vendors
        </button>
        <div className="text-center text-[var(--muted)] py-12">Vendor not found</div>
      </div>
    )
  }

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: 'purchase_orders', label: 'Purchase Orders', badge: pos.length || undefined },
    { id: 'receipts', label: 'Receipts', badge: receipts.length || undefined },
    { id: 'backorders', label: 'Backorders', badge: backorders.length || undefined },
  ]

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <button
        onClick={() => navigate('/vendors')}
        className="inline-flex items-center gap-2 text-[var(--signal)] hover:underline mb-6"
      >
        <Icon name="arrow-left" className="w-4 h-4" />
        Back to Vendors
      </button>

      {/* Info Card */}
      <div className="bg-[var(--panel)] rounded-xl border border-[var(--line)] p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--ink)] mb-2">{vendor.name}</h1>
            <span
              className="inline-block px-3 py-1 rounded-lg text-sm font-medium"
              style={{
                background: vendor.is_active
                  ? 'color-mix(in oklab, var(--success) 20%, var(--panel))'
                  : 'color-mix(in oklab, var(--danger) 20%, var(--panel))',
                color: vendor.is_active ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {vendor.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-[var(--line)]">
          {vendor.contact_name && (
            <div>
              <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
                Contact Name
              </div>
              <div className="text-[var(--ink)] font-medium">{vendor.contact_name}</div>
            </div>
          )}
          {vendor.phone && (
            <div>
              <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>Phone</div>
              <a href={`tel:${vendor.phone}`} className="text-[var(--signal)] hover:underline">{vendor.phone}</a>
            </div>
          )}
          {vendor.email && (
            <div>
              <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>Email</div>
              <a href={`mailto:${vendor.email}`} className="text-[var(--signal)] hover:underline">{vendor.email}</a>
            </div>
          )}
          {vendor.address && (
            <div>
              <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>Address</div>
              <div className="text-[var(--ink)] text-sm">
                {vendor.address.street && <div>{vendor.address.street}</div>}
                {(vendor.address.city || vendor.address.state) && (
                  <div>{vendor.address.city}, {vendor.address.state} {vendor.address.zip}</div>
                )}
              </div>
            </div>
          )}
        </div>
        {vendor.notes && (
          <div className="mt-6 pt-6 border-t border-[var(--line)]">
            <div className="text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>Notes</div>
            <p className="text-sm text-[var(--ink-2)]">{vendor.notes}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--line)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
            style={{
              borderBottomColor: activeTab === tab.id ? 'var(--signal)' : 'transparent',
              color: activeTab === tab.id ? 'var(--signal)' : 'var(--muted)',
            }}
          >
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold"
                style={{
                  background: activeTab === tab.id ? 'var(--signal)' : 'var(--panel-2)',
                  color: activeTab === tab.id ? 'white' : 'var(--muted)',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Purchase Orders ── */}
      {activeTab === 'purchase_orders' && (
        <div className="bg-[var(--panel)] rounded-xl border border-[var(--line)] overflow-hidden">
          {pos.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted)]">No purchase orders</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)]">
                    <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">PO #</th>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Project</th>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Date</th>
                    <th className="px-4 py-3 text-center font-semibold text-[var(--ink)]">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map((po) => (
                    <tr key={po.id} className="border-b border-[var(--line)] hover:bg-[var(--panel-2)]">
                      <td className="px-4 py-3">
                        <Link to={`/purchase-orders/${po.id}`} className="text-[var(--signal)] hover:underline font-medium">
                          {po.po_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--ink-2)]">{po.project?.name || '—'}</td>
                      <td className="px-4 py-3 text-[var(--ink-2)]">
                        {po.po_date ? new Date(po.po_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={po.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/purchase-orders/${po.id}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-[var(--panel-2)] transition-colors"
                        >
                          <Icon name="arrow-right" className="w-4 h-4 text-[var(--ink-2)]" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Receipts ── */}
      {activeTab === 'receipts' && (
        <div className="bg-[var(--panel)] rounded-xl border border-[var(--line)] overflow-hidden">
          {receiptsLoading ? (
            <div className="flex justify-center py-10">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : receipts.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted)]">
              No receipts found for {vendor.name}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)]">
                    <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">PO #</th>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Project</th>
                    <th className="px-4 py-3 text-center font-semibold text-[var(--ink)]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((entry) => (
                    <tr key={entry.id} className="border-b border-[var(--line)] hover:bg-[var(--panel-2)]">
                      <td className="px-4 py-3 text-[var(--ink-2)]" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                        {entry.date_received
                          ? new Date(entry.date_received + 'T00:00').toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })
                          : new Date(entry.created_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                      </td>
                      <td className="px-4 py-3" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)' }}>
                        {entry.po_number || '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--ink-2)]">{entry.project_name || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={entry.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Backorders ── */}
      {activeTab === 'backorders' && (
        <div className="bg-[var(--panel)] rounded-xl border border-[var(--line)] overflow-hidden">
          {backordersLoading ? (
            <div className="flex justify-center py-10">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : backorders.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted)]">
              No outstanding backorders for {vendor.name}
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-[var(--line)]" style={{ background: 'var(--panel-2)' }}>
                <p className="text-sm text-[var(--muted)]">
                  {backorders.length} PO line{backorders.length !== 1 ? 's' : ''} on confirmed/partially-received POs still pending or partial.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)]">
                      <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">PO #</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Description</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Part #</th>
                      <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Ordered</th>
                      <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Received</th>
                      <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Remaining</th>
                      <th className="px-4 py-3 text-center font-semibold text-[var(--ink)]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backorders.map((line) => {
                      const remaining = line.quantity_ordered - line.quantity_received
                      return (
                        <tr key={line.line_id} className="border-b border-[var(--line)] hover:bg-[var(--panel-2)]">
                          <td className="px-4 py-3">
                            <Link
                              to={`/purchase-orders/${line.po_id}`}
                              className="text-[var(--signal)] hover:underline"
                              style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
                            >
                              {line.po_number}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-[var(--ink)] font-medium">{line.description}</td>
                          <td
                            className="px-4 py-3 text-[var(--muted)]"
                            style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
                          >
                            {line.part_number || '—'}
                          </td>
                          <td
                            className="px-4 py-3 text-right"
                            style={{ fontFamily: 'var(--mono)', fontSize: 13 }}
                          >
                            {line.quantity_ordered}
                          </td>
                          <td
                            className="px-4 py-3 text-right"
                            style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--muted)' }}
                          >
                            {line.quantity_received}
                          </td>
                          <td
                            className="px-4 py-3 text-right font-medium"
                            style={{
                              fontFamily: 'var(--mono)',
                              fontSize: 13,
                              color: 'var(--warn)',
                            }}
                          >
                            {remaining}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded"
                              style={{
                                background: line.received_status === 'partial' ? 'var(--warn-soft)' : 'var(--panel-2)',
                                color: line.received_status === 'partial' ? 'var(--warn)' : 'var(--muted)',
                              }}
                            >
                              {line.received_status === 'partial' ? 'Partial' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
