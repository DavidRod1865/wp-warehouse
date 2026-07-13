/**
 * ReceiptHeaderForm — Step 1 of the receiving workflow (Phase 4)
 *
 * Collects:
 *  - Vendor (selector from vendors table, with free-text fallback for PO-less)
 *  - Link to Purchase Order (confirmed/partially_received, filtered by project)
 *  - Date received
 *  - Destination: a LOCATION selector (warehouse areas + project job_site)
 *  - PDF upload or manual entry
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
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
  project?: { name: string }
}

function usePOOptions(projectId: number | null) {
  return useQuery({
    queryKey: ['form', 'po-options', projectId],
    queryFn: async () => {
      let q = supabase
        .from('purchase_orders')
        .select('id, po_number, vendor_id, project_id, vendor:vendors(name), project:projects(name)')
        .in('status', ['confirmed', 'partially_received'])
        .order('po_number')
      if (projectId) {
        q = q.eq('project_id', projectId)
      }
      const { data, error } = await q
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
  onItemsParsed: (items: ReceivingLineItem[]) => void
  onManualEntry: () => void
  onNext: () => void
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
  onItemsParsed,
  onManualEntry,
  onNext,
}: ReceiptHeaderFormProps) {
  const [vendorMode, setVendorMode] = useState<'select' | 'freetext'>('select')

  const { data: vendors = [], isLoading: vendorsLoading } = useVendorOptions()
  const { data: projects = [], isLoading: projectsLoading } = useProjects()
  const { data: poOptions = [], isLoading: posLoading } = usePOOptions(selectedProjectId)
  const { data: warehouseLocations = [], isLoading: locationsLoading } = useLocations({ type: 'warehouse_area' })
  const { data: jobSiteLocations = [] } = useLocations({ type: 'job_site' })

  const pdfHook = useParsePdf()

  // When a PO is selected, pre-fill vendor + project
  const handlePoChange = (poIdStr: string) => {
    if (!poIdStr) {
      setPoId(null)
      setPoNumber('')
      return
    }
    const po = poOptions.find((p) => String(p.id) === poIdStr)
    if (!po) return
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
    onNext()
  }

  const handleManualEntry = () => {
    onManualEntry()
    onNext()
  }

  const canProceed = vendor.trim() && dateReceived && destinationLocationId

  const allLocations = [
    ...warehouseLocations.map((l) => ({ ...l, group: 'Warehouse Areas' })),
    ...jobSiteLocations.map((l) => ({ ...l, group: 'Job Sites' })),
  ]

  return (
    <div className="space-y-5">
      {/* Row 1: PO Link */}
      <FormField label="Link to Purchase Order">
        {posLoading ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          <select
            className="form-input"
            value={poId ?? ''}
            onChange={(e) => handlePoChange(e.target.value)}
          >
            <option value="">No PO — miscellaneous stock</option>
            {poOptions.map((po) => (
              <option key={po.id} value={po.id}>
                {po.po_number}
                {po.vendor?.name ? ` — ${po.vendor.name}` : ''}
                {po.project?.name ? ` — ${po.project.name}` : ''}
              </option>
            ))}
          </select>
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
