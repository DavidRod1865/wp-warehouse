/**
 * ProjectsPage — Projects management
 *
 * List, search, filter by status, create, and edit projects.
 * Shows links to general contractor and project address.
 */
import { useState } from 'react'
import { useProjects } from '../hooks/useProjects'
import { Icon } from '../../../components/ui/Icon'
import { ProjectFormModal } from './ProjectFormModal'
import type { Project } from '../../../types/project'

const STATUS_OPTIONS = ['active', 'completed', 'on_hold', 'cancelled']

interface ModalState {
  type: 'none' | 'create' | 'edit'
  project?: Project
}

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
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

        <button
          onClick={() => setModal({ type: 'create' })}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
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
        <div className="space-y-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={() => setModal({ type: 'edit', project })}
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
}: {
  project: Project
  onEdit: () => void
}) {
  const statusColor = {
    active: 'bg-[color-mix(in_oklab,var(--signal)_10%,var(--panel))] text-[var(--signal)]',
    completed: 'bg-[color-mix(in_oklab,#22c55e_10%,var(--panel))] text-[#22c55e]',
    on_hold: 'bg-[color-mix(in_oklab,#f59e0b_10%,var(--panel))] text-[#f59e0b]',
    cancelled: 'bg-[color-mix(in_oklab,var(--danger)_10%,var(--panel))] text-[var(--danger)]',
  }

  return (
    <div className="p-4 border border-[var(--line)] rounded-lg hover:bg-[var(--panel-2)] transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-[var(--ink)]">{project.name}</h3>
          <div className="mt-2 flex gap-2 flex-wrap">
            <span
              className={`text-xs px-2 py-1 rounded ${
                statusColor[project.status as keyof typeof statusColor] ||
                'bg-[var(--panel-2)] text-[var(--muted)]'
              }`}
            >
              {project.status}
            </span>
          </div>
          {project.project_address && (
            <div className="mt-2 text-xs text-[var(--muted)]">
              {[project.project_address.street_address, project.project_address.city, project.project_address.state, project.project_address.zip_code]
                .filter(Boolean)
                .join(', ')}
            </div>
          )}
          {project.notes && (
            <div className="mt-2 text-xs text-[var(--muted)]">{project.notes}</div>
          )}
        </div>
        <button
          onClick={onEdit}
          className="p-2 rounded-lg text-[var(--muted)] hover:bg-[var(--panel-2)]"
        >
          <Icon name="edit" className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
