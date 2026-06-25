import type { UseFormWatch, UseFormSetValue, FieldArrayWithId } from 'react-hook-form'
import type { DeliveryFormValues } from '../schemas/deliverySchema'
import { Icon } from '../../../components/ui/Icon'

interface DeliveryFormFooterProps {
  fields: FieldArrayWithId<DeliveryFormValues, 'items', 'id'>[]
  watch: UseFormWatch<DeliveryFormValues>
  setValue: UseFormSetValue<DeliveryFormValues>
  isSaving: boolean
}

export function DeliveryFormFooter({ fields, watch, setValue, isSaving }: DeliveryFormFooterProps) {
  return (
    <div
      className="flex items-center gap-3 justify-between pt-4"
      style={{ borderTop: '1px solid var(--line)' }}
    >
      <div className="text-sm text-[var(--muted)]">
        {fields.length > 0 && (
          <>
            <b className="text-[var(--ink-2)] font-medium">{fields.length} items</b> &middot;{' '}
            <b className="text-[var(--ink-2)] font-medium">
              {fields.reduce((sum, _, i) => sum + (watch(`items.${i}.quantity`) || 0), 0)} units
            </b>
          </>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSaving}
          onClick={() => setValue('status', 'draft')}
          className="px-4 py-2.5 rounded-lg border border-[var(--line)] text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--panel-2)] disabled:opacity-40"
        >
          {isSaving ? <span className="loading loading-spinner loading-sm" /> : 'Save as draft'}
        </button>
        <button
          type="submit"
          disabled={isSaving}
          onClick={() => setValue('status', 'pending')}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--signal)' }}
        >
          {isSaving ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <>
              Create order
              <Icon name="arrow" className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
