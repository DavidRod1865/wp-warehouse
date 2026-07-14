import type { ReactNode } from 'react'
import { Icon } from './Icon'

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

  const isDanger = confirmVariant === 'danger'

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center p-6 sm:p-10"
      style={{
        background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
        backdropFilter: 'blur(5px)',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl w-full max-w-md overflow-hidden"
        style={{
          background: isDanger
            ? 'color-mix(in oklab, var(--danger-soft) 60%, var(--panel))'
            : 'var(--panel)',
          boxShadow: isDanger
            ? '0 24px 48px -20px color-mix(in oklab, var(--danger) 32%, transparent), 0 0 0 1px color-mix(in oklab, var(--danger) 20%, var(--line))'
            : '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)',
        }}
      >
        {isDanger && (
          <div
            className="h-[3px] w-full"
            style={{
              background:
                'linear-gradient(90deg, transparent, color-mix(in oklab, var(--danger) 75%, transparent), transparent)',
            }}
            aria-hidden
          />
        )}

        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start gap-3">
            {isDanger && (
              <div
                className="mt-0.5 shrink-0 w-9 h-9 rounded-full grid place-items-center"
                style={{
                  background: 'color-mix(in oklab, var(--danger) 12%, var(--panel))',
                  color: 'var(--danger)',
                  boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--danger) 18%, transparent)',
                }}
                aria-hidden
              >
                <Icon name="alert" className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <h3
                className="text-lg font-semibold"
                style={{ color: isDanger ? 'var(--danger)' : 'var(--ink)' }}
              >
                {title}
              </h3>
              <div
                className="mt-2 text-sm leading-relaxed"
                style={{
                  color: isDanger
                    ? 'color-mix(in oklab, var(--danger) 40%, var(--muted))'
                    : 'var(--muted)',
                }}
              >
                {description}
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex justify-end gap-2 px-6 py-3.5 border-t"
          style={{
            borderColor: isDanger
              ? 'color-mix(in oklab, var(--danger) 14%, var(--line))'
              : 'var(--line)',
            background: isDanger
              ? 'color-mix(in oklab, var(--danger-soft) 75%, var(--panel))'
              : 'color-mix(in oklab, var(--panel-2) 50%, var(--panel))',
          }}
        >
          <button
            className="px-3.5 py-2 rounded-lg text-[var(--ink-2)] text-sm font-medium hover:bg-[var(--panel-2)] transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-3.5 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            style={{
              background: isDanger ? 'var(--danger)' : 'var(--signal)',
              color: isDanger ? '#fff' : 'var(--on-signal)',
              boxShadow: isDanger
                ? '0 6px 14px -6px color-mix(in oklab, var(--danger) 45%, transparent)'
                : undefined,
            }}
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
