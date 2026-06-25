/**
 * ItemMatchModal — Browse Sortly warehouse folders to link a receiving item
 *
 * Used in warehouse-destination mode. User navigates folder tree, selects
 * an existing item (to update qty) or picks a folder (to create new).
 */
import { useState, useEffect } from 'react'
import { useSubfolders } from '../../inventory/hooks/useFolders'
import { useItems } from '../../inventory/hooks/useItems'
import { Icon } from '../../../components/ui/Icon'
import type { SortlyItem } from '../../../types/sortly'

interface ItemMatchResult {
  sortly_item_id: number | null
  sortly_item_name: string | null
  sortly_current_quantity: number | null
  destination_folder_id: number
  destination_folder_name: string
  action: 'update' | 'create'
}

interface RootEntry {
  id: number
  label: string
}

interface ItemMatchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (result: ItemMatchResult) => void
  itemName: string
  mainWarehouseFolderId: number | null
  rootFolderLabel?: string
  additionalRoots?: RootEntry[]
  defaultFolderId?: number | null
  defaultFolderName?: string | null
  highlightedRootId?: number | null
}

export function ItemMatchModal({
  isOpen,
  onClose,
  onSelect,
  itemName,
  mainWarehouseFolderId,
  rootFolderLabel = 'Warehouse Root',
  additionalRoots = [],
  defaultFolderId = null,
  defaultFolderName = null,
  highlightedRootId = null,
}: ItemMatchModalProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [selectedFolderName, setSelectedFolderName] = useState<string>('')

  const { data: items, isLoading: itemsLoading } = useItems(selectedFolderId)

  useEffect(() => {
    if (isOpen) {
      setSelectedFolderId(defaultFolderId ?? null)
      setSelectedFolderName(defaultFolderName ?? '')
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null

  const allItems = items || []
  const subfolders = allItems.filter((item) => item.type === 'folder')
  const availableItems = allItems.filter((item) => item.type !== 'folder')

  const handleSelectItem = (item: SortlyItem) => {
    onSelect({
      sortly_item_id: item.id,
      sortly_item_name: item.name,
      sortly_current_quantity: item.quantity ?? 0,
      destination_folder_id: selectedFolderId!,
      destination_folder_name: selectedFolderName,
      action: 'update',
    })
    onClose()
  }

  const handleCreateInFolder = () => {
    if (!selectedFolderId) return
    onSelect({
      sortly_item_id: null,
      sortly_item_name: null,
      sortly_current_quantity: null,
      destination_folder_id: selectedFolderId,
      destination_folder_name: selectedFolderName,
      action: 'create',
    })
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
          width: 'min(900px, calc(100vw - 80px))',
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
              Link item to inventory
            </div>
            <div className="text-[var(--muted)] text-xs mt-0.5">
              Find <b className="text-[var(--ink-2)]">{itemName}</b> in the warehouse, or pick a folder to create it
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg grid place-items-center hover:bg-[var(--panel-2)] text-[var(--muted)]"
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

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
            <div className="space-y-px">
              {mainWarehouseFolderId && (
                <RootSection
                  root={{ id: mainWarehouseFolderId, label: rootFolderLabel }}
                  selectedId={selectedFolderId}
                  highlighted={highlightedRootId === mainWarehouseFolderId}
                  defaultExpanded={highlightedRootId === mainWarehouseFolderId}
                  onSelect={(id, name) => {
                    setSelectedFolderId(id)
                    setSelectedFolderName(name)
                  }}
                />
              )}

              {/* Additional roots (other projects) */}
              {additionalRoots.map((root) => (
                <RootSection
                  key={root.id}
                  root={root}
                  selectedId={selectedFolderId}
                  highlighted={highlightedRootId === root.id}
                  defaultExpanded={highlightedRootId === root.id}
                  onSelect={(id, name) => {
                    setSelectedFolderId(id)
                    setSelectedFolderName(name)
                  }}
                />
              ))}
            </div>
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
            ) : (
              <>
                {/* Subfolders — click to navigate into them */}
                {subfolders.length > 0 && (
                  <div className="mb-3 space-y-px">
                    <div
                      className="text-[var(--muted)] mb-1.5 px-1"
                      style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase' }}
                    >
                      Subfolders
                    </div>
                    {subfolders.map((folder) => (
                      <button
                        key={folder.id}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-[var(--panel-2)] transition-colors group"
                        onClick={() => {
                          setSelectedFolderId(folder.id)
                          setSelectedFolderName(folder.name)
                        }}
                      >
                        <span className="text-[var(--muted)] group-hover:text-[var(--ink-2)] text-xs">▸</span>
                        <span className="font-medium text-[var(--ink-2)] group-hover:text-[var(--ink)]">{folder.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {availableItems.length === 0 && subfolders.length === 0 ? (
                  <p className="text-sm text-[var(--muted)] text-center py-8">
                    No items in this folder
                  </p>
                ) : availableItems.length > 0 ? (
                  <div className="space-y-1 mb-4">
                    {subfolders.length > 0 && (
                      <div
                        className="text-[var(--muted)] mb-1.5 px-1"
                        style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase' }}
                      >
                        Items
                      </div>
                    )}
                    {availableItems.map((item) => {
                      const brand = item.custom_attribute_values?.find(
                        (a) => a.custom_attribute_name.toLowerCase() === 'brand'
                      )?.value
                      const partNum = item.custom_attribute_values?.find(
                        (a) => a.custom_attribute_name.toLowerCase() === 'part number'
                      )?.value

                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-[var(--panel-2)] transition-colors border border-transparent hover:border-[var(--line)]"
                          onClick={() => handleSelectItem(item)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--ink)] truncate">
                              {item.name}
                            </p>
                            <div className="flex items-center gap-3 mt-0.5">
                              {brand && (
                                <span
                                  className="text-[var(--muted)]"
                                  style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
                                >
                                  {brand}
                                </span>
                              )}
                              {partNum && (
                                <span
                                  className="text-[var(--muted)]"
                                  style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
                                >
                                  #{partNum}
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className="text-[var(--ink-2)] shrink-0"
                            style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500 }}
                          >
                            Qty: {item.quantity ?? 0}
                          </span>
                          <span className="text-xs text-[var(--signal)] font-medium shrink-0">
                            Select →
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : null}

                {/* Create new in this folder */}
                <button
                  onClick={handleCreateInFolder}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-[var(--line)] text-sm font-medium text-[var(--ink-2)] hover:border-[var(--signal)] hover:text-[var(--signal)] transition-colors"
                >
                  <Icon name="plus" className="w-4 h-4" />
                  Create new item in "{selectedFolderName}"
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Root section (project folder with its subfolders) ──

function RootSection({
  root,
  selectedId,
  onSelect,
  highlighted = false,
  defaultExpanded = false,
}: {
  root: RootEntry
  selectedId: number | null
  onSelect: (id: number, name: string) => void
  highlighted?: boolean
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { data: children, isLoading } = useSubfolders(expanded ? root.id : null)

  return (
    <div>
      <div className="flex items-center gap-1 mt-1">
        <button
          className="w-5 h-5 grid place-items-center text-[var(--muted)] hover:text-[var(--ink)] shrink-0"
          onClick={() => setExpanded(!expanded)}
          style={{ fontSize: 10 }}
        >
          {isLoading ? (
            <span className="loading loading-spinner" style={{ width: 10, height: 10 }} />
          ) : expanded ? '▾' : '▸'}
        </button>
        <button
          className={`flex-1 text-left text-sm truncate py-1.5 px-1.5 rounded transition-colors font-medium ${
            selectedId === root.id
              ? 'bg-[var(--panel-2)] text-[var(--ink)]'
              : 'text-[var(--ink-2)] hover:bg-[var(--panel-2)]'
          }`}
          style={highlighted ? { outline: '1.5px solid var(--signal)', outlineOffset: '-1px' } : undefined}
          onClick={() => {
            onSelect(root.id, root.label)
            setExpanded((v) => !v)
          }}
        >
          {root.label}
        </button>
      </div>
      {expanded && (children || []).map((child) => (
        <LazyFolderNode
          key={child.id}
          folder={child}
          selectedId={selectedId}
          onSelect={onSelect}
          depth={1}
        />
      ))}
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
  onSelect: (id: number, name: string) => void
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
          onClick={() => onSelect(folder.id, folder.name)}
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
