/**
 * useProjectMutations — Mutations for creating and updating projects
 *
 * Project locations (job_site, rigging_yard, project warehouse staging) are
 * NOT managed client-side. Every create/update calls the SECURITY DEFINER
 * RPC `ensure_project_locations`, which idempotently finds-or-creates the
 * three locations and keeps the job_site name/address synced to the project
 * (the project's address IS its job site). This also fixes a bug where a
 * status-only edit used to skip location sync entirely.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { projectKeys } from './projectKeys'
import { inventoryKeys } from '../../inventory/hooks/inventoryKeys'
import type { Project } from '../../../types/project'
import type { ProjectFormValues } from '../schemas/projectSchema'

async function ensureProjectLocations(projectId: number) {
  const { data, error } = await supabase.rpc('ensure_project_locations', {
    p_project_id: projectId,
  })

  if (error) throw error
  if (!data?.success) {
    throw new Error('Failed to sync project locations')
  }

  return data
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert([
          {
            name: values.name,
            gc_id: values.gc_id || null,
            project_address: values.project_address,
            status: values.status,
            notes: values.notes || null,
          },
        ])
        .select()
        .single()

      if (projectError) throw projectError

      await ensureProjectLocations(projectData.id)

      return projectData as Project
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.locations() })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: number
      values: Partial<ProjectFormValues>
    }) => {
      const updateData: Record<string, unknown> = {}

      if (values.name !== undefined) updateData.name = values.name
      if (values.gc_id !== undefined) updateData.gc_id = values.gc_id
      if (values.project_address !== undefined) updateData.project_address = values.project_address
      if (values.status !== undefined) updateData.status = values.status
      if (values.notes !== undefined) updateData.notes = values.notes

      updateData.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Always resync — a status-only edit still needs its locations to
      // exist (legacy projects), and name/address edits must propagate to
      // the job_site location.
      await ensureProjectLocations(id)

      return data as Project
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.locations() })
    },
  })
}
