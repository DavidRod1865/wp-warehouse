/**
 * ReceivingPage — Audit-first layout
 *
 * The daily receiving log is the page's primary content. The 3-step
 * receipt-creation workflow lives in NewReceiptModal, opened by the
 * "+ New receipt" CTA in the page hero.
 *
 * After confirm, useConfirmReceipt invalidates receivingKeys.all so the
 * daily log refreshes the moment the modal closes — no scroll, no flash.
 */
import { useState } from 'react'
import { DailyReceivingLog } from './DailyReceivingLog'
import { NewReceiptModal } from './NewReceiptModal'
import { Icon } from '../../../components/ui/Icon'

export default function ReceivingPage() {
  const [modalOpen, setModalOpen] = useState(false)

  const todayLong = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Hero — the daily log is now the page's identity */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div
            className="text-[var(--muted)] uppercase"
            style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.06em' }}
          >
            Receiving log &middot; {todayLong}
          </div>
          <h1
            className="text-[var(--ink)] mt-1"
            style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 500, letterSpacing: '-0.5px' }}
          >
            Daily receiving log
          </h1>
          <div className="text-[var(--ink-2)] mt-1" style={{ fontSize: 14 }}>
            Audit today's shipments and log new receipts.
          </div>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--on-signal)] shrink-0 transition-opacity hover:opacity-90"
          style={{ background: 'var(--signal)' }}
        >
          <Icon name="plus" className="w-3.5 h-3.5" />
          New receipt
        </button>
      </div>

      {/* Daily log — promoted to primary content */}
      <DailyReceivingLog />

      {/* Receipt creation lives in a modal */}
      <NewReceiptModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirmed={() => setModalOpen(false)}
      />
    </div>
  )
}
