import { useState, useEffect, useRef } from "react";
import { sortlyClient } from "../lib/sortly";
import type { SortlyItem } from "../types/sortly";
import { getBrand, getPartNumber } from "../utils/sortlyHelpers";

export default function WarehouseInventory() {
  const [items, setItems] = useState<SortlyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<
    Array<{ id: number | null; name: string }>
  >([{ id: null, name: "Root" }]);
  const lastUpdated = useRef<Date>(new Date());

  // Store all items once
  const allItems = useRef<SortlyItem[]>([]);
  const hasFetchedAll = useRef(false);

  useEffect(() => {
    if (!hasFetchedAll.current) {
      fetchAllItems();
    } else {
      filterItemsByFolder(currentFolderId);
    }
  }, [currentFolderId]);

  const fetchAllItems = async () => {
    setLoading(true);
    setInitialLoading(true);
    setError("");

    try {
      const allFetchedItems: SortlyItem[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await sortlyClient.listItems({ per_page: 100, page });

        if (response.data && response.data.length > 0) {
          allFetchedItems.push(...response.data);
          hasMore = response.data.length === 100;
          page++;
          console.log(
            `Fetched page ${page - 1}: ${
              allFetchedItems.length
            } total items so far...`
          );
        } else {
          hasMore = false;
        }
      }

      console.log(`✓ Loaded all ${allFetchedItems.length} items into memory`);
      allItems.current = allFetchedItems;
      hasFetchedAll.current = true;
      lastUpdated.current = new Date(); // Add this line

      // Now filter for current folder
      filterItemsByFolder(currentFolderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch items");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const filterItemsByFolder = (folderId: number | null) => {
    console.log(`Filtering items for folder ${folderId}...`);

    const filteredItems = allItems.current.filter((item) => {
      if (folderId === null) {
        return item.parent_id === null || item.parent_id === undefined;
      } else {
        return item.parent_id === folderId;
      }
    });

    console.log(`Found ${filteredItems.length} items in folder ${folderId}`);
    setItems(filteredItems);
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

  const folders = items.filter((item) => item.type === "folder");
  const inventoryItems = items.filter((item) => item.type !== "folder");

  // Show items only if there are no folders
  const showItems = inventoryItems.length > 0 && folders.length === 0;
  const showFolders = folders.length > 0;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Warehouse Inventory
              </h1>
              {hasFetchedAll.current && (
                <p className="text-xs text-gray-500 mt-1">
                  Last updated: {new Date().toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {hasFetchedAll.current && (
                <button
                  onClick={() => {
                    hasFetchedAll.current = false;
                    setCurrentFolderId(null);
                    setBreadcrumbs([{ id: null, name: "Root" }]);
                    fetchAllItems();
                  }}
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <table className="min-w-full divide-y divide-gray-200">
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
                        onClick={() => navigateToFolder(folder.id, folder.name)}
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
            )}

            {/* Items Table */}
            {showItems && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Items ({inventoryItems.length})
                  </h2>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
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
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
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
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500 max-w-xs truncate">
                            {item.notes || "-"}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
    </div>
  );
}
