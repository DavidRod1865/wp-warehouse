/**
 * ProjectSelector — Reusable dropdown for selecting active projects
 * Used in delivery forms and other features
 */
import { useProjects } from '../hooks/useProjects'

interface ProjectSelectorProps {
  value: number | null
  onChange: (projectId: number | null) => void
  disabled?: boolean
  className?: string
}

function projectLabel(project: { name: string; general_contractor?: string }): string {
  return project.general_contractor
    ? `${project.general_contractor} - ${project.name}`
    : project.name
}

export function ProjectSelector({
  value,
  onChange,
  disabled = false,
  className = 'form-input',
}: ProjectSelectorProps) {
  const { data: projects = [] } = useProjects({ activeOnly: true })

  const sortedProjects = [...projects].sort((a, b) =>
    projectLabel(a).localeCompare(projectLabel(b), undefined, { sensitivity: 'base' }),
  )

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className={className}
      disabled={disabled}
    >
      <option value="">Select project…</option>
      {sortedProjects.map((project) => (
        <option key={project.id} value={project.id}>
          {projectLabel(project)}
        </option>
      ))}
    </select>
  )
}
