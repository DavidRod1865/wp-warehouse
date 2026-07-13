/**
 * VendorDetailPage — View a single vendor
 *
 * Shows vendor info and their purchase orders
 */
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useVendors } from '../hooks/useVendors'
import { usePurchaseOrders } from '../../purchase-orders/hooks/usePurchaseOrders'
import { Icon } from '../../../components/ui/Icon'

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
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: colors_entry.bg, color: colors_entry.text }}
    >
      {labels[status] || status}
    </span>
  )
}

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const vendorId = id ? id : null
  const { data: vendors = [] } = useVendors()
  const vendor = vendorId ? vendors.find((v) => String(v.id) === vendorId) : undefined

  const { data: pos = [] } = usePurchaseOrders({
    vendor_id: vendor?.id,
  })

  if (!vendorId) {
    return <div>Invalid vendor ID</div>
  }

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

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Back Button */}
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

        {/* Details Grid */}
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
              <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
                Phone
              </div>
              <div className="text-[var(--ink)]">
                <a href={`tel:${vendor.phone}`} className="text-[var(--signal)] hover:underline">
                  {vendor.phone}
                </a>
              </div>
            </div>
          )}

          {vendor.email && (
            <div>
              <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
                Email
              </div>
              <div className="text-[var(--ink)]">
                <a href={`mailto:${vendor.email}`} className="text-[var(--signal)] hover:underline">
                  {vendor.email}
                </a>
              </div>
            </div>
          )}

          {vendor.address && (
            <div>
              <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
                Address
              </div>
              <div className="text-[var(--ink)] text-sm">
                {vendor.address.street && <div>{vendor.address.street}</div>}
                {(vendor.address.city || vendor.address.state) && (
                  <div>
                    {vendor.address.city}, {vendor.address.state} {vendor.address.zip}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {vendor.notes && (
          <div className="mt-6 pt-6 border-t border-[var(--line)]">
            <div className="text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>
              Notes
            </div>
            <p className="text-sm text-[var(--ink-2)]">{vendor.notes}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-[var(--line)]">
        <div className="px-4 py-2 border-b-2 border-[var(--signal)] text-[var(--ink)] font-medium">
          Purchase Orders
        </div>
      </div>

      {/* Purchase Orders Table */}
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
                {pos.map((po: any) => (
                  <tr key={po.id} className="border-b border-[var(--line)] hover:bg-[var(--panel-2)]">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--ink)]">
                      <Link to={`/purchase-orders/${po.id}`} className="text-[var(--signal)] hover:underline">
                        {po.po_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--ink-2)]">
                      {po.project?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--ink-2)]">
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

      {/* Receiving — coming in Phase 4 */}
      <div className="mt-6 p-6 bg-[var(--panel-2)] rounded-xl border border-[var(--line)] text-center text-[var(--muted)]">
        <Icon name="clock" className="w-8 h-8 inline mb-2 text-[var(--muted)]" />
        <p className="text-sm">Receipts coming in Phase 4</p>
      </div>
    </div>
  )
}
