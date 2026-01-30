import { useState, useEffect } from "react";
import { sortlyClient } from "../lib/sortly";
import type { SortlyItem } from "../types/sortly";
import { getBrand, getPartNumber } from "../utils/sortlyHelpers";
import { deleteItem, updateItem } from "../services/sortlyApi";
import { inventoryCache } from "../services/inventoryCache";
import ItemFormModal from "../components/ItemFormModal";
import DeleteConfirmDialog from "../components/DeleteConfirmDialog";

export default function WarehouseInventory() {
  const [items, setItems] = useState<SortlyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<
    Array<{ id: number | null; name: string }>
  >([{ id: null, name: "Root" }]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [cacheExpiry, setCacheExpiry] = useState<number>(0);

  // CRUD state
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<SortlyItem | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<SortlyItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Auto-refresh state - only refresh when cache expires
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadFolderItems();
  }, [currentFolderId]);

  // Auto-refresh effect - only refresh when cache expires
  useEffect(() => {
    if (autoRefresh && cacheExpiry > 0) {
      // Set timer to refresh when cache expires
      const timeout = setTimeout(() => {
        console.log('Cache expired, auto-refreshing...');
        loadFolderItems(true);
      }, cacheExpiry * 1000);

      return () => clearTimeout(timeout);
    }
  }, [autoRefresh, cacheExpiry]);

  // Update cache expiry counter every second
  useEffect(() => {
    if (cacheExpiry > 0) {
      const interval = setInterval(() => {
        const remaining = inventoryCache.getTimeUntilExpiry(currentFolderId);
        setCacheExpiry(remaining);
        if (remaining === 0 && autoRefresh) {
          loadFolderItems(true);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [cacheExpiry, currentFolderId, autoRefresh]);

  const loadFolderItems = async (forceRefresh: boolean = false) => {
    setLoading(true);
    if (!inventoryCache.isValid(currentFolderId)) {
      setInitialLoading(true);
    }
    setError("");

    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = inventoryCache.get(currentFolderId);
        if (cached) {
          console.log(`✓ Using cached data for folder ${currentFolderId}`);
          setItems(cached);
          setLastUpdated(inventoryCache.getTimestamp(currentFolderId) || new Date());
          setCacheExpiry(inventoryCache.getTimeUntilExpiry(currentFolderId));
          setLoading(false);
          setInitialLoading(false);
          return;
        }
      }

      // Fetch from API if cache miss or force refresh
      console.log(`Fetching items from API for folder ${currentFolderId}...`);
      const fetchedItems: SortlyItem[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await sortlyClient.listItems({
          parent_id: currentFolderId === null ? undefined : currentFolderId,
          per_page: 100,
          page
        });

        if (response.data && response.data.length > 0) {
          fetchedItems.push(...response.data);
          hasMore = response.data.length === 100;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Filter to only items in this folder
      const folderItems = fetchedItems.filter((item) => {
        if (currentFolderId === null) {
          return item.parent_id === null || item.parent_id === undefined;
        } else {
          return item.parent_id === currentFolderId;
        }
      });

      console.log(`✓ Loaded ${folderItems.length} items for folder ${currentFolderId}`);

      // Update cache
      inventoryCache.set(currentFolderId, folderItems);
      setItems(folderItems);
      setLastUpdated(new Date());
      setCacheExpiry(inventoryCache.getTimeUntilExpiry(currentFolderId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch items");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const navigateToFolder = (folderId: number, folderName: string) => {
    setCurrentFolderId(folderId);
    setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
  };

  // CRUD handlers
  const handleItemClick = (item: SortlyItem) => {
    setEditingItem(item);
    setShowItemForm(true);
  };

  const handleDeleteFromModal = () => {
    if (editingItem) {
      setShowItemForm(false);
      setItemToDelete(editingItem);
      setShowDeleteDialog(true);
    }
  };

  const handleSaveItem = async (itemData: Partial<SortlyItem>) => {
    setActionLoading(true);
    setActionError("");
    setActionSuccess("");

    try {
      if (editingItem) {
        // Update on server
        const updatedItem = await updateItem(editingItem.id, itemData);
        setActionSuccess(`Updated "${itemData.name || editingItem.name}"`);

        // Update cache immediately
        inventoryCache.updateItem(editingItem.id, updatedItem);

        // Refresh local state from cache
        const cached = inventoryCache.get(currentFolderId);
        if (cached) {
          setItems(cached);
        }
      } else {
        // Create new item
        const newItem = await sortlyClient.createItem({
          name: itemData.name!,
          quantity: itemData.quantity || 0,
          parent_id: currentFolderId!,
        });

        // Add other fields via updateItem if needed
        let finalItem = newItem.data;
        const updateData: Partial<SortlyItem> = {};
        if (itemData.sid) updateData.sid = itemData.sid;
        if (itemData.price) updateData.price = itemData.price;
        if (itemData.notes) updateData.notes = itemData.notes;
        if (itemData.tags) updateData.tags = itemData.tags;

        if (Object.keys(updateData).length > 0) {
          finalItem = await updateItem(newItem.data.id, updateData);
        }

        setActionSuccess(`Created "${itemData.name}"`);

        // Add to cache immediately
        inventoryCache.addItem(currentFolderId, finalItem);

        // Refresh local state from cache
        const cached = inventoryCache.get(currentFolderId);
        if (cached) {
          setItems(cached);
        }
      }

      // Close modal
      setShowItemForm(false);
      setEditingItem(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save item");
      // Refresh from API on error to ensure consistency
      await loadFolderItems(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    setActionLoading(true);
    setActionError("");

    try {
      // Delete on server
      await deleteItem(itemToDelete.id);
      setActionSuccess(`Deleted "${itemToDelete.name}"`);

      // Remove from cache immediately
      inventoryCache.removeItem(itemToDelete.id);

      // Refresh local state from cache
      const cached = inventoryCache.get(currentFolderId);
      if (cached) {
        setItems(cached);
      }

      // Close dialog
      setShowDeleteDialog(false);
      setItemToDelete(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete item");
      // Refresh from API on error to ensure consistency
      await loadFolderItems(true);
    } finally {
      setActionLoading(false);
    }
  };

  const folders = items.filter((item) => item.type === "folder");
  const inventoryItems = items.filter((item) => item.type !== "folder");

  // Show items only if there are no folders
  const showItems = inventoryItems.length > 0 && folders.length === 0;
  const showFolders = folders.length > 0;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Warehouse Inventory
              </h1>
              {!initialLoading && (
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-xs text-gray-500">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </p>
                  {cacheExpiry > 0 && (
                    <p className="text-xs text-gray-500">
                      • Cache expires in: {Math.floor(cacheExpiry / 60)}m {cacheExpiry % 60}s
                    </p>
                  )}
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="rounded"
                    />
                    Auto-refresh when cache expires
                  </label>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {currentFolderId !== null && !initialLoading && (
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setShowItemForm(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  + Add Item
                </button>
              )}
              {!initialLoading && (
                <button
                  onClick={() => loadFolderItems(true)}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span>🔄</span>
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              )}
              <button
                onClick={() => window.history.back()}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <nav className="flex mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            {breadcrumbs.map((crumb, index) => (
              <li key={index} className="flex items-center">
                {index > 0 && <span className="mx-2 text-gray-400">/</span>}
                <button
                  onClick={() => navigateToBreadcrumb(index)}
                  className={`text-sm font-medium ${
                    index === breadcrumbs.length - 1
                      ? "text-gray-900"
                      : "text-blue-600 hover:text-blue-800"
                  }`}
                >
                  {crumb.name}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {actionSuccess && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex justify-between items-center">
            <span>{actionSuccess}</span>
            <button
              onClick={() => setActionSuccess("")}
              className="text-green-600 hover:text-green-800 font-bold text-xl"
            >
              ×
            </button>
          </div>
        )}

        {actionError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex justify-between items-center">
            <span>{actionError}</span>
            <button
              onClick={() => setActionError("")}
              className="text-red-600 hover:text-red-800 font-bold text-xl"
            >
              ×
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading && initialLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">
              Loading inventory (this may take a moment)...
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Subsequent navigation will be instant
            </p>
          </div>
        ) : (
          <>
            {/* Folders Table */}
            {showFolders && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-[400px] divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Folder Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {folders.map((folder) => (
                        <tr
                          key={folder.id}
                          onClick={() =>
                            navigateToFolder(folder.id, folder.name)
                          }
                          className="hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-xl mr-3">📁</span>
                              <span className="text-sm font-medium text-gray-900">
                                {folder.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-500">Folder</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Items Table */}
            {showItems && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Items ({inventoryItems.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[1000px] divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Photo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Item Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Brand
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Part Number
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Barcode
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date Received
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {items.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          className="hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.photos && item.photos.length > 0 ? (
                              <img
                                src={item.photos[0].url}
                                alt={item.name}
                                className="h-12 w-12 object-cover rounded"
                              />
                            ) : (
                              <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center">
                                <span className="text-gray-400 text-xs">
                                  No photo
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {item.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {getBrand(item) || "-"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {getPartNumber(item) || "-"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {item.quantity || 0}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {item.sid || "-"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(() => {
                              // Try to extract Date Received from notes metadata
                              if (item.notes) {
                                const dateMatch = item.notes.match(
                                  /Date Received: ([^|\]]+)/
                                );
                                if (dateMatch) return dateMatch[1].trim();
                              }
                              // Fallback to custom attributes if available
                              const dateAttr =
                                item.custom_attribute_values?.find(
                                  (attr) =>
                                    attr.custom_attribute_name ===
                                    "Date Received"
                                );
                              return dateAttr?.value || (
                                <span className="text-gray-400">—</span>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-500 max-w-xs truncate">
                              {(() => {
                                // Remove metadata from notes display
                                if (item.notes) {
                                  const notesWithoutMetadata =
                                    item.notes.replace(/^\[.*?\]\n?/, "");
                                  return notesWithoutMetadata || "-";
                                }
                                return "-";
                              })()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!showFolders && !showItems && (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500">
                  No items or folders found in this location
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Item Form Modal */}
      <ItemFormModal
        isOpen={showItemForm}
        onClose={() => {
          setShowItemForm(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
        onDelete={editingItem ? handleDeleteFromModal : undefined}
        editItem={editingItem}
        parentFolderId={currentFolderId}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        item={itemToDelete}
        loading={actionLoading}
      />
    </div>
  );
}
