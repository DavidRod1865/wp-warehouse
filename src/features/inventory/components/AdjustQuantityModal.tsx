import { useState } from 'react'
import { Icon } from '../../../components/ui/Icon'
import { useToast } from '../../../components/ui/Toast'
import { useUpdateItem } from '../hooks/useSortlyMutations'
import type { EnrichedItem } from '../hooks/useInventoryData'

const ADJUSTMENT_TYPES = ['Received', 'Damaged', 'Counted', 'Returned', 'Other'] as const

interface AdjustQuantityModalProps {
  item: EnrichedItem
  onClose: () => void
}

export function AdjustQuantityModal({ item, onClose }: AdjustQuantityModalProps) {
  const [newQty, setNewQty] = useState(Math.floor(item.quantity ?? 0))
  const [adjustType, setAdjustType] = useState<string>('Counted')
  const [reason, setReason] = useState('')
  const updateItem = useUpdateItem()
  const { toast } = useToast()

  const currentQty = Math.floor(item.quantity ?? 0)
  const delta = newQty - currentQty

  async function handleSave() {
    try {
      await updateItem.mutateAsync({
        itemId: item.id,
        updates: { quantity: newQty },
      })
      onClose()
      toast(`"${item.name}" quantity updated (${delta > 0 ? '+' : ''}${delta})`)
    } catch (err) {
      console.error('Adjust quantity failed:', err)
      toast('Failed to update quantity', 'error')
    }
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
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--panel)] rounded-xl w-full max-w-sm overflow-hidden"
        style={{ boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="text-lg font-semibold">Adjust Quantity</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--panel-2)] text-[var(--muted)]">
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Item info */}
        <div className="px-6 pb-4">
          <div className="text-sm font-medium text-[var(--ink)]">{item.name}</div>
          {item.sid && (
            <div className="text-xs text-[var(--muted)] mt-0.5" style={{ fontFamily: 'var(--mono)' }}>
              {item.sid}
            </div>
          )}
        </div>

        {/* Form */}
        <div className="px-6 pb-5 space-y-4">
          {/* Current → New */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>
                Current
              </label>
              <div className="form-input bg-[var(--panel-2)] text-[var(--muted)] cursor-not-allowed">
                {currentQty}
              </div>
            </div>
            <Icon name="arrow" className="w-4 h-4 text-[var(--muted)] mt-5" />
            <div className="flex-1">
              <label className="block text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>
                New
              </label>
              <input
                type="number"
                min={0}
                value={newQty}
                step={1}
              onChange={(e) => setNewQty(Math.max(0, Math.floor(Number(e.target.value))))}
                className="form-input w-full"
                autoFocus
              />
            </div>
          </div>

          {/* Delta indicator */}
          {delta !== 0 && (
            <div
              className="text-sm font-medium px-3 py-1.5 rounded-lg"
              style={{
                background: delta > 0 ? 'var(--ok-soft)' : 'var(--danger-soft)',
                color: delta > 0 ? 'var(--ok)' : 'var(--danger)',
              }}
            >
              {delta > 0 ? '+' : ''}{delta} units
            </div>
          )}

          {/* Adjustment type */}
          <div>
            <label className="block text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>
              Reason
            </label>
            <select
              value={adjustType}
              onChange={(e) => setAdjustType(e.target.value)}
              className="form-input w-full cursor-pointer"
            >
              {ADJUSTMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>
              Notes <span className="normal-case text-[var(--faint)]">(optional)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Additional details..."
              className="form-input w-full"
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 px-6 py-3.5 border-t border-[var(--line)]"
          style={{ background: 'color-mix(in oklab, var(--panel-2) 50%, var(--panel))' }}
        >
          <button
            className="px-3.5 py-2 rounded-lg text-[var(--ink-2)] text-sm font-medium hover:bg-[var(--panel-2)]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3.5 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--signal)' }}
            onClick={handleSave}
            disabled={delta === 0 || updateItem.isPending}
          >
            {updateItem.isPending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
