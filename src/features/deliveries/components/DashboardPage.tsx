/**
 * DashboardPage — Main manager dashboard matching hi-fi design.
 *
 * Hero greeting, stat cards with sparklines, active deliveries table,
 * attention rail. All data from real hooks — nothing hardcoded.
 */
import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../auth/hooks/useAuth'
import { useDeliveries, type DeliveryFilters } from '../hooks/useDeliveries'
import { useDeleteDelivery } from '../hooks/useDeliveryMutations'
import { generateDeliveryPDF } from '../utils/generateDeliveryPDF'
import type { Delivery, DeliveryStatus } from '../types'
import { StatCard } from '../../../components/ui/StatCard'
import { StatusChip } from '../../../components/ui/StatusChip'
import { Icon } from '../../../components/ui/Icon'
import { DeleteConfirmDialog } from '../../../components/ui/DeleteConfirmDialog'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(): string {
  const now = new Date()
  const day = now.toLocaleDateString('en-US', { weekday: 'long' })
  const month = now.toLocaleDateString('en-US', { month: 'long' })
  const date = now.getDate()
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${day} · ${month} ${date} · ${time}`
}

export default function DashboardPage() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<DeliveryStatus | 'all'>('all')
  const [deliveryToDelete, setDeliveryToDelete] = useState<Delivery | null>(null)

  // Fetch all deliveries (unfiltered) for counts, and filtered for table
  const { data: allDeliveries, isLoading: allLoading } = useDeliveries({})
  const filters: DeliveryFilters = useMemo(() => ({
    status: filter === 'all' ? undefined : filter,
  }), [filter])
  const { data: deliveries, isLoading, error } = useDeliveries(filters)
  const deleteDelivery = useDeleteDelivery()

  // Status counts from unfiltered data
  const statusCounts = useMemo(() => {
    const all = allDeliveries || []
    return {
      draft: all.filter((d) => d.status === 'draft').length,
      pending: all.filter((d) => d.status === 'pending').length,
      in_transit: all.filter((d) => d.status === 'in_transit').length,
      delivered: all.filter((d) => d.status === 'delivered').length,
      cancelled: all.filter((d) => d.status === 'cancelled').length,
      total: all.length,
    }
  }, [allDeliveries])

  // Derive attention items from real data
  const attentionItems = useMemo(() => {
    const items: Array<{ tone: 'warn' | 'info' | 'ok'; title: string; sub: string; action: string; onClick?: () => void }> = []
    const all = allDeliveries || []

    // Deliveries stuck in draft
    const drafts = all.filter(d => d.status === 'draft')
    if (drafts.length > 0) {
      items.push({
        tone: 'warn',
        title: `${drafts.length} deliver${drafts.length > 1 ? 'ies' : 'y'} still in draft`,
        sub: drafts.map(d => d.delivery_number).slice(0, 3).join(', ') + (drafts.length > 3 ? ` +${drafts.length - 3} more` : ''),
        action: 'Review',
        onClick: () => setFilter('draft'),
      })
    }

    // Deliveries in transit
    const inTransit = all.filter(d => d.status === 'in_transit')
    if (inTransit.length > 0) {
      items.push({
        tone: 'info',
        title: `${inTransit.length} deliver${inTransit.length > 1 ? 'ies' : 'y'} in transit`,
        sub: inTransit.map(d => d.delivery_number).slice(0, 3).join(', '),
        action: 'Track',
        onClick: () => setFilter('in_transit'),
      })
    }

    // Recently delivered
    const recentDelivered = all.filter(d => {
      if (d.status !== 'delivered' || !d.delivered_at) return false
      const deliveredDate = new Date(d.delivered_at)
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      return deliveredDate > dayAgo
    })
    if (recentDelivered.length > 0) {
      items.push({
        tone: 'ok',
        title: `${recentDelivered.length} deliver${recentDelivered.length > 1 ? 'ies' : 'y'} completed recently`,
        sub: recentDelivered.map(d => d.delivery_number).join(', '),
        action: 'View',
        onClick: () => setFilter('delivered'),
      })
    }

    return items
  }, [allDeliveries])

  const handleDelete = async () => {
    if (!deliveryToDelete || !user) return
    try {
      await deleteDelivery.mutateAsync({
        deliveryId: deliveryToDelete.id,
        deliveryNumber: deliveryToDelete.delivery_number,
        status: deliveryToDelete.status,
        fromLocationId: null,
        activityLog: deliveryToDelete.activity_log || [],
        deliveryItems: [],
        userId: user.id,
        userEmail: user.email || '',
        userName: profile?.name || undefined,
      })
      setDeliveryToDelete(null)
    } catch (err) {
      console.error('Failed to delete delivery:', err)
    }
  }

  const handlePrintPDF = async (delivery: Delivery) => {
    try {
      await generateDeliveryPDF({
        delivery_number: delivery.delivery_number,
        project_name: delivery.projects?.name || null,
        truck_name: delivery.truck_name || null,
        from_address: delivery.from_address,
        to_address: delivery.to_address,
        status: delivery.status,
        created_at: delivery.created_at,
        items: [],
        signature_name: delivery.signature_name,
        signature_data: delivery.signature_data,
      })
    } catch (err) {
      console.error('Failed to generate PDF:', err)
    }
  }

  const firstName = profile?.name?.split(' ')[0] || profile?.email || 'Manager'

  return (
    <div className="px-8 py-7 max-w-[1480px]">
      {/* ── Hero ──────────────────────────────────────── */}
      <header className="flex items-end justify-between mb-7 gap-6">
        <div>
          <div
            className="text-[var(--muted)] uppercase"
            style={{ fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '.08em' }}
          >
            {formatDate()}
          </div>
          <h1
            className="mt-1.5 mb-0.5 text-[30px] font-medium tracking-tight leading-tight"
            style={{ fontFamily: 'var(--serif)', letterSpacing: '-0.6px' }}
          >
            {getGreeting()}, {firstName}.
          </h1>
          <div className="text-[var(--muted)] text-sm">
            {allLoading ? (
              <span className="inline-block w-48 h-4 bg-[var(--panel-2)] rounded animate-pulse" />
            ) : (
              <>
                <b className="text-[var(--ink-2)] font-medium">{statusCounts.in_transit}</b> in transit ·{' '}
                <b className="text-[var(--ink-2)] font-medium">{statusCounts.pending}</b> pending ·{' '}
                <b className="text-[var(--ink-2)] font-medium">{statusCounts.draft}</b> drafts
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            to="/receiving"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[var(--line-2)] bg-[var(--panel)] text-[var(--ink)] text-[13.5px] font-medium no-underline hover:bg-[var(--panel-2)] transition-colors"
          >
            <Icon name="clipboard" className="w-[15px] h-[15px]" /> Receive shipment
          </Link>
          <Link
            to="/inventory"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[var(--line-2)] bg-[var(--panel)] text-[var(--ink)] text-[13.5px] font-medium no-underline hover:bg-[var(--panel-2)] transition-colors"
          >
            <Icon name="box" className="w-[15px] h-[15px]" /> Count stock
          </Link>
          <button
            onClick={() => navigate('/deliveries/new')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[var(--ink)] text-[var(--on-ink)] text-[13.5px] font-medium border border-[var(--ink)] hover:bg-[var(--ink-2)] transition-colors"
            style={{ boxShadow: '0 1px 0 color-mix(in oklab, var(--ink) 40%, #000), 0 4px 12px -2px color-mix(in oklab, var(--ink) 40%, transparent)' }}
          >
            <Icon name="plus" className="w-[15px] h-[15px]" /> New delivery
          </button>
        </div>
      </header>

      {/* ── Stat Cards ────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Draft deliveries"
          value={allLoading ? '—' : statusCounts.draft}
          unit="orders"
          dotColor="var(--muted)"
          sparkColor="var(--muted)"
          subtitle={statusCounts.draft > 0 ? <span>Awaiting submission</span> : undefined}
          loading={allLoading}
          onClick={() => setFilter(filter === 'draft' ? 'all' : 'draft')}
          active={filter === 'draft'}
        />
        <StatCard
          label="Pending pickup"
          value={allLoading ? '—' : statusCounts.pending}
          unit="orders"
          dotColor="var(--warn)"
          sparkColor="var(--warn)"
          subtitle={statusCounts.pending > 0 ? <span>Ready for driver</span> : undefined}
          loading={allLoading}
          onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')}
          active={filter === 'pending'}
        />
        <StatCard
          label="In transit"
          value={allLoading ? '—' : statusCounts.in_transit}
          unit="trucks"
          dotColor="var(--signal)"
          sparkColor="var(--signal)"
          subtitle={statusCounts.in_transit > 0 ? <span>On the road now</span> : undefined}
          loading={allLoading}
          onClick={() => setFilter(filter === 'in_transit' ? 'all' : 'in_transit')}
          active={filter === 'in_transit'}
        />
        <StatCard
          label="Delivered"
          value={allLoading ? '—' : statusCounts.delivered}
          unit="complete"
          dotColor="var(--ok)"
          sparkColor="var(--ok)"
          subtitle={statusCounts.delivered > 0 ? <span>Successfully completed</span> : undefined}
          loading={allLoading}
          onClick={() => setFilter(filter === 'delivered' ? 'all' : 'delivered')}
          active={filter === 'delivered'}
        />
      </div>

      {/* ── Two-column grid ───────────────────────────── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1.45fr 1fr' }}>
        {/* Left: Active deliveries table */}
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius)] shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="flex items-center gap-3 px-[18px] pt-4 pb-3">
            <div>
              <div className="font-medium text-[17px]" style={{ fontFamily: 'var(--serif)', letterSpacing: '-0.2px' }}>
                Active deliveries
              </div>
              <div className="text-xs text-[var(--muted)]">
                {allLoading ? '...' : `${statusCounts.total} total · ${filter === 'all' ? 'showing all' : `filtered: ${filter.replace('_', ' ')}`}`}
              </div>
            </div>
            <div className="w-px h-4 bg-[var(--line)]" />
            {statusCounts.in_transit > 0 && (
              <div className="inline-flex items-center gap-1.5" style={{ fontFamily: 'var(--mono)', fontSize: '10px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                <span className="w-[7px] h-[7px] rounded-full bg-[var(--ok)]" style={{ animation: 'pulse-ring 1.8s ease-out infinite' }} />
                live
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <div className="flex gap-0.5 bg-[var(--panel-2)] p-0.5 rounded-[7px]">
                {(['all', 'pending', 'in_transit', 'delivered'] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setFilter(filter === key ? 'all' : key)}
                    className={`px-2.5 py-1 rounded-[5px] text-xs font-medium cursor-pointer transition-colors ${
                      filter === key
                        ? 'bg-[var(--panel)] text-[var(--ink)] shadow-[var(--shadow-sm)]'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {key === 'all' ? 'All' : key === 'in_transit' ? 'Transit' : key.charAt(0).toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          {error ? (
            <div className="px-[18px] py-8 text-center text-[var(--danger)]">
              Failed to load: {error.message}
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : !deliveries || deliveries.length === 0 ? (
            <div className="text-center py-16 text-[var(--faint)]">
              <p className="text-lg">No deliveries found</p>
              <p className="text-sm mt-1">Create your first delivery to get started</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr>
                    <th className="text-left font-medium text-[var(--muted)] text-[11.5px] tracking-wider uppercase px-[18px] py-2 bg-[var(--panel-2)] border-y border-[var(--line)]" style={{ paddingLeft: '18px' }}>
                      Delivery & project
                    </th>
                    <th className="text-left font-medium text-[var(--muted)] text-[11.5px] tracking-wider uppercase px-[18px] py-2 bg-[var(--panel-2)] border-y border-[var(--line)]">
                      Status
                    </th>
                    <th className="text-left font-medium text-[var(--muted)] text-[11.5px] tracking-wider uppercase px-[18px] py-2 bg-[var(--panel-2)] border-y border-[var(--line)]">
                      Truck
                    </th>
                    <th className="text-left font-medium text-[var(--muted)] text-[11.5px] tracking-wider uppercase px-[18px] py-2 bg-[var(--panel-2)] border-y border-[var(--line)]">
                      Created
                    </th>
                    <th className="text-right font-medium text-[var(--muted)] text-[11.5px] tracking-wider uppercase px-[18px] py-2 bg-[var(--panel-2)] border-y border-[var(--line)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => (
                    <tr
                      key={delivery.id}
                      className="border-b border-[var(--line)] last:border-b-0 hover:bg-[color-mix(in_oklab,var(--panel-2)_60%,transparent)] cursor-pointer transition-colors"
                      onClick={() => navigate(`/deliveries/${delivery.id}`)}
                    >
                      <td className="px-[18px] py-3">
                        <div className="font-medium text-[var(--ink)]">
                          {delivery.delivery_number}
                        </div>
                        <div className="text-[var(--muted)] mt-0.5" style={{ fontFamily: 'var(--mono)', fontSize: '11.5px', letterSpacing: '.02em' }}>
                          {delivery.projects?.name || 'Residential'} · {delivery.po_reference || 'No PO'}
                        </div>
                      </td>
                      <td className="px-[18px] py-3">
                        <StatusChip status={delivery.status} />
                      </td>
                      <td className="px-[18px] py-3 text-[var(--ink-2)]">
                        {delivery.truck_name || <span className="text-[var(--faint)]">—</span>}
                      </td>
                      <td className="px-[18px] py-3" style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--muted)' }}>
                        {new Date(delivery.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-[18px] py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="dropdown dropdown-end">
                          <div tabIndex={0} role="button" className="p-1.5 rounded-md hover:bg-[var(--panel-2)] text-[var(--muted)] cursor-pointer inline-flex">
                            <Icon name="more" className="w-4 h-4" />
                          </div>
                          <ul tabIndex={0} className="dropdown-content menu p-1.5 shadow-lg bg-[var(--panel)] border border-[var(--line)] rounded-lg w-40 z-50">
                            <li><button onClick={() => navigate(`/deliveries/${delivery.id}`)}>Edit</button></li>
                            <li><button onClick={() => handlePrintPDF(delivery)}>Print PDF</button></li>
                            <li>
                              <button
                                className="text-[var(--danger)]"
                                onClick={() => setDeliveryToDelete(delivery)}
                              >
                                Delete
                              </button>
                            </li>
                          </ul>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          {deliveries && deliveries.length > 0 && (
            <div className="flex items-center justify-between px-[18px] py-2.5 border-t border-[var(--line)] text-xs text-[var(--muted)]" style={{ background: 'color-mix(in oklab, var(--panel-2) 70%, transparent)' }}>
              <span>Showing {deliveries.length} of {statusCounts.total} · {filter === 'all' ? 'all statuses' : filter.replace('_', ' ')}</span>
            </div>
          )}
        </div>

        {/* Right: Attention rail */}
        <div className="flex flex-col gap-5">
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius)] shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="px-[18px] pt-4 pb-3">
              <div className="font-medium text-[17px]" style={{ fontFamily: 'var(--serif)', letterSpacing: '-0.2px' }}>
                Needs your attention
              </div>
              <div className="text-xs text-[var(--muted)]">
                {attentionItems.length} item{attentionItems.length !== 1 ? 's' : ''} · updated just now
              </div>
            </div>
            <div className="flex flex-col">
              {allLoading ? (
                <div className="px-[18px] py-8 text-center text-[var(--faint)]">
                  <span className="loading loading-spinner loading-sm" />
                </div>
              ) : attentionItems.length === 0 ? (
                <div className="px-[18px] py-8 text-center text-[var(--faint)] text-sm">
                  <Icon name="check" className="w-6 h-6 mx-auto mb-2 text-[var(--ok)]" />
                  All clear — nothing needs attention
                </div>
              ) : (
                attentionItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex gap-3 px-[18px] py-3.5 border-b border-[var(--line)] last:border-b-0 items-start"
                  >
                    <div
                      className={`w-7 h-7 rounded-[7px] grid place-items-center shrink-0 ${
                        item.tone === 'warn' ? 'bg-[var(--warn-soft)] text-[var(--warn)]' :
                        item.tone === 'ok' ? 'bg-[var(--ok-soft)] text-[var(--ok)]' :
                        'bg-[color-mix(in_oklab,#4266aa_18%,var(--panel))] text-[#3d5d92]'
                      }`}
                    >
                      <Icon
                        name={item.tone === 'warn' ? 'alert' : item.tone === 'ok' ? 'check' : 'info'}
                        className="w-3.5 h-3.5"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] text-[var(--ink)] font-medium leading-snug">
                        {item.title}
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-0.5 leading-relaxed">
                        {item.sub}
                      </div>
                    </div>
                    <button
                      onClick={item.onClick}
                      className="px-2 py-1 border border-[var(--line)] rounded-md bg-[var(--panel)] text-[var(--ink-2)] hover:bg-[var(--panel-2)] whitespace-nowrap"
                      style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}
                    >
                      {item.action}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick links card */}
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius)] shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="px-[18px] pt-4 pb-3">
              <div className="font-medium text-[17px]" style={{ fontFamily: 'var(--serif)', letterSpacing: '-0.2px' }}>
                Quick actions
              </div>
            </div>
            <div className="px-[18px] pb-4 flex flex-col gap-2">
              <Link
                to="/deliveries/new"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--panel-2)] hover:bg-[var(--line)] text-[var(--ink-2)] no-underline transition-colors text-sm"
              >
                <Icon name="plus" className="w-4 h-4 text-[var(--muted)]" />
                Create new delivery
                <Icon name="arrow" className="w-3 h-3 ml-auto text-[var(--faint)]" />
              </Link>
              <Link
                to="/receiving"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--panel-2)] hover:bg-[var(--line)] text-[var(--ink-2)] no-underline transition-colors text-sm"
              >
                <Icon name="clipboard" className="w-4 h-4 text-[var(--muted)]" />
                Log received shipment
                <Icon name="arrow" className="w-3 h-3 ml-auto text-[var(--faint)]" />
              </Link>
              <Link
                to="/inventory"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--panel-2)] hover:bg-[var(--line)] text-[var(--ink-2)] no-underline transition-colors text-sm"
              >
                <Icon name="box" className="w-4 h-4 text-[var(--muted)]" />
                Browse inventory
                <Icon name="arrow" className="w-3 h-3 ml-auto text-[var(--faint)]" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <DeleteConfirmDialog
        open={!!deliveryToDelete}
        itemType="delivery"
        itemName={deliveryToDelete?.delivery_number ?? ''}
        description={
          deliveryToDelete ? (
            <>
              Are you sure you want to delete{' '}
              <strong className="text-[var(--ink)]">{deliveryToDelete.delivery_number}</strong>?
              {deliveryToDelete.status === 'pending' &&
                ' Stock will be returned to the source location.'}
            </>
          ) : null
        }
        loading={deleteDelivery.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeliveryToDelete(null)}
      />
    </div>
  )
}
