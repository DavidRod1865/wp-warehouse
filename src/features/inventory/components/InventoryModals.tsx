/**
 * InventoryModals — Modal dialogs for add/edit/adjust/delete operations
 */
import { useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { useToast } from '../../../components/ui/Toast'
import { useDeleteItem } from '../hooks/useSortlyMutations'
import { sortlyKeys } from '../hooks/sortlyKeys'
import { AdjustQuantityModal } from './AdjustQuantityModal'
import { EditItemModal } from './EditItemModal'
import { AddItemModal } from './AddItemModal'
import type { EnrichedItem, LocationOption } from '../hooks/useInventoryData'

export type ModalState =
  | { type: 'none' }
  | { type: 'adjustQty'; item: EnrichedItem }
  | { type: 'editItem'; item: EnrichedItem }
  | { type: 'deleteItem'; item: EnrichedItem }
  | { type: 'addItem' }

interface InventoryModalsProps {
  modal: ModalState
  onSetModal: (state: ModalState) => void
  locationOptions: LocationOption[]
  activeFolderId: number | null
  activeLocationLabel: string
  isProjectView: boolean
}

export function InventoryModals({
  modal,
  onSetModal,
  locationOptions,
  activeFolderId,
  activeLocationLabel,
  isProjectView,
}: InventoryModalsProps) {
  const deleteItem = useDeleteItem()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const handleDelete = async () => {
    if (modal.type !== 'deleteItem') return
    const itemName = modal.item.name
    let deleteFailed = false
    try {
      await deleteItem.mutateAsync(modal.item.id)
    } catch (err) {
      console.warn('Delete response error (item may still have been deleted):', err)
      deleteFailed = true
    }
    await queryClient.invalidateQueries({ queryKey: sortlyKeys.items() })
    onSetModal({ type: 'none' })
    if (deleteFailed) {
      toast(`Failed to delete "${itemName}"`, 'error')
    } else {
      toast(`"${itemName}" deleted`)
    }
  }

  return (
    <>
      {modal.type === 'adjustQty' && (
        <AdjustQuantityModal item={modal.item} onClose={() => onSetModal({ type: 'none' })} />
      )}
      {modal.type === 'editItem' && (
        <EditItemModal item={modal.item} onClose={() => onSetModal({ type: 'none' })} />
      )}
      {modal.type === 'addItem' && (
        <AddItemModal
          locationOptions={locationOptions}
          defaultLocationId={activeFolderId}
          activeLocationLabel={activeLocationLabel}
          isProjectView={isProjectView}
          onClose={() => onSetModal({ type: 'none' })}
        />
      )}
      <ConfirmDialog
        open={modal.type === 'deleteItem'}
        title="Delete item"
        description={
          modal.type === 'deleteItem' ? (
            <>
              Are you sure you want to delete <b>{modal.item.name}</b>? This will remove the item from Sortly and cannot be undone.
            </>
          ) : ''
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteItem.isPending}
        onCancel={() => onSetModal({ type: 'none' })}
        onConfirm={handleDelete}
      />
    </>
  )
}
