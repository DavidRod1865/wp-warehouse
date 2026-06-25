import type {
  UseFormRegister,
  UseFormWatch,
  UseFormSetValue,
  FieldErrors,
  FieldArrayWithId,
} from 'react-hook-form'
import type { DeliveryFormValues } from '../schemas/deliverySchema'
import { Icon } from '../../../components/ui/Icon'

interface DeliveryItemsCardProps {
  fields: FieldArrayWithId<DeliveryFormValues, 'items', 'id'>[]
  watch: UseFormWatch<DeliveryFormValues>
  setValue: UseFormSetValue<DeliveryFormValues>
  register: UseFormRegister<DeliveryFormValues>
  remove: (index: number) => void
  errors: FieldErrors<DeliveryFormValues>
  watchFromLocationId: number | null
  onOpenItemSelector: () => void
}

export function DeliveryItemsCard({
  fields,
  watch,
  setValue,
  register,
  remove,
  errors,
  watchFromLocationId,
  onOpenItemSelector,
}: DeliveryItemsCardProps) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--line)]">
        <div className="flex items-center gap-2">
          <span
            className="font-medium text-[var(--ink)]"
            style={{ fontFamily: 'var(--serif)', fontSize: 15 }}
          >
            Items
          </span>
          <span className="text-[var(--muted)]" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
            {fields.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenItemSelector}
          disabled={!watchFromLocationId}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] text-[var(--ink-2)] text-sm font-medium hover:bg-[var(--panel-2)] disabled:opacity-40"
        >
          <Icon name="plus" className="w-3.5 h-3.5" />
          From warehouse
        </button>
      </div>

      {errors.items && typeof errors.items.message === 'string' && (
        <div
          className="mx-5 mt-3 px-3 py-2 rounded-lg text-sm"
          style={{
            background: 'color-mix(in oklab, var(--danger) 8%, var(--panel))',
            color: 'var(--danger)',
          }}
        >
          {errors.items.message}
        </div>
      )}

      {fields.length === 0 ? (
        <div className="text-center py-10 text-[var(--muted)]">
          <p className="text-sm">No items added yet.</p>
          <p className="text-xs mt-1">Click "From warehouse" to browse inventory</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b border-[var(--line)] text-[var(--muted)]"
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 10.5,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
              }}
            >
              <th className="text-left font-medium px-5 py-2.5">Item</th>
              <th className="text-right font-medium px-3 py-2.5" style={{ width: 90 }}>
                Avail.
              </th>
              <th className="text-center font-medium px-3 py-2.5" style={{ width: 140 }}>
                Send
              </th>
              <th className="font-medium px-3 py-2.5" style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const qty = watch(`items.${index}.quantity`)
              const avail = field.available_quantity ?? 0
              const over = qty > avail && avail > 0

              return (
                <tr key={field.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium text-[var(--ink)]">{field.item_name}</div>
                    {field.is_manual && (
                      <span
                        className="inline-block mt-0.5 px-2 py-px rounded text-xs"
                        style={{
                          background: 'color-mix(in oklab, var(--signal) 14%, var(--panel))',
                          color: 'color-mix(in oklab, var(--signal) 70%, #000)',
                          fontWeight: 500,
                        }}
                      >
                        Manual
                      </span>
                    )}
                  </td>
                  <td
                    className="px-3 py-3 text-right"
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 13,
                      color: over ? 'var(--danger)' : 'var(--ink-2)',
                    }}
                  >
                    {avail || '—'}
                  </td>
                  <td className="px-3 py-3">
                    <div
                      className="inline-flex items-center mx-auto rounded-md overflow-hidden"
                      style={{
                        border: `1px solid ${over ? 'var(--danger)' : 'var(--line)'}`,
                        background: 'var(--panel)',
                      }}
                    >
                      <button
                        type="button"
                        className="px-2 py-1 text-[var(--muted)] hover:text-[var(--ink)]"
                        style={{ fontFamily: 'var(--mono)' }}
                        onClick={() => {
                          const cur = watch(`items.${index}.quantity`)
                          if (cur > 1) setValue(`items.${index}.quantity`, cur - 1)
                        }}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                        className="w-10 text-center bg-transparent border-x border-[var(--line)] py-1"
                        style={{ fontFamily: 'var(--mono)', fontSize: 13 }}
                      />
                      <button
                        type="button"
                        className="px-2 py-1 text-[var(--muted)] hover:text-[var(--ink)]"
                        style={{ fontFamily: 'var(--mono)' }}
                        onClick={() => {
                          const cur = watch(`items.${index}.quantity`)
                          setValue(`items.${index}.quantity`, cur + 1)
                        }}
                      >
                        +
                      </button>
                    </div>
                    {over && (
                      <div
                        className="text-center mt-1"
                        style={{ fontSize: 10.5, color: 'var(--danger)' }}
                      >
                        over available
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="w-7 h-7 rounded-md grid place-items-center hover:bg-[var(--panel-2)] text-[var(--muted)] hover:text-[var(--danger)]"
                    >
                      <Icon name="close" className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
