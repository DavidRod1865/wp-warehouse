/**
 * InventoryTable — Paginated inventory table with actions
 */
import { useMemo } from 'react'
import { Icon } from '../../../components/ui/Icon'
import { RowActionMenu } from './RowActionMenu'
import { RowStockBar } from './RowStockBar'
import type { EnrichedItem } from '../hooks/useInventoryData'

interface InventoryTableProps {
  hasActiveFilter: boolean
  viewMode: 'warehouse' | 'trucks'
  activeLocationLabel: string
  isLoading: boolean
  filteredItems: EnrichedItem[]
  searchQuery: string
  isProjectView: boolean
  receivedDates: {
    getReceivedDate: (brand: string, poNumber: string | null) => string | null
  }
  currentPage: number
  onSetCurrentPage: (page: number) => void
  onEditQuantity: (item: EnrichedItem) => void
  onEditItem: (item: EnrichedItem) => void
  onDelete: (item: EnrichedItem) => void
}

const PAGE_SIZE = 25

function getAttr(item: EnrichedItem, name: string): string {
  return (
    item.custom_attribute_values?.find(
      (a) => a.custom_attribute_name.toLowerCase() === name.toLowerCase()
    )?.value ?? ''
  )
}

function formatRelativeDate(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return (
      'Today ' +
      date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    )
  }
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function InventoryRow({
  item,
  isProjectView,
  receivedDate,
  onEditQuantity,
  onEditItem,
  onDelete,
}: {
  item: EnrichedItem
  isProjectView: boolean
  receivedDate: string | null
  onEditQuantity: (item: EnrichedItem) => void
  onEditItem: (item: EnrichedItem) => void
  onDelete: (item: EnrichedItem) => void
}) {
  const qty = item.quantity ?? 0
  const reorder = item.min_quantity ?? 0
  const maxEstimate = Math.max(qty, reorder * 3, 10)

  const stockColor =
    item.stockStatus === 'zero'
      ? 'var(--danger)'
      : item.stockStatus === 'low'
        ? 'var(--warn)'
        : 'var(--ok)'

  const pct = Math.min(1, qty / maxEstimate)
  const reorderPct = reorder > 0 ? Math.min(1, reorder / maxEstimate) : 0

  const updated = item.updated_at
    ? formatRelativeDate(new Date(item.updated_at))
    : '—'

  const brand = getAttr(item, 'brand')
  const partNumber = getAttr(item, 'part number')

  return (
    <tr className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--panel-2)] transition-colors">
      {/* Vendor (Brand) */}
      <td className="px-5 py-3 text-center">
        {brand ? (
          <span
            className="inline-block px-2 py-0.5 rounded-md"
            style={{
              background: 'color-mix(in oklab, var(--signal) 8%, var(--panel))',
              border: '1px solid color-mix(in oklab, var(--signal) 18%, var(--line))',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--ink-2)',
            }}
          >
            {brand}
          </span>
        ) : (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--faint)' }}>—</span>
        )}
      </td>

      {/* Name + PO */}
      <td className="px-3 py-3">
        <div className="font-medium text-[var(--ink)]">{item.name}</div>
        {getAttr(item, 'po number') && (
          <div className="mt-0.5" style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)' }}>
            PO: {getAttr(item, 'po number')}
          </div>
        )}
      </td>

      {/* Part Number */}
      <td
        className="px-3 py-3 text-center"
        style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: partNumber ? 'var(--ink-2)' : 'var(--faint)' }}
      >
        {partNumber || '—'}
      </td>

      {/* On hand */}
      <td
        className="px-3 py-3 text-center"
        style={{
          fontSize: 14,
          fontWeight: item.stockStatus !== 'ok' ? 600 : 500,
          color: stockColor,
        }}
      >
        {Math.floor(qty)}
      </td>

      {/* Stock vs reorder */}
      <td className="px-3 py-3">
        <div className="flex flex-col items-center gap-1">
          <RowStockBar pct={pct} reorderPct={reorderPct} color={stockColor} reorder={reorder} />
          {item.stockStatus === 'low' && (
            <div className="flex items-center gap-1" style={{ fontSize: 10, color: 'var(--warn)' }}>
              <Icon name="alert" className="w-2.5 h-2.5" />
              below reorder ({Math.floor(reorder)})
            </div>
          )}
          {item.stockStatus === 'zero' && (
            <div className="flex items-center gap-1" style={{ fontSize: 10, color: 'var(--danger)' }}>
              <Icon name="alert" className="w-2.5 h-2.5" />
              out of stock
            </div>
          )}
        </div>
      </td>

      {/* Location */}
      <td className="px-3 py-3 text-center">
        <span
          className="inline-block px-1.5 py-px rounded"
          style={{
            background: 'var(--panel-2)',
            border: '1px solid var(--line)',
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            color: 'var(--ink-2)',
          }}
        >
          {item.location}
        </span>
      </td>

      {/* Received date (projects only) */}
      {isProjectView && (
        <td
          className="px-3 py-3 text-center"
          style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: receivedDate ? 'var(--muted)' : 'var(--faint)' }}
        >
          {receivedDate ? formatRelativeDate(new Date(receivedDate)) : '—'}
        </td>
      )}

      {/* Last updated */}
      <td
        className="px-3 py-3 text-center"
        style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--muted)' }}
      >
        {updated}
      </td>

      {/* Actions */}
      <td className="px-3 py-3">
        <RowActionMenu
          item={item}
          onEditQuantity={onEditQuantity}
          onEditItem={onEditItem}
          onDelete={onDelete}
        />
      </td>
    </tr>
  )
}

export function InventoryTable({
  hasActiveFilter,
  viewMode,
  activeLocationLabel,
  isLoading,
  filteredItems,
  searchQuery,
  isProjectView,
  receivedDates,
  currentPage,
  onSetCurrentPage,
  onEditQuantity,
  onEditItem,
  onDelete,
}: InventoryTableProps) {
  const filteredCount = filteredItems.length
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filteredItems.slice(start, start + PAGE_SIZE)
  }, [filteredItems, safePage])

  return (
    <div className="border border-[var(--line)] rounded-xl bg-[var(--panel)] overflow-hidden">
      {!hasActiveFilter ? (
        <div className="text-center py-20 text-[var(--muted)]">
          <Icon name="box" className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium text-[var(--ink-2)]">
            {viewMode === 'trucks' ? 'Select a truck' : 'Select a location or project'}
          </p>
          <p className="text-sm mt-1">
            {viewMode === 'trucks'
              ? 'Pick a truck from the dropdown to view its inventory'
              : 'Use the filters above to browse inventory by location or project'}
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 text-[var(--muted)]">
          <p className="text-base font-medium">No items found</p>
          <p className="text-sm mt-1">
            {searchQuery
              ? 'Try a different search term'
              : `No inventory in ${activeLocationLabel}`}
          </p>
        </div>
      ) : (
        <>
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
                  <th className="text-center font-medium px-5 py-2.5" style={{ width: 120 }}>
                    Vendor
                  </th>
                  <th className="text-left font-medium px-3 py-2.5">Name</th>
                  <th className="text-center font-medium px-3 py-2.5" style={{ width: 130 }}>
                    Part Number
                  </th>
                  <th className="text-center font-medium px-3 py-2.5" style={{ width: 90 }}>
                    On hand
                  </th>
                  <th className="text-center font-medium px-3 py-2.5" style={{ width: 120 }}>
                    Stock vs reorder
                  </th>
                  <th className="text-center font-medium px-3 py-2.5" style={{ width: 140 }}>
                    Location
                  </th>
                  {isProjectView && (
                    <th className="text-center font-medium px-3 py-2.5" style={{ width: 110 }}>
                      Received
                    </th>
                  )}
                  <th className="text-center font-medium px-3 py-2.5" style={{ width: 120 }}>
                    Last updated
                  </th>
                  <th className="font-medium px-3 py-2.5" style={{ width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => (
                  <InventoryRow
                    key={item.id}
                    item={item}
                    isProjectView={isProjectView}
                    receivedDate={
                      isProjectView
                        ? receivedDates.getReceivedDate(
                            getAttr(item, 'brand'),
                            getAttr(item, 'po number') || null
                          )
                        : null
                    }
                    onEditQuantity={onEditQuantity}
                    onEditItem={onEditItem}
                    onDelete={onDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer with pagination */}
          <div
            className="flex items-center justify-between px-5 py-3 border-t border-[var(--line)] text-[var(--muted)]"
            style={{ fontSize: 12 }}
          >
            <span>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredCount)} of {filteredCount} items
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSetCurrentPage(1)}
                  disabled={safePage === 1}
                  className="px-2 py-1 rounded-md hover:bg-[var(--panel-2)] disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
                >
                  First
                </button>
                <button
                  onClick={() => onSetCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="w-7 h-7 rounded-md grid place-items-center hover:bg-[var(--panel-2)] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Icon name="chevron-left" className="w-3.5 h-3.5" />
                </button>

                <span
                  className="px-2 text-[var(--ink-2)]"
                  style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
                >
                  {safePage} / {totalPages}
                </span>

                <button
                  onClick={() => onSetCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="w-7 h-7 rounded-md grid place-items-center hover:bg-[var(--panel-2)] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Icon name="chevron-right" className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onSetCurrentPage(totalPages)}
                  disabled={safePage === totalPages}
                  className="px-2 py-1 rounded-md hover:bg-[var(--panel-2)] disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
                >
                  Last
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
