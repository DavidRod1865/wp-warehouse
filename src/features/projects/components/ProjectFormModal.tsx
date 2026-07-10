/**
 * ProjectFormModal — Form for creating/editing projects
 *
 * Required fields: name, address (street, city, state, zip), gc_id (with inline selection)
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { projectFormSchema, type ProjectFormValues } from '../schemas/projectSchema'
import { useCreateProject, useUpdateProject } from '../hooks/useProjectMutations'
import { useClients } from '../../clients/hooks/useClients'
import { Icon } from '../../../components/ui/Icon'
import { useToast } from '../../../components/ui/Toast'
import type { Project } from '../../../types/project'

interface ProjectFormModalProps {
  project?: Project
  onClose: () => void
}

function FormField({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        className="mb-1.5 text-[var(--muted)]"
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10.5,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
        }}
      >
        {label} {required && <span className="text-[var(--danger)]">*</span>}
      </div>
      {children}
      {error && (
        <div className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}
    </div>
  )
}

export function ProjectFormModal({ project, onClose }: ProjectFormModalProps) {
  const isEdit = !!project
  const [saving, setSaving] = useState(false)
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const { data: clients = [] } = useClients({ activeOnly: true })
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: project?.name ?? '',
      gc_id: project?.gc_id ?? null,
      project_address: project?.project_address ?? {
        street_address: '',
        city: '',
        state: '',
        zip_code: '',
        phone: '',
      },
      status: project?.status ?? 'active',
      notes: project?.notes ?? null,
    } as ProjectFormValues,
  })

  async function onSubmit(values: any) {
    setSaving(true)
    try {
      if (isEdit && project) {
        await updateProject.mutateAsync({
          id: project.id,
          values: values as ProjectFormValues,
        })
        toast('Project updated')
      } else {
        await createProject.mutateAsync(values as ProjectFormValues)
        toast('Project created')
      }
      onClose()
    } catch (err) {
      console.error('Save failed:', err)
      toast(err instanceof Error ? err.message : 'Failed to save project', 'error')
    } finally {
      setSaving(false)
    }
  }

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
        className="bg-[var(--panel)] rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)' }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--line)]">
          <h3 className="text-lg font-semibold">{isEdit ? 'Edit Project' : 'New Project'}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--panel-2)] text-[var(--muted)]"
            disabled={saving}
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="px-6 py-5 space-y-4">
            <FormField label="Project Name" required error={errors.name?.message}>
              <input
                {...register('name')}
                className="form-input w-full"
                placeholder="Office Building Renovation"
                autoFocus
                disabled={saving}
              />
            </FormField>

            <FormField label="General Contractor" required error={errors.gc_id?.message}>
              <select
                {...register('gc_id', { valueAsNumber: true })}
                className="form-input w-full"
                disabled={saving}
              >
                <option value="">Select contractor…</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Don't see your contractor? <a href="/clients" className="text-[var(--signal)] hover:underline">Add one</a>
              </p>
            </FormField>

            <div>
              <div
                className="mb-3 text-[var(--muted)]"
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10.5,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                }}
              >
                Project Address <span className="text-[var(--danger)]">*</span>
              </div>
              <div className="space-y-2">
                <input
                  {...register('project_address.street_address')}
                  className={`form-input w-full ${errors.project_address?.street_address ? 'border-[var(--danger)]' : ''}`}
                  placeholder="Street Address"
                  disabled={saving}
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    {...register('project_address.city')}
                    className={`form-input ${errors.project_address?.city ? 'border-[var(--danger)]' : ''}`}
                    placeholder="City"
                    disabled={saving}
                  />
                  <input
                    {...register('project_address.state')}
                    className={`form-input ${errors.project_address?.state ? 'border-[var(--danger)]' : ''}`}
                    placeholder="State"
                    disabled={saving}
                  />
                  <input
                    {...register('project_address.zip_code')}
                    className={`form-input ${errors.project_address?.zip_code ? 'border-[var(--danger)]' : ''}`}
                    placeholder="Zip"
                    disabled={saving}
                  />
                </div>
                <input
                  {...register('project_address.phone')}
                  className="form-input w-full"
                  placeholder="Phone"
                  disabled={saving}
                />
              </div>
            </div>

            <FormField label="Status" error={errors.status?.message}>
              <select
                {...register('status')}
                className="form-input w-full"
                disabled={saving}
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </FormField>

            <FormField label="Notes" error={errors.notes?.message}>
              <textarea
                {...register('notes')}
                className="form-input w-full"
                placeholder="Project notes..."
                rows={3}
                disabled={saving}
              />
            </FormField>
          </div>

          <div
            className="flex justify-end gap-2 px-6 py-3.5 border-t border-[var(--line)]"
            style={{ background: 'color-mix(in oklab, var(--panel-2) 50%, var(--panel))' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:bg-[var(--panel-2)]"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-2 rounded-lg text-sm text-white hover:opacity-90"
              style={{ background: 'var(--signal)' }}
              disabled={saving}
            >
              {saving ? <span className="loading loading-spinner loading-sm inline" /> : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
