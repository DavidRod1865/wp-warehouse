/**
 * EditPoModal — Edit PO header + line items
 *
 * Header fields (PO #, vendor, project, date) stay locked/greyed until the
 * user explicitly unlocks them via the edit icon — so line-item edits don't
 * accidentally change header identity.
 */
import { useState, useRef, useEffect } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { poFormSchema, type POFormSchema } from '../schemas/poSchema'
import { useUpdatePo, useCancelPo, useRevertPoToDraft } from '../hooks/usePoMutations'
import { useVendors } from '../../vendors/hooks/useVendors'
import { useToast } from '../../../components/ui/Toast'
import { Icon } from '../../../components/ui/Icon'
import { ProjectSelector } from '../../projects/components/ProjectSelector'
import type { PurchaseOrder, POLineItem } from '../types'

type LineSortKey = 'description' | 'part_number' | 'quantity_ordered' | 'unit_price'

interface EditPoModalProps {
  po: PurchaseOrder & { line_items: POLineItem[] }
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

function SectionCard({
  title,
  required,
  action,
  locked,
  children,
}: {
  title: string
  required?: boolean
  action?: React.ReactNode
  locked?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl border border-[var(--line)] p-4 space-y-4"
      style={{
        background: locked
          ? 'color-mix(in oklab, var(--panel-2) 70%, var(--panel))'
          : 'var(--panel)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          className="font-semibold text-[var(--ink)] tracking-tight"
          style={{ fontSize: 13 }}
        >
          {title}
          {required && <span className="text-[var(--danger)] ml-1">*</span>}
        </h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function formatMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: LineSortKey
  activeKey: LineSortKey | null
  dir: 'asc' | 'desc'
  onSort: (key: LineSortKey) => void
  align?: 'left' | 'right'
}) {
  const active = activeKey === sortKey
  return (
    <th
      className={`px-2 py-2 font-medium text-[var(--ink-2)] ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ fontSize: 11 }}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-[var(--ink)] ${
          align === 'right' ? 'flex-row-reverse' : ''
        } ${active ? 'text-[var(--ink)]' : ''}`}
      >
        {label}
        <Icon
          name="sortAsc"
          className={`w-3 h-3 opacity-40 ${active ? 'opacity-100' : ''} ${
            active && dir === 'desc' ? 'rotate-180' : ''
          }`}
        />
      </button>
    </th>
  )
}

export function EditPoModal({ po, onClose }: EditPoModalProps) {
  const [headerUnlocked, setHeaderUnlocked] = useState(false)
  const [linesUnlocked, setLinesUnlocked] = useState(false)
  const [sortKey, setSortKey] = useState<LineSortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [widthPct, setWidthPct] = useState(80)
  const [modalWidth, setModalWidth] = useState(0)
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  )
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startWidth: number; edge: 'left' | 'right' } | null>(
    null
  )
  const updatePo = useUpdatePo()
  const cancelPo = useCancelPo()
  const revertToDraft = useRevertPoToDraft()
  const { data: vendors = [] } = useVendors()
  const { toast } = useToast()

  const hasReceivedInventory = po.line_items.some((l) => l.quantity_received > 0)
  const canCancelPo = po.status !== 'cancelled' && po.status !== 'received'
  const canRevertToDraft =
    po.status !== 'draft' &&
    po.status !== 'cancelled' &&
    po.status !== 'received' &&
    !hasReceivedInventory

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => setIsDesktop(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w != null) setModalWidth(w)
    })
    ro.observe(el)
    setModalWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  // Layout driven by modal panel width (not viewport) so edge-resize reflows content
  const splitTop = modalWidth >= 780
  const compact = modalWidth > 0 && modalWidth < 640
  const padClass = compact ? 'p-3' : 'p-4 sm:p-5'

  const clampWidth = (pct: number) => Math.min(96, Math.max(50, Math.round(pct)))

  const onResizePointerDown =
    (edge: 'left' | 'right') => (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDesktop) return
      e.preventDefault()
      dragRef.current = { startX: e.clientX, startWidth: widthPct, edge }
      e.currentTarget.setPointerCapture(e.pointerId)
    }

  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !isDesktop) return
    // Centered modal: each side grows equally → 2× delta relative to viewport
    const raw =
      ((e.clientX - dragRef.current.startX) / window.innerWidth) * 200
    const deltaPct = dragRef.current.edge === 'right' ? raw : -raw
    setWidthPct(clampWidth(dragRef.current.startWidth + deltaPct))
  }

  const onResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const pricingModeDefault: 'per_line' | 'lump_sum' =
    po.lump_sum_amount != null ? 'lump_sum' : 'per_line'

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<POFormSchema>({
    resolver: zodResolver(poFormSchema),
    shouldFocusError: false,
    defaultValues: {
      po_number: po.po_number,
      vendor_id: po.vendor_id,
      project_id: po.project_id,
      po_date: po.po_date,
      pricing_mode: pricingModeDefault,
      lump_sum_amount: po.lump_sum_amount,
      notes: po.notes,
      lines: po.line_items.map((line) => ({
        id: line.id,
        line_number: line.line_number,
        description: line.description,
        part_number: line.part_number,
        quantity_ordered: line.quantity_ordered,
        unit_price: line.unit_price,
        notes: line.notes,
      })),
    },
  })

  // keyName avoids clobbering our DB line `id` with RHF's internal field key
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'lines',
    keyName: '_key',
  })

  const lines = watch('lines')
  const pricingMode = watch('pricing_mode')
  const receivedById = po.line_items.reduce<Record<number, number>>((acc, line) => {
    acc[line.id] = line.quantity_received
    return acc
  }, {})

  const lineTotal = (lines ?? []).reduce((sum, line) => {
    const price = line.unit_price
    const qty = line.quantity_ordered
    if (price == null || Number.isNaN(price) || !qty || Number.isNaN(qty)) return sum
    return sum + price * qty
  }, 0)

  const hasAnyLinePrice = (lines ?? []).some(
    (l) => l.unit_price != null && !Number.isNaN(l.unit_price)
  )

  const handleAddLine = () => {
    if (!linesUnlocked) return
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
    if (!linesUnlocked) return
    if ((lines?.length ?? 0) <= 1) return
    const line = lines?.[idx]
    const received = line?.id != null ? receivedById[line.id] ?? 0 : 0
    if (received > 0) {
      toast(`Cannot remove — ${received} already received on this line`, 'error')
      return
    }
    remove(idx)
  }

  const handleSort = (key: LineSortKey) => {
    if (!linesUnlocked) return
    const nextDir =
      sortKey === key ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc'
    setSortKey(key)
    setSortDir(nextDir)

    const current = getValues('lines') ?? []
    const sorted = [...current].sort((a, b) => {
      const av = a[key]
      const bv = b[key]

      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1

      let cmp = 0
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, {
          sensitivity: 'base',
          numeric: true,
        })
      }
      return nextDir === 'asc' ? cmp : -cmp
    })

    replace(
      sorted.map((line, i) => ({
        ...line,
        line_number: i + 1,
      }))
    )
  }

  const setPricingMode = (mode: 'per_line' | 'lump_sum') => {
    setValue('pricing_mode', mode)
    if (mode === 'per_line') {
      setValue('lump_sum_amount', null)
    }
  }

  const onSubmit = async (data: POFormSchema) => {
    try {
      await updatePo.mutateAsync({
        id: po.id,
        data: {
          po_number: data.po_number,
          vendor_id: data.vendor_id,
          project_id: data.project_id,
          po_date: data.po_date || null,
          pricing_mode: data.pricing_mode,
          lump_sum_amount: data.lump_sum_amount ?? null,
          lines: data.lines.map((line, i) => ({
            ...line,
            line_number: i + 1,
          })),
          notes: data.notes,
        },
        existingLines: po.line_items,
      })
      toast('Purchase order updated', 'success')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update PO', 'error')
    }
  }

  const handleCancelPo = async () => {
    if (!window.confirm('Cancel this purchase order? It keeps a record and does not delete it.')) return
    try {
      await cancelPo.mutateAsync(po.id)
      toast('PO cancelled', 'success')
      onClose()
    } catch {
      toast('Failed to cancel PO', 'error')
    }
  }

  const handleRevertToDraft = async () => {
    if (!window.confirm('Revert this purchase order to draft?')) return
    try {
      await revertToDraft.mutateAsync({
        id: po.id,
        status: po.status,
        lineItems: po.line_items,
      })
      toast('PO reverted to draft', 'success')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to revert PO', 'error')
    }
  }

  const headerFieldClass = headerUnlocked
    ? 'form-input w-full'
    : 'form-input w-full opacity-60 cursor-not-allowed bg-[var(--panel-2)]'

  const lineFieldClass = linesUnlocked
    ? 'form-input w-full text-sm'
    : 'form-input w-full text-sm opacity-60 cursor-not-allowed bg-[var(--panel-2)]'

  return (
    <div className="fixed inset-0 z-50 overflow-hidden sm:overflow-y-auto overscroll-contain bg-black/40">
      <div className="flex h-full sm:min-h-full items-stretch sm:items-center justify-center p-0 sm:p-4">
        <div
          ref={panelRef}
          className="relative bg-[var(--panel)] sm:rounded-2xl shadow-2xl w-full flex flex-col h-full sm:h-auto sm:max-h-[min(900px,calc(100dvh-32px))]"
          style={{
            width: isDesktop ? `${widthPct}vw` : undefined,
            maxWidth: isDesktop ? 'calc(100vw - 2rem)' : '100%',
          }}
        >
          {/* Drag handles — desktop only */}
          {isDesktop &&
            (['left', 'right'] as const).map((edge) => (
              <div
                key={edge}
                role="separator"
                aria-orientation="vertical"
                aria-label={`Resize modal from ${edge}`}
                aria-valuemin={50}
                aria-valuemax={96}
                aria-valuenow={widthPct}
                onPointerDown={onResizePointerDown(edge)}
                onPointerMove={onResizePointerMove}
                onPointerUp={onResizePointerUp}
                onPointerCancel={onResizePointerUp}
                className={`absolute top-8 bottom-8 w-3 cursor-ew-resize z-10 flex items-center justify-center touch-none ${
                  edge === 'right' ? '-right-1.5' : '-left-1.5'
                }`}
                title="Drag to resize"
              >
                <div
                  className="w-1 h-12 rounded-full opacity-40 hover:opacity-80 transition-opacity"
                  style={{ background: 'var(--muted)' }}
                />
              </div>
            ))}

          <div
            className={`sticky top-0 bg-[var(--panel)] border-b border-[var(--line)] flex items-center justify-between gap-3 shrink-0 sm:rounded-t-2xl z-20 ${
              compact ? 'px-3 py-3' : 'px-4 sm:px-6 py-3 sm:py-4'
            }`}
          >
            <h2
              className={`font-semibold text-[var(--ink)] truncate min-w-0 ${
                compact ? 'text-base' : 'text-lg sm:text-xl'
              }`}
            >
              {compact ? `Edit PO: ${po.po_number}` : `Edit Purchase Order: ${po.po_number}`}
            </h2>
            <button
              onClick={onClose}
              className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors shrink-0 p-1"
              type="button"
              aria-label="Close"
            >
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className={`${padClass} overflow-y-auto min-h-0 flex-1 space-y-4`}
          >
            {/* Details left; Pricing + Notes stacked on the right (stacks when narrow) */}
            <div
              className={`grid gap-4 sm:gap-5 ${
                splitTop ? 'grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]' : 'grid-cols-1'
              }`}
            >
              <div
                className="rounded-xl border border-[var(--line)] p-3 sm:p-4 space-y-4"
                style={{
                  background: headerUnlocked
                    ? 'var(--panel)'
                    : 'color-mix(in oklab, var(--panel-2) 70%, var(--panel))',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3
                    className="font-semibold text-[var(--ink)] tracking-tight"
                    style={{ fontSize: 13 }}
                  >
                    PO Details
                  </h3>
                  <button
                    type="button"
                    onClick={() => setHeaderUnlocked((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--line)] text-sm font-medium hover:bg-[var(--panel)] transition-colors"
                    style={{ color: headerUnlocked ? 'var(--signal)' : 'var(--ink-2)' }}
                    title={headerUnlocked ? 'Lock header' : 'Unlock header to edit'}
                  >
                    <Icon name="edit" className="w-3.5 h-3.5" />
                    {headerUnlocked ? 'Lock' : 'Edit'}
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="PO Number" required error={errors.po_number?.message}>
                      <input
                        type="text"
                        className={headerFieldClass}
                        disabled={!headerUnlocked}
                        {...register('po_number')}
                      />
                    </FormField>

                    <FormField label="PO Issue Date" required error={errors.po_date?.message}>
                      <input
                        type="date"
                        className={headerFieldClass}
                        disabled={!headerUnlocked}
                        {...register('po_date')}
                      />
                    </FormField>
                  </div>

                  <FormField label="Vendor" required error={errors.vendor_id?.message}>
                    <select
                      className={headerFieldClass}
                      disabled={!headerUnlocked}
                      {...register('vendor_id', { valueAsNumber: true })}
                    >
                      <option value="">Select vendor...</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={String(v.id)}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Project" required error={errors.project_id?.message}>
                    <Controller
                      name="project_id"
                      control={control}
                      render={({ field }) => (
                        <ProjectSelector
                          value={field.value}
                          onChange={field.onChange}
                          disabled={!headerUnlocked}
                          className={headerFieldClass}
                        />
                      )}
                    />
                  </FormField>
                </div>
              </div>

              <div className="space-y-4 sm:space-y-5">
                <SectionCard title="Pricing">
                  <div
                    className="inline-flex rounded-lg border border-[var(--line)] p-0.5 w-full"
                    role="group"
                    aria-label="Pricing type"
                  >
                    <button
                      type="button"
                      onClick={() => setPricingMode('per_line')}
                      className="flex-1 px-2 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                      style={{
                        background:
                          pricingMode === 'per_line'
                            ? 'color-mix(in oklab, var(--signal) 18%, var(--panel))'
                            : 'transparent',
                        color: pricingMode === 'per_line' ? 'var(--signal)' : 'var(--muted)',
                      }}
                    >
                      Per-Line
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingMode('lump_sum')}
                      className="flex-1 px-2 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                      style={{
                        background:
                          pricingMode === 'lump_sum'
                            ? 'color-mix(in oklab, var(--signal) 18%, var(--panel))'
                            : 'transparent',
                        color: pricingMode === 'lump_sum' ? 'var(--signal)' : 'var(--muted)',
                      }}
                    >
                      Lump Sum
                    </button>
                  </div>
                </SectionCard>

                <SectionCard title="Notes">
                  <textarea
                    placeholder="Any additional notes..."
                    rows={splitTop ? 4 : 3}
                    className="form-input w-full resize-none"
                    {...register('notes')}
                  />
                  {errors.notes?.message && (
                    <div className="text-xs" style={{ color: 'var(--danger)' }}>
                      {errors.notes.message}
                    </div>
                  )}
                </SectionCard>
              </div>
            </div>

            {/* Main focus: line items table */}
            <SectionCard
              title="Line Items"
              required
              locked={!linesUnlocked}
              action={
                <div className="flex items-center gap-2">
                  {linesUnlocked && (
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--signal)] hover:underline"
                    >
                      <Icon name="plus" className="w-3.5 h-3.5" />
                      Add line
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setLinesUnlocked((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--line)] text-sm font-medium hover:bg-[var(--panel)] transition-colors"
                    style={{ color: linesUnlocked ? 'var(--signal)' : 'var(--ink-2)' }}
                    title={linesUnlocked ? 'Lock line items' : 'Unlock line items to edit'}
                  >
                    <Icon name="edit" className="w-3.5 h-3.5" />
                    {linesUnlocked ? 'Lock' : 'Edit'}
                  </button>
                </div>
              }
            >
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[440px] sm:min-w-[520px]">
                  <thead>
                    <tr className="border-b border-[var(--line)]">
                      <th
                        className="px-2 py-2 text-left font-medium text-[var(--ink-2)] w-8"
                        style={{ fontSize: 11 }}
                      >
                        #
                      </th>
                      <SortableTh
                        label="Description"
                        sortKey="description"
                        activeKey={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                      <SortableTh
                        label="Part #"
                        sortKey="part_number"
                        activeKey={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                      <SortableTh
                        label="Qty"
                        sortKey="quantity_ordered"
                        activeKey={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                        align="right"
                      />
                      {pricingMode === 'per_line' && (
                        <SortableTh
                          label="Unit price"
                          sortKey="unit_price"
                          activeKey={sortKey}
                          dir={sortDir}
                          onSort={handleSort}
                          align="right"
                        />
                      )}
                      <th className="px-2 py-2 w-9" />
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, idx) => {
                      const lineId = lines?.[idx]?.id
                      const received = lineId != null ? receivedById[lineId] ?? 0 : 0
                      return (
                        <tr
                          key={field._key}
                          className="border-b border-[var(--line)] last:border-b-0 align-top"
                        >
                          <td className="px-2 py-2 text-[var(--muted)] tabular-nums pt-3">
                            {idx + 1}
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              placeholder="Description"
                              className={lineFieldClass}
                              disabled={!linesUnlocked}
                              {...register(`lines.${idx}.description`)}
                            />
                            {received > 0 && (
                              <div className="text-[10px] text-[var(--warning)] mt-1">
                                {received} received
                              </div>
                            )}
                            {errors.lines?.[idx]?.description && (
                              <div className="text-[10px] mt-1" style={{ color: 'var(--danger)' }}>
                                {errors.lines[idx]?.description?.message}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              placeholder="Part #"
                              className={lineFieldClass}
                              disabled={!linesUnlocked}
                              {...register(`lines.${idx}.part_number`)}
                            />
                          </td>
                          <td className="px-2 py-1.5 w-20">
                            <input
                              type="number"
                              placeholder="Qty"
                              min={Math.max(1, received)}
                              className={`${lineFieldClass} text-right`}
                              disabled={!linesUnlocked}
                              {...register(`lines.${idx}.quantity_ordered`, {
                                valueAsNumber: true,
                              })}
                            />
                          </td>
                          {pricingMode === 'per_line' && (
                            <td className="px-2 py-1.5 w-28">
                              <div
                                className={`form-input flex items-center gap-1 !py-0 !px-0 overflow-hidden text-sm ${
                                  linesUnlocked
                                    ? ''
                                    : 'opacity-60 cursor-not-allowed bg-[var(--panel-2)]'
                                }`}
                              >
                                <span className="pl-2 text-[var(--muted)] text-sm shrink-0 select-none">
                                  $
                                </span>
                                <input
                                  type="number"
                                  placeholder="0.00"
                                  step="0.01"
                                  disabled={!linesUnlocked}
                                  className="flex-1 min-w-0 bg-transparent border-0 outline-none py-[7px] pr-2 text-right text-[var(--ink)] disabled:cursor-not-allowed"
                                  {...register(`lines.${idx}.unit_price`, {
                                    valueAsNumber: true,
                                  })}
                                />
                              </div>
                            </td>
                          )}
                          <td className="px-1 py-1.5">
                            {linesUnlocked && fields.length > 1 && received === 0 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(idx)}
                                className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--panel-2)]"
                                aria-label="Remove line"
                              >
                                <Icon name="close" className="w-4 h-4" />
                              </button>
                            )}
                            <input
                              type="hidden"
                              {...register(`lines.${idx}.line_number`, { valueAsNumber: true })}
                            />
                            {lineId != null && (
                              <input
                                type="hidden"
                                {...register(`lines.${idx}.id`, { valueAsNumber: true })}
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {errors.lines && typeof errors.lines.message === 'string' && (
                <div className="text-xs" style={{ color: 'var(--danger)' }}>
                  {errors.lines.message}
                </div>
              )}

              {pricingMode === 'lump_sum' && (
                <div className="flex justify-end">
                  <div className="w-full max-w-[220px]">
                    <FormField
                      required
                      label="PO total (lump sum)"
                      error={errors.lump_sum_amount?.message}
                    >
                      <div
                        className={`form-input flex items-center gap-1.5 !py-0 !px-0 overflow-hidden ${
                          linesUnlocked
                            ? ''
                            : 'opacity-60 cursor-not-allowed bg-[var(--panel-2)]'
                        }`}
                      >
                        <span className="pl-3 text-[var(--muted)] text-sm shrink-0 select-none">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          disabled={!linesUnlocked}
                          className="flex-1 min-w-0 bg-transparent border-0 outline-none py-[9px] pr-3 text-right text-[var(--ink)] disabled:cursor-not-allowed"
                          {...register('lump_sum_amount', { valueAsNumber: true })}
                        />
                      </div>
                    </FormField>
                  </div>
                </div>
              )}

              {pricingMode === 'per_line' && (
                <div className="flex justify-end text-sm">
                  <span className="text-[var(--ink-2)]">
                    Line total:{' '}
                    <b className="text-[var(--ink)]">
                      {hasAnyLinePrice ? formatMoney(lineTotal) : '—'}
                    </b>
                  </span>
                </div>
              )}
            </SectionCard>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {(canCancelPo || canRevertToDraft) && (
                <div className="flex flex-wrap gap-2 mr-auto">
                  {canRevertToDraft && (
                    <button
                      type="button"
                      onClick={handleRevertToDraft}
                      disabled={
                        revertToDraft.isPending ||
                        cancelPo.isPending ||
                        isSubmitting ||
                        updatePo.isPending
                      }
                      className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--panel-2)] text-sm font-medium disabled:opacity-50"
                    >
                      <Icon name="refresh" className="w-4 h-4 inline mr-2" />
                      {revertToDraft.isPending ? 'Reverting…' : 'Revert to draft'}
                    </button>
                  )}
                  {canCancelPo && (
                    <div className="relative group/cancel-po">
                      <button
                        type="button"
                        onClick={handleCancelPo}
                        disabled={
                          cancelPo.isPending ||
                          revertToDraft.isPending ||
                          isSubmitting ||
                          updatePo.isPending
                        }
                        className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                        style={{
                          background: 'color-mix(in oklab, var(--danger) 14%, var(--panel))',
                          color: 'var(--danger)',
                        }}
                        aria-describedby="edit-cancel-po-tip"
                      >
                        <Icon name="x" className="w-4 h-4 inline mr-2" />
                        {cancelPo.isPending ? 'Cancelling…' : 'Cancel PO'}
                      </button>
                      <div
                        id="edit-cancel-po-tip"
                        role="tooltip"
                        className="pointer-events-none absolute left-0 bottom-full mb-1.5 z-20 w-max max-w-52 rounded-md border border-[var(--line)] px-2.5 py-1.5 text-[11px] leading-snug text-[var(--muted)] opacity-0 transition-opacity duration-150 group-hover/cancel-po:opacity-100 text-left"
                        style={{
                          background: 'var(--panel)',
                          boxShadow:
                            '0 4px 12px -6px color-mix(in oklab, var(--ink) 18%, transparent)',
                        }}
                      >
                        Keeps a record of the cancelled PO.
                        <br />
                        Does not delete it.
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors text-sm font-medium ${canCancelPo || canRevertToDraft ? '' : 'flex-1'}`}
              >
                Close
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  updatePo.isPending ||
                  cancelPo.isPending ||
                  revertToDraft.isPending
                }
                className={`px-4 py-2 rounded-lg text-[var(--on-signal)] text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${canCancelPo || canRevertToDraft ? '' : 'flex-1'}`}
                style={{ background: 'var(--signal)' }}
              >
                {isSubmitting || updatePo.isPending ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

