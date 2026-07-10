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

export function ProjectSelector({
  value,
  onChange,
  disabled = false,
  className = 'form-input',
}: ProjectSelectorProps) {
  const { data: projects = [] } = useProjects({ activeOnly: true })

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className={className}
      disabled={disabled}
    >
      <option value="">Select project…</option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </select>
  )
}
