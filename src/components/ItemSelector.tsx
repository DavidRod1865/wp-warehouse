import { useState, useEffect } from "react";
import { sortlyClient } from "../lib/sortly";
import type { SortlyItem } from "../types/sortly";
import { getBrand, getPartNumber } from "../utils/sortlyHelpers";

interface ItemSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  fromLocationId: number;
  onAddItems: (
    items: Array<{
      sortly_item_id: number;
      item_name: string;
      quantity: number;
      available_quantity: number;
      location: string;
      custom_attribute_values?: Array<{
        custom_attribute_id: number;
        custom_attribute_name: string;
        value: string;
      }>;
    }>
  ) => void;
  excludeItemIds: number[];
  hasProject: boolean;
}

export default function ItemSelector({
  isOpen,
  onClose,
  fromLocationId,
  onAddItems,
  excludeItemIds,
  hasProject,
}: ItemSelectorProps) {
  const [allItems, setAllItems] = useState<SortlyItem[]>([]);
  const [currentFolderId, setCurrentFolderId] =
    useState<number>(fromLocationId);
  const [displayItems, setDisplayItems] = useState<SortlyItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInRootFolder, setSearchInRootFolder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState<
    Array<{ id: number; name: string }>
  >([]);

  useEffect(() => {
    if (isOpen) {
      loadAllItems();
      setSearchInRootFolder(false);
    }
  }, [isOpen, fromLocationId]);

  useEffect(() => {
    if (allItems.length > 0) {
      filterItems();
    }
  }, [currentFolderId, searchQuery, allItems, searchInRootFolder]);

  const loadAllItems = async () => {
    setLoading(true);
    try {
      const fetchedItems: SortlyItem[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await sortlyClient.listItems({ per_page: 100, page });
        if (response.data && response.data.length > 0) {
          fetchedItems.push(...response.data);
          hasMore = response.data.length === 100;
          page++;
        } else {
          hasMore = false;
        }
      }

      setAllItems(fetchedItems);

      // Set initial breadcrumb
      const rootFolder = fetchedItems.find(
        (item) => item.id === fromLocationId
      );
      if (rootFolder) {
        setBreadcrumbs([{ id: rootFolder.id, name: rootFolder.name }]);
      }
      setCurrentFolderId(fromLocationId);
    } catch (error) {
      console.error("Error loading items:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterItems = () => {
    let filtered = allItems;

    if (searchQuery) {
      // Search mode: show all matching items
      if (hasProject && !searchInRootFolder) {
        // If project selected and not searching root, only search within project folders
        const projectItems = getAllItemsInFolder(fromLocationId);
        filtered = projectItems.filter(
          (item) =>
            item.type !== "folder" &&
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !excludeItemIds.includes(item.id)
        );
      } else {
        // Search all items
        filtered = allItems.filter(
          (item) =>
            item.type !== "folder" &&
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !excludeItemIds.includes(item.id)
        );
      }
    } else {
      // Browse mode: show items in current folder
      filtered = allItems.filter((item) => item.parent_id === currentFolderId);
    }

    setDisplayItems(filtered);
  };

  // Get all items recursively within a folder
  const getAllItemsInFolder = (folderId: number): SortlyItem[] => {
    const result: SortlyItem[] = [];
    const directChildren = allItems.filter(
      (item) => item.parent_id === folderId
    );

    directChildren.forEach((child) => {
      result.push(child);
      if (child.type === "folder") {
        result.push(...getAllItemsInFolder(child.id));
      }
    });

    return result;
  };

  const buildBreadcrumb = (folderId: number): string => {
    const path: string[] = [];
    let currentId: number | null | undefined = folderId;

    while (currentId) {
      const folder = allItems.find((item) => item.id === currentId);
      if (folder) {
        path.unshift(folder.name);
        currentId = folder.parent_id;
      } else {
        break;
      }
    }

    return path.join(" > ");
  };

  const navigateToFolder = (folderId: number, folderName: string) => {
    setCurrentFolderId(folderId);
    setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
    setSearchQuery(""); // Clear search when navigating
  };

  const navigateToBreadcrumb = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
    setSearchQuery("");
  };

  const toggleItemSelection = (itemId: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleAddSelected = () => {
    const itemsToAdd = Array.from(selectedItems).map((itemId) => {
      const item = allItems.find((i) => i.id === itemId)!;
      return {
        sortly_item_id: item.id,
        item_name: item.name,
        quantity: 0,
        available_quantity: item.quantity || 0,
        location: buildBreadcrumb(item.parent_id || fromLocationId),
        custom_attribute_values: item.custom_attribute_values,
      };
    });

    onAddItems(itemsToAdd);
    setSelectedItems(new Set());
    onClose();
  };

  const folders = displayItems.filter((item) => item.type === "folder");
  const items = displayItems.filter((item) => item.type !== "folder");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Select Items</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>

          {/* Search with Root Folder Option */}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search items by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            {hasProject && searchQuery && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={searchInRootFolder}
                  onChange={(e) => setSearchInRootFolder(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-gray-700">
                  Search in all folders (not just project folders)
                </span>
              </label>
            )}
          </div>

          {/* Breadcrumbs (only show when not searching) */}
          {!searchQuery && (
            <nav className="flex mt-3" aria-label="Breadcrumb">
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
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading items...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Folders */}
              {!searchQuery && folders.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    📁 Folders
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => navigateToFolder(folder.id, folder.name)}
                        className="p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📁</span>
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {folder.name}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Items */}
              {items.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    📦 Items ({items.length}){" "}
                    {selectedItems.size > 0 &&
                      `- ${selectedItems.size} selected`}
                  </h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="w-12 px-4 py-3"></th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Item Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Brand
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Part #
                          </th>
                          {searchQuery && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Location
                            </th>
                          )}
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Available Qty
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {items.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => toggleItemSelection(item.id)}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedItems.has(item.id)}
                                onChange={() => toggleItemSelection(item.id)}
                                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {item.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {getBrand(item) || "-"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {getPartNumber(item) || "-"}
                            </td>
                            {searchQuery && (
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {buildBreadcrumb(
                                  item.parent_id || fromLocationId
                                )}
                              </td>
                            )}
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {item.quantity || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  {searchQuery
                    ? "No items found matching your search"
                    : "No items in this folder"}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            {selectedItems.size} item{selectedItems.size !== 1 ? "s" : ""}{" "}
            selected
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSelected}
              disabled={selectedItems.size === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Add Selected Items
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
