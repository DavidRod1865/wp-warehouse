/**
 * ItemSelectorModal — Browse scoped Sortly folders and select items
 *
 * Restyled to match the hi-fi design: wider modal, design-matched chrome,
 * folder tree, quantity controls. Logic unchanged.
 */
import { useState, useEffect } from 'react'
import { useSubfolders } from '../../inventory/hooks/useFolders'
import { useItems } from '../../inventory/hooks/useItems'
import { Icon } from '../../../components/ui/Icon'
import type { SortlyItem } from '../../../types/sortly'
import type { DeliveryItemFormValues } from '../schemas/deliverySchema'

interface ItemSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onAddItems: (items: DeliveryItemFormValues[]) => void
  sourceFolderId: number | null
  mainWarehouseFolderId: number | null
  existingItemIds: Set<number>
}

export function ItemSelectorModal({
  isOpen,
  onClose,
  onAddItems,
  sourceFolderId,
  mainWarehouseFolderId,
  existingItemIds,
}: ItemSelectorModalProps) {
  const hasProjectFolder =
    sourceFolderId != null &&
    mainWarehouseFolderId != null &&
    sourceFolderId !== mainWarehouseFolderId

  const [activeTab, setActiveTab] = useState<'project' | 'warehouse'>('project')
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [selectedItems, setSelectedItems] = useState<Map<number, { item: SortlyItem; quantity: number }>>(new Map())

  const activeRootId = hasProjectFolder && activeTab === 'project'
    ? sourceFolderId
    : mainWarehouseFolderId

  useEffect(() => {
    setSelectedFolderId(activeRootId)
  }, [activeRootId])

  useEffect(() => {
    if (isOpen) {
      setActiveTab('project')
      setSelectedItems(new Map())
      setSelectedFolderId(activeRootId)
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: rootSubfolders, isLoading: foldersLoading } = useSubfolders(activeRootId)
  const { data: items, isLoading: itemsLoading } = useItems(selectedFolderId)

  if (!isOpen) return null

  const toggleItem = (item: SortlyItem) => {
    const next = new Map(selectedItems)
    if (next.has(item.id)) {
      next.delete(item.id)
    } else {
      next.set(item.id, { item, quantity: item.quantity || 1 })
    }
    setSelectedItems(next)
  }

  const updateQuantity = (itemId: number, quantity: number) => {
    const next = new Map(selectedItems)
    const entry = next.get(itemId)
    if (entry) {
      next.set(itemId, { ...entry, quantity: Math.max(1, quantity) })
    }
    setSelectedItems(next)
  }

  const handleConfirm = () => {
    const deliveryItems: DeliveryItemFormValues[] = Array.from(selectedItems.values()).map(
      ({ item, quantity }) => ({
        sortly_item_id: item.id,
        item_name: item.name,
        quantity,
        delivered_quantity: 0,
        remaining_quantity: quantity,
        available_quantity: item.quantity || 0,
        location: '',
        is_manual: false,
        notes: null,
        custom_attribute_values: item.custom_attribute_values || null,
      })
    )
    onAddItems(deliveryItems)
    setSelectedItems(new Map())
    onClose()
  }

  const availableItems = (items || []).filter(
    (item) => item.type !== 'folder' && !existingItemIds.has(item.id)
  )

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
          width: 'min(1000px, calc(100vw - 80px))',
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
              Browse folders and pick items to add
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg grid place-items-center hover:bg-[var(--panel-2)] text-[var(--muted)]"
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        {hasProjectFolder && (
          <div className="flex gap-1 px-6 pt-3 pb-0">
            {(['project', 'warehouse'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={{
                  background: activeTab === tab ? 'var(--panel-2)' : 'transparent',
                  color: activeTab === tab ? 'var(--ink)' : 'var(--muted)',
                }}
              >
                {tab === 'project' ? 'Project Inventory' : 'Main Warehouse'}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Folder tree */}
          <div className="w-[240px] border-r border-[var(--line)] overflow-y-auto p-3">
            <div
              className="text-[var(--muted)] mb-2 px-2"
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 10,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
              }}
            >
              Folders
            </div>
            {foldersLoading ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-sm" />
              </div>
            ) : (
              <div className="space-y-px">
                {activeRootId && (
                  <button
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      selectedFolderId === activeRootId
                        ? 'bg-[var(--panel-2)] text-[var(--ink)]'
                        : 'text-[var(--ink-2)] hover:bg-[var(--panel-2)]'
                    }`}
                    onClick={() => setSelectedFolderId(activeRootId)}
                  >
                    {hasProjectFolder && activeTab === 'project' ? 'Project Root' : 'Warehouse Root'}
                  </button>
                )}
                {(rootSubfolders || []).map((folder) => (
                  <LazyFolderNode
                    key={folder.id}
                    folder={folder}
                    selectedId={selectedFolderId}
                    onSelect={setSelectedFolderId}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Item list */}
          <div className="flex-1 overflow-y-auto p-4">
            {!selectedFolderId ? (
              <p className="text-sm text-[var(--muted)] text-center py-8">
                Select a folder to browse items
              </p>
            ) : itemsLoading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-sm" />
              </div>
            ) : availableItems.length === 0 ? (
              <p className="text-sm text-[var(--muted)] text-center py-8">
                No items in this folder
              </p>
            ) : (
              <div className="space-y-1">
                {availableItems.map((item) => {
                  const isSelected = selectedItems.has(item.id)
                  const entry = selectedItems.get(item.id)

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
                      onClick={() => toggleItem(item)}
                    >
                      <div
                        className="w-4 h-4 rounded border grid place-items-center shrink-0"
                        style={{
                          borderColor: isSelected ? 'var(--signal)' : 'var(--line)',
                          background: isSelected ? 'var(--signal)' : 'transparent',
                        }}
                      >
                        {isSelected && (
                          <Icon name="check" className="w-2.5 h-2.5 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--ink)] truncate">
                          {item.name}
                        </p>
                        <p
                          className="text-[var(--muted)] mt-0.5"
                          style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
                        >
                          Available: {item.quantity ?? 0}
                        </p>
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
                              max={item.quantity || 999}
                              value={entry.quantity}
                              onChange={(e) =>
                                updateQuantity(item.id, parseInt(e.target.value) || 1)
                              }
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
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-3.5 border-t border-[var(--line)]"
          style={{ background: 'color-mix(in oklab, var(--panel-2) 50%, var(--panel))' }}
        >
          <span className="text-sm text-[var(--muted)]">
            <b className="text-[var(--ink-2)] font-medium">{selectedItems.size}</b> item
            {selectedItems.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[var(--line)] text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--panel-2)]"
            >
              Cancel
            </button>
            <button
              disabled={selectedItems.size === 0}
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

// ── Lazy-loading folder tree node ──

function LazyFolderNode({
  folder,
  selectedId,
  onSelect,
  depth = 0,
}: {
  folder: SortlyItem
  selectedId: number | null
  onSelect: (id: number) => void
  depth?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const { data: children, isLoading } = useSubfolders(expanded ? folder.id : null)
  const isSelected = selectedId === folder.id
  const hasChildren = children && children.length > 0

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded-md transition-colors"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          className="w-5 h-5 grid place-items-center text-[var(--muted)] hover:text-[var(--ink)] shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
          style={{ fontSize: 10 }}
        >
          {isLoading ? (
            <span className="loading loading-spinner" style={{ width: 10, height: 10 }} />
          ) : expanded && hasChildren ? (
            '▾'
          ) : (
            '▸'
          )}
        </button>
        <button
          className={`flex-1 text-left text-sm truncate py-1.5 px-1.5 rounded transition-colors ${
            isSelected
              ? 'bg-[var(--panel-2)] text-[var(--ink)] font-medium'
              : 'text-[var(--ink-2)] hover:bg-[var(--panel-2)]'
          }`}
          onClick={() => onSelect(folder.id)}
        >
          {folder.name}
        </button>
      </div>
      {expanded &&
        hasChildren &&
        children.map((child) => (
          <LazyFolderNode
            key={child.id}
            folder={child}
            selectedId={selectedId}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
    </div>
  )
}
