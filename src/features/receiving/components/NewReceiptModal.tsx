/**
 * NewReceiptModal (Phase 4) — Multi-step receipt creation
 *
 * Step 1: Receipt header (vendor, PO link, date, destination location, PDF/manual)
 * Step 2: Review & match line items against inventory + PO lines
 * Step 3: Confirm → confirm_receipt RPC
 */
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ReceiptHeaderForm } from './ReceiptHeaderForm'
import { ReceiptLineItems } from './ReceiptLineItems'
import { ReceiptReview } from './ReceiptReview'
import { CreatePoFromPackingList } from './CreatePoFromPackingList'
import { Icon } from '../../../components/ui/Icon'
import type { ReceivingLineItem } from '../types'

/**
 * Sub-phase within Step 1 (kept out of the 3-step indicator):
 *  - form:       the header form
 *  - po-choice:  no PO linked but items parsed → offer to create one
 *  - po-create:  the inline "create PO from packing list" panel
 */
type HeaderPhase = 'form' | 'po-choice' | 'po-create'

const STEPS = [
  { num: 1, label: 'Receipt info' },
  { num: 2, label: 'Line items' },
  { num: 3, label: 'Confirm' },
]

interface NewReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirmed: () => void
}

export function NewReceiptModal({ isOpen, onClose, onConfirmed }: NewReceiptModalProps) {
  return (
    <AnimatePresence>
      {isOpen && <ModalContents onClose={onClose} onConfirmed={onConfirmed} />}
    </AnimatePresence>
  )
}

function ModalContents({
  onClose,
  onConfirmed,
}: {
  onClose: () => void
  onConfirmed: () => void
}) {
  const [step, setStep] = useState(1)
  const [headerPhase, setHeaderPhase] = useState<HeaderPhase>('form')

  // Step 1 state
  const [vendor, setVendor] = useState('')
  const [vendorId, setVendorId] = useState<number | null>(null)
  const [poId, setPoId] = useState<number | null>(null)
  const [poNumber, setPoNumber] = useState('')
  const [dateReceived, setDateReceived] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [destinationLocationId, setDestinationLocationId] = useState<number | null>(null)
  const [destinationLocationName, setDestinationLocationName] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  // Step 2 state
  const [items, setItems] = useState<ReceivingLineItem[]>([])
  const [isManualEntry, setIsManualEntry] = useState(false)

  // Packing-list PDF to archive with the receipt (optional)
  const [packingListFile, setPackingListFile] = useState<File | null>(null)

  const hasUnsavedWork = vendor.trim().length > 0 || items.length > 0 || step > 1

  const requestClose = () => {
    if (!hasUnsavedWork) {
      onClose()
      return
    }
    if (window.confirm('Discard this receipt? Your changes will be lost.')) {
      onClose()
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnsavedWork])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Advance from the header form. When no PO is linked but a packing list was
  // parsed, offer to create a PO from it; otherwise go straight to Step 2.
  const handleHeaderNext = (source: 'parsed' | 'manual') => {
    if (source === 'parsed' && poId == null) {
      setHeaderPhase('po-choice')
    } else {
      setStep(2)
    }
  }

  const backToHeaderForm = () => {
    setHeaderPhase('form')
    setStep(1)
  }

  const titleForStep = (() => {
    if (step === 1) {
      if (headerPhase === 'po-choice') return 'No purchase order linked'
      if (headerPhase === 'po-create') return 'Create PO from packing list'
      return 'New receipt'
    }
    if (step === 2) return `Review items — ${destinationLocationName ?? 'Select location'}`
    return 'Confirm receipt'
  })()

  const subtitleForStep = (() => {
    if (step === 1) {
      if (headerPhase === 'po-choice') return 'Create a purchase order from this packing list, or receive without one.'
      if (headerPhase === 'po-create') return 'Verify the parsed details, then create the PO to track receipts against.'
      return 'Enter shipment details and upload a packing list or add items manually.'
    }
    if (step === 2) {
      return isManualEntry
        ? 'Add items and link them to inventory or PO lines.'
        : 'Verify parsed items and link them to inventory or PO lines.'
    }
    return 'Review all changes and confirm to update inventory.'
  })()

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
      style={{
        background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
        backdropFilter: 'blur(4px)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:p-6 sm:items-center">
      <motion.div
        className="bg-[var(--panel)] rounded-xl flex flex-col overflow-hidden my-4 sm:my-0"
        style={{
          width: 'min(1200px, calc(100vw - 32px))',
          maxHeight: 'min(900px, calc(100dvh - 32px))',
          boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)',
        }}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 4 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--line)] shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div
                className="text-[var(--muted)] uppercase"
                style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.06em' }}
              >
                Receiving log &middot;{' '}
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long', month: 'short', day: 'numeric',
                })}
              </div>
              <h2
                className="text-[var(--ink)] mt-1 truncate"
                style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 500, letterSpacing: '-0.3px' }}
              >
                {titleForStep}
              </h2>
              <div className="text-[var(--ink-2)] mt-1" style={{ fontSize: 13.5 }}>
                {subtitleForStep}
              </div>
            </div>
            <button
              onClick={requestClose}
              aria-label="Close"
              className="w-8 h-8 rounded-lg grid place-items-center hover:bg-[var(--panel-2)] text-[var(--muted)] shrink-0"
            >
              <Icon name="close" className="w-4 h-4" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 mt-4">
            {STEPS.map(({ num, label }) => (
              <div key={num} className="flex items-center gap-1">
                {num > 1 && (
                  <div
                    className="w-8 h-px mx-1"
                    style={{ background: num <= step ? 'var(--signal)' : 'var(--line)' }}
                  />
                )}
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full grid place-items-center text-xs font-semibold"
                    style={{
                      background: num <= step ? 'var(--signal)' : 'var(--panel-2)',
                      color: num <= step ? 'white' : 'var(--muted)',
                      border: num <= step ? 'none' : '1px solid var(--line)',
                    }}
                  >
                    {num < step ? <Icon name="check" className="w-3 h-3" /> : num}
                  </div>
                  <span
                    className="text-sm hidden sm:inline"
                    style={{
                      color: num <= step ? 'var(--ink)' : 'var(--muted)',
                      fontWeight: num === step ? 500 : 400,
                    }}
                  >
                    {label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step === 1 ? `1-${headerPhase}` : step}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            >
              {step === 1 && headerPhase === 'form' && (
                <ReceiptHeaderForm
                  vendor={vendor}
                  setVendor={setVendor}
                  vendorId={vendorId}
                  setVendorId={setVendorId}
                  poId={poId}
                  setPoId={setPoId}
                  poNumber={poNumber}
                  setPoNumber={setPoNumber}
                  dateReceived={dateReceived}
                  setDateReceived={setDateReceived}
                  selectedProjectId={selectedProjectId}
                  setSelectedProjectId={setSelectedProjectId}
                  projectName={projectName}
                  setProjectName={setProjectName}
                  destinationLocationId={destinationLocationId}
                  setDestinationLocationId={setDestinationLocationId}
                  destinationLocationName={destinationLocationName}
                  setDestinationLocationName={setDestinationLocationName}
                  notes={notes}
                  setNotes={setNotes}
                  packingListFile={packingListFile}
                  setPackingListFile={setPackingListFile}
                  onItemsParsed={(parsedItems) => setItems(parsedItems)}
                  onManualEntry={() => setIsManualEntry(true)}
                  onNext={handleHeaderNext}
                />
              )}

              {step === 1 && headerPhase === 'po-choice' && (
                <PoChoice
                  onCreate={() => setHeaderPhase('po-create')}
                  onSkip={() => setStep(2)}
                  onBack={backToHeaderForm}
                />
              )}

              {step === 1 && headerPhase === 'po-create' && (
                <CreatePoFromPackingList
                  vendor={vendor}
                  vendorId={vendorId}
                  poNumber={poNumber}
                  defaultProjectId={selectedProjectId}
                  parsedItems={items}
                  onCreated={(newPoId, newPoNumber) => {
                    setPoId(newPoId)
                    setPoNumber(newPoNumber)
                    setHeaderPhase('form')
                    setStep(2)
                  }}
                  onBack={() => setHeaderPhase('po-choice')}
                />
              )}

              {step === 2 && (
                <ReceiptLineItems
                  items={items}
                  setItems={setItems}
                  poId={poId}
                  destinationLocationId={destinationLocationId}
                  destinationLocationName={destinationLocationName}
                  isManualEntry={isManualEntry}
                  onBack={backToHeaderForm}
                  onNext={() => setStep(3)}
                />
              )}

              {step === 3 && (
                <ReceiptReview
                  vendor={vendor}
                  vendorId={vendorId}
                  poId={poId}
                  poNumber={poNumber}
                  dateReceived={dateReceived}
                  destinationLocationId={destinationLocationId}
                  destinationLocationName={destinationLocationName}
                  projectId={selectedProjectId}
                  projectName={projectName}
                  notes={notes}
                  items={items}
                  packingListFile={packingListFile}
                  onBack={() => setStep(2)}
                  onConfirmed={onConfirmed}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
      </div>
    </motion.div>
  )
}

// ── No-PO choice screen ─────────────────────────────────────────────────────

function PoChoice({
  onCreate,
  onSkip,
  onBack,
}: {
  onCreate: () => void
  onSkip: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--ink-2)]">
        This packing list isn't linked to a purchase order. Create one from the parsed
        items so received quantities are tracked against it — or receive straight into
        inventory without a PO.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={onCreate}
          className="rounded-xl text-left p-5 transition-colors"
          style={{ border: '1.5px solid var(--signal)', background: 'color-mix(in oklab, var(--signal) 6%, var(--panel))' }}
        >
          <div className="inline-flex p-2.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] mb-3">
            <Icon name="clipboard" className="w-5 h-5" style={{ color: 'var(--signal)' }} />
          </div>
          <div className="text-[var(--ink)]" style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>
            Create a PO from this packing list
          </div>
          <div className="text-[var(--muted)] text-sm mt-1">
            Recommended — verify vendor, project and lines, then track receipts against it.
          </div>
        </button>

        <button
          onClick={onSkip}
          className="rounded-xl text-left p-5 transition-colors hover:bg-[var(--panel-2)]"
          style={{ border: '1.5px solid var(--line-2)', background: 'color-mix(in oklab, var(--panel-2) 60%, transparent)' }}
        >
          <div className="inline-flex p-2.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] mb-3">
            <Icon name="box" className="w-5 h-5 text-[var(--ink-2)]" />
          </div>
          <div className="text-[var(--ink)]" style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>
            Receive without a PO
          </div>
          <div className="text-[var(--muted)] text-sm mt-1">
            Add the items straight to inventory. No purchase order is created.
          </div>
        </button>
      </div>

      <div className="flex justify-start pt-4 border-t border-[var(--line)]">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[var(--line)] text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--panel-2)]"
        >
          Back
        </button>
      </div>
    </div>
  )
}
