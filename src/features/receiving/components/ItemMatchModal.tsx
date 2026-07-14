/**
 * ItemMatchModal (Phase 4 — inventory-backed)
 *
 * Matching priority:
 *  1. Open PO lines (if a PO is linked) — auto-suggests by part_number exact,
 *     then name contains. Shows ordered vs already-received.
 *  2. Existing inventory items (useInventoryItems search).
 *  3. Create new item (no folder browsing — that's a Sortly concept).
 *
 * No Sortly imports.
 */
import { useState, useEffect } from 'react'
import { useInventoryItems } from '../../inventory/hooks/useInventoryItems'
import { Icon } from '../../../components/ui/Icon'
import type { InventoryItem } from '../../inventory/types'
import type { POLineSuggestion } from '../types'

interface ItemMatchResult {
  item_id: number | null
  item_name_linked: string | null
  current_stock_quantity: number | null
  po_line_item_id: number | null
  po_line_suggestion: POLineSuggestion | null
  action: 'update' | 'create'
}

interface ItemMatchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (result: ItemMatchResult) => void
  itemName: string
  partNumber: string | null
  /** PO lines from the linked PO (empty array if no PO linked) */
  poLines: POLineSuggestion[]
}

export function ItemMatchModal({
  isOpen,
  onClose,
  onSelect,
  itemName,
  partNumber,
  poLines,
}: ItemMatchModalProps) {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'po' | 'items' | 'new'>('po')

  const { data: searchResults = [], isLoading: searchLoading } = useInventoryItems({
    search: search.length >= 2 ? search : itemName.length >= 2 ? itemName : undefined,
  })

  // Auto-focus right tab on open
  useEffect(() => {
    if (!isOpen) return
    setSearch('')
    setActiveTab(poLines.length > 0 ? 'po' : 'items')
  }, [isOpen, poLines.length])

  if (!isOpen) return null

  // ── PO line auto-suggestion ────────────────────────────────────────────────

  function scorePOLine(line: POLineSuggestion): number {
    // Exact part_number match → highest priority
    if (partNumber && line.part_number) {
      if (partNumber.toLowerCase().trim() === line.part_number.toLowerCase().trim()) return 1.0
      if (line.part_number.toLowerCase().includes(partNumber.toLowerCase().trim())) return 0.75
    }
    // Name contains
    const q = itemName.toLowerCase()
    const t = line.description.toLowerCase()
    if (q === t) return 0.9
    const words = q.split(' ')
    if (words.every((w) => t.includes(w))) return 0.7
    const matched = words.filter((w) => t.includes(w))
    if (matched.length > 0) return (matched.length / words.length) * 0.5
    return 0
  }

  const scoredPoLines = poLines
    .map((line) => ({ line, score: scorePOLine(line) }))
    .sort((a, b) => b.score - a.score)

  const handleSelectPOLine = (line: POLineSuggestion) => {
    onSelect({
      item_id: line.item_id ?? null,
      item_name_linked: line.description,
      current_stock_quantity: null,
      po_line_item_id: line.po_line_item_id,
      po_line_suggestion: line,
      action: 'update',
    })
    onClose()
  }

  const handleSelectItem = (item: InventoryItem) => {
    onSelect({
      item_id: item.id,
      item_name_linked: item.name,
      current_stock_quantity: null,
      po_line_item_id: null,
      po_line_suggestion: null,
      action: 'update',
    })
    onClose()
  }

  const handleCreateNew = () => {
    onSelect({
      item_id: null,
      item_name_linked: null,
      current_stock_quantity: null,
      po_line_item_id: null,
      po_line_suggestion: null,
      action: 'create',
    })
    onClose()
  }

  const tabs = [
    ...(poLines.length > 0 ? [{ id: 'po' as const, label: `PO Lines (${poLines.length})` }] : []),
    { id: 'items' as const, label: 'Inventory Items' },
    { id: 'new' as const, label: 'Create New' },
  ]

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain"
      style={{
        background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:p-6 sm:items-center">
      <div
        className="bg-[var(--panel)] rounded-xl flex flex-col overflow-hidden my-4 sm:my-0"
        style={{
          width: 'min(760px, calc(100vw - 32px))',
          maxHeight: 'min(720px, calc(100dvh - 32px))',
          boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)] shrink-0">
          <div>
            <div
              className="text-[var(--ink)]"
              style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500 }}
            >
              Link item to inventory
            </div>
            <div className="text-[var(--muted)] text-xs mt-0.5">
              Matching <b className="text-[var(--ink-2)]">{itemName}</b>
              {partNumber && (
                <span className="ml-1 font-mono">#{partNumber}</span>
              )}
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
        <div className="flex border-b border-[var(--line)] px-6 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderBottomColor: activeTab === tab.id ? 'var(--signal)' : 'transparent',
                color: activeTab === tab.id ? 'var(--signal)' : 'var(--muted)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {/* ── Tab: PO Lines ── */}
          {activeTab === 'po' && (
            <div className="space-y-2">
              {scoredPoLines.length === 0 ? (
                <p className="text-sm text-[var(--muted)] text-center py-8">
                  No open PO lines available
                </p>
              ) : (
                scoredPoLines.map(({ line, score }) => {
                  const isOverReceived = line.quantity_already_received >= line.quantity_ordered
                  const isSuggested = score >= 0.5
                  return (
                    <div
                      key={line.po_line_item_id}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors border"
                      style={{
                        background: isSuggested
                          ? 'color-mix(in oklab, var(--ok) 6%, var(--panel))'
                          : 'var(--panel)',
                        borderColor: isSuggested
                          ? 'color-mix(in oklab, var(--ok) 25%, var(--line))'
                          : 'var(--line)',
                      }}
                      onClick={() => handleSelectPOLine(line)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[var(--ink)] truncate">
                            {line.description}
                          </p>
                          {isSuggested && (
                            <span
                              className="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded"
                              style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}
                            >
                              Suggested
                            </span>
                          )}
                          {isOverReceived && (
                            <span
                              className="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded"
                              style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
                            >
                              Fully received
                            </span>
                          )}
                        </div>
                        {line.part_number && (
                          <p
                            className="text-xs mt-0.5"
                            style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}
                          >
                            #{line.part_number}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className="text-xs"
                          style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}
                        >
                          {line.quantity_already_received} / {line.quantity_ordered} received
                        </div>
                        <div
                          className="text-xs font-medium mt-0.5"
                          style={{
                            color: line.quantity_remaining <= 0 ? 'var(--ok)' : 'var(--signal)',
                          }}
                        >
                          {line.quantity_remaining > 0
                            ? `${line.quantity_remaining} remaining`
                            : 'Complete'}
                        </div>
                      </div>
                      <Icon name="chevron-right" className="w-4 h-4 text-[var(--muted)] shrink-0" />
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* ── Tab: Inventory Items ── */}
          {activeTab === 'items' && (
            <div className="space-y-3">
              <input
                className="form-input w-full"
                placeholder={`Search inventory... (pre-filled: "${itemName}")`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {searchLoading ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-sm" />
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-sm text-[var(--muted)] text-center py-6">
                  {search.length >= 2 || itemName.length >= 2
                    ? 'No matching items found'
                    : 'Type to search'}
                </p>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-[var(--panel-2)] transition-colors border border-transparent hover:border-[var(--line)]"
                      onClick={() => handleSelectItem(item)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--ink)] truncate">{item.name}</p>
                        {item.part_number && (
                          <p
                            className="text-xs mt-0.5"
                            style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}
                          >
                            #{item.part_number}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-[var(--signal)] font-medium shrink-0">
                        Select →
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Create New ── */}
          {activeTab === 'new' && (
            <div className="py-6 text-center space-y-4">
              <div
                className="w-12 h-12 rounded-xl grid place-items-center mx-auto"
                style={{ background: 'var(--info-soft)', border: '1px solid color-mix(in oklab, var(--info) 30%, var(--line))' }}
              >
                <Icon name="plus" className="w-5 h-5" style={{ color: 'var(--info)' }} />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">
                  Create new inventory item
                </p>
                <p className="text-sm text-[var(--muted)] mt-1">
                  "<b>{itemName}</b>" will be added to your inventory catalog when confirmed.
                  {partNumber && (
                    <span> Part number <b>#{partNumber}</b> will be saved.</span>
                  )}
                </p>
              </div>
              <button
                onClick={handleCreateNew}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--info)' }}
              >
                Create "{itemName}"
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
