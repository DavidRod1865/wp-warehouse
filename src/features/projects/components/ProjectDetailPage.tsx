/**
 * ProjectDetailPage — Project hub: overview, inventory (per-project locations),
 * purchase orders, deliveries, and reconciliation for a single project.
 *
 * Job site is the project's address (never entered separately); the project
 * also owns a rigging_yard and a warehouse_area staging location, created and
 * kept in sync by the `ensure_project_locations` RPC (see useProjectMutations).
 */
import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useProjectDetail } from '../hooks/useProjects'
import { useProjectStockLevels, useProjectReturns } from '../../inventory/hooks/useProjectStockLevels'
import { useLocations } from '../../inventory/hooks/useLocations'
import { useMoveInventory } from '../../inventory/hooks/useInventoryMutations'
import { usePurchaseOrders } from '../../purchase-orders/hooks/usePurchaseOrders'
import { useDeliveries } from '../../deliveries/hooks/useDeliveries'
import { useReconciliation } from '../../audit/hooks/useReconciliation'
import type { ReconciliationRow } from '../../audit/hooks/useReconciliation'
import { Icon } from '../../../components/ui/Icon'
import { useToast } from '../../../components/ui/Toast'
import type { ProjectStockLevel } from '../../inventory/hooks/useProjectStockLevels'

type Tab = 'overview' | 'inventory' | 'purchase_orders' | 'deliveries' | 'reconciliation'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'purchase_orders', label: 'Purchase Orders' },
  { id: 'deliveries', label: 'Deliveries' },
  { id: 'reconciliation', label: 'Reconciliation' },
]

const STATUS_STYLES: Record<string, string> = {
  active:
    'bg-[color-mix(in_oklab,var(--signal)_12%,var(--panel))] text-[var(--signal)] border-[color-mix(in_oklab,var(--signal)_30%,transparent)]',
  completed:
    'bg-[var(--ok-soft)] text-[var(--ok)] border-[color-mix(in_oklab,var(--ok)_28%,transparent)]',
  on_hold:
    'bg-[var(--warn-soft)] text-[var(--warn)] border-[color-mix(in_oklab,var(--warn)_28%,transparent)]',
  cancelled:
    'bg-[var(--danger-soft)] text-[var(--danger)] border-[color-mix(in_oklab,var(--danger)_28%,transparent)]',
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const projectId = id ? Number(id) : null
  const { data: project, isLoading } = useProjectDetail(projectId!)

  if (!projectId) {
    return <div>Invalid project ID</div>
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <button
        onClick={() => navigate('/projects')}
        className="inline-flex items-center gap-2 text-[var(--signal)] hover:underline mb-6"
      >
        <Icon name="arrow-left" className="w-4 h-4" />
        Back to Projects
      </button>

      {isLoading ? (
        <div className="text-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : !project ? (
        <div className="text-center text-[var(--muted)] py-12">Project not found</div>
      ) : (
        <>
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <h1 className="text-3xl font-bold text-[var(--ink)]">
                {project.general_contractor ? `${project.general_contractor} - ${project.name}` : project.name}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${
                  STATUS_STYLES[project.status] || 'bg-transparent text-[var(--muted)] border-[var(--line)]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {project.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div role="tablist" className="flex gap-0.5 border-b border-[var(--line)] mb-6 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-[var(--ink)] text-[var(--ink)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--ink-2)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && <OverviewTab project={project} />}
          {activeTab === 'inventory' && <InventoryTab projectId={projectId} />}
          {activeTab === 'purchase_orders' && <PurchaseOrdersTab projectId={projectId} />}
          {activeTab === 'deliveries' && <DeliveriesTab projectId={projectId} />}
          {activeTab === 'reconciliation' && <ReconciliationTab projectId={projectId} />}
        </>
      )}
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────

function OverviewTab({ project }: { project: NonNullable<ReturnType<typeof useProjectDetail>['data']> }) {
  const addr = project.project_address

  return (
    <div className="bg-[var(--panel)] rounded-xl border border-[var(--line)] p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
            General Contractor
          </div>
          <div className="text-[var(--ink)] font-medium">{project.general_contractor || '—'}</div>
        </div>

        <div>
          <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
            Job Site Address
          </div>
          <div className="text-[var(--ink)] text-sm">
            {addr?.street_address && <div>{addr.street_address}</div>}
            {(addr?.city || addr?.state) && (
              <div>
                {addr?.city}, {addr?.state} {addr?.zip_code}
              </div>
            )}
            {!addr?.street_address && !addr?.city && <span className="text-[var(--muted)]">—</span>}
          </div>
        </div>
      </div>

      {project.notes && (
        <div className="mt-6 pt-6 border-t border-[var(--line)]">
          <div className="text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>
            Notes
          </div>
          <p className="text-sm text-[var(--ink-2)]">{project.notes}</p>
        </div>
      )}
    </div>
  )
}

// ── Inventory ─────────────────────────────────────────────────────────────

const LOCATION_TYPE_LABEL: Record<string, string> = {
  warehouse_area: 'Warehouse Staging',
  rigging_yard: 'Rigging Yard',
  job_site: 'Job Site',
}

function InventoryTab({ projectId }: { projectId: number }) {
  const { data: stock = [], isLoading } = useProjectStockLevels(projectId)
  const { data: returns = [], isLoading: returnsLoading } = useProjectReturns(projectId)
  const [returnModalStock, setReturnModalStock] = useState<ProjectStockLevel | null>(null)

  const grouped = useMemo(() => {
    const groups: Record<string, ProjectStockLevel[]> = {
      warehouse_area: [],
      rigging_yard: [],
      job_site: [],
    }
    for (const row of stock) {
      const type = row.location?.location_type
      if (type && groups[type]) groups[type].push(row)
    }
    return groups
  }, [stock])

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {(['warehouse_area', 'rigging_yard', 'job_site'] as const).map((type) => (
        <div key={type} className="bg-[var(--panel)] rounded-xl border border-[var(--line)] overflow-hidden">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-2)]">
            <h2 className="text-lg font-semibold text-[var(--ink)]">{LOCATION_TYPE_LABEL[type]}</h2>
          </div>
          {grouped[type].length === 0 ? (
            <div className="p-6 text-center text-[var(--muted)] text-sm">No stock</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)]">
                    <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Item</th>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Part Number</th>
                    <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Quantity</th>
                    {type !== 'warehouse_area' && (
                      <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {grouped[type].map((row) => (
                    <tr key={row.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-4 py-3 font-medium text-[var(--ink)]">{row.item?.name || '—'}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{row.item?.part_number || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono">{row.quantity}</td>
                      {type !== 'warehouse_area' && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setReturnModalStock(row)}
                            disabled={row.quantity === 0}
                            className="text-xs px-2 py-1 rounded text-[var(--signal)] hover:bg-[var(--panel-2)] disabled:opacity-40"
                          >
                            Return overstock
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      <div className="bg-[var(--panel)] rounded-xl border border-[var(--line)] overflow-hidden">
        <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-2)]">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Overstock Returns</h2>
        </div>
        {returnsLoading ? (
          <div className="p-6 text-center">
            <span className="loading loading-spinner loading-sm" />
          </div>
        ) : returns.length === 0 ? (
          <div className="p-6 text-center text-[var(--muted)] text-sm">No returns recorded</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Item</th>
                  <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Qty</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Destination</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((mv) => (
                  <tr key={mv.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {new Date(mv.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-[var(--ink)]">{mv.item?.name || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">{mv.quantity}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{mv.to_location?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {returnModalStock && (
        <ReturnOverstockModal
          projectId={projectId}
          stock={returnModalStock}
          onClose={() => setReturnModalStock(null)}
        />
      )}
    </div>
  )
}

function ReturnOverstockModal({
  projectId,
  stock,
  onClose,
}: {
  projectId: number
  stock: ProjectStockLevel
  onClose: () => void
}) {
  const { data: sharedWarehouses = [] } = useLocations({ type: 'warehouse_area', activeOnly: true })
  const [toLocationId, setToLocationId] = useState<number | null>(null)
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const moveInventory = useMoveInventory()
  const { toast } = useToast()

  // Destinations: shared warehouse areas (no project) or this project's own
  // warehouse staging location.
  const destinations = sharedWarehouses.filter(
    (l) => l.project_id === null || l.project_id === projectId
  )

  const qtyNum = Number(qty)
  const isValid = toLocationId !== null && qtyNum > 0 && qtyNum <= stock.quantity

  async function handleSave() {
    if (!isValid || toLocationId === null) return

    setSaving(true)
    try {
      await moveInventory.mutateAsync({
        item_id: stock.item_id,
        quantity: qtyNum,
        movement_type: 'return',
        from_location_id: stock.location_id,
        to_location_id: toLocationId,
        reference_type: 'overstock_return',
        reference_id: projectId,
        notes: notes.trim() || undefined,
      })

      toast('Overstock returned')
      onClose()
    } catch (err) {
      console.error('Return overstock failed:', err)
      toast(err instanceof Error ? err.message : 'Failed to return overstock', 'error')
    } finally {
      setSaving(false)
    }
  }

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
        className="bg-[var(--panel)] rounded-xl w-full max-w-md overflow-hidden"
        style={{ boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)' }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--line)]">
          <h3 className="text-lg font-semibold">Return Overstock</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--panel-2)] text-[var(--muted)]"
            disabled={saving}
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
              Item
            </div>
            <div className="form-input bg-[var(--panel-2)] text-[var(--ink)]">{stock.item?.name || '—'}</div>
          </div>

          <div>
            <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
              From
            </div>
            <div className="form-input bg-[var(--panel-2)] text-[var(--ink)]">
              {stock.location?.name || '—'} ({stock.quantity} available)
            </div>
          </div>

          <div>
            <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
              Return To
            </div>
            <select
              value={toLocationId ?? ''}
              onChange={(e) => setToLocationId(e.target.value ? Number(e.target.value) : null)}
              className="form-input w-full"
              disabled={saving}
              autoFocus
            >
              <option value="">Select destination…</option>
              {destinations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} {loc.project_id === null ? '(Shared)' : '(Project Staging)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
              Quantity
            </div>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              min={1}
              max={stock.quantity}
              className="form-input w-full"
              disabled={saving}
            />
          </div>

          <div>
            <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
              Notes
            </div>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note..."
              className="form-input w-full"
              disabled={saving}
            />
          </div>
        </div>

        <div
          className="flex justify-end gap-2 px-6 py-3.5 border-t border-[var(--line)]"
          style={{ background: 'color-mix(in oklab, var(--panel-2) 50%, var(--panel))' }}
        >
          <button
            className="px-3.5 py-2 rounded-lg text-[var(--ink-2)] text-sm font-medium hover:bg-[var(--panel-2)]"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="px-3.5 py-2 rounded-lg text-[var(--on-signal)] text-sm font-medium hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--signal)' }}
            onClick={handleSave}
            disabled={!isValid || saving}
          >
            {saving ? <span className="loading loading-spinner loading-sm" /> : 'Return'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Purchase Orders ───────────────────────────────────────────────────────

function PurchaseOrdersTab({ projectId }: { projectId: number }) {
  const { data: pos = [], isLoading } = usePurchaseOrders({ project_id: projectId })

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (pos.length === 0) {
    return <div className="text-center text-[var(--muted)] py-12">No purchase orders for this project</div>
  }

  return (
    <div className="bg-[var(--panel)] rounded-xl border border-[var(--line)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">PO #</th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Vendor</th>
              <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Received</th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {pos.map((po) => {
              const lineItems = po.line_items || []
              const receivedCount = lineItems.filter(
                (li) => li.received_status === 'received' || li.received_status === 'over_received'
              ).length
              return (
                <tr key={po.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--panel-2)]">
                  <td className="px-4 py-3">
                    <Link to={`/purchase-orders/${po.id}`} className="text-[var(--signal)] hover:underline font-mono text-xs">
                      {po.po_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--ink)]">{po.vendor?.name || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {receivedCount}/{lineItems.length}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 bg-[var(--panel-2)] rounded">
                      {po.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Deliveries ────────────────────────────────────────────────────────────

function DeliveriesTab({ projectId }: { projectId: number }) {
  const { data: deliveries = [], isLoading } = useDeliveries({ projectId })

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (deliveries.length === 0) {
    return <div className="text-center text-[var(--muted)] py-12">No deliveries for this project</div>
  }

  return (
    <div className="bg-[var(--panel)] rounded-xl border border-[var(--line)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Delivery #</th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Date</th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--panel-2)]">
                <td className="px-4 py-3">
                  <Link to={`/deliveries/${d.id}`} className="text-[var(--signal)] hover:underline font-mono text-xs">
                    {d.delivery_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {new Date(d.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 bg-[var(--panel-2)] rounded">{d.status.replace('_', ' ')}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Reconciliation ────────────────────────────────────────────────────────

const RECON_STATE_BADGE: Record<ReconciliationRow['reconciliation_state'], { label: string; cls: string }> = {
  backorder: { label: 'Backorder', cls: 'badge badge-warning' },
  complete: { label: 'Complete', cls: 'badge badge-success' },
  in_warehouse: { label: 'In Warehouse', cls: 'badge badge-neutral' },
  in_transit: { label: 'In Transit', cls: 'badge badge-info' },
  over_delivered: { label: 'Over-Delivered', cls: 'badge badge-error' },
}

function ReconciliationTab({ projectId }: { projectId: number }) {
  const { data: rows = [], isLoading } = useReconciliation(projectId)

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (rows.length === 0) {
    return <div className="text-center text-[var(--muted)] py-12">No PO lines found for this project</div>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
      <table className="table table-sm w-full">
        <thead>
          <tr className="bg-[var(--panel-2)] text-[var(--ink-2)] text-xs uppercase tracking-wider">
            <th>PO #</th>
            <th>Line</th>
            <th>Description</th>
            <th>Part #</th>
            <th className="text-right">Ordered</th>
            <th className="text-right">Received</th>
            <th className="text-right">Delivered</th>
            <th className="text-right">On Hand</th>
            <th className="text-right">On Truck</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cfg = RECON_STATE_BADGE[row.reconciliation_state] ?? {
              label: row.reconciliation_state,
              cls: 'badge badge-ghost',
            }
            return (
              <tr key={row.po_line_item_id} className="hover:bg-[var(--panel-2)]">
                <td className="font-mono text-xs">{row.po_number}</td>
                <td className="text-center text-xs text-[var(--muted)]">{row.line_number}</td>
                <td className="max-w-[200px] truncate text-sm">{row.description}</td>
                <td className="font-mono text-xs text-[var(--muted)]">{row.part_number ?? '—'}</td>
                <td className="text-right tabular-nums">{row.quantity_ordered}</td>
                <td className="text-right tabular-nums">{row.quantity_received}</td>
                <td className="text-right tabular-nums">{row.qty_delivered_to_site}</td>
                <td className="text-right tabular-nums">{row.qty_on_hand_warehouse}</td>
                <td className="text-right tabular-nums">{row.qty_on_truck}</td>
                <td>
                  <span className={cfg.cls}>{cfg.label}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
