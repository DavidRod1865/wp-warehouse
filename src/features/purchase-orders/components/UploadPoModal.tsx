/**
 * UploadPoModal — Two-step flow for uploading and parsing purchase orders
 *
 * Step 1: Upload PDF or skip
 * Step 2: Review parsed data, select vendor, project, edit line items, save
 *
 * Pricing: exclusive modes — per-line unit prices OR a single PO lump sum.
 */
import { useState } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { poFormSchema, type POFormSchema } from '../schemas/poSchema'
import { useParsePo } from '../hooks/useParsePo'
import { useCreatePo, uploadPoFile } from '../hooks/usePoMutations'
import { useVendors } from '../../vendors/hooks/useVendors'
import { useCreateVendor } from '../../vendors/hooks/useVendorMutations'
import { useToast } from '../../../components/ui/Toast'
import { Icon } from '../../../components/ui/Icon'
import { ProjectSelector } from '../../projects/components/ProjectSelector'
import { PoUploadZone } from './PoUploadZone'

interface UploadPoModalProps {
  onClose: () => void
}

function FormField({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        className="mb-1.5 text-[var(--muted)]"
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10.5,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
        }}
      >
        {label} {required && <span className="text-[var(--danger)]">*</span>}
      </div>
      {children}
      {error && (
        <div className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}
    </div>
  )
}

function formatMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/**
 * Fuzzy match vendor name: case-insensitive contains
 */
function findVendorByName(
  name: string,
  vendors: Array<{ id: number; name: string }>
) {
  const lower = name.toLowerCase()
  return vendors.find((v) => v.name.toLowerCase().includes(lower))
}

export function UploadPoModal({ onClose }: UploadPoModalProps) {
  const [step, setStep] = useState<'upload' | 'review'>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const { isParsing, error: parseError, data: parsedPo, parsePo } = useParsePo()
  const createPo = useCreatePo()
  const { data: vendors = [] } = useVendors()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<POFormSchema>({
    resolver: zodResolver(poFormSchema),
    shouldFocusError: false,
    defaultValues: {
      po_number: '',
      vendor_id: 0,
      project_id: 0,
      po_date: null,
      pricing_mode: 'per_line',
      lump_sum_amount: null,
      lines: [],
      notes: null,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  })

  const vendorId = watch('vendor_id')
  const lines = watch('lines')
  const pricingMode = watch('pricing_mode')
  const lumpSumAmount = watch('lump_sum_amount')

  const lineTotal = (lines ?? []).reduce((sum, line) => {
    const price = line.unit_price
    const qty = line.quantity_ordered
    if (price == null || Number.isNaN(price) || !qty || Number.isNaN(qty)) return sum
    return sum + price * qty
  }, 0)

  const hasAnyLinePrice = (lines ?? []).some(
    (l) => l.unit_price != null && !Number.isNaN(l.unit_price)
  )

  // Create a vendor directly from the parsed PDF name when no match exists
  const createVendor = useCreateVendor()
  const [creatingVendor, setCreatingVendor] = useState(false)
  const handleCreateParsedVendor = async () => {
    if (!parsedPo?.vendor_name) return
    setCreatingVendor(true)
    try {
      const vendor = await createVendor.mutateAsync({ name: parsedPo.vendor_name, is_active: true })
      setValue('vendor_id', Number(vendor.id), { shouldValidate: true })
      toast(`Vendor "${parsedPo.vendor_name}" created`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create vendor', 'error')
    } finally {
      setCreatingVendor(false)
    }
  }

  // Step 1: Parse PDF or skip
  const handleParseFile = async (file: File) => {
    setSelectedFile(file)
    try {
      const parsed = await parsePo(file)

      // Prefill form from parsed data
      if (parsed.po_number) setValue('po_number', parsed.po_number)
      if (parsed.po_date) setValue('po_date', parsed.po_date)

      // Fuzzy-match vendor
      if (parsed.vendor_name) {
        const vendorMatches: Array<{ id: number; name: string }> = vendors.map((v) => ({ id: Number(v.id), name: v.name }))
        const matched = findVendorByName(parsed.vendor_name, vendorMatches)
        if (matched) {
          setValue('vendor_id', matched.id)
        }
      }

      // Populate line items
      setValue(
        'lines',
        parsed.lines.map((line) => ({
          line_number: line.line_number,
          description: line.description,
          part_number: line.part_number,
          quantity_ordered: line.quantity_ordered,
          unit_price: line.unit_price,
          notes: null,
        }))
      )

      // Pricing mode from PDF: per-line if any unit prices; else lump sum if total present
      const anyLinePrice = parsed.lines.some((l) => l.unit_price != null)
      if (anyLinePrice) {
        setValue('pricing_mode', 'per_line')
        setValue('lump_sum_amount', null)
      } else if (parsed.total_amount != null && parsed.total_amount > 0) {
        setValue('pricing_mode', 'lump_sum')
        setValue('lump_sum_amount', parsed.total_amount)
      } else {
        setValue('pricing_mode', 'per_line')
        setValue('lump_sum_amount', null)
      }

      setStep('review')
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Failed to parse PDF',
        'error'
      )
    }
  }

  const handleSkipPdf = () => {
    setValue('pricing_mode', 'per_line')
    setValue('lump_sum_amount', null)
    setValue('lines', [
      {
        line_number: 1,
        description: '',
        part_number: null,
        quantity_ordered: 1,
        unit_price: null,
        notes: null,
      },
    ])
    setStep('review')
  }

  const handleAddLine = () => {
    append({
      line_number: (lines?.length ?? 0) + 1,
      description: '',
      part_number: null,
      quantity_ordered: 1,
      unit_price: null,
      notes: null,
    })
  }

  const handleRemoveLine = (idx: number) => {
    if ((lines?.length ?? 0) <= 1) return
    remove(idx)
  }

  const setPricingMode = (mode: 'per_line' | 'lump_sum') => {
    setValue('pricing_mode', mode)
    if (mode === 'per_line') {
      setValue('lump_sum_amount', null)
    }
  }

  // Step 2: Save PO
  const onSubmit = async (data: POFormSchema) => {
    try {
      let storagePath: string | undefined

      // Upload PDF if selected
      if (selectedFile) {
        storagePath = await uploadPoFile(selectedFile, data.po_number)
      }

      const lines = data.lines.map((line, i) => ({
        ...line,
        line_number: i + 1,
      }))

      await createPo.mutateAsync({
        po_number: data.po_number,
        vendor_id: data.vendor_id,
        project_id: data.project_id,
        po_date: data.po_date || null,
        pricing_mode: data.pricing_mode,
        lump_sum_amount: data.lump_sum_amount ?? null,
        lines,
        notes: data.notes,
        pdf_storage_path: storagePath,
      })

      toast('Purchase order created successfully', 'success')
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save PO'
      toast(message, 'error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/40"
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center">
      <div
        className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-2xl my-4 sm:my-0 flex flex-col"
        style={{ maxHeight: 'min(900px, calc(100dvh - 32px))' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--panel)] border-b border-[var(--line)] p-6 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-semibold text-[var(--ink)]">
            {step === 'upload' ? 'Upload Purchase Order' : 'Review Purchase Order'}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto min-h-0">
          {step === 'upload' ? (
            // Step 1: Upload
            <div className="space-y-6">
              <div>
                <p className="text-sm text-[var(--muted)] mb-4">
                  Upload a purchase order PDF to auto-extract details, or skip to enter manually.
                </p>
                <PoUploadZone
                  onFileParsed={handleParseFile}
                  isParsing={isParsing}
                  error={parseError}
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[var(--line)]" />
                <span className="text-xs text-[var(--muted)] uppercase">or</span>
                <div className="flex-1 h-px bg-[var(--line)]" />
              </div>

              <button
                type="button"
                onClick={handleSkipPdf}
                disabled={isParsing}
                className="w-full px-4 py-3 rounded-lg border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Icon name="edit" className="w-4 h-4 inline mr-2" />
                Enter Manually
              </button>
            </div>
          ) : (
            // Step 2: Review form
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
              {/* PO Number */}
              <FormField label="PO Number" required error={errors.po_number?.message}>
                <input
                  type="text"
                  placeholder="PO-2026-001"
                  className="form-input w-full"
                  {...register('po_number')}
                />
              </FormField>

              {/* Vendor */}
              <FormField label="Vendor" required error={errors.vendor_id?.message}>
                <select
                  className="form-input w-full"
                  {...register('vendor_id', { valueAsNumber: true })}
                >
                  <option value="">Select vendor...</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={String(v.id)}>
                      {v.name}
                    </option>
                  ))}
                </select>

                {vendorId && vendorId > 0 && parsedPo?.vendor_name ? (
                  <div className="mt-2 text-xs text-[var(--muted)]">
                    Matched from PDF: "{parsedPo.vendor_name}"
                  </div>
                ) : parsedPo?.vendor_name ? (
                  <button
                    type="button"
                    onClick={handleCreateParsedVendor}
                    disabled={creatingVendor}
                    className="mt-2 text-xs px-2 py-1 rounded text-[var(--signal)] hover:bg-[var(--panel-2)] disabled:opacity-50"
                  >
                    {creatingVendor ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <>No match found — create vendor "{parsedPo.vendor_name}"</>
                    )}
                  </button>
                ) : null}
              </FormField>

              {/* Project */}
              <FormField label="Project" required error={errors.project_id?.message}>
                <Controller
                  name="project_id"
                  control={control}
                  render={({ field }) => (
                    <ProjectSelector
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </FormField>

              {/* PO Date */}
              <FormField label="PO Date" error={errors.po_date?.message}>
                <input
                  type="date"
                  className="form-input w-full"
                  {...register('po_date')}
                />
              </FormField>

              {/* Pricing mode */}
              <div>
                <div
                  className="mb-2 text-[var(--muted)] uppercase"
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 10.5,
                    letterSpacing: '.08em',
                  }}
                >
                  Pricing
                </div>
                <div
                  className="inline-flex rounded-lg border border-[var(--line)] p-0.5"
                  role="group"
                  aria-label="Pricing mode"
                >
                  <button
                    type="button"
                    onClick={() => setPricingMode('per_line')}
                    className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                    style={{
                      background:
                        pricingMode === 'per_line'
                          ? 'color-mix(in oklab, var(--signal) 18%, var(--panel))'
                          : 'transparent',
                      color:
                        pricingMode === 'per_line' ? 'var(--signal)' : 'var(--muted)',
                    }}
                  >
                    Per-line prices
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingMode('lump_sum')}
                    className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                    style={{
                      background:
                        pricingMode === 'lump_sum'
                          ? 'color-mix(in oklab, var(--signal) 18%, var(--panel))'
                          : 'transparent',
                      color:
                        pricingMode === 'lump_sum' ? 'var(--signal)' : 'var(--muted)',
                    }}
                  >
                    Lump sum
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  {pricingMode === 'per_line'
                    ? 'Enter a unit price on each line when the vendor prices items individually.'
                    : 'Use when the vendor quotes a single total instead of per-line prices.'}
                </p>
              </div>

              {pricingMode === 'lump_sum' && (
                <FormField
                  label="PO total (lump sum)"
                  error={errors.lump_sum_amount?.message}
                >
                  <div className="form-input flex items-center gap-1.5 !py-0 !px-0 overflow-hidden">
                    <span className="pl-3 text-[var(--muted)] text-sm shrink-0 select-none">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="flex-1 min-w-0 bg-transparent border-0 outline-none py-[9px] pr-3 text-[var(--ink)]"
                      {...register('lump_sum_amount', { valueAsNumber: true })}
                    />
                  </div>
                </FormField>
              )}

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label
                    className="text-[var(--muted)] uppercase"
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10.5,
                      letterSpacing: '.08em',
                    }}
                  >
                    Line Items <span className="text-[var(--danger)]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--signal)] hover:underline"
                  >
                    <Icon name="plus" className="w-3.5 h-3.5" />
                    Add line
                  </button>
                </div>

                <div className="space-y-3">
                  {fields.map((field, idx) => (
                    <div
                      key={field.id}
                      className="p-3 rounded-lg border border-[var(--line)] bg-[var(--panel-2)]"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="grid grid-cols-12 gap-2">
                            <input
                              type="text"
                              placeholder="Description"
                              className="form-input col-span-7 text-sm"
                              {...register(`lines.${idx}.description`)}
                            />
                            <input
                              type="text"
                              placeholder="Part #"
                              className="form-input col-span-5 text-sm"
                              {...register(`lines.${idx}.part_number`)}
                            />
                          </div>
                          <div className="grid grid-cols-12 gap-2">
                            <input
                              type="number"
                              placeholder="Qty"
                              className="form-input col-span-4 text-sm"
                              {...register(`lines.${idx}.quantity_ordered`, {
                                valueAsNumber: true,
                              })}
                            />
                            {pricingMode === 'per_line' && (
                              <div className="col-span-8 form-input flex items-center gap-1.5 !py-0 !px-0 overflow-hidden text-sm">
                                <span className="pl-3 text-[var(--muted)] text-sm shrink-0 select-none">
                                  $
                                </span>
                                <input
                                  type="number"
                                  placeholder="Unit price"
                                  step="0.01"
                                  className="flex-1 min-w-0 bg-transparent border-0 outline-none py-[9px] pr-3 text-[var(--ink)]"
                                  {...register(`lines.${idx}.unit_price`, {
                                    valueAsNumber: true,
                                  })}
                                />
                              </div>
                            )}
                            {pricingMode === 'lump_sum' && (
                              <div className="col-span-8 flex items-center text-xs text-[var(--muted)] px-1">
                                Priced via lump sum
                              </div>
                            )}
                          </div>
                          {errors.lines?.[idx]?.description && (
                            <div className="text-xs" style={{ color: 'var(--danger)' }}>
                              {errors.lines[idx]?.description?.message}
                            </div>
                          )}
                        </div>
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="shrink-0 p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--panel)]"
                            aria-label="Remove line"
                          >
                            <Icon name="close" className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <input
                        type="hidden"
                        {...register(`lines.${idx}.line_number`, { valueAsNumber: true })}
                      />
                    </div>
                  ))}
                </div>

                {errors.lines && typeof errors.lines.message === 'string' && (
                  <div className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
                    {errors.lines.message}
                  </div>
                )}

                {/* Pricing summary */}
                <div className="mt-3 flex justify-end text-sm">
                  {pricingMode === 'lump_sum' ? (
                    <span className="text-[var(--ink-2)]">
                      Lump sum:{' '}
                      <b className="text-[var(--ink)]">
                        {lumpSumAmount != null && !Number.isNaN(lumpSumAmount)
                          ? formatMoney(lumpSumAmount)
                          : '—'}
                      </b>
                    </span>
                  ) : (
                    <span className="text-[var(--ink-2)]">
                      Line total:{' '}
                      <b className="text-[var(--ink)]">
                        {hasAnyLinePrice ? formatMoney(lineTotal) : '—'}
                      </b>
                    </span>
                  )}
                </div>
              </div>

              {/* Notes */}
              <FormField label="Notes" error={errors.notes?.message}>
                <textarea
                  placeholder="Any additional notes..."
                  rows={3}
                  className="form-input w-full resize-none"
                  {...register('notes')}
                />
              </FormField>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors text-sm font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || createPo.isPending}
                  className="flex-1 px-4 py-2 rounded-lg text-[var(--on-signal)] text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'var(--signal)' }}
                >
                  {isSubmitting || createPo.isPending ? 'Saving...' : 'Save & Confirm'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
