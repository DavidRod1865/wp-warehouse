/**
 * ReceiptHeaderForm — Step 1 of the receiving workflow
 *
 * Collects: vendor/brand, PO number, date received, destination (project or warehouse),
 * and input method (PDF upload or manual entry).
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { useAppConfig } from '../../../hooks/useAppConfig'
import { PdfDropZone } from './PdfDropZone'
import { useParsePdf } from '../hooks/useParsePdf'
import type { Project } from '../../../types/project'
import type { DestinationType, ParsedPackingItem, ReceivingLineItem } from '../types'

interface ReceiptHeaderFormProps {
  vendor: string
  setVendor: (v: string) => void
  poNumber: string
  setPoNumber: (v: string) => void
  dateReceived: string
  setDateReceived: (v: string) => void
  destinationType: DestinationType
  setDestinationType: (v: DestinationType) => void
  selectedProjectId: number | null
  setSelectedProjectId: (v: number | null) => void
  destinationFolderId: number | null
  setDestinationFolderId: (v: number | null) => void
  projectName: string | null
  setProjectName: (v: string | null) => void
  notes: string
  setNotes: (v: string) => void
  onItemsParsed: (items: ReceivingLineItem[]) => void
  onManualEntry: () => void
  onNext: () => void
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

export function ReceiptHeaderForm({
  vendor,
  setVendor,
  poNumber,
  setPoNumber,
  dateReceived,
  setDateReceived,
  destinationType,
  setDestinationType,
  selectedProjectId,
  setSelectedProjectId,
  destinationFolderId,
  setDestinationFolderId,
  setProjectName,
  notes,
  setNotes,
  onItemsParsed,
  onManualEntry,
  onNext,
}: ReceiptHeaderFormProps) {
  const { data: projects = [], isLoading: projectsLoading } = useProjects()
  const { data: appConfig } = useAppConfig()
  const pdfHook = useParsePdf()

  const handleProjectChange = (projectId: string) => {
    if (!projectId) {
      setSelectedProjectId(null)
      setDestinationFolderId(null)
      setProjectName(null)
      return
    }
    const project = projects.find((p) => p.id === Number(projectId))
    if (project) {
      setSelectedProjectId(project.id)
      setDestinationFolderId(project.sortly_warehouse_folder_id || null)
      setProjectName(project.name)
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
      sortly_item_id: null,
      sortly_item_name: null,
      sortly_current_quantity: null,
      destination_folder_id: destinationFolderId,
      destination_folder_name: null,
      notes: null,
      tags: [],
    }))
    onItemsParsed(lineItems)
    onNext()
  }

  const handleManualEntry = () => {
    onManualEntry()
    onNext()
  }

  const canProceed = vendor.trim() && dateReceived && destinationFolderId

  return (
    <div className="space-y-5">
      {/* Row 1: Vendor, PO, Date */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="Vendor / Brand" required>
          <input
            className="form-input"
            placeholder="Vendor name..."
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
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

      {/* Row 2: Destination */}
      <FormField label="Destination">
        <div className="flex gap-2 mb-3">
          {(['project', 'warehouse'] as const).map((type) => (
            <button
              key={type}
              onClick={() => {
                setDestinationType(type)
                setSelectedProjectId(null)
                setDestinationFolderId(
                  type === 'warehouse' ? (appConfig?.mainWarehouseFolderId ?? null) : null
                )
                setProjectName(null)
              }}
              className="px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                background: destinationType === type ? 'var(--panel-2)' : 'transparent',
                color: destinationType === type ? 'var(--ink)' : 'var(--muted)',
                border: `1px solid ${destinationType === type ? 'var(--line)' : 'transparent'}`,
              }}
            >
              {type === 'project' ? 'Project' : 'Main Warehouse'}
            </button>
          ))}
        </div>

        {destinationType === 'project' ? (
          projectsLoading ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <select
              className="form-input"
              value={selectedProjectId ?? ''}
              onChange={(e) => handleProjectChange(e.target.value)}
            >
              <option value="">Select a project...</option>
              {projects
                .filter((p) => p.sortly_warehouse_folder_id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          )
        ) : (
          <div
            className="text-sm text-[var(--muted)] px-3 py-2 rounded-md"
            style={{ background: 'var(--panel-2)' }}
          >
            Items will be placed in the main warehouse. You'll link each item to a specific folder in the next step.
          </div>
        )}
      </FormField>

      {/* Row 3: Notes */}
      <FormField label="Notes">
        <textarea
          className="form-input"
          style={{ minHeight: 80, resize: 'vertical' }}
          placeholder="Any notes about this shipment..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </FormField>

      {/* Row 4: Input method */}
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
            {/* B1+B2: Equal-weight sibling card; clipboard icon implies "list of items" */}
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
