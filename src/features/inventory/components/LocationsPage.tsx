/**
 * LocationsPage — Manage warehouse and truck locations
 *
 * Job sites are NOT created here: every project's address IS its job site,
 * so job_site locations are created/updated automatically with the project
 * (src/features/projects/hooks/useProjectMutations.ts) and shown read-only.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocations } from '../hooks/useLocations'
import { useCreateLocation, useUpdateLocation } from '../hooks/useInventoryMutations'
import { Icon } from '../../../components/ui/Icon'
import { useToast } from '../../../components/ui/Toast'
import type { Location } from '../types'

type LocationType = 'warehouse_area' | 'truck' | 'job_site'

interface ModalState {
  type: 'none' | 'create' | 'edit'
  location?: Location
}

export default function LocationsPage() {
  const { data: locations = [], isLoading } = useLocations({ activeOnly: false })
  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [activeTab, setActiveTab] = useState<LocationType>('warehouse_area')

  // Group by type
  const byType = {
    warehouse_area: locations.filter((l) => l.location_type === 'warehouse_area'),
    truck: locations.filter((l) => l.location_type === 'truck'),
    job_site: locations.filter((l) => l.location_type === 'job_site'),
  }

  const currentLocations = byType[activeTab]

  const typeLabels: Record<LocationType, string> = {
    warehouse_area: 'Warehouse Areas',
    truck: 'Trucks',
    job_site: 'Job Sites',
  }

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--ink)]">Locations</h1>
        <p className="text-[var(--muted)] mt-1">Manage warehouses, trucks, and job sites</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-[var(--line)]">
        {(['warehouse_area', 'truck', 'job_site'] as LocationType[]).map((type) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === type
                ? 'text-[var(--signal)] border-[var(--signal)]'
                : 'text-[var(--muted)] border-transparent hover:text-[var(--ink)]'
            }`}
          >
            {typeLabels[type]}
            <span className="ml-2 text-xs bg-[var(--panel-2)] px-2 py-0.5 rounded">
              {byType[type].length}
            </span>
          </button>
        ))}
      </div>

      {/* Actions — job sites are derived from projects, not created here */}
      <div className="mb-6 flex gap-2 items-center">
        {activeTab === 'job_site' ? (
          <p className="text-sm text-[var(--muted)]">
            Job sites are created automatically from a project's address. Manage them on the{' '}
            <Link to="/projects" className="text-[var(--signal)] hover:underline">Projects</Link> page.
          </p>
        ) : (
          <button
            onClick={() => setModal({ type: 'create' })}
            className="px-4 py-2 rounded-lg text-[var(--on-signal)] text-sm font-medium hover:opacity-90"
            style={{ background: 'var(--signal)' }}
          >
            <Icon name="plus" className="w-4 h-4 inline mr-1" />
            New {typeLabels[activeTab].slice(0, -1)}
          </button>
        )}
      </div>

      {/* Locations List */}
      {isLoading ? (
        <div className="text-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : currentLocations.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted)]">
          No {typeLabels[activeTab].toLowerCase()} yet
        </div>
      ) : (
        <div className="space-y-3">
          {currentLocations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              allLocations={locations}
              onEdit={() => setModal({ type: 'edit', location })}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {modal.type === 'create' && (
        <LocationFormModal
          type={activeTab}
          locations={locations}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
      {modal.type === 'edit' && modal.location && (
        <LocationFormModal
          location={modal.location}
          locations={locations}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
    </div>
  )
}

function LocationCard({
  location,
  allLocations,
  onEdit,
}: {
  location: Location
  allLocations: Location[]
  onEdit: () => void
}) {
  const typeLabel = {
    warehouse_area: 'Warehouse Area',
    truck: 'Truck',
    job_site: 'Job Site',
  }[location.location_type]

  const parentLocation = location.parent_location_id
    ? allLocations.find((l) => l.id === location.parent_location_id)
    : null

  return (
    <div className="p-4 border border-[var(--line)] rounded-lg hover:bg-[var(--panel-2)] transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-[var(--ink)]">{location.name}</h3>
          <div className="mt-2 flex gap-2 flex-wrap">
            <span className="text-xs px-2 py-1 bg-[var(--panel-2)] rounded">
              {typeLabel}
            </span>
            {!location.is_active && (
              <span className="text-xs px-2 py-1 bg-[color-mix(in_oklab,var(--danger)_10%,var(--panel))] text-[var(--danger)] rounded">
                Inactive
              </span>
            )}
            {parentLocation && (
              <span className="text-xs px-2 py-1 bg-[var(--panel-2)] rounded">
                Under {parentLocation.name}
              </span>
            )}
          </div>
          {location.address && Object.keys(location.address).length > 0 && (
            <div className="mt-2 text-xs text-[var(--muted)]">
              {Object.entries(location.address)
                .filter(([, v]) => v)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' • ')}
            </div>
          )}
        </div>
        {location.location_type !== 'job_site' && (
          <button
            onClick={onEdit}
            className="p-2 rounded-lg text-[var(--muted)] hover:bg-[var(--panel-2)]"
          >
            <Icon name="edit" className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

interface LocationFormModalProps {
  type?: LocationType
  location?: Location
  locations: Location[]
  onClose: () => void
}

function LocationFormModal({ type, location, locations, onClose }: LocationFormModalProps) {
  const [name, setName] = useState(location?.name ?? '')
  const [locationType, setLocationType] = useState<LocationType>(type ?? location?.location_type ?? 'warehouse_area')
  const [parentId, setParentId] = useState<number | null>(location?.parent_location_id ?? null)
  const [isActive, setIsActive] = useState(location?.is_active ?? true)
  const [saving, setSaving] = useState(false)

  const createLocation = useCreateLocation()
  const updateLocation = useUpdateLocation()
  const { toast } = useToast()

  async function handleSave() {
    if (!name.trim()) {
      toast('Name is required', 'error')
      return
    }

    setSaving(true)
    try {
      if (location) {
        await updateLocation.mutateAsync({
          id: location.id,
          name: name.trim(),
          location_type: locationType,
          parent_location_id: parentId,
          is_active: isActive,
        })
        toast(`"${name.trim()}" updated`)
      } else {
        await createLocation.mutateAsync({
          name: name.trim(),
          location_type: locationType,
          parent_location_id: parentId,
          is_active: isActive,
        })
        toast(`"${name.trim()}" created`)
      }
      onClose()
    } catch (err) {
      console.error('Save location failed:', err)
      toast(err instanceof Error ? err.message : 'Failed to save location', 'error')
    } finally {
      setSaving(false)
    }
  }

  const isValid = name.trim().length > 0

  // Parent hierarchy applies to warehouse areas (e.g. shelf under an area)
  const parentOptions = locations.filter(
    (l) => l.id !== location?.id && l.location_type === 'warehouse_area'
  )

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{
        background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--panel)] rounded-xl w-full max-w-md overflow-hidden"
        style={{ boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)' }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--line)]">
          <h3 className="text-lg font-semibold">
            {location ? 'Edit Location' : 'New Location'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--panel-2)] text-[var(--muted)]"
            disabled={saving}
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <FormField label="Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Location name"
              className="form-input w-full"
              autoFocus
              disabled={saving}
            />
          </FormField>

          <FormField label="Type" required>
            <select
              value={locationType}
              onChange={(e) => {
                setLocationType(e.target.value as LocationType)
                setParentId(null)
              }}
              className="form-input w-full"
              disabled={saving || !!location}
            >
              <option value="warehouse_area">Warehouse Area</option>
              <option value="truck">Truck</option>
            </select>
          </FormField>

          {parentOptions.length > 0 && (
            <FormField label="Parent Area">
              <select
                value={parentId ?? ''}
                onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
                className="form-input w-full"
                disabled={saving}
              >
                <option value="">None</option>
                {parentOptions.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <label className="flex items-center gap-2 cursor-pointer mt-4">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="checkbox checkbox-sm"
              disabled={saving}
            />
            <span className="text-sm text-[var(--ink)]">Active</span>
          </label>
        </div>

        <div
          className="flex justify-end gap-2 px-6 py-3.5 border-t border-[var(--line)]"
          style={{ background: 'color-mix(in oklab, var(--panel-2) 50%, var(--panel))' }}
        >
          <button
            className="px-3.5 py-2 rounded-lg text-[var(--ink-2)] text-sm font-medium hover:bg-[var(--panel-2)]"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="px-3.5 py-2 rounded-lg text-[var(--on-signal)] text-sm font-medium hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--signal)' }}
            onClick={handleSave}
            disabled={!isValid || saving}
          >
            {saving ? <span className="loading loading-spinner loading-sm" /> : 'Save'}
          </button>
        </div>
      </div>
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
      <label className="block text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>
        {label}
        {required && <span className="text-[var(--danger)] ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}
