/**
 * DeleteConfirmDialog — Reusable confirmation for destructive deletes.
 *
 * Built on ConfirmDialog with delete-focused defaults (danger variant,
 * permanent-action copy). Use for any entity delete that needs a second step.
 */
import type { ReactNode } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

interface DeleteConfirmDialogProps {
  open: boolean
  /** Short label for the entity type, e.g. "draft PO", "delivery" */
  itemType: string
  /** Specific name/number shown in bold, e.g. "PO-2026-001" */
  itemName: string
  /** Override the default irreversible-delete description */
  description?: ReactNode
  confirmLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmDialog({
  open,
  itemType,
  itemName,
  description,
  confirmLabel = 'Delete',
  loading = false,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title={`Delete ${itemType}?`}
      description={
        description ?? (
          <>
            This permanently deletes <b className="text-[var(--ink)]">{itemName}</b>.
            This cannot be undone.
          </>
        )
      }
      confirmLabel={confirmLabel}
      confirmVariant="danger"
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
