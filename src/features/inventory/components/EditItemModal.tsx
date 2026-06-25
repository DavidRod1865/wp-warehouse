import { useState } from 'react'
import { Icon } from '../../../components/ui/Icon'
import { useToast } from '../../../components/ui/Toast'
import { useUpdateItem } from '../hooks/useSortlyMutations'
import { sortlyClient } from '../../../lib/sortly'
import type { EnrichedItem } from '../hooks/useInventoryData'

interface EditItemModalProps {
  item: EnrichedItem
  onClose: () => void
}

/** Extract a custom attribute value by name (case-insensitive). */
function getCustomAttr(item: EnrichedItem, attrName: string) {
  const attr = item.custom_attribute_values?.find(
    (a) => a.custom_attribute_name.toLowerCase() === attrName.toLowerCase()
  )
  return attr ? { id: attr.custom_attribute_id, value: attr.value } : null
}

export function EditItemModal({ item, onClose }: EditItemModalProps) {
  const [name, setName] = useState(item.name)

  const [quantity, setQuantity] = useState(Math.floor(item.quantity ?? 0))
  const [minQuantity, setMinQuantity] = useState(Math.floor(item.min_quantity ?? 0))
  const [notes, setNotes] = useState(item.notes || '')
  const existingBrand = getCustomAttr(item, 'Brand')
  const [brand, setBrand] = useState(existingBrand?.value ?? '')
  const existingPartNumber = getCustomAttr(item, 'Part Number')
  const [partNumber, setPartNumber] = useState(existingPartNumber?.value ?? '')
  const existingPo = getCustomAttr(item, 'PO Number')
  const [poNumber, setPoNumber] = useState(existingPo?.value ?? '')
  const updateItem = useUpdateItem()
  const { toast } = useToast()

  async function handleSave() {
    try {
      const updates: Partial<import('../../../types/sortly').SortlyItem> = {
        name,
        quantity,
        min_quantity: minQuantity,
        notes: notes || undefined,
      }

      // Build custom attribute updates for Brand, Part Number, and PO Number
      const attrUpdates: Array<{ custom_attribute_id: number; custom_attribute_name: string; value: string }> = []

      // Brand
      if (existingBrand) {
        attrUpdates.push({ custom_attribute_id: existingBrand.id, custom_attribute_name: 'Brand', value: brand })
      }
      // Part Number
      if (existingPartNumber) {
        attrUpdates.push({ custom_attribute_id: existingPartNumber.id, custom_attribute_name: 'Part Number', value: partNumber })
      }
      // PO Number
      if (existingPo) {
        attrUpdates.push({ custom_attribute_id: existingPo.id, custom_attribute_name: 'PO Number', value: poNumber })
      }

      // For fields being set for the first time, fetch custom field definitions
      const needsLookup =
        (!existingBrand && brand.trim()) ||
        (!existingPartNumber && partNumber.trim()) ||
        (!existingPo && poNumber.trim())

      if (needsLookup) {
        const fields = await sortlyClient.listCustomFields()
        if (!existingBrand && brand.trim()) {
          const f = fields.data.find((fd) => fd.name.toLowerCase() === 'brand')
          if (f) attrUpdates.push({ custom_attribute_id: f.id, custom_attribute_name: 'Brand', value: brand })
        }
        if (!existingPartNumber && partNumber.trim()) {
          const f = fields.data.find((fd) => fd.name.toLowerCase() === 'part number')
          if (f) attrUpdates.push({ custom_attribute_id: f.id, custom_attribute_name: 'Part Number', value: partNumber })
        }
        if (!existingPo && poNumber.trim()) {
          const f = fields.data.find((fd) => fd.name.toLowerCase() === 'po number')
          if (f) attrUpdates.push({ custom_attribute_id: f.id, custom_attribute_name: 'PO Number', value: poNumber })
        }
      }

      if (attrUpdates.length > 0) {
        updates.custom_attribute_values = attrUpdates
      }

      await updateItem.mutateAsync({
        itemId: item.id,
        updates,
      })
      onClose()
      toast(`"${name.trim()}" updated`)
    } catch (err) {
      console.error('Edit item failed:', err)
      toast('Failed to update item', 'error')
    }
  }

  const isValid = name.trim().length > 0

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
          <h3 className="text-lg font-semibold">Edit Item</h3>
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
              autoFocus
            />
          </Field>

          <Field label="Quantity">
            <input
              type="number"
              min={0}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(0, Math.floor(Number(e.target.value))))}
              className="form-input w-full"
            />
          </Field>

          <Field label="Reorder Point">
            <input
              type="number"
              min={0}
              step={1}
              value={minQuantity}
              onChange={(e) => setMinQuantity(Math.max(0, Math.floor(Number(e.target.value))))}
              className="form-input w-full"
            />
          </Field>

          <Field label="Vendor / Brand" optional>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="form-input w-full"
              placeholder="e.g. Carrier, Honeywell"
            />
          </Field>

          <Field label="Part Number" optional>
            <input
              type="text"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              className="form-input w-full"
              placeholder="e.g. HW-3842-A"
            />
          </Field>

          <Field label="PO Number" optional>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              className="form-input w-full"
              placeholder="e.g. PO-2026-0412"
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
          >
            Cancel
          </button>
          <button
            className="px-3.5 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--signal)' }}
            onClick={handleSave}
            disabled={!isValid || updateItem.isPending}
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
