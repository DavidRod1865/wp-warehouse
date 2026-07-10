/**
 * ClientsPage — General Contractors (Clients) directory
 *
 * List, search, create, edit, and toggle clients. Shows company info and project count.
 */
import { useState } from 'react'
import { useClients, useClientProjects, type GeneralContractor } from '../hooks/useClients'
import { useToggleClientActive } from '../hooks/useClientMutations'
import { Icon } from '../../../components/ui/Icon'
import { ClientFormModal } from './ClientFormModal'

interface ModalState {
  type: 'none' | 'create' | 'edit' | 'detail'
  client?: GeneralContractor
}

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [modal, setModal] = useState<ModalState>({ type: 'none' })

  const { data: clients = [], isLoading } = useClients({ search: searchQuery })

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--ink)]">Clients</h1>
        <p className="text-[var(--muted)] mt-1">Manage general contractors and project clients</p>
      </div>

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
            placeholder="Company name..."
            className="form-input w-full"
          />
        </div>

        <button
          onClick={() => setModal({ type: 'create' })}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
          style={{ background: 'var(--signal)' }}
        >
          <Icon name="plus" className="w-4 h-4 inline mr-1" />
          New Client
        </button>
      </div>

      {/* Clients Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Company</th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Contact</th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Phone</th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Email</th>
              <th className="px-4 py-3 text-center font-semibold text-[var(--ink)]">Projects</th>
              <th className="px-4 py-3 text-center font-semibold text-[var(--ink)]">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">
                  <span className="loading loading-spinner loading-sm" />
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">
                  {searchQuery ? 'No matching clients' : 'No clients yet'}
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <ClientRow
                  key={client.id}
                  client={client}
                  onEdit={() => setModal({ type: 'edit', client })}
                  onDetail={() => setModal({ type: 'detail', client })}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modal.type === 'create' && (
        <ClientFormModal
          onClose={() => setModal({ type: 'none' })}
        />
      )}
      {modal.type === 'edit' && modal.client && (
        <ClientFormModal
          client={modal.client}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
      {modal.type === 'detail' && modal.client && (
        <ClientDetailModal
          client={modal.client}
          onClose={() => setModal({ type: 'none' })}
          onEdit={() => {
            setModal({ type: 'edit', client: modal.client })
          }}
        />
      )}
    </div>
  )
}

function ClientRow({
  client,
  onEdit,
  onDetail,
}: {
  client: GeneralContractor
  onEdit: () => void
  onDetail: () => void
}) {
  const toggleActive = useToggleClientActive()
  const { data: projects = [], isLoading } = useClientProjects(client.id)

  return (
    <tr className="border-b border-[var(--line)] hover:bg-[var(--panel-2)] transition-colors">
      <td className="px-4 py-3 font-medium text-[var(--ink)]">{client.company_name}</td>
      <td className="px-4 py-3 text-[var(--muted)]">{client.contact_name || '—'}</td>
      <td className="px-4 py-3 text-[var(--muted)]">{client.phone || '—'}</td>
      <td className="px-4 py-3 text-[var(--muted)]">{client.email || '—'}</td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm font-mono">{isLoading ? '…' : projects.length}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <label className="cursor-pointer flex justify-center">
          <input
            type="checkbox"
            checked={client.is_active}
            onChange={(e) =>
              toggleActive.mutate({ id: client.id, isActive: e.target.checked })
            }
            className="checkbox checkbox-sm"
            disabled={toggleActive.isPending}
          />
        </label>
      </td>
      <td className="px-4 py-3 text-right space-x-1">
        <button
          onClick={onDetail}
          className="text-xs px-2 py-1 rounded text-[var(--signal)] hover:bg-[var(--panel-2)]"
        >
          View
        </button>
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

function ClientDetailModal({
  client,
  onClose,
  onEdit,
}: {
  client: GeneralContractor
  onClose: () => void
  onEdit: () => void
}) {
  const { data: projects = [] } = useClientProjects(client.id)

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{
        background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--panel)] rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        style={{ boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)' }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--line)]">
          <h3 className="text-lg font-semibold">{client.company_name}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--panel-2)] text-[var(--muted)]"
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Info */}
          <div className="space-y-2">
            <div className="text-xs text-[var(--muted)] uppercase" style={{ fontFamily: 'var(--mono)', letterSpacing: '.08em' }}>Contact Info</div>
            <div className="space-y-1 text-sm">
              {client.contact_name && <div><span className="text-[var(--muted)]">Contact:</span> {client.contact_name}</div>}
              {client.phone && <div><span className="text-[var(--muted)]">Phone:</span> {client.phone}</div>}
              {client.email && <div><span className="text-[var(--muted)]">Email:</span> {client.email}</div>}
            </div>
          </div>

          {/* Address */}
          {client.billing_address && Object.keys(client.billing_address).length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-[var(--muted)] uppercase" style={{ fontFamily: 'var(--mono)', letterSpacing: '.08em' }}>Billing Address</div>
              <div className="text-sm space-y-0.5">
                {client.billing_address.street && <div>{client.billing_address.street}</div>}
                {(client.billing_address.city || client.billing_address.state || client.billing_address.zip) && (
                  <div>
                    {[client.billing_address.city, client.billing_address.state, client.billing_address.zip]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {client.notes && (
            <div className="space-y-2">
              <div className="text-xs text-[var(--muted)] uppercase" style={{ fontFamily: 'var(--mono)', letterSpacing: '.08em' }}>Notes</div>
              <div className="text-sm text-[var(--ink)]">{client.notes}</div>
            </div>
          )}

          {/* Projects */}
          <div className="space-y-3">
            <div className="text-xs text-[var(--muted)] uppercase" style={{ fontFamily: 'var(--mono)', letterSpacing: '.08em' }}>Projects</div>
            {projects.length === 0 ? (
              <div className="text-sm text-[var(--muted)]">No projects assigned</div>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => (
                  <div key={p.id} className="p-2 bg-[var(--panel-2)] rounded text-sm">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-[var(--muted)]">{p.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className="flex justify-end gap-2 px-6 py-3.5 border-t border-[var(--line)]"
          style={{ background: 'color-mix(in oklab, var(--panel-2) 50%, var(--panel))' }}
        >
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:bg-[var(--panel-2)]"
          >
            Close
          </button>
          <button
            onClick={() => {
              onEdit()
              onClose()
            }}
            className="px-3 py-2 rounded-lg text-sm text-white hover:opacity-90"
            style={{ background: 'var(--signal)' }}
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  )
}
