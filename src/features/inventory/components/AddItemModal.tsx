import { useState } from 'react'
import { Icon } from '../../../components/ui/Icon'
import { useToast } from '../../../components/ui/Toast'
import { useCreateItem } from '../hooks/useSortlyMutations'
import { useQueryClient } from '@tanstack/react-query'
import { sortlyKeys } from '../hooks/sortlyKeys'
import type { LocationOption } from '../hooks/useInventoryData'

interface AddItemModalProps {
  locationOptions: LocationOption[]
  defaultLocationId: number | null
  activeLocationLabel?: string
  isProjectView?: boolean
  onClose: () => void
}

export function AddItemModal({ locationOptions, defaultLocationId, activeLocationLabel, isProjectView, onClose }: AddItemModalProps) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState(0)
  const [minQuantity, setMinQuantity] = useState(0)
  const [parentId, setParentId] = useState<number | null>(defaultLocationId)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const createItem = useCreateItem()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  async function handleSave() {
    if (!parentId || !name.trim()) return
    setSaving(true)
    try {
      await createItem.mutateAsync({
        name: name.trim(),
        type: 'item',
        parent_id: parentId,
        quantity,
        min_quantity: minQuantity,
        notes: notes || undefined,
      })
      await queryClient.invalidateQueries({ queryKey: sortlyKeys.items() })
      onClose()
      toast(`"${name.trim()}" added`)
    } catch (err) {
      console.error('Create item failed:', err)
      setSaving(false)
      toast(err instanceof Error ? err.message : 'Failed to add item', 'error')
    }
  }

  const isValid = name.trim().length > 0 && parentId !== null

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
        className="bg-[var(--panel)] rounded-xl w-full max-w-md overflow-hidden"
        style={{ boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h3 className="text-lg font-semibold">Add Item</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--panel-2)] text-[var(--muted)]">
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 pb-5 space-y-4">
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input w-full"
              placeholder="Item name"
              autoFocus
            />
          </Field>

          <Field label="Location">
            {isProjectView ? (
              <div className="form-input bg-[var(--panel-2)] text-[var(--muted)] cursor-not-allowed">
                {activeLocationLabel || 'Project folder'}
              </div>
            ) : (
              <select
                value={parentId ?? ''}
                onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
                className="form-input w-full cursor-pointer"
              >
                <option value="">Select location...</option>
                {locationOptions.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Quantity">
            <input
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(0, Number(e.target.value)))}
              className="form-input w-full"
            />
          </Field>

          <Field label="Reorder Point">
            <input
              type="number"
              min={0}
              value={minQuantity}
              onChange={(e) => setMinQuantity(Math.max(0, Number(e.target.value)))}
              className="form-input w-full"
            />
          </Field>

          <Field label="Notes" optional>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="form-input w-full resize-none"
              placeholder="Item notes..."
            />
          </Field>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 px-6 py-3.5 border-t border-[var(--line)]"
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
            className="px-3.5 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--signal)' }}
            onClick={handleSave}
            disabled={!isValid || saving}
          >
            {saving ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              'Add Item'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>
        {label}
        {optional && <span className="normal-case text-[var(--faint)] ml-1">(optional)</span>}
      </label>
      {children}
    </div>
  )
}
