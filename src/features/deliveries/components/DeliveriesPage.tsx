/**
 * DeliveriesPage — Full delivery orders list with driver schedule strip.
 *
 * Matches the deliveries-hifi design: hero + ScheduleStrip + OrdersTable.
 * All data from useDeliveries — no hardcoded rows.
 */
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/hooks/useAuth'
import { useDeliveries } from '../hooks/useDeliveries'
import { useDeleteDelivery } from '../hooks/useDeliveryMutations'
import { generateDeliveryPDF } from '../utils/generateDeliveryPDF'
import { DriverTimeline } from '../../../components/ui/DriverTimeline'
import { StatusChip } from '../../../components/ui/StatusChip'
import { ProgressBar } from '../../../components/ui/ProgressBar'
import { Icon } from '../../../components/ui/Icon'
import type { Delivery } from '../types'

type Tab = 'all' | 'open' | 'today' | 'delivered'

export default function DeliveriesPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { data: allDeliveries = [], isLoading } = useDeliveries()
  const deleteDelivery = useDeleteDelivery()
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [deleteTarget, setDeleteTarget] = useState<Delivery | null>(null)

  // Tab filtering
  const filtered = useMemo(() => {
    const today = new Date().toDateString()
    switch (activeTab) {
      case 'open':
        return allDeliveries.filter((d) => !['delivered', 'cancelled'].includes(d.status))
      case 'today':
        return allDeliveries.filter((d) => new Date(d.created_at).toDateString() === today)
      case 'delivered':
        return allDeliveries.filter((d) => d.status === 'delivered')
      default:
        return allDeliveries
    }
  }, [allDeliveries, activeTab])

  // Stats
  const openCount = allDeliveries.filter((d) => !['delivered', 'cancelled'].includes(d.status)).length
  const todayCount = allDeliveries.filter(
    (d) => new Date(d.created_at).toDateString() === new Date().toDateString()
  ).length
  const inTransitCount = allDeliveries.filter((d) => d.status === 'in_transit').length
  const lateCount = 0 // We'd need started_at + expected duration to derive this

  // Drivers for timeline — derive unique driver_ids from today's deliveries
  const todayDeliveries = useMemo(() => {
    const today = new Date().toDateString()
    return allDeliveries.filter(
      (d) =>
        new Date(d.created_at).toDateString() === today &&
        !['cancelled'].includes(d.status)
    )
  }, [allDeliveries])

  const drivers = useMemo(() => {
    const seen = new Map<string, string>()
    for (const d of todayDeliveries) {
      if (d.driver_id && !seen.has(d.driver_id)) {
        seen.set(d.driver_id, d.truck_name || `Driver`)
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [todayDeliveries])

  const handleDelete = async () => {
    if (!deleteTarget || !user) return
    try {
      await deleteDelivery.mutateAsync({
        deliveryId: deleteTarget.id,
        deliveryNumber: deleteTarget.delivery_number,
        status: deleteTarget.status,
        truckSortlyFolderId: null,
        fromLocationId: null,
        activityLog: deleteTarget.activity_log || [],
        deliveryItems: [],
        userId: user.id,
        userEmail: user.email || '',
        userName: profile?.name || undefined,
      })
      setDeleteTarget(null)
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: allDeliveries.length },
    { key: 'open', label: 'Open', count: openCount },
    { key: 'today', label: 'Today', count: todayCount },
    { key: 'delivered', label: 'Delivered' },
  ]

  return (
    <div className="p-6 max-w-[1600px]">
      {/* Hero */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div
            className="text-[var(--muted)] uppercase"
            style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.06em' }}
          >
            Delivery orders &middot;{' '}
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </div>
          <h1
            className="text-[var(--ink)] mt-1"
            style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 500, letterSpacing: '-0.5px' }}
          >
            Deliveries
          </h1>
          <div className="text-[var(--ink-2)] mt-1" style={{ fontSize: 14 }}>
            <b>{todayCount}</b> run{todayCount !== 1 ? 's' : ''} today &middot;{' '}
            <b>{inTransitCount}</b> in flight
            {lateCount > 0 && (
              <>
                {' '}
                &middot; <b style={{ color: 'var(--danger)' }}>{lateCount} running late</b>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] text-[var(--ink-2)] text-sm font-medium hover:bg-[var(--panel-2)]"
          >
            <Icon name="download" className="w-3.5 h-3.5" />
            Export manifest
          </button>
          <button
            onClick={() => navigate('/deliveries/new')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--signal)' }}
          >
            <Icon name="plus" className="w-3.5 h-3.5" />
            New delivery order
          </button>
        </div>
      </div>

      {/* Driver Timeline */}
      <DriverTimeline deliveries={todayDeliveries} drivers={drivers} />

      {/* Orders Table */}
      <div className="border border-[var(--line)] rounded-xl bg-[var(--panel)] overflow-hidden">
        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--line)]">
          <div>
            <div
              className="font-medium text-[var(--ink)]"
              style={{ fontFamily: 'var(--serif)', fontSize: 15 }}
            >
              Delivery orders
            </div>
            <div
              className="text-[var(--muted)] mt-0.5"
              style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
            >
              {filtered.length} shown &middot; {allDeliveries.length} all-time
            </div>
          </div>
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={{
                  background: activeTab === tab.key ? 'var(--panel-2)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--ink)' : 'var(--muted)',
                }}
              >
                {tab.label}
                {tab.count != null && (
                  <span className="ml-1" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[var(--muted)]">
            <p className="text-base font-medium">No deliveries found</p>
            <p className="text-sm mt-1">
              {activeTab !== 'all' ? 'Try a different filter' : 'Create your first delivery to get started'}
            </p>
          </div>
        ) : (
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
                  <th className="text-left font-medium px-5 py-2.5" style={{ width: 90 }}>
                    Order
                  </th>
                  <th className="text-left font-medium px-3 py-2.5">Project &middot; site</th>
                  <th className="text-left font-medium px-3 py-2.5" style={{ width: 150 }}>
                    Driver
                  </th>
                  <th className="text-left font-medium px-3 py-2.5" style={{ width: 120 }}>
                    Scheduled
                  </th>
                  <th className="text-left font-medium px-3 py-2.5" style={{ width: 130 }}>
                    Status
                  </th>
                  <th className="text-left font-medium px-3 py-2.5" style={{ width: 110 }}>
                    Items
                  </th>
                  <th className="text-left font-medium px-3 py-2.5" style={{ width: 100 }}>
                    POD
                  </th>
                  <th className="font-medium px-3 py-2.5" style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((del) => (
                  <OrderRow
                    key={del.id}
                    delivery={del}
                    onEdit={() => navigate(`/deliveries/${del.id}`)}
                    onDelete={() => setDeleteTarget(del)}
                    onPdf={() => generateDeliveryPDF({
                      delivery_number: del.delivery_number,
                      project_name: del.projects?.name || null,
                      truck_name: del.truck_name || null,
                      from_address: del.from_address,
                      to_address: del.to_address,
                      status: del.status,
                      created_at: del.created_at,
                      items: [],
                      signature_name: del.signature_name,
                      signature_data: del.signature_data,
                    })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div
            className="flex items-center justify-between px-5 py-3 border-t border-[var(--line)] text-[var(--muted)]"
            style={{ fontSize: 12 }}
          >
            <span>
              Showing {filtered.length} of {allDeliveries.length}
            </span>
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-10"
          style={{
            background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-[var(--panel)] rounded-xl p-6 w-full max-w-md"
            style={{ boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-[var(--ink)]"
              style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500 }}
            >
              Delete delivery?
            </h3>
            <p className="text-[var(--ink-2)] text-sm mt-2">
              This will permanently delete{' '}
              <b className="text-[var(--ink)]">{deleteTarget.delivery_number}</b>. This action
              cannot be undone.
            </p>
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-[var(--line)] text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--panel-2)]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteDelivery.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--danger)' }}
              >
                {deleteDelivery.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Order Row ──

function OrderRow({
  delivery,
  onEdit,
  onDelete,
  onPdf,
}: {
  delivery: Delivery
  onEdit: () => void
  onDelete: () => void
  onPdf: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  const projectName = delivery.projects?.name || delivery.to_address?.company_name || '—'
  const address = delivery.to_address?.street_address || '—'
  const truckName = delivery.truck_name || '—'

  const created = new Date(delivery.created_at)
  const isToday = created.toDateString() === new Date().toDateString()
  const dateLabel = isToday
    ? 'Today'
    : created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const timeLabel = created.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const hasPod = delivery.signature_data != null

  return (
    <tr
      className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--panel-2)] transition-colors cursor-pointer"
      onClick={onEdit}
    >
      <td className="px-5 py-3" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)' }}>
        #{delivery.delivery_number?.replace('DEL-', '') || delivery.id}
      </td>
      <td className="px-3 py-3">
        <div className="font-medium text-[var(--ink)]">{projectName}</div>
        <div className="text-[var(--muted)] mt-0.5" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
          {address}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span
            className="w-[22px] h-[22px] rounded-full text-white grid place-items-center font-semibold shrink-0"
            style={{
              fontSize: 9,
              background: delivery.driver_id
                ? 'linear-gradient(135deg, #4a5578, #1a2338)'
                : 'var(--muted)',
            }}
          >
            {delivery.driver_id ? '?' : '??'}
          </span>
          <span className="text-sm">
            {delivery.driver_id ? truckName : (
              <span className="text-[var(--muted)] italic">unassigned</span>
            )}
          </span>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="font-medium text-[var(--ink)]">{dateLabel}</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
          {timeLabel}
        </div>
      </td>
      <td className="px-3 py-3">
        <StatusChip status={delivery.status} />
      </td>
      <td className="px-3 py-3">
        <ProgressBar value={delivery.status === 'delivered' ? 100 : 0} />
        <span
          className="text-[var(--ink-2)] mt-1 block"
          style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
        >
          {delivery.items_count || 0} items
        </span>
      </td>
      <td className="px-3 py-3">
        {hasPod ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[var(--ok-soft)] text-[var(--ok)]">
            <Icon name="check" className="w-2.5 h-2.5" />
            signed
          </span>
        ) : (
          <span className="text-[var(--faint)]">&mdash;</span>
        )}
      </td>
      <td className="px-3 py-3 relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-7 h-7 rounded-md grid place-items-center hover:bg-[var(--panel-2)] text-[var(--muted)]"
        >
          <Icon name="more" className="w-4 h-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div
              className="absolute right-0 top-full z-50 w-40 rounded-lg border border-[var(--line)] bg-[var(--panel)] py-1"
              style={{ boxShadow: 'var(--shadow)' }}
            >
              <button
                onClick={() => { onEdit(); setMenuOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--panel-2)] text-[var(--ink-2)]"
              >
                Edit
              </button>
              <button
                onClick={() => { onPdf(); setMenuOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--panel-2)] text-[var(--ink-2)]"
              >
                Download PDF
              </button>
              <hr className="my-1 border-[var(--line)]" />
              <button
                onClick={() => { onDelete(); setMenuOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--panel-2)] text-[var(--danger)]"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </td>
    </tr>
  )
}
