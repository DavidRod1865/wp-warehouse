/**
 * InventoryFilterBar — Location/truck and project filters
 */
import { Icon } from '../../../components/ui/Icon'

interface FilterBarOption {
  id: number | string
  name: string
}

interface InventoryFilterBarProps {
  viewMode: 'warehouse' | 'trucks'
  selectedLocationId: number | null
  locationOptions: FilterBarOption[]
  onSetSelectedLocationId: (id: number | null) => void
  selectedProjectId: number | null
  projectOptions: FilterBarOption[]
  onSetSelectedProjectId: (id: number | null) => void
  activeProject: { sortly_jobsite_folder_id: string | null } | null
  projectSubView: 'warehouse' | 'jobsite'
  onSetProjectSubView: (view: 'warehouse' | 'jobsite') => void
  hasActiveFilter: boolean
  onReset: () => void
  filteredItemsCount: number
  totalSkusCount: number
}

export function InventoryFilterBar({
  viewMode,
  selectedLocationId,
  locationOptions,
  onSetSelectedLocationId,
  selectedProjectId,
  projectOptions,
  onSetSelectedProjectId,
  activeProject,
  projectSubView,
  onSetProjectSubView,
  hasActiveFilter,
  onReset,
  filteredItemsCount,
  totalSkusCount,
}: InventoryFilterBarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2.5 mb-4 px-3 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--panel)]"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Location / Truck dropdown */}
      <select
        value={selectedLocationId ?? ''}
        onChange={(e) => onSetSelectedLocationId(e.target.value ? Number(e.target.value) : null)}
        className="px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-sm text-[var(--ink)] outline-none cursor-pointer"
        style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
      >
        <option value="">
          {viewMode === 'trucks' ? 'Delivery Trucks' : 'Main Warehouse Locations'}
        </option>
        {locationOptions.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
          </option>
        ))}
      </select>

      {/* Project dropdown (warehouse mode only) */}
      {viewMode === 'warehouse' && (
        <select
          value={selectedProjectId ?? ''}
          onChange={(e) => onSetSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-sm text-[var(--ink)] outline-none cursor-pointer"
          style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
        >
          <option value="">No Project Selected</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      {/* Job Site toggle — only shown when a project is selected */}
      {activeProject && activeProject.sortly_jobsite_folder_id && (
        <button
          onClick={() => onSetProjectSubView(projectSubView === 'jobsite' ? 'warehouse' : 'jobsite')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: projectSubView === 'jobsite'
              ? 'color-mix(in oklab, var(--ok) 15%, var(--panel))'
              : 'var(--panel)',
            border: `1px solid ${projectSubView === 'jobsite' ? 'var(--ok)' : 'var(--line)'}`,
            color: projectSubView === 'jobsite' ? 'var(--ok)' : 'var(--ink-2)',
          }}
        >
          <span
            className="inline-block rounded-full"
            style={{
              width: 6,
              height: 6,
              background: projectSubView === 'jobsite' ? 'var(--ok)' : 'var(--line-2)',
            }}
          />
          Job Site Inventory
        </button>
      )}

      {hasActiveFilter && (
        <button
          onClick={onReset}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--line)] text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
        >
          <Icon name="close" className="w-3 h-3" />
          Reset
        </button>
      )}

      <div className="ml-auto" style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
        {hasActiveFilter ? `${filteredItemsCount} of ${totalSkusCount} shown` : ''}
      </div>
    </div>
  )
}
