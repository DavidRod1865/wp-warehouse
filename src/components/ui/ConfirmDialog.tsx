import type { ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  confirmVariant?: 'danger' | 'primary'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  confirmVariant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  const confirmBg =
    confirmVariant === 'danger' ? 'var(--danger)' : 'var(--signal)'

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-10"
      style={{
        background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--panel)] rounded-xl w-full max-w-md overflow-hidden"
        style={{ boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)' }}
      >
        <div className="px-6 pt-5 pb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="mt-3 text-sm text-[var(--muted)]">{description}</div>
        </div>
        <div
          className="flex justify-end gap-2 px-6 py-3.5 border-t border-[var(--line)]"
          style={{ background: 'color-mix(in oklab, var(--panel-2) 50%, var(--panel))' }}
        >
          <button
            className="px-3.5 py-2 rounded-lg border border-transparent bg-transparent text-[var(--ink-2)] text-sm font-medium hover:bg-[var(--panel-2)]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-3.5 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            style={{ background: confirmBg }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
