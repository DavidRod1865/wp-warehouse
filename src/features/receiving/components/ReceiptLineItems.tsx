/**
 * ReceiptLineItems — Step 2 of the receiving workflow
 *
 * Displays parsed/manual line items. Handles auto-matching for project
 * destinations and manual linking for warehouse destinations.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ReceiptItemRow } from './ReceiptItemRow'
import { ItemMatchModal } from './ItemMatchModal'
import { useFolderItems } from '../hooks/useFolderItems'
import { useFolders } from '../../inventory/hooks/useFolders'
import { useAppConfig } from '../../../hooks/useAppConfig'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../../../components/ui/Icon'
import type { ReceivingLineItem, DestinationType, ItemAction } from '../types'
import type { Project } from '../../../types/project'

interface ReceiptLineItemsProps {
  items: ReceivingLineItem[]
  setItems: (items: ReceivingLineItem[]) => void
  destinationType: DestinationType
  destinationFolderId: number | null
  /** Display name for the destination folder (project name for project mode) */
  destinationFolderName?: string | null
  /** Whether user chose manual entry (vs PDF upload) */
  isManualEntry?: boolean
  onBack: () => void
  onNext: () => void
}

export function ReceiptLineItems({
  items,
  setItems,
  destinationType,
  destinationFolderId,
  destinationFolderName,
  isManualEntry,
  onBack,
  onNext,
}: ReceiptLineItemsProps) {
  const { data: appConfig } = useAppConfig()
  const isProject = destinationType === 'project'

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ['projects', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, sortly_warehouse_folder_id')
        .eq('status', 'active')
        .order('name')
      if (error) throw error
      return (data || []) as Project[]
    },
    staleTime: 5 * 60 * 1000,
  })

  // Build additional roots: all projects with a Sortly folder (including current destination)
  const additionalRoots = useMemo(() =>
    allProjects
      .filter((p) => p.sortly_warehouse_folder_id != null)
      .map((p) => ({ id: p.sortly_warehouse_folder_id!, label: p.name })),
    [allProjects]
  )

  // Build folder ID→name map for warehouse mode (to show folder in banner)
  const { data: allFolders } = useFolders()
  const folderNameMap = useMemo(
    () => new Map((allFolders ?? []).map((f) => [f.id, f.name])),
    [allFolders],
  )

  // Fetch items for matching: project = flat (folder only), warehouse = recursive (all subfolders)
  const { items: folderItems, findMatches, isLoading: folderItemsLoading } =
    useFolderItems(destinationFolderId, !isProject)

  // For warehouse mode: modal for linking items
  const [linkingTempId, setLinkingTempId] = useState<string | null>(null)
  const linkingItem = items.find((i) => i.tempId === linkingTempId)

  // For manual entry: modal to browse and add an existing Sortly item
  const [showBrowseModal, setShowBrowseModal] = useState(false)

  // Manual add form
  const [showAddForm, setShowAddForm] = useState(!!isManualEntry)
  const [newItemName, setNewItemName] = useState('')
  const [newPartNumber, setNewPartNumber] = useState('')
  const [newQuantity, setNewQuantity] = useState(1)

  // Auto-match on mount or when folder items load
  const autoMatch = useCallback(() => {
    if (folderItemsLoading || folderItems.length === 0) return

    const updated = items.map((item) => {
      if (item.action !== 'pending') return item

      const matches = findMatches(item.item_name)
      if (matches.length > 0 && matches[0].score >= 0.7) {
        const best = matches[0].item
        // For project mode use the passed-in folder name; for warehouse look up by parent_id
        const folderName = isProject
          ? (destinationFolderName ?? null)
          : (folderNameMap.get(best.parent_id ?? 0) ?? null)
        return {
          ...item,
          action: 'update' as ItemAction,
          sortly_item_id: best.id,
          sortly_item_name: best.name,
          sortly_current_quantity: Math.round(best.quantity ?? 0),
          destination_folder_id: destinationFolderId,
          destination_folder_name: folderName,
        }
      }
      // No match → create new
      return {
        ...item,
        action: 'create' as ItemAction,
        destination_folder_id: destinationFolderId,
        destination_folder_name: isProject ? (destinationFolderName ?? null) : null,
      }
    })

    setItems(updated)
  }, [folderItemsLoading, folderItems.length, folderNameMap]) // eslint-disable-line react-hooks/exhaustive-deps

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
      // quantity_received always tracks quantity_shipped
      if (field === 'quantity_shipped') updated.quantity_received = qty
      return updated
    }))
  }

  const handleTagsChange = (tempId: string, tags: string[]) => {
    setItems(items.map((i) => (i.tempId === tempId ? { ...i, tags } : i)))
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
    sortly_item_id: number | null
    sortly_item_name: string | null
    sortly_current_quantity: number | null
    destination_folder_id: number
    destination_folder_name: string
    action: 'update' | 'create'
  }) => {
    setItems(
      items.map((i) =>
        i.tempId === linkingTempId
          ? {
              ...i,
              sortly_item_id: result.sortly_item_id,
              sortly_item_name: result.sortly_item_name,
              sortly_current_quantity: result.sortly_current_quantity !== null
                ? Math.round(result.sortly_current_quantity)
                : null,
              destination_folder_id: result.destination_folder_id,
              destination_folder_name: result.destination_folder_name,
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
            sortly_item_id: null,
            sortly_item_name: null,
            sortly_current_quantity: null,
            destination_folder_id: destinationFolderId,
            destination_folder_name: isProject ? (destinationFolderName ?? null) : null,
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
      action: isProject ? 'create' : 'pending',
      sortly_item_id: null,
      sortly_item_name: null,
      sortly_current_quantity: null,
      destination_folder_id: destinationFolderId,
      destination_folder_name: isProject ? (destinationFolderName ?? null) : null,
      notes: null,
      tags: [],
    }

    // Try auto-matching the new item against existing folder items
    if (folderItems.length > 0) {
      const matches = findMatches(newItemName.trim())
      if (matches.length > 0 && matches[0].score >= 0.7) {
        const best = matches[0].item
        newItem.action = 'update'
        newItem.sortly_item_id = best.id
        newItem.sortly_item_name = best.name
        newItem.sortly_current_quantity = Math.round(best.quantity ?? 0)
      }
    }

    setItems([...items, newItem])
    setNewItemName('')
    setNewPartNumber('')
    setNewQuantity(1)
    if (!isManualEntry) setShowAddForm(false)
  }

  const handleBrowseResult = (result: {
    sortly_item_id: number | null
    sortly_item_name: string | null
    sortly_current_quantity: number | null
    destination_folder_id: number
    destination_folder_name: string
    action: 'update' | 'create'
  }) => {
    const newItem: ReceivingLineItem = {
      tempId: `browse-${Date.now()}`,
      item_name: result.sortly_item_name || 'New item',
      part_number: null,
      quantity_ordered: 1,
      quantity_shipped: 1,
      back_order: 0,
      quantity_received: 1,
      confidence: 'high',
      action: result.action,
      sortly_item_id: result.sortly_item_id,
      sortly_item_name: result.sortly_item_name,
      sortly_current_quantity: result.sortly_current_quantity !== null
        ? Math.round(result.sortly_current_quantity)
        : null,
      destination_folder_id: result.destination_folder_id,
      destination_folder_name: result.destination_folder_name,
      notes: null,
      tags: [],
    }
    setItems([...items, newItem])
    setShowBrowseModal(false)
  }

  const activeItems = items.filter((i) => i.action !== 'skip')
  const canProceed = activeItems.length > 0

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[var(--muted)]">
          <b className="text-[var(--ink-2)] font-medium">{items.length}</b> item
          {items.length !== 1 ? 's' : ''}
          {folderItemsLoading && (
            <span className="ml-2">
              <span className="loading loading-spinner" style={{ width: 12, height: 12 }} /> Matching...
            </span>
          )}
        </div>
        {/* Hide "+ Add item" when form is already showing */}
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

      {/* Manual add form */}
      {showAddForm && (
        <div
          className="rounded-xl p-4 space-y-3 relative"
          style={{ background: 'var(--panel-2)' }}
        >
          {/* G: Cancel only when toggleable (non-manual mode) */}
          {!isManualEntry && (
            <button
              onClick={() => setShowAddForm(false)}
              className="absolute top-3 right-3 text-xs text-[var(--muted)] hover:text-[var(--ink-2)] transition-colors"
            >
              Cancel
            </button>
          )}

          {/* Primary: Create new item form */}
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
              <div className="text-sm font-medium text-[var(--ink)]">Create new item</div>
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

          {/* Secondary: Browse existing */}
          <button
            onClick={() => setShowBrowseModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] hover:border-[var(--signal)] transition-colors text-left group"
          >
            <div
              className="w-7 h-7 rounded-md grid place-items-center shrink-0"
              style={{
                background: 'var(--ok-soft)',
                border: '1px solid color-mix(in oklab, var(--ok) 30%, var(--line))',
              }}
            >
              <Icon name="search" className="w-3.5 h-3.5" style={{ color: 'var(--ok)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--ink)]">Link to existing item</div>
              <div className="text-xs text-[var(--muted)] mt-0.5">Browse Sortly inventory and update quantity</div>
            </div>
            <Icon name="chevron-right" className="w-4 h-4 text-[var(--faint)] group-hover:text-[var(--signal)] transition-colors shrink-0" />
          </button>
        </div>
      )}

      {/* Item list */}
      <div className="space-y-2">
        {items.map((item) => (
          <ReceiptItemRow
            key={item.tempId}
            item={item}
            onFieldChange={handleFieldChange}
            onQuantityChange={handleQuantityChange}
            onTagsChange={handleTagsChange}
            onActionChange={handleActionChange}
            onLink={handleLink}
            onCreateNew={handleCreateNew}
            onRemove={handleRemove}
            isProject={isProject}
            sessionFolderName={destinationFolderName ?? null}
          />
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center py-8 text-[var(--muted)]">
          {showAddForm ? (
            <p className="text-sm">
              Items you add will appear here. Each item can be linked to existing inventory or created as new.
            </p>
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

      {/* Link modal — relink an existing item row */}
      <ItemMatchModal
        isOpen={!!linkingTempId}
        onClose={() => setLinkingTempId(null)}
        onSelect={handleLinkResult}
        itemName={linkingItem?.item_name || ''}
        mainWarehouseFolderId={appConfig?.mainWarehouseFolderId ?? null}
        rootFolderLabel="Main Warehouse"
        additionalRoots={additionalRoots}
        defaultFolderId={destinationFolderId}
        defaultFolderName={destinationFolderName ?? null}
        highlightedRootId={destinationFolderId}
      />

      {/* Browse modal — manual entry: add a new item from Sortly */}
      <ItemMatchModal
        isOpen={showBrowseModal}
        onClose={() => setShowBrowseModal(false)}
        onSelect={handleBrowseResult}
        itemName=""
        mainWarehouseFolderId={appConfig?.mainWarehouseFolderId ?? null}
        rootFolderLabel="Main Warehouse"
        additionalRoots={additionalRoots}
        defaultFolderId={destinationFolderId}
        defaultFolderName={destinationFolderName ?? null}
        highlightedRootId={destinationFolderId}
      />
    </div>
  )
}
