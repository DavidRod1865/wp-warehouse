/**
 * DirectoryPage — Tabbed shell combining Clients and Vendors
 *
 * Active tab is driven by the `tab` search param ('clients' | 'vendors',
 * default 'clients') so links can deep-link into a specific tab
 * (e.g. /directory?tab=vendors). Switching tabs replaces the search param
 * rather than pushing a new history entry.
 */
import { useSearchParams } from 'react-router-dom'
import ClientsPage from '../../clients/components/ClientsPage'
import VendorsPage from '../../vendors/components/VendorsPage'

type Tab = 'clients' | 'vendors'

const TABS: { id: Tab; label: string }[] = [
  { id: 'clients', label: 'Clients' },
  { id: 'vendors', label: 'Vendors' },
]

function isTab(value: string | null): value is Tab {
  return value === 'clients' || value === 'vendors'
}

export default function DirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab: Tab = isTab(searchParams.get('tab')) ? (searchParams.get('tab') as Tab) : 'clients'

  function setActiveTab(tab: Tab) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      return next
    }, { replace: true })
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--ink)]">Directory</h1>
        <p className="text-[var(--muted)] mt-1">Clients and vendors in one place</p>
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
      {activeTab === 'clients' && <ClientsPage embedded />}
      {activeTab === 'vendors' && <VendorsPage embedded />}
    </div>
  )
}
