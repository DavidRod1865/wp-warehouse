/**
 * VendorsPage — Equipment and material vendors directory
 *
 * List, search, create, edit, and toggle vendors.
 */
import { useState } from 'react'
import { useVendors, type Vendor } from '../hooks/useVendors'
import { Icon } from '../../../components/ui/Icon'
import { VendorFormModal } from './VendorFormModal'

interface ModalState {
  type: 'none' | 'create' | 'edit'
  vendor?: Vendor
}

export default function VendorsPage({ embedded = false }: { embedded?: boolean }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [modal, setModal] = useState<ModalState>({ type: 'none' })

  const { data: vendors = [], isLoading } = useVendors({ search: searchQuery })

  return (
    <div className={embedded ? '' : 'p-6 max-w-[1200px] mx-auto'}>
      {/* Header */}
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--ink)]">Vendors</h1>
          <p className="text-[var(--muted)] mt-1">Manage equipment and material suppliers</p>
        </div>
      )}

      {/* Filter Bar */}
      <div className="mb-6 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>
            Search
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Vendor name..."
            className="form-input w-full"
          />
        </div>

        <button
          onClick={() => setModal({ type: 'create' })}
          className="px-4 py-2 rounded-lg text-[var(--on-signal)] text-sm font-medium hover:opacity-90"
          style={{ background: 'var(--signal)' }}
        >
          <Icon name="plus" className="w-4 h-4 inline mr-1" />
          New Vendor
        </button>
      </div>

      {/* Vendors Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Contact</th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Phone</th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Email</th>
              <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                  <span className="loading loading-spinner loading-sm" />
                </td>
              </tr>
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                  {searchQuery ? 'No matching vendors' : 'No vendors yet'}
                </td>
              </tr>
            ) : (
              vendors.map((vendor) => (
                <VendorRow
                  key={vendor.id}
                  vendor={vendor}
                  onEdit={() => setModal({ type: 'edit', vendor })}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modal.type === 'create' && (
        <VendorFormModal
          onClose={() => setModal({ type: 'none' })}
        />
      )}
      {modal.type === 'edit' && modal.vendor && (
        <VendorFormModal
          vendor={modal.vendor}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
    </div>
  )
}

function VendorRow({
  vendor,
  onEdit,
}: {
  vendor: Vendor
  onEdit: () => void
}) {
  return (
    <tr className="border-b border-[var(--line)] hover:bg-[var(--panel-2)] transition-colors">
      <td className="px-4 py-3 font-medium text-[var(--ink)]">{vendor.name}</td>
      <td className="px-4 py-3 text-[var(--muted)]">{vendor.contact_name || '—'}</td>
      <td className="px-4 py-3 text-[var(--muted)]">{vendor.phone || '—'}</td>
      <td className="px-4 py-3 text-[var(--muted)]">{vendor.email || '—'}</td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={onEdit}
          className="text-xs px-2 py-1 rounded text-[var(--signal)] hover:bg-[var(--panel-2)]"
        >
          Edit
        </button>
      </td>
    </tr>
  )
}
