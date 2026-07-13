/**
 * UploadPoModal — Two-step flow for uploading and parsing purchase orders
 *
 * Step 1: Upload PDF or skip
 * Step 2: Review parsed data, select vendor, project, edit line items, save
 */
import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
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
    defaultValues: {
      po_number: '',
      vendor_id: 0,
      project_id: 0,
      po_date: null,
      lines: [],
      notes: null,
    },
  })

  const vendorId = watch('vendor_id')
  const lines = watch('lines')

  // Create a vendor directly from the parsed PDF name when no match exists
  const createVendor = useCreateVendor()
  const [creatingVendor, setCreatingVendor] = useState(false)
  const handleCreateParsedVendor = async () => {
    if (!parsedPo?.vendor_name) return
    setCreatingVendor(true)
    try {
      const vendor = await createVendor.mutateAsync({ name: parsedPo.vendor_name })
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

      setStep('review')
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Failed to parse PDF',
        'error'
      )
    }
  }

  const handleSkipPdf = () => {
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

  // Step 2: Save PO
  const onSubmit = async (data: POFormSchema) => {
    try {
      let storagePath: string | undefined

      // Upload PDF if selected
      if (selectedFile) {
        storagePath = await uploadPoFile(selectedFile, data.po_number)
      }

      await createPo.mutateAsync({
        ...data,
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
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--panel)] border-b border-[var(--line)] p-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--ink)]">
            {step === 'upload' ? 'Upload Purchase Order' : 'Review Purchase Order'}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          >
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
                </div>

                <div className="space-y-3">
                  {lines.map((_, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-[var(--line)] bg-[var(--panel-2)]"
                    >
                      <div className="grid grid-cols-12 gap-2">
                        <input
                          type="text"
                          placeholder="Description"
                          className="form-input col-span-6 text-sm"
                          {...register(`lines.${idx}.description`)}
                        />
                        <input
                          type="text"
                          placeholder="Part #"
                          className="form-input col-span-3 text-sm"
                          {...register(`lines.${idx}.part_number`)}
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          className="form-input col-span-3 text-sm"
                          {...register(`lines.${idx}.quantity_ordered`, {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                      <input
                        type="number"
                        placeholder="Unit Price"
                        step="0.01"
                        className="form-input w-full text-sm mt-2"
                        {...register(`lines.${idx}.unit_price`, {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                  ))}
                </div>

                {errors.lines && (
                  <div className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
                    {typeof errors.lines.message === 'string' &&
                      errors.lines.message}
                  </div>
                )}
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
                  className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
  )
}
