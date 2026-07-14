/**
 * ReceiptItemRow (Phase 4) — Single line item in the receiving form
 *
 * Shows:
 *  - Item name + part number (editable)
 *  - Qty fields: Ordered / Shipped / B/O
 *  - If PO linked: ordered vs after-this-receipt with status badge
 *    (backorder remaining / complete / OVER in warning color)
 *  - Action badge + change menu
 *  - Destination location name
 *
 * No Sortly imports.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../../components/ui/Icon'
import { ACTION_STYLES } from '../utils/actionStyles'
import type { ReceivingLineItem, ItemAction, POLineSuggestion } from '../types'

interface ReceiptItemRowProps {
  item: ReceivingLineItem
  poLines: POLineSuggestion[]
  onFieldChange: (tempId: string, field: 'item_name' | 'part_number', value: string) => void
  onQuantityChange: (tempId: string, field: 'quantity_ordered' | 'quantity_shipped' | 'back_order', qty: number) => void
  onActionChange: (tempId: string, action: ItemAction) => void
  onLink: (tempId: string) => void
  onCreateNew: (tempId: string) => void
  onRemove?: (tempId: string) => void
  destinationLocationName: string | null
}

export function ReceiptItemRow({
  item,
  onFieldChange,
  onQuantityChange,
  onActionChange,
  onLink,
  onCreateNew,
  onRemove,
}: ReceiptItemRowProps) {
  const badge = ACTION_STYLES[item.action]
  const isLowConfidence = item.confidence === 'low'
  const isBalanced = item.quantity_ordered === item.quantity_shipped + item.back_order
  const isSkipped = item.action === 'skip'

  const [editingField, setEditingField] = useState<'item_name' | 'part_number' | null>(null)
  const [editValue, setEditValue] = useState('')

  const startEdit = (field: 'item_name' | 'part_number') => {
    setEditingField(field)
    setEditValue(field === 'item_name' ? item.item_name : item.part_number || '')
  }

  const commitEdit = () => {
    if (!editingField) return
    const trimmed = editValue.trim()
    if (editingField === 'item_name' && !trimmed) {
      setEditingField(null)
      return
    }
    onFieldChange(item.tempId, editingField, trimmed)
    setEditingField(null)
  }

  // PO line progress calculation
  const poLine = item.po_line_suggestion
  const poQtyAfterThis = poLine
    ? poLine.quantity_already_received + item.quantity_received
    : null
  const poQtyOrdered = poLine?.quantity_ordered ?? null

  const getPOBadge = () => {
    if (!poLine || poQtyAfterThis === null || poQtyOrdered === null) return null
    if (poQtyAfterThis > poQtyOrdered) {
      return { label: `OVER +${poQtyAfterThis - poQtyOrdered}`, color: 'var(--warn)', bg: 'var(--warn-soft)' }
    }
    if (poQtyAfterThis === poQtyOrdered) {
      return { label: 'Complete', color: 'var(--ok)', bg: 'var(--ok-soft)' }
    }
    const remaining = poQtyOrdered - poQtyAfterThis
    return { label: `${remaining} remaining`, color: 'var(--muted)', bg: 'var(--panel-2)' }
  }

  const poBadge = getPOBadge()

  return (
    <div
      className="flex gap-0 rounded-lg transition-colors overflow-hidden"
      style={{
        background: isSkipped
          ? 'var(--panel-2)'
          : isLowConfidence
            ? 'color-mix(in oklab, var(--warn) 6%, var(--panel))'
            : 'var(--panel)',
        border: isLowConfidence && !isSkipped
          ? '1px solid color-mix(in oklab, var(--warn) 25%, var(--line))'
          : '1px solid var(--line)',
      }}
    >
      {/* ── Left: item details ── */}
      <div
        className="flex-1 min-w-0 flex flex-col gap-2 px-4 py-3"
        style={{ opacity: isSkipped ? 0.45 : 1, pointerEvents: isSkipped ? 'none' : undefined }}
      >
        {/* Item name */}
        <div className="flex items-center gap-2 flex-wrap">
          {editingField === 'item_name' ? (
            <input
              autoFocus
              className="text-sm font-medium text-[var(--ink)] bg-transparent border-b border-[var(--signal)] outline-none w-full py-0.5"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') setEditingField(null)
              }}
            />
          ) : (
            <button
              onClick={() => startEdit('item_name')}
              className="text-sm font-medium text-[var(--ink)] truncate text-left hover:text-[var(--signal)] transition-colors group flex items-center gap-1"
              title="Click to edit name"
            >
              {item.item_name}
              <Icon name="edit" className="w-3 h-3 text-[var(--muted)] opacity-0 group-hover:opacity-100 shrink-0" />
            </button>
          )}
          {isLowConfidence && (
            <Icon name="alert" className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--warn)' }} />
          )}
          {/* Linked item indicator */}
          {item.action === 'update' && item.item_name_linked && (
            <div className="flex items-center gap-1 shrink-0">
              <Icon name="check" className="w-3 h-3" style={{ color: 'var(--ok)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--ok)' }}>
                {item.po_line_suggestion
                  ? `PO Line: ${item.po_line_suggestion.description}`
                  : `Linked: ${item.item_name_linked}`}
              </span>
            </div>
          )}
          {item.action === 'update' && !item.item_name_linked && item.po_line_item_id && (
            <div className="flex items-center gap-1 shrink-0">
              <Icon name="check" className="w-3 h-3" style={{ color: 'var(--ok)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--ok)' }}>
                Matched to PO line
              </span>
            </div>
          )}
        </div>

        {/* Part number */}
        <div>
          {editingField === 'part_number' ? (
            <input
              autoFocus
              className="bg-transparent border-b border-[var(--signal)] outline-none py-0.5"
              style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}
              placeholder="Part number..."
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') setEditingField(null)
              }}
            />
          ) : (
            <button
              onClick={() => startEdit('part_number')}
              className="hover:text-[var(--signal)] transition-colors group flex items-center gap-1"
              style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}
              title="Click to edit part number"
            >
              Part #: {item.part_number || '—'}
              <Icon name="edit" className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 shrink-0" />
            </button>
          )}
        </div>

        {/* Qty fields */}
        <div className="flex items-center gap-3 flex-wrap">
          {isLowConfidence && (
            <span className="text-xs font-medium shrink-0" style={{ color: 'var(--warn)' }}>
              Confirm quantities →
            </span>
          )}
          <QtyField
            label="Ordered"
            value={item.quantity_ordered}
            onChange={(v) => onQuantityChange(item.tempId, 'quantity_ordered', v)}
            highlight={isLowConfidence}
          />
          <QtyField
            label="Shipped"
            value={item.quantity_shipped}
            onChange={(v) => onQuantityChange(item.tempId, 'quantity_shipped', v)}
            highlight={isLowConfidence}
            primary
          />
          <QtyField
            label="B/O"
            value={item.back_order}
            onChange={(v) => onQuantityChange(item.tempId, 'back_order', v)}
            highlight={isLowConfidence}
            min={0}
          />
          {!isBalanced && (
            <span className="text-xs flex items-center gap-1 shrink-0" style={{ color: 'var(--warn)' }}>
              <Icon name="alert" className="w-3 h-3" />
              Ordered ≠ Shipped + B/O
            </span>
          )}
        </div>

        {/* PO progress (only when PO line is linked) */}
        {poLine && (
          <div
            className="flex items-center gap-3 px-2.5 py-1.5 rounded-md"
            style={{ background: 'var(--panel-2)', fontSize: 11, fontFamily: 'var(--mono)' }}
          >
            <span style={{ color: 'var(--muted)' }}>PO: {poLine.quantity_already_received} received</span>
            <span style={{ color: 'var(--muted)' }}>+{item.quantity_received} now</span>
            <span style={{ color: 'var(--muted)' }}>/ {poLine.quantity_ordered} ordered</span>
            {poBadge && (
              <span
                className="px-1.5 py-0.5 rounded font-medium ml-auto"
                style={{ fontSize: 10, color: poBadge.color, background: poBadge.bg }}
              >
                {poBadge.label}
              </span>
            )}
          </div>
        )}

        {/* Destination */}
        {item.destination_location_name && (
          <div
            className="flex items-center gap-1"
            style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}
          >
            Destination: {item.destination_location_name}
          </div>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="w-px shrink-0 self-stretch" style={{ background: 'var(--line)' }} />

      {/* ── Right: action panel ── */}
      <div className="w-44 shrink-0 flex flex-col gap-2 px-3 py-3">
        {/* Status badge */}
        <span
          className="px-2 py-0.5 rounded-full text-xs font-medium text-center"
          style={{ color: badge.color, background: badge.bg }}
        >
          {badge.label}
        </span>

        {/* Qty update preview */}
        {item.action === 'update' && item.current_stock_quantity !== null && (
          <QtyPreview
            from={Math.round(item.current_stock_quantity)}
            to={Math.round(item.current_stock_quantity) + item.quantity_received}
            tone="ok"
          />
        )}

        {/* Qty create preview */}
        {item.action === 'create' && (
          <QtyPreview from={0} to={item.quantity_received} tone="info" />
        )}

        {/* Action menu */}
        <div className="flex flex-col gap-1.5 mt-auto">
          <ActionMenu item={item} onLink={onLink} onCreateNew={onCreateNew} onActionChange={onActionChange} />
          {onRemove && (
            <button
              onClick={() => onRemove(item.tempId)}
              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-[var(--muted)] transition-colors"
              style={{ background: 'transparent' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--danger-soft)'
                e.currentTarget.style.color = 'var(--danger)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--muted)'
              }}
            >
              <Icon name="close" className="w-3 h-3" />
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Action menu ──────────────────────────────────────────

function ActionMenu({
  item,
  onLink,
  onCreateNew,
  onActionChange,
}: {
  item: ReceivingLineItem
  onLink: (tempId: string) => void
  onCreateNew: (tempId: string) => void
  onActionChange: (tempId: string, action: ItemAction) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + 4,
      left: rect.right - 176,
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    const handleScroll = () => setOpen(false)
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  const options: { label: string; onClick: () => void; tone?: 'danger' }[] = []

  if (item.action !== 'update') {
    options.push({ label: 'Link to existing / PO line', onClick: () => onLink(item.tempId) })
  } else {
    options.push({ label: 'Link to different item', onClick: () => onLink(item.tempId) })
  }

  if (item.action !== 'create') {
    options.push({ label: 'Create new item', onClick: () => onCreateNew(item.tempId) })
  }

  if (item.action !== 'skip') {
    options.push({ label: 'Skip', onClick: () => onActionChange(item.tempId, 'skip'), tone: 'danger' })
  }

  if (item.action === 'skip') {
    options.push({ label: 'Un-skip', onClick: () => onActionChange(item.tempId, 'pending') })
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--ink-2)] border border-[var(--line)] bg-[var(--panel)] hover:bg-[var(--panel-2)] transition-colors"
      >
        <span>Change…</span>
        <Icon
          name="chevron-right"
          className="w-3 h-3 transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed w-44 rounded-md overflow-hidden"
          style={{
            top: pos.top,
            left: pos.left,
            zIndex: 1000,
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow)',
          }}
        >
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => { opt.onClick(); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs font-medium transition-colors"
              style={{
                color: opt.tone === 'danger' ? 'var(--danger)' : 'var(--ink-2)',
                borderTop: i > 0 ? '1px solid var(--line)' : undefined,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = opt.tone === 'danger' ? 'var(--danger-soft)' : 'var(--panel-2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

// ── Qty preview pill ──────────────────────────────────────

function QtyPreview({ from, to, tone }: { from: number; to: number; tone: 'ok' | 'info' }) {
  const color = tone === 'ok' ? 'var(--ok)' : 'var(--info)'
  return (
    <div
      className="w-full flex items-center justify-center gap-2 rounded-md py-1.5"
      style={{
        background: `color-mix(in oklab, ${color} 10%, var(--panel))`,
        border: `1px solid color-mix(in oklab, ${color} 25%, var(--line))`,
      }}
    >
      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color }}>{from}</span>
      <span style={{ color, fontSize: 12 }}>→</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color }}>{to}</span>
    </div>
  )
}

// ── Qty stepper field ──────────────────────────────────────

function QtyField({
  label,
  value,
  onChange,
  highlight,
  primary,
  min = 1,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  highlight?: boolean
  primary?: boolean
  min?: number
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-[var(--muted)]"
        style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}
      >
        {label}
      </span>
      <div
        className="inline-flex items-center rounded-md overflow-hidden shrink-0"
        style={{
          border: highlight
            ? '1.5px solid var(--warn)'
            : primary
              ? '1px solid var(--signal)'
              : '1px solid var(--line)',
          background: 'var(--panel)',
        }}
      >
        <button
          className="px-1.5 py-0.5 text-[var(--muted)] hover:text-[var(--ink)]"
          style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(Math.max(min, parseInt(e.target.value) || min))}
          className="w-10 text-center bg-transparent border-x border-[var(--line)] py-0.5"
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 12,
            fontWeight: primary ? 600 : 400,
            color: primary ? 'var(--signal)' : undefined,
          }}
        />
        <button
          className="px-1.5 py-0.5 text-[var(--muted)] hover:text-[var(--ink)]"
          style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  )
}
