import type { UseFormRegister, FieldErrors } from 'react-hook-form'
import type { DeliveryFormValues } from '../schemas/deliverySchema'

export function FormField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
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
        {label}
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

export function AddressFields({
  prefix,
  label,
  register,
  errors,
}: {
  prefix: 'from_address' | 'to_address'
  label: string
  register: UseFormRegister<DeliveryFormValues>
  errors: FieldErrors<DeliveryFormValues>
}) {
  const addrErrors = errors[prefix]

  return (
    <fieldset className="space-y-2.5">
      <legend
        className="text-[var(--muted)] mb-2"
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10.5,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </legend>
      <input
        {...register(`${prefix}.company_name`)}
        className="form-input"
        placeholder="Company Name"
      />
      <input
        {...register(`${prefix}.street_address`)}
        className={`form-input ${addrErrors?.street_address ? 'border-[var(--danger)]' : ''}`}
        placeholder="Street Address"
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          {...register(`${prefix}.city`)}
          className={`form-input ${addrErrors?.city ? 'border-[var(--danger)]' : ''}`}
          placeholder="City"
        />
        <input
          {...register(`${prefix}.state`)}
          className={`form-input ${addrErrors?.state ? 'border-[var(--danger)]' : ''}`}
          placeholder="State"
        />
        <input
          {...register(`${prefix}.zip_code`)}
          className={`form-input ${addrErrors?.zip_code ? 'border-[var(--danger)]' : ''}`}
          placeholder="Zip Code"
        />
      </div>
      <input
        {...register(`${prefix}.phone`)}
        className="form-input"
        placeholder="Phone"
      />
    </fieldset>
  )
}
