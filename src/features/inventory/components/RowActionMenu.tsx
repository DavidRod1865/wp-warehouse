import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../../components/ui/Icon'
import type { EnrichedItem } from '../hooks/useInventoryData'

interface RowActionMenuProps {
  item: EnrichedItem
  onEditQuantity: (item: EnrichedItem) => void
  onEditItem: (item: EnrichedItem) => void
  onDelete: (item: EnrichedItem) => void
}

export function RowActionMenu({ item, onEditQuantity, onEditItem, onDelete }: RowActionMenuProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open) return

    // Position the menu below the button, right-aligned
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + 4,
        left: rect.right - 176, // 176 = w-44 = 11rem
      })
    }

    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function act(fn: (item: EnrichedItem) => void) {
    setOpen(false)
    fn(item)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 rounded-md grid place-items-center hover:bg-[var(--panel-2)] text-[var(--muted)]"
      >
        <Icon name="more" className="w-4 h-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-44 border border-[var(--line)] bg-[var(--panel)] rounded-lg py-1"
            style={{ top: pos.top, left: pos.left, boxShadow: '0 8px 30px -8px rgba(15,23,41,.25)' }}
          >
            <button
              onClick={() => act(onEditQuantity)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--panel-2)]"
            >
              <Icon name="edit" className="w-3.5 h-3.5" />
              Edit quantity
            </button>
            <button
              onClick={() => act(onEditItem)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--panel-2)]"
            >
              <Icon name="settings" className="w-3.5 h-3.5" />
              Edit item
            </button>
            <div className="my-1 border-t border-[var(--line)]" />
            <button
              onClick={() => act(onDelete)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--danger)] hover:bg-[var(--panel-2)]"
            >
              <Icon name="close" className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>,
          document.body
        )}
    </>
  )
}
