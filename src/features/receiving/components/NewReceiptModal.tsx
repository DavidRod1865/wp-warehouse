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
import { Icon } from '../../../components/ui/Icon'
import type { ReceivingLineItem } from '../types'

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

  const titleForStep = (() => {
    if (step === 1) return 'New receipt'
    if (step === 2) return `Review items — ${destinationLocationName ?? 'Select location'}`
    return 'Confirm receipt'
  })()

  const subtitleForStep = (() => {
    if (step === 1) return 'Enter shipment details and upload a packing list or add items manually.'
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
              key={step}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            >
              {step === 1 && (
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
                  onItemsParsed={(parsedItems) => setItems(parsedItems)}
                  onManualEntry={() => setIsManualEntry(true)}
                  onNext={() => setStep(2)}
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
                  onBack={() => setStep(1)}
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
