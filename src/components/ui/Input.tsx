import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, ...props }: InputProps) {
  return (
    <div>
      {label && (
        <label className="label">
          <span className="label-text font-medium inline-block pb-1">{label}</span>
        </label>
      )}
      <input className="input input-bordered w-full" {...props} />
    </div>
  )
}
