/**
 * ReceiptLineItems — Step 2 of the receiving workflow (Phase 4)
 *
 * Displays parsed/manual line items. Auto-matches against:
 *  1. PO lines (if a PO is linked) — by part_number exact then name contains
 *  2. Existing inventory items via useInventoryItems fuzzy match
 *  3. Create new (default for no match)
 *
 * No Sortly imports.
 */
import { useState, useEffect, useCallback } from 'react'
import { ReceiptItemRow } from './ReceiptItemRow'
import { ItemMatchModal } from './ItemMatchModal'
import { useFolderItems } from '../hooks/useFolderItems'
import { usePurchaseOrders } from '../../purchase-orders/hooks/usePurchaseOrders'
import { Icon } from '../../../components/ui/Icon'
import type { ReceivingLineItem, ItemAction, POLineSuggestion } from '../types'

interface ReceiptLineItemsProps {
  items: ReceivingLineItem[]
  setItems: (items: ReceivingLineItem[]) => void
  poId: number | null
  /** Default destination location id (for new items) */
  destinationLocationId: number | null
  destinationLocationName: string | null
  /** Whether user chose manual entry (vs PDF upload) */
  isManualEntry?: boolean
  onBack: () => void
  onNext: () => void
}

export function ReceiptLineItems({
  items,
  setItems,
  poId,
  destinationLocationId,
  destinationLocationName,
  isManualEntry,
  onBack,
  onNext,
}: ReceiptLineItemsProps) {
  // Inventory item search (for auto-matching and modal search)
  const { findMatches, isLoading: inventoryLoading } = useFolderItems()

  // PO lines for the linked PO (empty array if no PO)
  const { data: poData = [] } = usePurchaseOrders(
    poId ? { } : undefined,
  )
  // Find the specific PO and extract its lines
  const linkedPO = poId ? poData.find((po: { id: number }) => po.id === poId) : null
  const poLines: POLineSuggestion[] = linkedPO?.line_items?.map((line: {
    id: number
    description: string
    part_number: string | null
    quantity_ordered: number
    quantity_received: number
    received_status: 'pending' | 'partial' | 'received' | 'over_received'
    item_id: number | null
  }) => ({
    po_line_item_id: line.id,
    description: line.description,
    part_number: line.part_number,
    quantity_ordered: line.quantity_ordered,
    quantity_already_received: line.quantity_received,
    quantity_remaining: line.quantity_ordered - line.quantity_received,
    received_status: line.received_status,
    item_id: line.item_id ?? null,
  })) ?? []

  // Modal state
  const [linkingTempId, setLinkingTempId] = useState<string | null>(null)
  const linkingItem = items.find((i) => i.tempId === linkingTempId)

  // Manual add form
  const [showAddForm, setShowAddForm] = useState(!!isManualEntry)
  const [newItemName, setNewItemName] = useState('')
  const [newPartNumber, setNewPartNumber] = useState('')
  const [newQuantity, setNewQuantity] = useState(1)

  // Auto-match items against PO lines first, then inventory
  const autoMatch = useCallback(() => {
    if (inventoryLoading) return

    const updated = items.map((item) => {
      if (item.action !== 'pending') return item

      // 1. Try PO line match first (exact part_number → description contains)
      if (poLines.length > 0) {
        const pnLower = item.part_number?.toLowerCase().trim()
        const nameLower = item.item_name.toLowerCase()

        let bestPoLine: POLineSuggestion | null = null

        if (pnLower) {
          bestPoLine = poLines.find(
            (l) => l.part_number?.toLowerCase().trim() === pnLower
          ) ?? null
        }
        if (!bestPoLine) {
          const nameWords = nameLower.split(' ')
          bestPoLine = poLines.find(
            (l) => nameWords.every((w) => l.description.toLowerCase().includes(w))
          ) ?? null
        }

        if (bestPoLine) {
          return {
            ...item,
            action: 'update' as ItemAction,
            po_line_item_id: bestPoLine.po_line_item_id,
            po_line_suggestion: bestPoLine,
            item_id: bestPoLine.item_id ?? null,
            item_name_linked: bestPoLine.item_id != null ? bestPoLine.description : null,
            destination_location_id: destinationLocationId,
            destination_location_name: destinationLocationName,
          }
        }
      }

      // 2. Try inventory match
      const matches = findMatches(item.item_name)
      if (matches.length > 0 && matches[0].score >= 0.7) {
        const best = matches[0].item
        return {
          ...item,
          action: 'update' as ItemAction,
          item_id: best.id,
          item_name_linked: best.name,
          current_stock_quantity: null,
          po_line_item_id: null,
          po_line_suggestion: null,
          destination_location_id: destinationLocationId,
          destination_location_name: destinationLocationName,
        }
      }

      // 3. Default to create
      return {
        ...item,
        action: 'create' as ItemAction,
        destination_location_id: destinationLocationId,
        destination_location_name: destinationLocationName,
      }
    })

    setItems(updated)
  }, [inventoryLoading, poLines.length, items.length, destinationLocationId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    autoMatch()
  }, [autoMatch])

  const handleFieldChange = (tempId: string, field: 'item_name' | 'part_number', value: string) => {
    setItems(items.map((i) => {
      if (i.tempId !== tempId) return i
      return { ...i, [field]: field === 'part_number' ? (value || null) : value }
    }))
  }

  const handleQuantityChange = (tempId: string, field: 'quantity_ordered' | 'quantity_shipped' | 'back_order', qty: number) => {
    setItems(items.map((i) => {
      if (i.tempId !== tempId) return i
      const updated = { ...i, [field]: qty }
      if (field === 'quantity_shipped') updated.quantity_received = qty
      return updated
    }))
  }

  const handleActionChange = (tempId: string, action: ItemAction) => {
    setItems(items.map((i) => (i.tempId === tempId ? { ...i, action } : i)))
  }

  const handleRemove = (tempId: string) => {
    setItems(items.filter((i) => i.tempId !== tempId))
  }

  const handleLink = (tempId: string) => {
    setLinkingTempId(tempId)
  }

  const handleLinkResult = (result: {
    item_id: number | null
    item_name_linked: string | null
    current_stock_quantity: number | null
    po_line_item_id: number | null
    po_line_suggestion: POLineSuggestion | null
    action: 'update' | 'create'
  }) => {
    setItems(
      items.map((i) =>
        i.tempId === linkingTempId
          ? {
              ...i,
              item_id: result.item_id,
              item_name_linked: result.item_name_linked,
              current_stock_quantity: result.current_stock_quantity,
              po_line_item_id: result.po_line_item_id,
              po_line_suggestion: result.po_line_suggestion,
              action: result.action,
            }
          : i
      )
    )
    setLinkingTempId(null)
  }

  const handleCreateNew = (tempId: string) => {
    setItems(items.map((i) =>
      i.tempId === tempId
        ? {
            ...i,
            action: 'create' as ItemAction,
            item_id: null,
            item_name_linked: null,
            po_line_item_id: null,
            po_line_suggestion: null,
            destination_location_id: destinationLocationId,
            destination_location_name: destinationLocationName,
          }
        : i
    ))
  }

  const handleAddManualItem = () => {
    if (!newItemName.trim()) return

    const newItem: ReceivingLineItem = {
      tempId: `manual-${Date.now()}`,
      item_name: newItemName.trim(),
      part_number: newPartNumber.trim() || null,
      quantity_ordered: newQuantity,
      quantity_shipped: newQuantity,
      back_order: 0,
      quantity_received: newQuantity,
      confidence: 'high',
      action: 'pending',
      item_id: null,
      item_name_linked: null,
      current_stock_quantity: null,
      po_line_item_id: null,
      po_line_suggestion: null,
      destination_location_id: destinationLocationId,
      destination_location_name: destinationLocationName,
      notes: null,
    }

    setItems([...items, newItem])
    setNewItemName('')
    setNewPartNumber('')
    setNewQuantity(1)
    if (!isManualEntry) setShowAddForm(false)
  }

  const activeItems = items.filter((i) => i.action !== 'skip')
  const canProceed = activeItems.length > 0 && activeItems.every((i) => i.action !== 'pending')
  const pendingCount = items.filter((i) => i.action === 'pending').length

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[var(--muted)]">
          <b className="text-[var(--ink-2)] font-medium">{items.length}</b> item
          {items.length !== 1 ? 's' : ''}
          {inventoryLoading && (
            <span className="ml-2">
              <span className="loading loading-spinner" style={{ width: 12, height: 12 }} /> Matching...
            </span>
          )}
          {poId && poLines.length > 0 && (
            <span className="ml-2 text-xs" style={{ color: 'var(--signal)' }}>
              · {poLines.length} PO line{poLines.length !== 1 ? 's' : ''} available
            </span>
          )}
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-[var(--signal)] hover:bg-[var(--panel-2)] transition-colors"
          >
            <Icon name="plus" className="w-3.5 h-3.5" />
            Add item
          </button>
        )}
      </div>

      {/* Pending warning */}
      {pendingCount > 0 && !inventoryLoading && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm"
          style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
        >
          <Icon name="alert" className="w-4 h-4 shrink-0" />
          {pendingCount} item{pendingCount !== 1 ? 's need' : ' needs'} to be linked before you can proceed.
        </div>
      )}

      {/* Manual add form */}
      {showAddForm && (
        <div
          className="rounded-xl p-4 space-y-3 relative"
          style={{ background: 'var(--panel-2)' }}
        >
          {!isManualEntry && (
            <button
              onClick={() => setShowAddForm(false)}
              className="absolute top-3 right-3 text-xs text-[var(--muted)] hover:text-[var(--ink-2)] transition-colors"
            >
              Cancel
            </button>
          )}
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3.5">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-md grid place-items-center shrink-0"
                style={{
                  background: 'var(--info-soft)',
                  border: '1px solid color-mix(in oklab, var(--info) 30%, var(--line))',
                }}
              >
                <Icon name="plus" className="w-3.5 h-3.5" style={{ color: 'var(--info)' }} />
              </div>
              <div className="text-sm font-medium text-[var(--ink)]">Add item</div>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1 min-w-0">
                <div
                  className="mb-1 text-[var(--muted)]"
                  style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}
                >
                  Item name
                </div>
                <input
                  className="form-input w-full"
                  placeholder="e.g. 3/4 Copper Coupling"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleAddManualItem()}
                />
              </div>
              <div className="w-32 shrink-0">
                <div
                  className="mb-1 text-[var(--muted)]"
                  style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}
                >
                  Part #
                </div>
                <input
                  className="form-input w-full"
                  placeholder="Optional"
                  value={newPartNumber}
                  onChange={(e) => setNewPartNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddManualItem()}
                />
              </div>
              <div className="w-16 shrink-0">
                <div
                  className="mb-1 text-[var(--muted)]"
                  style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}
                >
                  Qty
                </div>
                <input
                  type="number"
                  className="form-input w-full"
                  min={1}
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(parseInt(e.target.value) || 1)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddManualItem()}
                />
              </div>
              <button
                onClick={handleAddManualItem}
                disabled={!newItemName.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 shrink-0"
                style={{ background: 'var(--signal)' }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item list */}
      <div className="space-y-2">
        {items.map((item) => (
          <ReceiptItemRow
            key={item.tempId}
            item={item}
            poLines={poLines}
            onFieldChange={handleFieldChange}
            onQuantityChange={handleQuantityChange}
            onActionChange={handleActionChange}
            onLink={handleLink}
            onCreateNew={handleCreateNew}
            onRemove={handleRemove}
            destinationLocationName={destinationLocationName}
          />
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center py-8 text-[var(--muted)]">
          {showAddForm ? (
            <p className="text-sm">Items you add will appear here.</p>
          ) : (
            <>
              <p className="text-base font-medium">No items yet</p>
              <p className="text-sm mt-1">Add items manually or go back and upload a PDF</p>
            </>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-[var(--line)]">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[var(--line)] text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--panel-2)]"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--signal)' }}
        >
          Review &amp; confirm
          <Icon name="chevron-right" className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Link modal */}
      {linkingTempId && linkingItem && (
        <ItemMatchModal
          isOpen={true}
          onClose={() => setLinkingTempId(null)}
          onSelect={handleLinkResult}
          itemName={linkingItem.item_name}
          partNumber={linkingItem.part_number}
          poLines={poLines}
        />
      )}
    </div>
  )
}
