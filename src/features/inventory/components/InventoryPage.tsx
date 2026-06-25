/**
 * InventoryPage — Browse Sortly inventory with folder-scoped fetching.
 *
 * Supports Warehouse / Trucks view toggle, location & project filters,
 * client-side search, and stock-status saved views.
 *
 * Refactored to use sub-components:
 * - InventoryHeader: Title and view toggle
 * - InventorySummaryStrip: Summary stats and sync status
 * - InventoryFilterBar: Location/project filters
 * - InventorySearchBar: Search and stock filters
 * - InventoryTable: Paginated table with actions
 * - InventoryModals: Modal dialogs for item operations
 */
import { useState, useEffect } from 'react'
import { useInventoryData } from '../hooks/useInventoryData'
import { useReceivedDates } from '../hooks/useReceivedDates'
import { useFolderSyncStatus } from '../hooks/useFolderSyncStatus'
import { InventoryHeader } from './InventoryHeader'
import { InventorySummaryStrip } from './InventorySummaryStrip'
import { InventoryFilterBar } from './InventoryFilterBar'
import { InventorySearchBar } from './InventorySearchBar'
import { InventoryTable } from './InventoryTable'
import { InventoryModals, type ModalState } from './InventoryModals'

export default function InventoryPage() {
  const inv = useInventoryData()
  const [currentPage, setCurrentPage] = useState(1)
  const [modal, setModal] = useState<ModalState>({ type: 'none' })

  const isProjectView = !!inv.selectedProjectId
  const receivedDates = useReceivedDates(inv.activeProject?.name ?? null)

  // Reset page when filters change
  const filteredCount = inv.filteredItems.length
  useEffect(() => {
    setCurrentPage(1)
  }, [filteredCount])

  const folderSync = useFolderSyncStatus(inv.activeFolderId)

  const noData = !inv.hasActiveFilter

  return (
    <div className="p-6 max-w-[1600px]">
      {/* Header */}
      <InventoryHeader
        activeLocationLabel={inv.activeLocationLabel}
        viewMode={inv.viewMode}
        onSetViewMode={inv.setViewMode}
        summaryStats={inv.summaryStats}
        noData={noData}
      />

      {/* Summary Strip */}
      <InventorySummaryStrip
        summaryStats={inv.summaryStats}
        noData={noData}
        folderSync={folderSync}
        hasFolder={!!inv.activeFolderId}
        onRefresh={folderSync.refresh}
      />

      {/* Filter Bar */}
      <InventoryFilterBar
        viewMode={inv.viewMode}
        selectedLocationId={inv.selectedLocationId}
        locationOptions={inv.locationOptions}
        onSetSelectedLocationId={inv.setSelectedLocationId}
        selectedProjectId={inv.selectedProjectId}
        projectOptions={inv.projectOptions}
        onSetSelectedProjectId={inv.setSelectedProjectId}
        activeProject={inv.activeProject}
        projectSubView={inv.projectSubView}
        onSetProjectSubView={inv.setProjectSubView}
        hasActiveFilter={inv.hasActiveFilter}
        onReset={() => inv.setViewMode('warehouse')}
        filteredItemsCount={filteredCount}
        totalSkusCount={inv.summaryStats.totalSkus}
      />

      {/* Search + Stock Filters */}
      <InventorySearchBar
        searchQuery={inv.searchQuery}
        onSetSearchQuery={inv.setSearchQuery}
        stockFilter={inv.stockFilter}
        onSetStockFilter={inv.setStockFilter}
        summaryStats={inv.summaryStats}
        hasActiveFolderId={!!inv.activeFolderId}
        onAddItem={() => setModal({ type: 'addItem' })}
      />

      {/* Table */}
      <InventoryTable
        hasActiveFilter={inv.hasActiveFilter}
        viewMode={inv.viewMode}
        activeLocationLabel={inv.activeLocationLabel}
        isLoading={inv.isLoading}
        filteredItems={inv.filteredItems}
        searchQuery={inv.searchQuery}
        isProjectView={isProjectView}
        receivedDates={receivedDates}
        currentPage={currentPage}
        onSetCurrentPage={setCurrentPage}
        onEditQuantity={(item) => setModal({ type: 'adjustQty', item })}
        onEditItem={(item) => setModal({ type: 'editItem', item })}
        onDelete={(item) => setModal({ type: 'deleteItem', item })}
      />

      {/* Modals */}
      <InventoryModals
        modal={modal}
        onSetModal={setModal}
        locationOptions={inv.locationOptions}
        activeFolderId={inv.activeFolderId}
        activeLocationLabel={inv.activeLocationLabel}
        isProjectView={isProjectView}
      />
    </div>
  )
}
