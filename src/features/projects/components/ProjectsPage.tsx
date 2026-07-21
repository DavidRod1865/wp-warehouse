/**
 * ProjectsPage — Projects management
 *
 * List, search, filter by status, create, and edit projects.
 * Shows links to general contractor and project address.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useProjects } from '../hooks/useProjects'
import { Icon } from '../../../components/ui/Icon'
import { ProjectFormModal } from './ProjectFormModal'
import type { Project } from '../../../types/project'

const STATUS_OPTIONS = ['active', 'completed', 'on_hold', 'cancelled']

interface ModalState {
  type: 'none' | 'create' | 'edit'
  project?: Project
}

type ViewMode = 'list' | 'grid'

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [modal, setModal] = useState<ModalState>({ type: 'none' })

  const { data: projects = [], isLoading } = useProjects({
    status: statusFilter || undefined,
    search: searchQuery,
  })

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--ink)]">Projects</h1>
        <p className="text-[var(--muted)] mt-1">Manage construction projects</p>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-60">
          <label className="block text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>
            Search
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Project name..."
            className="form-input w-full"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>
            Status
          </label>
          <select
            value={statusFilter ?? ''}
            onChange={(e) => setStatusFilter(e.target.value || null)}
            className="form-input"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div
          className="inline-flex rounded-lg border border-[var(--line)] p-0.5"
          role="group"
          aria-label="View mode"
        >
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-pressed={viewMode === 'list'}
            title="List view"
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list'
                ? 'view-toggle-active'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Icon name="list" className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            title="Grid view"
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'view-toggle-active'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Icon name="grid" className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setModal({ type: 'create' })}
          className="px-4 py-2 rounded-lg text-[var(--on-signal)] text-sm font-medium hover:opacity-90"
          style={{ background: 'var(--signal)' }}
        >
          <Icon name="plus" className="w-4 h-4 inline mr-1" />
          New Project
        </button>
      </div>

      {/* Projects List */}
      {isLoading ? (
        <div className="text-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted)]">
          {searchQuery || statusFilter ? 'No matching projects' : 'No projects yet'}
        </div>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
              : 'space-y-3'
          }
        >
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={() => setModal({ type: 'edit', project })}
              layout={viewMode}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {modal.type === 'create' && (
        <ProjectFormModal
          onClose={() => setModal({ type: 'none' })}
        />
      )}
      {modal.type === 'edit' && modal.project && (
        <ProjectFormModal
          project={modal.project}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
    </div>
  )
}

function ProjectCard({
  project,
  onEdit,
  layout = 'list',
}: {
  project: Project
  onEdit: () => void
  layout?: ViewMode
}) {
  const statusStyles: Record<string, string> = {
    active:
      'bg-[color-mix(in_oklab,var(--signal)_12%,var(--panel))] text-[var(--signal)] border-[color-mix(in_oklab,var(--signal)_30%,transparent)]',
    completed:
      'bg-[var(--ok-soft)] text-[var(--ok)] border-[color-mix(in_oklab,var(--ok)_28%,transparent)]',
    on_hold:
      'bg-[var(--warn-soft)] text-[var(--warn)] border-[color-mix(in_oklab,var(--warn)_28%,transparent)]',
    cancelled:
      'bg-[var(--danger-soft)] text-[var(--danger)] border-[color-mix(in_oklab,var(--danger)_28%,transparent)]',
  }

  const statusLabels: Record<string, string> = {
    active: 'Active',
    completed: 'Completed',
    on_hold: 'On hold',
    cancelled: 'Cancelled',
  }

  const cityLine = [
    project.project_address?.city,
    project.project_address?.state,
    project.project_address?.zip_code,
  ]
    .filter(Boolean)
    .join(', ')

  const addressFull = [
    project.project_address?.street_address,
    project.project_address?.city,
    project.project_address?.state,
    project.project_address?.zip_code,
  ]
    .filter(Boolean)
    .join(', ')

  const isGrid = layout === 'grid'

  return (
    <div
      className={`p-4 border border-[var(--line)] rounded-lg hover:bg-[var(--panel-2)] transition-colors ${
        isGrid ? 'h-full' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--ink)] tracking-tight">
            <Link to={`/projects/${project.id}`} className="hover:underline">
              {isGrid && project.general_contractor ? (
                <>
                  <span className="block">{project.general_contractor}</span>
                  <span className="block">{project.name}</span>
                </>
              ) : project.general_contractor ? (
                `${project.general_contractor} - ${project.name}`
              ) : (
                project.name
              )}
            </Link>
          </h3>
          {project.project_address && (
            <div className="mt-1 text-sm text-[var(--muted)]">
              {isGrid ? (
                <>
                  {project.project_address.street_address && (
                    <div>{project.project_address.street_address}</div>
                  )}
                  {cityLine && <div>{cityLine}</div>}
                </>
              ) : (
                addressFull
              )}
            </div>
          )}
          {project.notes && (
            <div className="mt-2 text-xs text-[var(--muted)] line-clamp-2">{project.notes}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="p-2 rounded-lg text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)]"
          >
            <Icon name="edit" className="w-4 h-4" />
          </button>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11.5px] font-medium leading-snug border whitespace-nowrap ${
              statusStyles[project.status] ||
              'bg-transparent text-[var(--muted)] border-[var(--line)]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {statusLabels[project.status] || project.status}
          </span>
        </div>
      </div>
    </div>
  )
}
