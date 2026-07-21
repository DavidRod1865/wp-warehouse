/**
 * CreatePoFromPackingList — Inline "spin up a PO from a packing list" step.
 *
 * Reached from the receiving wizard when NO PO is linked but items were parsed
 * from a packing list. The clerk verifies vendor + project + lines, then we:
 *   1. useCreatePo()  — insert the PO (draft) + its line items
 *   2. useConfirmPo() — move it to `confirmed` so confirm_receipt can roll its
 *      status forward (the RPC deliberately never advances a draft PO).
 * The new PO id is handed back so the wizard's existing PO-linked path (Step 2
 * auto-match, Step 3 over-receipt bar) takes over unchanged.
 *
 * Prices are intentionally omitted (subscription / no-cost policy) — the PO is
 * created per-line with null unit prices.
 */
import { useState } from 'react'
import { Icon } from '../../../components/ui/Icon'
import { useToast } from '../../../components/ui/Toast'
import { useVendors } from '../../vendors/hooks/useVendors'
import { useCreateVendor } from '../../vendors/hooks/useVendorMutations'
import { useCreatePo, useConfirmPo } from '../../purchase-orders/hooks/usePoMutations'
import { ProjectSelector } from '../../projects/components/ProjectSelector'
import type { POFormLine } from '../../purchase-orders/types'
import type { ReceivingLineItem } from '../types'

interface CreatePoFromPackingListProps {
  /** Vendor free-text from the header (prefill / create fallback) */
  vendor: string
  /** Vendor id if one was selected in the header */
  vendorId: number | null
  /** PO number typed in the header, if any */
  poNumber: string
  /** Project selected in the header, if any */
  defaultProjectId: number | null
  /** Parsed packing-list items used to seed the PO lines */
  parsedItems: ReceivingLineItem[]
  /** Called after the PO is created AND confirmed */
  onCreated: (poId: number, poNumber: string) => void
  onBack: () => void
}

interface DraftLine {
  description: string
  part_number: string | null
  quantity_ordered: number
}

export function CreatePoFromPackingList({
  vendor,
  vendorId,
  poNumber,
  defaultProjectId,
  parsedItems,
  onCreated,
  onBack,
}: CreatePoFromPackingListProps) {
  const { toast } = useToast()
  const { data: vendors = [] } = useVendors({ activeOnly: true })
  const createVendor = useCreateVendor()
  const createPo = useCreatePo()
  const confirmPo = useConfirmPo()

  const [poNo, setPoNo] = useState(poNumber)
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(vendorId)
  const [projectId, setProjectId] = useState<number | null>(defaultProjectId)
  const [creatingVendor, setCreatingVendor] = useState(false)
  const [lines, setLines] = useState<DraftLine[]>(
    parsedItems.map((it) => ({
      description: it.item_name,
      part_number: it.part_number,
      quantity_ordered: it.quantity_ordered || it.quantity_shipped || 1,
    })),
  )

  const isSubmitting = createPo.isPending || confirmPo.isPending

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleCreateVendor = async () => {
    if (!vendor.trim()) return
    setCreatingVendor(true)
    try {
      const v = await createVendor.mutateAsync({ name: vendor.trim(), is_active: true })
      setSelectedVendorId(Number(v.id))
      toast(`Vendor "${vendor.trim()}" created`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create vendor', 'error')
    } finally {
      setCreatingVendor(false)
    }
  }

  const validLines = lines.filter((l) => l.description.trim() && l.quantity_ordered > 0)

  const canSubmit =
    !isSubmitting &&
    poNo.trim().length > 0 &&
    selectedVendorId != null &&
    projectId != null &&
    validLines.length > 0

  const handleSubmit = async () => {
    if (selectedVendorId == null || projectId == null) return

    const formLines: POFormLine[] = validLines.map((l, i) => ({
      line_number: i + 1,
      description: l.description.trim(),
      part_number: l.part_number?.trim() || null,
      quantity_ordered: l.quantity_ordered,
      unit_price: null,
      notes: null,
    }))

    try {
      const po = await createPo.mutateAsync({
        po_number: poNo.trim(),
        vendor_id: selectedVendorId,
        project_id: projectId,
        po_date: null,
        pricing_mode: 'per_line',
        lump_sum_amount: null,
        lines: formLines,
        notes: 'Created from packing list at receiving.',
      })

      // Confirm so confirm_receipt can advance the PO's status on receipt.
      await confirmPo.mutateAsync(po.id)

      toast(`PO ${po.po_number} created and confirmed`, 'success')
      onCreated(po.id, po.po_number)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create purchase order', 'error')
    }
  }

  const noVendorMatch = selectedVendorId == null && vendor.trim().length > 0

  return (
    <div className="space-y-5">
      <div
        className="flex items-start gap-2 px-4 py-3 rounded-lg text-sm"
        style={{ background: 'var(--info-soft)', color: 'var(--info)' }}
      >
        <Icon name="info" className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          Verify the details below to create a purchase order from this packing list.
          Received quantities will then be tracked against it.
        </div>
      </div>

      {/* PO number + vendor + project */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="PO Number" required>
          <input
            className="form-input"
            placeholder="PO-2026-001"
            value={poNo}
            onChange={(e) => setPoNo(e.target.value)}
          />
        </Field>

        <Field label="Vendor" required>
          <select
            className="form-input"
            value={selectedVendorId ?? ''}
            onChange={(e) => setSelectedVendorId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Select vendor...</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          {noVendorMatch && (
            <button
              type="button"
              onClick={handleCreateVendor}
              disabled={creatingVendor}
              className="mt-1.5 text-xs text-[var(--signal)] hover:underline disabled:opacity-50"
            >
              {creatingVendor
                ? <span className="loading loading-spinner loading-xs" />
                : <>Create vendor "{vendor.trim()}"</>}
            </button>
          )}
        </Field>

        <Field label="Project" required>
          <ProjectSelector value={projectId} onChange={setProjectId} />
        </Field>
      </div>

      {/* Lines */}
      <div>
        <FieldLabel label={`PO Lines (${validLines.length})`} required />
        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2"
            >
              <input
                className="form-input flex-1 min-w-0"
                placeholder="Description"
                value={line.description}
                onChange={(e) => updateLine(idx, { description: e.target.value })}
              />
              <input
                className="form-input w-32 shrink-0"
                placeholder="Part #"
                value={line.part_number ?? ''}
                onChange={(e) => updateLine(idx, { part_number: e.target.value || null })}
              />
              <input
                type="number"
                min={1}
                className="form-input w-20 shrink-0"
                value={line.quantity_ordered}
                onChange={(e) => updateLine(idx, { quantity_ordered: parseInt(e.target.value) || 0 })}
              />
              <button
                type="button"
                onClick={() => removeLine(idx)}
                className="shrink-0 p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--danger)]"
                aria-label="Remove line"
              >
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>
          ))}
          {lines.length === 0 && (
            <p className="text-sm text-[var(--muted)] py-2">
              No lines — go back and add items to the packing list.
            </p>
          )}
        </div>
      </div>

      {createPo.isError && (
        <div
          className="flex items-start gap-2 px-4 py-3 rounded-lg text-sm"
          style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
        >
          <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" />
          {createPo.error?.message || 'Failed to create purchase order.'}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-[var(--line)]">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[var(--line)] text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--panel-2)] disabled:opacity-40"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium text-[var(--on-signal)] disabled:opacity-40"
          style={{ background: 'var(--signal)' }}
        >
          {isSubmitting ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <Icon name="check" className="w-4 h-4" />
          )}
          Create PO &amp; continue
        </button>
      </div>
    </div>
  )
}

// ── Helpers ──

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <div
      className="mb-1.5 text-[var(--muted)]"
      style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase' }}
    >
      {label}
      {required && <span className="ml-0.5" style={{ color: 'var(--danger)' }}>*</span>}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      {children}
    </div>
  )
}
