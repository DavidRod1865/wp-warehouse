/**
 * InventoryPage — Inventory browser on the first-party Supabase schema
 * (locations / items / stock_levels; all stock writes via RPC)
 *
 * Item-first layout: one row per item (locations are per-project now, so an
 * item can otherwise sprawl across many near-duplicate rows, including
 * quantity-0 leftovers). Each row expands to a per-location breakdown.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocations } from '../hooks/useLocations'
import { useInventoryItems } from '../hooks/useInventoryItems'
import { useStockLevels } from '../hooks/useStockLevels'
import { groupStockByItem, type ItemStockGroup } from '../utils/groupStockByItem'
import { Icon } from '../../../components/ui/Icon'
import { useToast } from '../../../components/ui/Toast'
import { useAdjustInventory, useCreateItem, useMoveInventory, useUpdateItem } from '../hooks/useInventoryMutations'
import type { InventoryItem, StockLevel, Location } from '../types'

const LOCATION_TYPE_LABELS: Record<Location['location_type'], string> = {
  warehouse_area: 'Warehouse Area',
  truck: 'Truck',
  job_site: 'Job Site',
  rigging_yard: 'Rigging Yard',
}

interface ModalState {
  type: 'none' | 'addItem' | 'editItem' | 'adjustQty' | 'moveStock'
  item?: InventoryItem
  stockLevel?: StockLevel
}

export default function InventoryPage() {
  const { data: locations = [], isLoading: locationsLoading } = useLocations({ activeOnly: true })
  const { data: items = [], isLoading: itemsLoading } = useInventoryItems()
  const { data: stockLevels = [], isLoading: stockLoading } = useStockLevels()

  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showEmptyLocations, setShowEmptyLocations] = useState(false)
  const [expandedItemIds, setExpandedItemIds] = useState<Set<number>>(new Set())
  const [modal, setModal] = useState<ModalState>({ type: 'none' })

  // Build lookup maps for joining data
  const itemMap = useMemo(() => {
    const map = new Map<number, InventoryItem>()
    for (const item of items) {
      map.set(item.id, item)
    }
    return map
  }, [items])

  const locationMap = useMemo(() => {
    const map = new Map<number, Location>()
    for (const loc of locations) {
      map.set(loc.id, loc)
    }
    return map
  }, [locations])

  // Enrich stock levels with joined data
  const enrichedStock = useMemo(() => {
    return stockLevels.map((s) => ({
      ...s,
      item: itemMap.get(s.item_id) ?? s.item,
      location: locationMap.get(s.location_id) ?? s.location,
    }))
  }, [stockLevels, itemMap, locationMap])

  // Group stock rows into one entry per item (totals always span every
  // location — the location filter narrows which items/rows are shown, not
  // the item's true total on hand).
  const itemGroups = useMemo(() => groupStockByItem(enrichedStock), [enrichedStock])

  // Location dropdown, grouped for the <optgroup> layout
  const locationGroups = useMemo(() => {
    const shared: Location[] = []
    const trucks: Location[] = []
    const project: Location[] = []

    for (const loc of locations) {
      if (loc.project_id != null) {
        project.push(loc)
      } else if (loc.location_type === 'truck') {
        trucks.push(loc)
      } else {
        shared.push(loc)
      }
    }

    return { shared, trucks, project }
  }, [locations])

  const searchLower = searchQuery.toLowerCase()

  const displayGroups = itemGroups.filter((group) => {
    if (selectedLocationId && !group.locations.some((l) => l.location_id === selectedLocationId)) {
      return false
    }
    if (!searchLower) return true
    return (
      group.item?.name.toLowerCase().includes(searchLower) ||
      (group.item?.part_number?.toLowerCase().includes(searchLower) ?? false)
    )
  })

  const isLoading = locationsLoading || itemsLoading || stockLoading

  function toggleExpanded(itemId: number) {
    setExpandedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--ink)]">Inventory</h1>
        <p className="text-[var(--muted)] mt-1">Items and stock levels across all locations</p>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>
            Location
          </label>
          <select
            value={selectedLocationId ?? ''}
            onChange={(e) => setSelectedLocationId(e.target.value ? Number(e.target.value) : null)}
            className="form-input w-full"
          >
            <option value="">All Locations</option>
            {locationGroups.shared.length > 0 && (
              <optgroup label="Shared Warehouse">
                {locationGroups.shared.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </optgroup>
            )}
            {locationGroups.trucks.length > 0 && (
              <optgroup label="Trucks">
                {locationGroups.trucks.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </optgroup>
            )}
            {locationGroups.project.length > 0 && (
              <optgroup label="Project Locations">
                {locationGroups.project.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({LOCATION_TYPE_LABELS[loc.location_type]})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>
            Search
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Item name or part #..."
            className="form-input w-full"
          />
        </div>

        <label className="flex items-center gap-2 pb-2.5 text-sm text-[var(--muted)] cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={showEmptyLocations}
            onChange={(e) => setShowEmptyLocations(e.target.checked)}
            className="checkbox checkbox-sm"
          />
          Show empty locations
        </label>

        <button
          onClick={() => setModal({ type: 'addItem' })}
          className="px-4 py-2 rounded-lg text-[var(--on-signal)] text-sm font-medium hover:opacity-90"
          style={{ background: 'var(--signal)' }}
        >
          <Icon name="plus" className="w-4 h-4 inline mr-1" />
          New Item
        </button>
      </div>

      {/* Stock Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)] w-8"></th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Item</th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Part Number</th>
              <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Total On Hand</th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Locations</th>
              <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  <span className="loading loading-spinner loading-sm" />
                </td>
              </tr>
            ) : displayGroups.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  {searchQuery || selectedLocationId ? 'No matching stock' : 'No stock found'}
                </td>
              </tr>
            ) : (
              displayGroups.map((group) => (
                <ItemRow
                  key={group.item_id}
                  group={group}
                  isExpanded={expandedItemIds.has(group.item_id)}
                  onToggle={() => toggleExpanded(group.item_id)}
                  selectedLocationId={selectedLocationId}
                  showEmptyLocations={showEmptyLocations}
                  onEditItem={() => group.item && setModal({ type: 'editItem', item: group.item as InventoryItem })}
                  onAdjust={(stock) => setModal({ type: 'adjustQty', stockLevel: stock })}
                  onMove={(stock) => setModal({ type: 'moveStock', stockLevel: stock })}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modal.type === 'addItem' && (
        <AddItemModal
          locations={locations}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
      {modal.type === 'editItem' && modal.item && (
        <EditItemModal
          item={modal.item}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
      {modal.type === 'adjustQty' && modal.stockLevel && (
        <AdjustQuantityModal
          stockLevel={modal.stockLevel}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
      {modal.type === 'moveStock' && modal.stockLevel && (
        <MoveStockModal
          stockLevel={modal.stockLevel}
          locations={locations}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
    </div>
  )
}

function ItemRow({
  group,
  isExpanded,
  onToggle,
  selectedLocationId,
  showEmptyLocations,
  onEditItem,
  onAdjust,
  onMove,
}: {
  group: ItemStockGroup
  isExpanded: boolean
  onToggle: () => void
  selectedLocationId: number | null
  showEmptyLocations: boolean
  onEditItem: () => void
  onAdjust: (stock: StockLevel) => void
  onMove: (stock: StockLevel) => void
}) {
  // When a specific location is selected, the breakdown shows just that one
  // row regardless of quantity — the filter itself is the intent to see it.
  const breakdownLocations = selectedLocationId
    ? group.locations.filter((l) => l.location_id === selectedLocationId)
    : group.locations.filter((l) => showEmptyLocations || l.quantity > 0)

  const locationsWithStock = group.locations.filter((l) => l.quantity > 0)
  const locationsSummary =
    locationsWithStock.length === 0
      ? 'No stock'
      : locationsWithStock.length === 1
        ? locationsWithStock[0].location?.name || '—'
        : `${locationsWithStock.length} locations`

  return (
    <>
      <tr
        className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--panel-2)] transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-[var(--muted)]">
          <Icon
            name="chevron-right"
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        </td>
        <td className="px-4 py-3 font-medium text-[var(--ink)]">{group.item?.name || '—'}</td>
        <td className="px-4 py-3 text-[var(--muted)]">{group.item?.part_number || '—'}</td>
        <td className="px-4 py-3 text-right font-mono">{group.totalQuantity}</td>
        <td className="px-4 py-3 text-[var(--muted)]">{locationsSummary}</td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEditItem()
            }}
            className="text-xs px-2 py-1 rounded text-[var(--signal)] hover:bg-[var(--panel-2)]"
          >
            Edit
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr className="border-b border-[var(--line)] last:border-0">
          <td colSpan={6} className="px-4 py-3 bg-[var(--panel-2)]">
            {breakdownLocations.length === 0 ? (
              <div className="text-xs text-[var(--muted)] py-2 px-2">
                No stock at any location.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--muted)]">
                    <th className="px-2 py-1.5 text-left font-medium">Location</th>
                    <th className="px-2 py-1.5 text-left font-medium">Type</th>
                    <th className="px-2 py-1.5 text-right font-medium">Quantity</th>
                    <th className="px-2 py-1.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownLocations.map((stock) => (
                    <tr key={stock.id} className="border-t border-[var(--line)]">
                      <td className="px-2 py-1.5 text-[var(--ink)]">
                        {stock.location?.project_id != null ? (
                          <Link
                            to={`/projects/${stock.location.project_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[var(--signal)] hover:underline"
                          >
                            {stock.location?.name || '—'}
                          </Link>
                        ) : (
                          stock.location?.name || '—'
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-[var(--muted)]">
                        {stock.location ? LOCATION_TYPE_LABELS[stock.location.location_type] : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">{stock.quantity}</td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onMove(stock)
                          }}
                          disabled={stock.quantity === 0}
                          className="text-xs px-2 py-1 rounded text-[var(--signal)] hover:bg-[var(--panel)] disabled:opacity-40"
                        >
                          Move
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onAdjust(stock)
                          }}
                          className="text-xs px-2 py-1 rounded text-[var(--signal)] hover:bg-[var(--panel)]"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function MoveStockModal({
  stockLevel,
  locations,
  onClose,
}: {
  stockLevel: StockLevel
  locations: Location[]
  onClose: () => void
}) {
  const [toLocationId, setToLocationId] = useState<number | null>(null)
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const moveInventory = useMoveInventory()
  const { toast } = useToast()

  const destinations = locations.filter((l) => l.id !== stockLevel.location_id)
  const qtyNum = Number(qty)
  const isValid =
    toLocationId !== null && qtyNum > 0 && qtyNum <= stockLevel.quantity

  async function handleSave() {
    if (!isValid || toLocationId === null) return

    setSaving(true)
    try {
      await moveInventory.mutateAsync({
        item_id: stockLevel.item_id,
        quantity: qtyNum,
        movement_type: 'transfer',
        from_location_id: stockLevel.location_id,
        to_location_id: toLocationId,
        notes: notes.trim() || undefined,
      })

      toast('Stock moved')
      onClose()
    } catch (err) {
      console.error('Move stock failed:', err)
      toast(err instanceof Error ? err.message : 'Failed to move stock', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
      style={{
        background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center">
      <div
        className="bg-[var(--panel)] rounded-xl w-full max-w-md my-4 sm:my-0 flex flex-col"
        style={{
          maxHeight: 'min(900px, calc(100dvh - 32px))',
          boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)',
        }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--line)] shrink-0">
          <h3 className="text-lg font-semibold">Move Stock</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--panel-2)] text-[var(--muted)]"
            disabled={saving}
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto min-h-0">
          <FormField label="Item">
            <div className="form-input bg-[var(--panel-2)] text-[var(--ink)]">
              {stockLevel.item?.name || '—'}
            </div>
          </FormField>

          <FormField label="From">
            <div className="form-input bg-[var(--panel-2)] text-[var(--ink)]">
              {stockLevel.location?.name || '—'} ({stockLevel.quantity} available)
            </div>
          </FormField>

          <FormField label="To" required>
            <select
              value={toLocationId ?? ''}
              onChange={(e) => setToLocationId(e.target.value ? Number(e.target.value) : null)}
              className="form-input w-full"
              autoFocus
              disabled={saving}
            >
              <option value="">Select destination…</option>
              {destinations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.location_type.replace('_', ' ')})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Quantity" required>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              min={1}
              max={stockLevel.quantity}
              className="form-input w-full"
              disabled={saving}
            />
          </FormField>

          <FormField label="Notes">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note..."
              className="form-input w-full"
              disabled={saving}
            />
          </FormField>
        </div>

        <div
          className="flex justify-end gap-2 px-6 py-3.5 border-t border-[var(--line)] shrink-0"
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
            {saving ? <span className="loading loading-spinner loading-sm" /> : 'Move'}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}

function AddItemModal({
  locations,
  onClose,
}: {
  locations: Location[]
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [description, setDescription] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [initialQty, setInitialQty] = useState('')
  const [selectedLocId, setSelectedLocId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const createItem = useCreateItem()
  const adjustInventory = useAdjustInventory()
  const { toast } = useToast()

  async function handleSave() {
    if (!name.trim()) {
      toast('Item name is required', 'error')
      return
    }

    setSaving(true)
    try {
      // Create item
      const item = await createItem.mutateAsync({
        name: name.trim(),
        part_number: partNumber.trim() || undefined,
        description: description.trim() || undefined,
        unit_cost: unitCost ? Number(unitCost) : undefined,
      })

      // If initial quantity provided, adjust inventory
      if (initialQty && selectedLocId) {
        const qty = Number(initialQty)
        if (qty > 0) {
          await adjustInventory.mutateAsync({
            location_id: selectedLocId,
            item_id: item.id,
            new_quantity: qty,
            reason: 'Initial stock',
          })
        }
      }

      toast(`"${name.trim()}" added`)
      onClose()
    } catch (err) {
      console.error('Create item failed:', err)
      toast(err instanceof Error ? err.message : 'Failed to add item', 'error')
    } finally {
      setSaving(false)
    }
  }

  const isValid = name.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
      style={{
        background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center">
      <div
        className="bg-[var(--panel)] rounded-xl w-full max-w-md my-4 sm:my-0 flex flex-col"
        style={{
          maxHeight: 'min(900px, calc(100dvh - 32px))',
          boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--line)] shrink-0">
          <h3 className="text-lg font-semibold">Add Item</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--panel-2)] text-[var(--muted)]"
            disabled={saving}
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto min-h-0">
          <FormField label="Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValid && !saving) handleSave()
              }}
              placeholder="Item name"
              className="form-input w-full"
              autoFocus
              disabled={saving}
            />
          </FormField>

          <FormField label="Part Number">
            <input
              type="text"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValid && !saving) handleSave()
              }}
              placeholder="Part #"
              className="form-input w-full"
              disabled={saving}
            />
          </FormField>

          <FormField label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description..."
              rows={2}
              className="form-input w-full resize-none"
              disabled={saving}
            />
          </FormField>

          <FormField label="Unit Cost">
            <input
              type="number"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValid && !saving) handleSave()
              }}
              placeholder="0.00"
              step={0.01}
              min={0}
              className="form-input w-full"
              disabled={saving}
            />
          </FormField>

          <FormField label="Initial Stock Location">
            <select
              value={selectedLocId ?? ''}
              onChange={(e) => setSelectedLocId(e.target.value ? Number(e.target.value) : null)}
              className="form-input w-full"
              disabled={saving}
            >
              <option value="">Skip initial stock</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </FormField>

          {selectedLocId && (
            <FormField label="Initial Quantity">
              <input
                type="number"
                value={initialQty}
                onChange={(e) => setInitialQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isValid && !saving) handleSave()
                }}
                placeholder="0"
                min={0}
                className="form-input w-full"
                disabled={saving}
              />
            </FormField>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 px-6 py-3.5 border-t border-[var(--line)] shrink-0"
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
            {saving ? <span className="loading loading-spinner loading-sm" /> : 'Add Item'}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}

function EditItemModal({
  item,
  onClose,
}: {
  item: InventoryItem
  onClose: () => void
}) {
  const [name, setName] = useState(item.name)
  const [partNumber, setPartNumber] = useState(item.part_number ?? '')
  const [description, setDescription] = useState(item.description ?? '')
  const [unitCost, setUnitCost] = useState(item.unit_cost != null ? String(item.unit_cost) : '')
  const [saving, setSaving] = useState(false)

  const updateItem = useUpdateItem()
  const { toast } = useToast()

  async function handleSave() {
    if (!name.trim()) {
      toast('Item name is required', 'error')
      return
    }

    setSaving(true)
    try {
      await updateItem.mutateAsync({
        id: item.id,
        name: name.trim(),
        part_number: partNumber.trim() || undefined,
        description: description.trim() || undefined,
        unit_cost: unitCost ? Number(unitCost) : undefined,
      })

      toast(`"${name.trim()}" updated`)
      onClose()
    } catch (err) {
      console.error('Update item failed:', err)
      toast(err instanceof Error ? err.message : 'Failed to update item', 'error')
    } finally {
      setSaving(false)
    }
  }

  const isValid = name.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
      style={{
        background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center">
      <div
        className="bg-[var(--panel)] rounded-xl w-full max-w-md my-4 sm:my-0 flex flex-col"
        style={{
          maxHeight: 'min(900px, calc(100dvh - 32px))',
          boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)',
        }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--line)] shrink-0">
          <h3 className="text-lg font-semibold">Edit Item</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--panel-2)] text-[var(--muted)]"
            disabled={saving}
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto min-h-0">
          <FormField label="Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValid && !saving) handleSave()
              }}
              placeholder="Item name"
              className="form-input w-full"
              autoFocus
              disabled={saving}
            />
          </FormField>

          <FormField label="Part Number">
            <input
              type="text"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValid && !saving) handleSave()
              }}
              placeholder="Part #"
              className="form-input w-full"
              disabled={saving}
            />
          </FormField>

          <FormField label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description..."
              rows={2}
              className="form-input w-full resize-none"
              disabled={saving}
            />
          </FormField>

          <FormField label="Unit Cost">
            <input
              type="number"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValid && !saving) handleSave()
              }}
              placeholder="0.00"
              step={0.01}
              min={0}
              className="form-input w-full"
              disabled={saving}
            />
          </FormField>
        </div>

        <div
          className="flex justify-end gap-2 px-6 py-3.5 border-t border-[var(--line)] shrink-0"
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
            {saving ? <span className="loading loading-spinner loading-sm" /> : 'Save'}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}

function AdjustQuantityModal({
  stockLevel,
  onClose,
}: {
  stockLevel: StockLevel
  onClose: () => void
}) {
  const [newQty, setNewQty] = useState(String(stockLevel.quantity))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const adjustInventory = useAdjustInventory()
  const { toast } = useToast()

  async function handleSave() {
    if (!reason.trim()) {
      toast('Reason is required', 'error')
      return
    }

    setSaving(true)
    try {
      const qty = Number(newQty)
      if (qty < 0) {
        toast('Quantity cannot be negative', 'error')
        return
      }

      await adjustInventory.mutateAsync({
        location_id: stockLevel.location_id,
        item_id: stockLevel.item_id,
        new_quantity: qty,
        reason: reason.trim(),
      })

      toast('Stock adjusted')
      onClose()
    } catch (err) {
      console.error('Adjust inventory failed:', err)
      toast(err instanceof Error ? err.message : 'Failed to adjust stock', 'error')
    } finally {
      setSaving(false)
    }
  }

  const isValid = reason.trim().length > 0 && !isNaN(Number(newQty))

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
      style={{
        background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center">
      <div
        className="bg-[var(--panel)] rounded-xl w-full max-w-md my-4 sm:my-0 flex flex-col"
        style={{
          maxHeight: 'min(900px, calc(100dvh - 32px))',
          boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)',
        }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--line)] shrink-0">
          <h3 className="text-lg font-semibold">Adjust Quantity</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--panel-2)] text-[var(--muted)]"
            disabled={saving}
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto min-h-0">
          <FormField label="Item">
            <div className="form-input bg-[var(--panel-2)] text-[var(--ink)]">
              {stockLevel.item?.name || '—'}
            </div>
          </FormField>

          <FormField label="Location">
            <div className="form-input bg-[var(--panel-2)] text-[var(--ink)]">
              {stockLevel.location?.name || '—'}
            </div>
          </FormField>

          <FormField label="Current Quantity">
            <div className="form-input bg-[var(--panel-2)] text-[var(--ink)] font-mono">
              {stockLevel.quantity}
            </div>
          </FormField>

          <FormField label="New Quantity" required>
            <input
              type="number"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              min={0}
              className="form-input w-full"
              autoFocus
              disabled={saving}
            />
          </FormField>

          <FormField label="Reason" required>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValid && !saving) handleSave()
              }}
              placeholder="e.g., Physical count, Damage, Loss..."
              className="form-input w-full"
              disabled={saving}
            />
          </FormField>
        </div>

        <div
          className="flex justify-end gap-2 px-6 py-3.5 border-t border-[var(--line)] shrink-0"
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
            {saving ? <span className="loading loading-spinner loading-sm" /> : 'Update'}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}

function FormField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>
        {label}
        {required && <span className="text-[var(--danger)] ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}
