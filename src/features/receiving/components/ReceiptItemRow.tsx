/**
 * ReceiptItemRow — Single line item in the receiving form
 *
 * Editable name, part number, 3 qty fields with balance check, tags, and a
 * compact action menu. The menu replaces the prior 3-button color stack —
 * status + qty preview stay prominent; transitions live behind a "Change…"
 * affordance to quiet the visual noise across many rows.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../../components/ui/Icon'
import { ACTION_STYLES } from '../utils/actionStyles'
import type { ReceivingLineItem, ItemAction } from '../types'

interface ReceiptItemRowProps {
  item: ReceivingLineItem
  onFieldChange: (tempId: string, field: 'item_name' | 'part_number', value: string) => void
  onQuantityChange: (tempId: string, field: 'quantity_ordered' | 'quantity_shipped' | 'back_order', qty: number) => void
  onTagsChange: (tempId: string, tags: string[]) => void
  onActionChange: (tempId: string, action: ItemAction) => void
  onLink: (tempId: string) => void
  onCreateNew: (tempId: string) => void
  onRemove?: (tempId: string) => void
  isProject: boolean
  sessionFolderName: string | null
}

export function ReceiptItemRow({
  item,
  onFieldChange,
  onQuantityChange,
  onTagsChange,
  onActionChange,
  onLink,
  onCreateNew,
  onRemove,
  isProject,
  sessionFolderName,
}: ReceiptItemRowProps) {
  const badge = ACTION_STYLES[item.action]
  const isLowConfidence = item.confidence === 'low'
  const isBalanced = item.quantity_ordered === item.quantity_shipped + item.back_order

  // Inline editing state
  const [editingField, setEditingField] = useState<'item_name' | 'part_number' | null>(null)
  const [editValue, setEditValue] = useState('')

  // Tag input state
  const [tagInput, setTagInput] = useState('')
  const tagInputRef = useRef<HTMLInputElement>(null)

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

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed || item.tags.includes(trimmed)) return
    onTagsChange(item.tempId, [...item.tags, trimmed])
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    onTagsChange(item.tempId, item.tags.filter((t) => t !== tag))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    } else if (e.key === 'Backspace' && !tagInput && item.tags.length > 0) {
      removeTag(item.tags[item.tags.length - 1])
    }
  }

  const isSkipped = item.action === 'skip'

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
          {item.action === 'update' && item.sortly_item_id && (
            <div className="flex items-center gap-1 shrink-0">
              <Icon name="check" className="w-3 h-3" style={{ color: 'var(--ok)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--ok)' }}>
                Linked: {item.sortly_item_name || `Item #${item.sortly_item_id}`}
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
              Part Number: {item.part_number || '-'}
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

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: 'var(--panel-2)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:opacity-70 transition-opacity" style={{ color: 'var(--danger)' }}>
                <Icon name="close" className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <input
            ref={tagInputRef}
            className="bg-transparent text-xs outline-none min-w-[80px] py-0.5 text-[var(--ink-2)] placeholder:text-[var(--muted)]"
            placeholder={item.tags.length === 0 ? 'Add tags...' : ''}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => { if (tagInput.trim()) addTag(tagInput) }}
          />
        </div>

        {/* Destination */}
        {item.destination_folder_name && (() => {
          const isCrossProject = sessionFolderName !== null && item.destination_folder_name !== sessionFolderName
          return (
            <div
              className="flex items-center gap-1"
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: isCrossProject ? 'var(--warn)' : 'var(--muted)',
                background: isCrossProject ? 'var(--warn-soft)' : undefined,
                border: isCrossProject ? '1px solid color-mix(in oklab, var(--warn) 30%, var(--line))' : undefined,
                borderRadius: isCrossProject ? 4 : undefined,
                padding: isCrossProject ? '2px 6px' : undefined,
              }}
            >
              {isProject
                ? `Add to ${item.destination_folder_name}`
                : `Add to Warehouse — ${item.destination_folder_name}`}
              {isCrossProject && (
                <span style={{ opacity: 0.75 }}> · Different project</span>
              )}
            </div>
          )
        })()}
      </div>

      {/* ── Divider ── */}
      <div className="w-px shrink-0 self-stretch" style={{ background: 'var(--line)' }} />

      {/* ── Right: action panel (compact) ── */}
      <div className="w-44 shrink-0 flex flex-col gap-2 px-3 py-3">
        {/* Status badge */}
        <span
          className="px-2 py-0.5 rounded-full text-xs font-medium text-center"
          style={{ color: badge.color, background: badge.bg }}
        >
          {badge.label}
        </span>

        {/* Qty update — shown when linked to existing item */}
        {item.action === 'update' && item.sortly_current_quantity !== null && (
          <QtyPreview
            from={Math.round(item.sortly_current_quantity)}
            to={Math.round(item.sortly_current_quantity) + item.quantity_received}
            tone="ok"
          />
        )}

        {/* Qty preview — shown when creating a new item */}
        {item.action === 'create' && (
          <QtyPreview from={0} to={item.quantity_received} tone="info" />
        )}

        {/* Action menu — replaces the old 3-button color stack */}
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

// ── Action menu (the visual quieting) ──────────────────

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
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Compute portal position when menu opens, anchored to the button
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + 4,
      left: rect.right - 176, // align right edge (w-44 = 176px)
      width: rect.width,
    })
  }, [open])

  // Close on outside click or scroll
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
    options.push({
      label: 'Link to existing item',
      onClick: () => onLink(item.tempId),
    })
  } else {
    options.push({
      label: 'Link to different item',
      onClick: () => onLink(item.tempId),
    })
  }

  if (item.action !== 'create') {
    options.push({
      label: 'Create new item',
      onClick: () => onCreateNew(item.tempId),
    })
  }

  if (item.action !== 'skip') {
    options.push({
      label: 'Skip import',
      onClick: () => onActionChange(item.tempId, 'skip'),
      tone: 'danger',
    })
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
              onClick={() => {
                opt.onClick()
                setOpen(false)
              }}
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

// ── Qty preview pill ────────────────────────────────────

function QtyPreview({
  from,
  to,
  tone,
}: {
  from: number
  to: number
  tone: 'ok' | 'info'
}) {
  const color = tone === 'ok' ? 'var(--ok)' : 'var(--info)'
  return (
    <div
      className="w-full flex items-center justify-center gap-2 rounded-md py-1.5"
      style={{
        background: `color-mix(in oklab, ${color} 10%, var(--panel))`,
        border: `1px solid color-mix(in oklab, ${color} 25%, var(--line))`,
      }}
    >
      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color }}>
        {from}
      </span>
      <span style={{ color, fontSize: 12 }}>→</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color }}>
        {to}
      </span>
    </div>
  )
}

// ── Qty field (stepper) ────────────────────────────────

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
