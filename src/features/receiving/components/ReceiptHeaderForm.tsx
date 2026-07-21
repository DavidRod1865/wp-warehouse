/**
 * ReceiptHeaderForm — Step 1 of the receiving workflow (Phase 4)
 *
 * Collects:
 *  - Vendor (selector from vendors table, with free-text fallback for PO-less)
 *  - Link to Purchase Order (search confirmed/partially_received POs)
 *  - Date received
 *  - Destination: a LOCATION selector (warehouse areas + project job_site)
 *  - PDF upload or manual entry
 */
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../../../components/ui/Icon'
import { useLocations } from '../../inventory/hooks/useLocations'
import { PdfDropZone } from './PdfDropZone'
import { useParsePdf } from '../hooks/useParsePdf'
import type { Project } from '../../../types/project'
import type { ParsedPackingItem, ReceivingLineItem } from '../types'

// ── Local query hooks ─────────────────────────────────────────────────────────

interface VendorOption {
  id: number
  name: string
}

function useVendorOptions() {
  return useQuery({
    queryKey: ['form', 'vendors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data || []) as VendorOption[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

interface POOption {
  id: number
  po_number: string
  vendor_id: number
  project_id: number
  vendor?: { name: string }
  project?: {
    name: string
    general_contractors?: { company_name: string } | null
  }
}

function projectLabel(project: POOption['project']): string {
  if (!project) return ''
  const gc = project.general_contractors?.company_name
  return gc ? `${gc} - ${project.name}` : project.name
}

function poOptionLabel(po: POOption): string {
  const project = projectLabel(po.project)
  return [
    po.po_number,
    po.vendor?.name,
    project || null,
  ].filter(Boolean).join(' — ')
}

function usePOOptions() {
  return useQuery({
    queryKey: ['form', 'po-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id, po_number, vendor_id, project_id, vendor:vendors(name), project:projects(name, general_contractors(company_name))')
        .in('status', ['confirmed', 'partially_received'])
        .order('po_number')
      if (error) throw error
      return (data || []) as unknown as POOption[]
    },
    staleTime: 2 * 60 * 1000,
  })
}

function useProjects() {
  return useQuery({
    queryKey: ['form', 'projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'active')
        .order('name')
      if (error) throw error
      return (data || []) as Project[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReceiptHeaderFormProps {
  vendor: string
  setVendor: (v: string) => void
  vendorId: number | null
  setVendorId: (v: number | null) => void
  poId: number | null
  setPoId: (v: number | null) => void
  poNumber: string
  setPoNumber: (v: string) => void
  dateReceived: string
  setDateReceived: (v: string) => void
  selectedProjectId: number | null
  setSelectedProjectId: (v: number | null) => void
  projectName: string | null
  setProjectName: (v: string | null) => void
  destinationLocationId: number | null
  setDestinationLocationId: (v: number | null) => void
  destinationLocationName: string | null
  setDestinationLocationName: (v: string | null) => void
  notes: string
  setNotes: (v: string) => void
  packingListFile: File | null
  setPackingListFile: (f: File | null) => void
  onItemsParsed: (items: ReceivingLineItem[]) => void
  onManualEntry: () => void
  /** `source` distinguishes a parsed packing list from manual entry so the
   *  modal can offer the "create PO from packing list" branch only when there
   *  are parsed items to seed it. */
  onNext: (source: 'parsed' | 'manual') => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReceiptHeaderForm({
  vendor,
  setVendor,
  vendorId,
  setVendorId,
  poId,
  setPoId,
  poNumber,
  setPoNumber,
  dateReceived,
  setDateReceived,
  selectedProjectId,
  setSelectedProjectId,
  setProjectName,
  destinationLocationId,
  setDestinationLocationId,
  destinationLocationName,
  setDestinationLocationName,
  notes,
  setNotes,
  packingListFile,
  setPackingListFile,
  onItemsParsed,
  onManualEntry,
  onNext,
}: ReceiptHeaderFormProps) {
  const [vendorMode, setVendorMode] = useState<'select' | 'freetext'>('select')
  const manualFileRef = useRef<HTMLInputElement>(null)

  const { data: vendors = [], isLoading: vendorsLoading } = useVendorOptions()
  const { data: projects = [], isLoading: projectsLoading } = useProjects()
  const { data: poOptions = [], isLoading: posLoading } = usePOOptions()
  const { data: warehouseLocations = [], isLoading: locationsLoading } = useLocations({ type: 'warehouse_area' })
  const { data: jobSiteLocations = [] } = useLocations({ type: 'job_site' })

  const pdfHook = useParsePdf()

  // When a PO is selected, pre-fill vendor + project
  const handlePoSelect = (po: POOption | null) => {
    if (!po) {
      setPoId(null)
      setPoNumber('')
      return
    }
    setPoId(po.id)
    setPoNumber(po.po_number)
    // Pre-fill vendor
    const v = vendors.find((v) => v.id === po.vendor_id)
    if (v) {
      setVendorId(v.id)
      setVendor(v.name)
    }
    // Pre-fill project
    const proj = projects.find((p) => p.id === po.project_id)
    if (proj) {
      setSelectedProjectId(proj.id)
      setProjectName(proj.name)
      // Try to pre-fill job site location for that project
      const jobSite = jobSiteLocations.find((l) => l.name.toLowerCase().includes(proj.name.toLowerCase()))
      if (jobSite) {
        setDestinationLocationId(jobSite.id)
        setDestinationLocationName(jobSite.name)
      }
    }
  }

  const handleVendorSelect = (vendorIdStr: string) => {
    if (!vendorIdStr) {
      setVendorId(null)
      setVendor('')
      return
    }
    const v = vendors.find((v) => String(v.id) === vendorIdStr)
    if (v) {
      setVendorId(v.id)
      setVendor(v.name)
    }
  }

  const handleLocationChange = (locationIdStr: string) => {
    if (!locationIdStr) {
      setDestinationLocationId(null)
      setDestinationLocationName(null)
      return
    }
    const allLocations = [...warehouseLocations, ...jobSiteLocations]
    const loc = allLocations.find((l) => String(l.id) === locationIdStr)
    if (loc) {
      setDestinationLocationId(loc.id)
      setDestinationLocationName(loc.name)
    }
  }

  const handleParsedItems = (parsed: ParsedPackingItem[]) => {
    const lineItems: ReceivingLineItem[] = parsed.map((item, i) => ({
      tempId: `parsed-${i}-${Date.now()}`,
      item_name: item.item_name,
      part_number: item.part_number,
      quantity_ordered: item.quantity_ordered,
      quantity_shipped: item.quantity_shipped,
      back_order: item.back_order,
      quantity_received: item.quantity_shipped,
      confidence: item.confidence,
      action: 'pending',
      item_id: null,
      item_name_linked: null,
      current_stock_quantity: null,
      po_line_item_id: null,
      po_line_suggestion: null,
      destination_location_id: destinationLocationId,
      destination_location_name: destinationLocationName,
      notes: null,
    }))
    onItemsParsed(lineItems)
    onNext('parsed')
  }

  const handleManualEntry = () => {
    onManualEntry()
    onNext('manual')
  }

  const canProceed = vendor.trim() && dateReceived && destinationLocationId

  const allLocations = [
    ...warehouseLocations.map((l) => ({ ...l, group: 'Warehouse Areas' })),
    ...jobSiteLocations.map((l) => ({ ...l, group: 'Job Sites' })),
  ]

  return (
    <div className="space-y-5">
      {/* Row 1: PO Link */}
      <FormField label="Link to Existing Purchase Order">
        {posLoading ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          <PoSearchSelect
            options={poOptions}
            value={poId}
            onChange={handlePoSelect}
          />
        )}
        {poId && (
          <p className="text-xs text-[var(--muted)] mt-1">
            Vendor and project have been pre-filled from this PO. Received quantities will be tracked against PO lines.
          </p>
        )}
      </FormField>

      {/* Row 2: Vendor, PO Number, Date */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="Vendor / Brand" required>
          <div className="flex gap-2">
            {vendorMode === 'select' ? (
              <>
                {vendorsLoading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <select
                    className="form-input flex-1"
                    value={vendorId ?? ''}
                    onChange={(e) => handleVendorSelect(e.target.value)}
                  >
                    <option value="">Select vendor...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => { setVendorMode('freetext'); setVendorId(null) }}
                  className="text-xs text-[var(--muted)] hover:text-[var(--signal)] shrink-0 whitespace-nowrap"
                  title="Type a vendor name not in the list"
                >
                  Free text
                </button>
              </>
            ) : (
              <>
                <input
                  className="form-input flex-1"
                  placeholder="Vendor name..."
                  value={vendor}
                  onChange={(e) => { setVendor(e.target.value); setVendorId(null) }}
                />
                <button
                  type="button"
                  onClick={() => setVendorMode('select')}
                  className="text-xs text-[var(--muted)] hover:text-[var(--signal)] shrink-0 whitespace-nowrap"
                >
                  Select
                </button>
              </>
            )}
          </div>
        </FormField>

        <FormField label="PO Number">
          <input
            className="form-input"
            placeholder="Optional"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
          />
        </FormField>

        <FormField label="Date Received" required>
          <input
            type="date"
            className="form-input"
            value={dateReceived}
            onChange={(e) => setDateReceived(e.target.value)}
          />
        </FormField>
      </div>

      {/* Row 3: Project + Destination Location */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Project">
          {projectsLoading ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <select
              className="form-input"
              value={selectedProjectId ?? ''}
              onChange={(e) => {
                const pid = e.target.value ? Number(e.target.value) : null
                const proj = projects.find((p) => p.id === pid)
                setSelectedProjectId(pid)
                setProjectName(proj?.name ?? null)
              }}
            >
              <option value="">No project (main warehouse)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </FormField>

        <FormField label="Destination Location" required>
          {locationsLoading ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <select
              className="form-input"
              value={destinationLocationId ?? ''}
              onChange={(e) => handleLocationChange(e.target.value)}
            >
              <option value="">Select destination...</option>
              {warehouseLocations.length > 0 && (
                <optgroup label="Warehouse Areas">
                  {warehouseLocations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </optgroup>
              )}
              {jobSiteLocations.length > 0 && (
                <optgroup label="Job Sites">
                  {jobSiteLocations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          )}
          {allLocations.length === 0 && !locationsLoading && (
            <p className="text-xs text-[var(--warn)] mt-1">
              No locations configured yet — set up warehouse areas in Inventory → Locations.
            </p>
          )}
        </FormField>
      </div>

      {/* Row 4: Notes */}
      <FormField label="Notes">
        <textarea
          className="form-input"
          style={{ minHeight: 80, resize: 'vertical' }}
          placeholder="Any notes about this shipment..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </FormField>

      {/* Row 5: Input method */}
      {canProceed && (
        <div>
          <FieldLabel label="Add items" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PdfDropZone
              onItemsParsed={handleParsedItems}
              isParsing={pdfHook.isParsing}
              error={pdfHook.error}
              onParse={(file) => pdfHook.parsePdf(file, vendor, poNumber)}
              onFileSelected={setPackingListFile}
            />
            <button
              onClick={handleManualEntry}
              className="rounded-xl text-center py-8 px-6 cursor-pointer transition-colors group"
              style={{
                border: '1.5px dashed var(--line-2)',
                background: 'color-mix(in oklab, var(--panel-2) 60%, transparent)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'color-mix(in oklab, var(--signal) 5%, var(--panel))'
                e.currentTarget.style.borderColor = 'var(--signal)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'color-mix(in oklab, var(--panel-2) 60%, transparent)'
                e.currentTarget.style.borderColor = 'var(--line-2)'
              }}
            >
              <div className="inline-flex p-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] mb-2.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-[var(--ink-2)]">
                  <rect x="5" y="4" width="14" height="17" rx="1.5" />
                  <path d="M9 4h6v3H9zM9 11h6M9 15h6M9 18h3" />
                </svg>
              </div>
              <div
                className="text-[var(--ink)]"
                style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}
              >
                Enter items manually
              </div>
              <div className="text-[var(--muted)] text-sm mt-1">
                Add line items one by one
              </div>
            </button>
          </div>

          {/* Optional packing-list attachment — kept on file with this receipt.
              The PDF dropzone captures its own file automatically; this control
              lets the manual-entry path (or a corrected upload) attach a copy. */}
          <div className="mt-3 flex items-center gap-2 text-sm">
            <input
              ref={manualFileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setPackingListFile(f)
              }}
            />
            {packingListFile ? (
              <>
                <Icon name="file" className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
                <span className="text-[var(--ink-2)] truncate">{packingListFile.name}</span>
                <span className="text-[var(--muted)] text-xs">will be filed with this receipt</span>
                <button
                  type="button"
                  onClick={() => setPackingListFile(null)}
                  className="ml-1 text-[var(--muted)] hover:text-[var(--danger)] shrink-0"
                  title="Remove attachment"
                >
                  <Icon name="close" className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => manualFileRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--signal)]"
              >
                <Icon name="file" className="w-3.5 h-3.5" />
                Attach packing list PDF (optional)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── PO search select ──

function PoSearchSelect({
  options,
  value,
  onChange,
}: {
  options: POOption[]
  value: number | null
  onChange: (po: POOption | null) => void
}) {
  const selected = options.find((po) => po.id === value) ?? null
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? options.filter((po) => {
        const haystack = [
          po.po_number,
          po.vendor?.name,
          po.project?.name,
          po.project?.general_contractors?.company_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
    : options

  const displayValue = open
    ? query
    : selected
      ? poOptionLabel(selected)
      : ''

  return (
    <div ref={rootRef} className="relative">
      <div className="form-input flex items-center gap-2 !py-0 !px-0 overflow-hidden">
        <Icon
          name="search"
          className="ml-3 h-4 w-4 shrink-0 text-[var(--muted)]"
        />
        <input
          ref={inputRef}
          className="min-w-0 flex-1 bg-transparent py-2.5 pr-2 text-[13.5px] text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
          placeholder={selected ? undefined : 'Search PO #, vendor, or project…'}
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            setQuery('')
          }}
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
        />
        {(selected || query) && (
          <button
            type="button"
            className="mr-2 rounded p-1 text-[var(--muted)] hover:text-[var(--ink)]"
            title={selected ? 'Clear PO link' : 'Clear search'}
            onClick={() => {
              onChange(null)
              setQuery('')
              setOpen(false)
              inputRef.current?.blur()
            }}
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-[var(--muted)]">No matching purchase orders</div>
          ) : (
            filtered.map((po) => {
              const label = poOptionLabel(po)
              const isSelected = po.id === value
              return (
                <button
                  key={po.id}
                  type="button"
                  className={`w-full px-3 py-2.5 text-left text-sm hover:bg-[var(--panel-2)] ${
                    isSelected ? 'bg-[var(--panel-2)] text-[var(--ink)]' : 'text-[var(--ink)]'
                  }`}
                  onClick={() => {
                    onChange(po)
                    setQuery('')
                    setOpen(false)
                  }}
                >
                  {label}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ── Helpers ──

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <div
      className="mb-1.5 text-[var(--muted)]"
      style={{
        fontFamily: 'var(--mono)',
        fontSize: 10.5,
        letterSpacing: '.08em',
        textTransform: 'uppercase',
      }}
    >
      {label}
      {required && <span className="ml-0.5" style={{ color: 'var(--danger)' }}>*</span>}
    </div>
  )
}

function FormField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      {children}
    </div>
  )
}
