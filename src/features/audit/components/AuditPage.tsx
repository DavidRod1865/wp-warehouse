/**
 * AuditPage — Tabbed shell for the warehouse audit suite
 *
 * Tabs:
 *   Reconciliation  — PO vs. receiving vs. delivered breakdown per project
 *   Cycle Counts    — Physical inventory count management
 *   Signed Deliveries — Delivered orders with signature + PDF access
 */
import { useState } from 'react'
import { ReconciliationTab } from './ReconciliationTab'
import { CycleCountsTab } from './CycleCountsTab'
import { SignedDeliveriesTab } from './SignedDeliveriesTab'

type Tab = 'reconciliation' | 'cycle_counts' | 'signed_deliveries'

const TABS: { id: Tab; label: string }[] = [
  { id: 'reconciliation',   label: 'Reconciliation' },
  { id: 'cycle_counts',     label: 'Cycle Counts' },
  { id: 'signed_deliveries',label: 'Signed Deliveries' },
]

export default function AuditPage() {
  const [activeTab, setActiveTab] = useState<Tab>('reconciliation')

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--ink)]">Audit</h1>
        <p className="text-[var(--muted)] mt-1">
          Reconciliation, cycle counts, and signed delivery records
        </p>
      </div>

      {/* Tab bar */}
      <div
        role="tablist"
        className="flex gap-0.5 border-b border-[var(--line)] mb-6"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-[var(--ink)] text-[var(--ink)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink-2)]'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'reconciliation'    && <ReconciliationTab />}
      {activeTab === 'cycle_counts'      && <CycleCountsTab />}
      {activeTab === 'signed_deliveries' && <SignedDeliveriesTab />}
    </div>
  )
}
