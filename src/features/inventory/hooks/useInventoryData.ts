import { useState, useMemo } from 'react'
import { useAppConfig } from '../../../hooks/useAppConfig'
import { useItems } from './useItems'
import { useSearchItems } from './useSearchItems'
import { useFolders, useSubfolders } from './useFolders'
import { useActiveProjects } from './useActiveProjects'
import type { SortlyItem } from '../../../types/sortly'

export type ViewMode = 'warehouse' | 'trucks'
export type StockFilter = 'all' | 'low' | 'zero' | 'ok'
export type ProjectSubView = 'warehouse' | 'jobsite'

export interface EnrichedItem extends SortlyItem {
  stockStatus: 'ok' | 'low' | 'zero'
  location: string
}

export interface LocationOption {
  id: number
  name: string
}

function enrichItems(items: SortlyItem[], folderNames: Map<number, string>): EnrichedItem[] {
  return items
    .filter((item) => item.type !== 'folder')
    .map((item) => {
      const qty = item.quantity ?? 0
      const reorder = item.min_quantity ?? 0
      const status: 'ok' | 'low' | 'zero' =
        qty === 0 ? 'zero' : reorder > 0 && qty < reorder ? 'low' : 'ok'
      const location = item.parent_id ? folderNames.get(item.parent_id) || '—' : '—'
      return { ...item, stockStatus: status, location }
    })
}

export function useInventoryData() {
  const { data: appConfig, isLoading: configLoading } = useAppConfig()
  const { data: allFolders = [] } = useFolders()
  const { data: projects = [] } = useActiveProjects()

  // Filter state
  const [viewMode, setViewMode] = useState<ViewMode>('warehouse')
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [projectSubView, setProjectSubView] = useState<ProjectSubView>('warehouse')
  const [searchQuery, setSearchQuery] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')

  const mainWarehouseFolderId = appConfig?.mainWarehouseFolderId ?? null
  const deliveryTrucksFolderId = appConfig?.deliveryTrucksFolderId ?? null

  // Warehouse subfolders (locations within the warehouse)
  const { data: warehouseSubfolders = [] } = useSubfolders(mainWarehouseFolderId)

  // Truck subfolders
  const { data: truckSubfolders = [] } = useSubfolders(deliveryTrucksFolderId)

  // Determine which folder to fetch items from
  // Returns null when no filter is active — useItems won't fire
  const activeFolderId = useMemo(() => {
    if (viewMode === 'trucks') {
      return selectedLocationId // null until a truck is picked
    }

    // Project mode — resolve to project's Sortly folder
    if (selectedProjectId) {
      const project = projects.find((p) => p.id === selectedProjectId)
      if (project) {
        return projectSubView === 'jobsite'
          ? project.sortly_jobsite_folder_id ?? null
          : project.sortly_warehouse_folder_id ?? null
      }
    }

    // Warehouse mode — only fetch when a specific location is picked
    return selectedLocationId ?? null
  }, [viewMode, selectedLocationId, selectedProjectId, projectSubView, projects])

  // Fetch items for the active folder
  const { data: rawItems = [], isLoading: itemsLoading } = useItems(activeFolderId)

  // Server-side search across warehouse when no folder is selected
  const isGlobalSearch = !activeFolderId && searchQuery.length >= 2 && viewMode === 'warehouse'
  const searchFolderIds = useMemo(
    () => {
      const ids = warehouseSubfolders.map((f) => f.id)
      if (mainWarehouseFolderId) ids.push(mainWarehouseFolderId)
      return ids.length > 0 ? ids : undefined
    },
    [mainWarehouseFolderId, warehouseSubfolders]
  )
  const { data: searchResponse, isLoading: searchLoading } = useSearchItems(
    isGlobalSearch ? searchQuery : '',
    searchFolderIds
  )
  const searchItems = useMemo(
    () => (isGlobalSearch && searchResponse?.data ? searchResponse.data : []),
    [isGlobalSearch, searchResponse]
  )

  // Use search results when doing global search, folder items otherwise
  const sourceItems = isGlobalSearch ? searchItems : rawItems

  // Folder name lookup
  const folderNames = useMemo(() => {
    const map = new Map<number, string>()
    for (const f of [...allFolders, ...warehouseSubfolders, ...truckSubfolders]) {
      map.set(f.id, f.name)
    }
    return map
  }, [allFolders, warehouseSubfolders, truckSubfolders])

  // Enrich items with stock status
  const enriched = useMemo(() => enrichItems(sourceItems, folderNames), [sourceItems, folderNames])

  // Summary stats (from full scoped set, before client-side filters)
  const totalSkus = enriched.length
  const lowCount = enriched.filter((i) => i.stockStatus === 'low').length
  const zeroCount = enriched.filter((i) => i.stockStatus === 'zero').length

  // Client-side filtering (search + stock status)
  // Skip client-side name filter when doing global search (Sortly already filtered)
  const filteredItems = useMemo(() => {
    let items = enriched

    if (!isGlobalSearch && searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.sid && i.sid.toLowerCase().includes(q)) ||
          i.custom_attribute_values?.some(
            (a) => a.value && a.value.toLowerCase().includes(q)
          )
      )
    }

    if (stockFilter !== 'all') {
      items = items.filter((i) => i.stockStatus === stockFilter)
    }

    return items
  }, [enriched, searchQuery, stockFilter, isGlobalSearch])

  // Location options for dropdowns
  const locationOptions: LocationOption[] = useMemo(() => {
    if (viewMode === 'trucks') {
      return truckSubfolders.map((f) => ({ id: f.id, name: f.name }))
    }
    return warehouseSubfolders.map((f) => ({ id: f.id, name: f.name }))
  }, [viewMode, warehouseSubfolders, truckSubfolders])

  // Projects that have at least one Sortly folder
  const projectOptions = useMemo(
    () => projects.filter((p) => p.sortly_warehouse_folder_id || p.sortly_jobsite_folder_id),
    [projects]
  )

  // Active project object (for sub-toggle visibility)
  const activeProject = useMemo(
    () => (selectedProjectId ? projects.find((p) => p.id === selectedProjectId) ?? null : null),
    [selectedProjectId, projects]
  )

  // Build the page title
  const activeLocationLabel = useMemo(() => {
    if (activeProject) {
      const suffix = projectSubView === 'jobsite' ? 'Job Site' : 'Warehouse'
      return `${activeProject.name} — ${suffix}`
    }
    if (viewMode === 'trucks') {
      if (selectedLocationId) {
        const name = folderNames.get(selectedLocationId) || 'Truck'
        return `Trucks — ${name}`
      }
      return 'Trucks'
    }
    if (selectedLocationId) {
      const name = folderNames.get(selectedLocationId) || 'Location'
      return `Main Warehouse — ${name}`
    }
    if (isGlobalSearch) {
      return 'Search results'
    }
    return 'Inventory'
  }, [viewMode, selectedLocationId, activeProject, projectSubView, folderNames])

  // Handlers that manage filter interactions
  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode)
    setSelectedLocationId(null)
    setSelectedProjectId(null)
    setProjectSubView('warehouse')
    setSearchQuery('')
    setStockFilter('all')
  }

  function handleProjectChange(projectId: number | null) {
    setSelectedProjectId(projectId)
    setSelectedLocationId(null)
    setProjectSubView('warehouse')
  }

  function handleLocationChange(locationId: number | null) {
    setSelectedLocationId(locationId)
    if (viewMode === 'warehouse') {
      setSelectedProjectId(null)
      setProjectSubView('warehouse')
    }
  }

  // Whether the user has picked a filter that triggers data fetching
  const hasActiveFilter = activeFolderId !== null || isGlobalSearch

  return {
    // Data
    items: enriched,
    filteredItems,
    summaryStats: { totalSkus, lowCount, zeroCount },
    isLoading: configLoading || itemsLoading || (isGlobalSearch && searchLoading),
    hasActiveFilter,

    // Filter state
    viewMode,
    selectedLocationId,
    selectedProjectId,
    projectSubView,
    searchQuery,
    stockFilter,

    // Filter setters
    setViewMode: handleViewModeChange,
    setSelectedLocationId: handleLocationChange,
    setSelectedProjectId: handleProjectChange,
    setProjectSubView,
    setSearchQuery,
    setStockFilter,

    // Dropdown options
    locationOptions,
    projectOptions,
    activeProject,
    activeLocationLabel,

    // Active folder (for adding items)
    activeFolderId,
  }
}
