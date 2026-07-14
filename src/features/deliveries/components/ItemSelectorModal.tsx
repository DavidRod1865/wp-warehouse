/**
 * ItemSelectorModal — Browse inventory items from a selected warehouse location
 *
 * Phase 5+: Uses useStockLevels(locationId) to show available quantities.
 * No Sortly folder browsing. Caps selection at available stock.
 */
import { useState, useEffect } from 'react'
import { useStockLevels } from '../../inventory/hooks/useStockLevels'
import { useInventoryItems } from '../../inventory/hooks/useInventoryItems'
import { Icon } from '../../../components/ui/Icon'
import type { DeliveryItemFormValues } from '../schemas/deliverySchema'

interface ItemSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onAddItems: (items: DeliveryItemFormValues[]) => void
  /** The warehouse_area location to pull stock from */
  sourceLocationId: number | null
  /** Already-added item_ids to exclude from selection */
  existingItemIds: Set<number>
}

interface SelectedEntry {
  itemId: number
  itemName: string
  quantity: number
  availableQty: number
}

export function ItemSelectorModal({
  isOpen,
  onClose,
  onAddItems,
  sourceLocationId,
  existingItemIds,
}: ItemSelectorModalProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Map<number, SelectedEntry>>(new Map())

  // Stock levels at the source location
  const { data: stockLevels, isLoading: stockLoading } = useStockLevels(
    sourceLocationId ? { locationId: sourceLocationId } : undefined
  )

  // Inventory item metadata for name/part# search
  const { data: allItems, isLoading: itemsLoading } = useInventoryItems(
    search.length >= 2 ? { search } : undefined
  )

  const isLoading = stockLoading || itemsLoading

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setSelected(new Map())
    }
  }, [isOpen])

  if (!isOpen) return null

  // Build a map: item_id → quantity_available from stock levels
  const stockMap = new Map<number, number>()
  for (const sl of stockLevels || []) {
    if (sl.quantity > 0) {
      stockMap.set(sl.item_id, sl.quantity)
    }
  }

  // Items to display: if searching, use allItems filtered to those with stock;
  // otherwise list all items that have stock at this location.
  let displayItems: Array<{ id: number; name: string; part_number?: string | null; available: number }> = []

  if (search.length >= 2 && allItems) {
    displayItems = allItems
      .filter((item) => stockMap.has(item.id) && !existingItemIds.has(item.id))
      .map((item) => ({ id: item.id, name: item.name, part_number: item.part_number, available: stockMap.get(item.id)! }))
  } else if (stockLevels) {
    // stockLevels includes joined item data (name, part_number) when locationId is provided
    displayItems = stockLevels
      .filter((sl) => sl.quantity > 0 && !existingItemIds.has(sl.item_id))
      .map((sl) => ({
        id: sl.item_id,
        name: sl.item?.name || `Item #${sl.item_id}`,
        part_number: sl.item?.part_number ?? null,
        available: sl.quantity,
      }))
  }

  const toggleItem = (id: number, name: string, available: number) => {
    const next = new Map(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.set(id, { itemId: id, itemName: name, quantity: 1, availableQty: available })
    }
    setSelected(next)
  }

  const updateQuantity = (itemId: number, qty: number) => {
    const next = new Map(selected)
    const entry = next.get(itemId)
    if (entry) {
      next.set(itemId, {
        ...entry,
        quantity: Math.max(1, Math.min(qty, entry.availableQty)),
      })
    }
    setSelected(next)
  }

  const handleConfirm = () => {
    const items: DeliveryItemFormValues[] = Array.from(selected.values()).map((entry) => ({
      item_id: entry.itemId,
      sortly_item_id: null,
      item_name: entry.itemName,
      quantity: entry.quantity,
      delivered_quantity: 0,
      remaining_quantity: entry.quantity,
      available_quantity: entry.availableQty,
      location: '',
      is_manual: false,
      notes: null,
      custom_attribute_values: null,
    }))
    onAddItems(items)
    setSelected(new Map())
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-10"
      style={{
        background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="bg-[var(--panel)] rounded-xl flex flex-col overflow-hidden"
        style={{
          width: 'min(720px, calc(100vw - 80px))',
          maxHeight: 'calc(100vh - 80px)',
          boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)]">
          <div>
            <div
              className="text-[var(--ink)]"
              style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500 }}
            >
              Select items from inventory
            </div>
            <div className="text-[var(--muted)] text-xs mt-0.5">
              {sourceLocationId
                ? 'Showing available stock at selected location'
                : 'Select a source location first'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg grid place-items-center hover:bg-[var(--panel-2)] text-[var(--muted)]"
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-[var(--line)]">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--panel-2)]">
            <Icon name="search" className="w-3.5 h-3.5 text-[var(--muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or part #…"
              className="flex-1 bg-transparent text-sm text-[var(--ink)] placeholder-[var(--muted)] outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-[var(--muted)] hover:text-[var(--ink)]">
                <Icon name="close" className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto p-4">
          {!sourceLocationId ? (
            <p className="text-sm text-[var(--muted)] text-center py-8">
              Select a source location to browse available inventory
            </p>
          ) : isLoading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-sm" />
            </div>
          ) : displayItems.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-8">
              {search.length >= 2
                ? 'No matching items with stock at this location'
                : 'No items with available stock at this location'}
            </p>
          ) : (
            <div className="space-y-1">
              {displayItems.map((item) => {
                const isSelected = selected.has(item.id)
                const entry = selected.get(item.id)

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                    style={{
                      background: isSelected
                        ? 'color-mix(in oklab, var(--signal) 8%, var(--panel))'
                        : 'transparent',
                      border: isSelected
                        ? '1px solid color-mix(in oklab, var(--signal) 25%, var(--line))'
                        : '1px solid transparent',
                    }}
                    onClick={() => toggleItem(item.id, item.name, item.available)}
                  >
                    <div
                      className="w-4 h-4 rounded border grid place-items-center shrink-0"
                      style={{
                        borderColor: isSelected ? 'var(--signal)' : 'var(--line)',
                        background: isSelected ? 'var(--signal)' : 'transparent',
                      }}
                    >
                      {isSelected && <Icon name="check" className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--ink)] truncate">{item.name}</p>
                      {item.part_number && (
                        <p className="text-[var(--muted)] mt-0.5" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                          {item.part_number}
                        </p>
                      )}
                    </div>
                    <div
                      className="text-right shrink-0"
                      style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}
                    >
                      {item.available} avail.
                    </div>
                    {isSelected && entry && (
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-xs text-[var(--muted)]">Qty:</span>
                        <div
                          className="inline-flex items-center rounded-md overflow-hidden"
                          style={{ border: '1px solid var(--line)', background: 'var(--panel)' }}
                        >
                          <button
                            className="px-1.5 py-0.5 text-[var(--muted)] hover:text-[var(--ink)]"
                            style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
                            onClick={() => updateQuantity(item.id, entry.quantity - 1)}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={item.available}
                            value={entry.quantity}
                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                            className="w-10 text-center bg-transparent border-x border-[var(--line)] py-0.5"
                            style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
                          />
                          <button
                            className="px-1.5 py-0.5 text-[var(--muted)] hover:text-[var(--ink)]"
                            style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
                            onClick={() => updateQuantity(item.id, entry.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-3.5 border-t border-[var(--line)]"
          style={{ background: 'color-mix(in oklab, var(--panel-2) 50%, var(--panel))' }}
        >
          <span className="text-sm text-[var(--muted)]">
            <b className="text-[var(--ink-2)] font-medium">{selected.size}</b> item
            {selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[var(--line)] text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--panel-2)]"
            >
              Cancel
            </button>
            <button
              disabled={selected.size === 0}
              onClick={handleConfirm}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
              style={{ background: 'var(--signal)' }}
            >
              Add items
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
