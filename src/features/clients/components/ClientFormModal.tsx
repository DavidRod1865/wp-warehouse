/**
 * ClientFormModal — Form for creating/editing general contractors
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clientFormSchema, type ClientFormValues } from '../schemas/clientSchema'
import { useCreateClient, useUpdateClient, type GeneralContractor } from '../hooks/useClientMutations'
import { Icon } from '../../../components/ui/Icon'
import { useToast } from '../../../components/ui/Toast'

interface ClientFormModalProps {
  client?: GeneralContractor
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

export function ClientFormModal({ client, onClose }: ClientFormModalProps) {
  const isEdit = !!client
  const [saving, setSaving] = useState(false)
  const createClient = useCreateClient()
  const updateClient = useUpdateClient()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    shouldFocusError: false,
    defaultValues: {
      company_name: client?.company_name ?? '',
      contact_name: client?.contact_name ?? null,
      phone: client?.phone ?? null,
      email: client?.email ?? null,
      billing_address: client?.billing_address ?? null,
      notes: client?.notes ?? null,
      is_active: client?.is_active ?? true,
    } as ClientFormValues,
  })

  async function onSubmit(values: ClientFormValues) {
    setSaving(true)
    try {
      if (isEdit && client) {
        await updateClient.mutateAsync({
          id: client.id,
          values,
        })
        toast('Client updated')
      } else {
        await createClient.mutateAsync(values)
        toast('Client created')
      }
      onClose()
    } catch (err) {
      console.error('Save failed:', err)
      toast(err instanceof Error ? err.message : 'Failed to save client', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
      style={{
        background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center">
      <div
        className="bg-[var(--panel)] rounded-xl w-full max-w-md my-4 sm:my-0 flex flex-col"
        style={{
          maxHeight: 'min(900px, calc(100dvh - 32px))',
          boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)',
        }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--line)] shrink-0">
          <h3 className="text-lg font-semibold">{isEdit ? 'Edit Client' : 'New Client'}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--panel-2)] text-[var(--muted)]"
            disabled={saving}
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col min-h-0 flex-1">
          <div className="px-6 py-5 space-y-4 overflow-y-auto min-h-0">
            <FormField label="Company Name" required error={errors.company_name?.message}>
              <input
                {...register('company_name')}
                className="form-input w-full"
                placeholder="ABC Construction"
                autoFocus
                disabled={saving}
              />
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
                Billing Address
              </div>
              <div className="space-y-2">
                <input
                  {...register('billing_address.street')}
                  className="form-input w-full"
                  placeholder="Street"
                  disabled={saving}
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    {...register('billing_address.city')}
                    className="form-input"
                    placeholder="City"
                    disabled={saving}
                  />
                  <input
                    {...register('billing_address.state')}
                    className="form-input"
                    placeholder="State"
                    disabled={saving}
                  />
                  <input
                    {...register('billing_address.zip')}
                    className="form-input"
                    placeholder="Zip"
                    disabled={saving}
                  />
                </div>
                <input
                  {...register('billing_address.notes')}
                  className="form-input w-full"
                  placeholder="Address notes"
                  disabled={saving}
                />
              </div>
            </div>

            <FormField label="Contact Name" error={errors.contact_name?.message}>
              <input
                {...register('contact_name')}
                className="form-input w-full"
                placeholder="John Smith"
                disabled={saving}
              />
            </FormField>

            <FormField label="Phone" error={errors.phone?.message}>
              <input
                {...register('phone')}
                className="form-input w-full"
                placeholder="(555) 123-4567"
                disabled={saving}
              />
            </FormField>

            <FormField label="Email" error={errors.email?.message}>
              <input
                {...register('email')}
                type="email"
                className="form-input w-full"
                placeholder="contact@example.com"
                disabled={saving}
              />
            </FormField>

            <FormField label="Notes" error={errors.notes?.message}>
              <textarea
                {...register('notes')}
                className="form-input w-full"
                placeholder="Additional notes..."
                rows={3}
                disabled={saving}
              />
            </FormField>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register('is_active')}
                className="checkbox checkbox-sm"
                disabled={saving}
              />
              <span className="text-sm text-[var(--ink)]">Active</span>
            </label>
          </div>

          <div
            className="flex justify-end gap-2 px-6 py-3.5 border-t border-[var(--line)] shrink-0"
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
              className="px-3 py-2 rounded-lg text-sm text-[var(--on-signal)] hover:opacity-90"
              style={{ background: 'var(--signal)' }}
              disabled={saving}
            >
              {saving ? <span className="loading loading-spinner loading-sm inline" /> : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  )
}
