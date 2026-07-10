/**
 * useProjectMutations — Mutations for creating and updating projects
 *
 * Note on createProject: When creating a project, we also create a job_site location.
 * Currently done as two client-side inserts (insert project, then insert location and
 * update project with job_site_location_id). This pattern is acceptable for now but
 * should move to an RPC if it becomes problematic (transaction atomicity, etc).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { projectKeys } from './projectKeys'
import type { Project } from '../../../types/project'
import type { ProjectFormValues } from '../schemas/projectSchema'

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      // Step 1: Create the project
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

      // Step 2: Create a job_site location with the project address
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .insert([
          {
            name: values.name,
            location_type: 'job_site',
            address: {
              street: values.project_address.street_address,
              city: values.project_address.city,
              state: values.project_address.state,
              zip: values.project_address.zip_code,
              phone: values.project_address.phone,
            },
          },
        ])
        .select()
        .single()

      if (locationError) throw locationError

      // Step 3: Update project with job_site_location_id
      const { data: updatedProject, error: updateError } = await supabase
        .from('projects')
        .update({ job_site_location_id: locationData.id })
        .eq('id', projectData.id)
        .select()
        .single()

      if (updateError) throw updateError

      return updatedProject as Project
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
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
      const updateData: Record<string, any> = {}

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
      return data as Project
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) })
    },
  })
}
