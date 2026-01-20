import type { SortlyItem, SortlyApiResponse } from '../types/sortly';

import { cacheService } from './cache';

const API_BASE_URL = 'https://api.sortly.com/api/v1';

/**
 * Get the secret key from environment variables
 * Sortly API uses OAuth 2.0 with the secret key as Bearer token
 */
function getSecretKey(): string {
  const secretKey = import.meta.env.VITE_SORTLY_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      'Sortly API secret key not found. Please set VITE_SORTLY_SECRET_KEY in your .env file and restart the dev server.'
    );
  }

  return secretKey;
}

/**
 * Fetch a single page of items from Sortly API with caching
 */
async function fetchPage(url: string, authHeader: string, useCache: boolean = true): Promise<SortlyApiResponse> {
  // Check cache first
  if (useCache) {
    const cached = cacheService.get<SortlyApiResponse>(url);
    if (cached) {
      return cached;
    }
  }

  const requestHeaders = {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const response = await fetch(url, {
    method: 'GET',
    headers: requestHeaders,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Sortly API error: ${response.status} ${response.statusText}. ${errorText}`
    );
  }

  const data: SortlyApiResponse = await response.json();
  
  // Cache the response
  if (useCache) {
    cacheService.set(url, data);
  }
  
  return data;
}

/**
 * Fetch all folders from Sortly API (not just root folders)
 */
export async function fetchAllFolders(useCache: boolean = true): Promise<SortlyItem[]> {
  try {
    const secretKey = getSecretKey().trim();
    const authHeader = `Bearer ${secretKey}`;

    let url = `${API_BASE_URL}/items`;
    const params = new URLSearchParams();
    params.append('type', 'folder');
    params.append('per_page', '100');
    url += `?${params.toString()}`;

    const allItems: SortlyItem[] = [];
    let currentUrl: string | null = url;
    let pageCount = 0;
    const maxPages = 50;

    while (currentUrl && pageCount < maxPages) {
      const data: SortlyApiResponse = await fetchPage(
        currentUrl,
        authHeader,
        useCache
      );
      
      if (data.data) {
        // Get all folders (not just root ones)
        const folders = data.data.filter(item => item.type === 'folder');
        allItems.push(...folders);
      }

      const pagination = data.meta?.pagination;
      let nextPageUrl = pagination?.next_page_url;
      if (nextPageUrl) {
        if (nextPageUrl.startsWith('/')) {
          nextPageUrl = `${API_BASE_URL}${nextPageUrl}`;
        } else if (!nextPageUrl.startsWith('http')) {
          nextPageUrl = `${API_BASE_URL}/${nextPageUrl}`;
        }
        currentUrl = nextPageUrl;
        pageCount++;
      } else {
        currentUrl = null;
      }
    }

    return allItems;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch folders from Sortly API');
  }
}

/**
 * Fetch only root folders (folders with no parent_id) from Sortly API
 * @deprecated Use fetchAllFolders() instead
 */
export async function fetchFolders(): Promise<SortlyItem[]> {
  const allFolders = await fetchAllFolders();
  return allFolders.filter(
    folder => folder.parent_id === null || folder.parent_id === undefined
  );
}

/**
 * Fetch subfolders in a folder
 * @param folderId Folder ID to fetch subfolders from
 */
export async function fetchSubfolders(
  folderId: number,
  useCache: boolean = true
): Promise<SortlyItem[]> {
  try {
    const secretKey = getSecretKey().trim();
    const authHeader = `Bearer ${secretKey}`;

    let url = `${API_BASE_URL}/items`;
    const params = new URLSearchParams();
    params.append('folder_id', folderId.toString());
    params.append('type', 'folder');
    params.append('per_page', '100');
    url += `?${params.toString()}`;

    const allItems: SortlyItem[] = [];
    let currentUrl: string | null = url;
    let pageCount = 0;
    const maxPages = 50;

    while (currentUrl && pageCount < maxPages) {
      const data: SortlyApiResponse = await fetchPage(
        currentUrl,
        authHeader,
        useCache
      );
      
      if (data.data) {
        const filteredFolders = data.data.filter(item => 
          item.type === 'folder' && item.parent_id === folderId && item.id !== folderId
        );
        allItems.push(...filteredFolders);
      }

      const pagination = data.meta?.pagination;
      let nextPageUrl = pagination?.next_page_url;
      if (nextPageUrl) {
        if (nextPageUrl.startsWith('/')) {
          nextPageUrl = `${API_BASE_URL}${nextPageUrl}`;
        } else if (!nextPageUrl.startsWith('http')) {
          nextPageUrl = `${API_BASE_URL}/${nextPageUrl}`;
        }
        currentUrl = nextPageUrl;
        pageCount++;
      } else {
        currentUrl = null;
      }
    }

    return allItems;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch subfolders from Sortly API');
  }
}

/**
 * Fetch folders and items in a folder with pagination support
 * @param folderId Folder ID to fetch items from
 * @param page Page number (1-indexed)
 * @param perPage Items per page (default 50)
 */
export async function fetchFolderItems(
  folderId: number,
  page: number = 1,
  perPage: number = 50
): Promise<{ items: SortlyItem[]; folders: SortlyItem[]; totalPages: number; totalCount: number }> {
  try {
    const secretKey = getSecretKey().trim();
    const authHeader = `Bearer ${secretKey}`;

    // Build URL - use folder_id parameter
    let url = `${API_BASE_URL}/items`;
    const params = new URLSearchParams();
    params.append('folder_id', folderId.toString());
    params.append('per_page', perPage.toString());
    params.append('page', page.toString());
    url += `?${params.toString()}`;

    const data: SortlyApiResponse = await fetchPage(url, authHeader);
    
    const pagination = data.meta?.pagination;
    const itemsOnPage = data.data?.length || 0;
    
    // Get total count - check both pagination.total_count and meta.total
    let totalCount = pagination?.total_count || data.meta?.total;
    
    // If we got a full page and there's a next_page_url, we know there are more items
    const hasNextPage = !!pagination?.next_page_url;
    const gotFullPage = itemsOnPage >= perPage;
    
    // Calculate totalPages - use API value if available
    let totalPages = pagination?.total_pages;
    
    // If API doesn't provide total_pages, try to infer it
    if (!totalPages) {
      if (totalCount && totalCount > 0) {
        // Calculate based on totalCount
        totalPages = Math.ceil(totalCount / perPage);
      } else if (gotFullPage && hasNextPage) {
        // We got a full page and there's a next page - assume at least 2 pages
        // We'll update this when we fetch more pages
        totalPages = 2;
      } else if (gotFullPage) {
        // Got a full page but no next_page_url - might be exactly one page or API issue
        // Assume at least 2 pages to be safe (user can navigate and we'll correct it)
        totalPages = 2;
      } else {
        // Less than a full page - this is the last page
        totalPages = page;
      }
    }
    
    // If we still don't have totalCount, estimate it
    if (!totalCount || totalCount < itemsOnPage) {
      if (gotFullPage && hasNextPage) {
        // At minimum, we have this page + at least one more
        totalCount = itemsOnPage + 1; // Will be updated when we fetch more
      } else {
        totalCount = itemsOnPage;
      }
    }

    // Filter to only include items with correct parent_id and exclude the current folder
    const allItems = (data.data || []).filter(item => 
      item.parent_id === folderId && item.id !== folderId
    );

    // Separate folders and items
    const folders = allItems.filter(item => item.type === 'folder');
    const items = allItems.filter(item => item.type === 'item');

    return {
      items,
      folders,
      totalPages,
      totalCount,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch folder items from Sortly API');
  }
}

/**
 * Search for items by name or SKU across ALL folders
 * Fetches all folders first, then searches items in each folder
 * @param searchQuery Search query string
 */
export async function searchItems(searchQuery: string): Promise<SortlyItem[]> {
  try {
    const secretKey = getSecretKey().trim();
    const authHeader = `Bearer ${secretKey}`;
    const queryLower = searchQuery.toLowerCase();
    const allMatchingItems: SortlyItem[] = [];

    // First, get all folders to search through each one
    const allFolders = await fetchAllFolders();
    
    // Also search root level (items with no parent_id)
    const foldersToSearch = [null, ...allFolders.map(f => f.id).filter((id): id is number => id !== undefined)];

    // Search function for a specific folder
    const searchInFolder = async (folderId: number | null): Promise<SortlyItem[]> => {
      const results: SortlyItem[] = [];
      let url = `${API_BASE_URL}/items`;
      const params = new URLSearchParams();
      params.append('type', 'item');
      params.append('per_page', '100');
      if (folderId !== null) {
        params.append('folder_id', folderId.toString());
      }
      url += `?${params.toString()}`;

      let currentUrl: string | null = url;
      let pageCount = 0;
      const maxPages = 50;

      while (currentUrl && pageCount < maxPages) {
        const data: SortlyApiResponse = await fetchPage(currentUrl, authHeader);
        
        if (data.data) {
          const matchingItems = data.data.filter(item => {
            if (item.type !== 'item') return false;
            
            // Match by name
            const nameMatch = item.name?.toLowerCase().includes(queryLower);
            
            // Match by SKU (sid field)
            const skuMatch = item.sid?.toLowerCase().includes(queryLower);
            
            // Also search in label_url and label_url_extra
            const labelMatch = item.label_url?.toLowerCase().includes(queryLower);
            const labelExtraMatch = item.label_url_extra?.toLowerCase().includes(queryLower);
            
            return nameMatch || skuMatch || labelMatch || labelExtraMatch;
          });
          results.push(...matchingItems);
        }

        const pagination = data.meta?.pagination;
        let nextPageUrl = pagination?.next_page_url;
        if (nextPageUrl) {
          if (nextPageUrl.startsWith('/')) {
            nextPageUrl = `${API_BASE_URL}${nextPageUrl}`;
          } else if (!nextPageUrl.startsWith('http')) {
            nextPageUrl = `${API_BASE_URL}/${nextPageUrl}`;
          }
          currentUrl = nextPageUrl;
          pageCount++;
        } else {
          currentUrl = null;
        }
      }

      return results;
    };

    // Search in all folders (including root) in parallel for better performance
    const searchPromises = foldersToSearch.map(folderId => 
      searchInFolder(folderId).catch(err => {
        // Continue searching other folders even if one fails
        console.error(`Error searching folder ${folderId}:`, err);
        return [] as SortlyItem[];
      })
    );

    // Wait for all searches to complete in parallel
    const allResults = await Promise.all(searchPromises);
    
    // Flatten all results
    allResults.forEach(results => {
      allMatchingItems.push(...results);
    });

    // Remove duplicates based on item ID
    const uniqueItems = Array.from(
      new Map(allMatchingItems.map(item => [item.id, item])).values()
    );

    return uniqueItems;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to search items from Sortly API');
  }
}

/**
 * Fetch all items from Sortly API with pagination support
 * Fetches items from all folders across the entire system
 * @param folderId Optional folder ID to fetch items within a specific folder
 */
export async function fetchAllItems(folderId?: number): Promise<SortlyItem[]> {
  try {
    const secretKey = getSecretKey().trim(); // Trim any whitespace
    const authHeader = `Bearer ${secretKey}`;

    // If folderId is provided, fetch only from that folder
    if (folderId) {
      let url = `${API_BASE_URL}/items`;
      const params = new URLSearchParams();
      params.append('folder_id', folderId.toString());
      params.append('type', 'item');
      params.append('per_page', '100');
      url += `?${params.toString()}`;

      const allItems: SortlyItem[] = [];
      let currentUrl: string | null = url;
      let pageCount = 0;
      const maxPages = 100;

      while (currentUrl && pageCount < maxPages) {
        const data: SortlyApiResponse = await fetchPage(currentUrl, authHeader);
        
        if (data.data) {
          const items = data.data.filter(item => item.type === 'item');
          allItems.push(...items);
        }

        const pagination = data.meta?.pagination;
        let nextPageUrl = pagination?.next_page_url;
        if (nextPageUrl) {
          if (nextPageUrl.startsWith('/')) {
            nextPageUrl = `${API_BASE_URL}${nextPageUrl}`;
          } else if (!nextPageUrl.startsWith('http')) {
            nextPageUrl = `${API_BASE_URL}/${nextPageUrl}`;
          }
          currentUrl = nextPageUrl;
          pageCount++;
        } else {
          currentUrl = null;
        }
      }

      return allItems;
    }

    // Fetch all items from all folders (no folderId specified)
    // First, get all folders to search through each one
    const allFolders = await fetchAllFolders();
    const foldersToSearch = [null, ...allFolders.map(f => f.id).filter((id): id is number => id !== undefined)];

    // Fetch function for a specific folder
    const fetchItemsFromFolder = async (folderId: number | null): Promise<SortlyItem[]> => {
      const results: SortlyItem[] = [];
      let url = `${API_BASE_URL}/items`;
      const params = new URLSearchParams();
      params.append('type', 'item');
      params.append('per_page', '100');
      if (folderId !== null) {
        params.append('folder_id', folderId.toString());
      }
      url += `?${params.toString()}`;

      let currentUrl: string | null = url;
      let pageCount = 0;
      const maxPages = 100;

      while (currentUrl && pageCount < maxPages) {
        const data: SortlyApiResponse = await fetchPage(currentUrl, authHeader);
        
        if (data.data) {
          const items = data.data.filter(item => item.type === 'item');
          results.push(...items);
        }

        const pagination = data.meta?.pagination;
        let nextPageUrl = pagination?.next_page_url;
        if (nextPageUrl) {
          if (nextPageUrl.startsWith('/')) {
            nextPageUrl = `${API_BASE_URL}${nextPageUrl}`;
          } else if (!nextPageUrl.startsWith('http')) {
            nextPageUrl = `${API_BASE_URL}/${nextPageUrl}`;
          }
          currentUrl = nextPageUrl;
          pageCount++;
        } else {
          currentUrl = null;
        }
      }

      return results;
    };

    // Fetch from all folders in parallel
    const fetchPromises = foldersToSearch.map(folderId => 
      fetchItemsFromFolder(folderId).catch(err => {
        console.error(`Error fetching items from folder ${folderId}:`, err);
        return [] as SortlyItem[];
      })
    );

    const allResults = await Promise.all(fetchPromises);
    const allItems: SortlyItem[] = [];
    allResults.forEach(results => {
      allItems.push(...results);
    });

    // Remove duplicates based on item ID
    const uniqueItems = Array.from(
      new Map(allItems.map(item => [item.id, item])).values()
    );

    return uniqueItems;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch items from Sortly API');
  }
}

/**
 * Move item with quantity using Sortly's move API
 * @param itemId Item ID to move
 * @param quantity Quantity to move
 * @param folderId Target folder ID (optional, moves to root if not specified)
 * @param leaveZeroQuantity Keep items with zero quantity (default: false)
 */
export async function moveItem(
  itemId: number, 
  quantity: number, 
  folderId?: number, 
  leaveZeroQuantity: boolean = false
): Promise<SortlyItem> {
  try {
    const secretKey = getSecretKey().trim();
    const authHeader = `Bearer ${secretKey}`;

    const url = `${API_BASE_URL}/items/${itemId}/move`;
    const requestHeaders = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const payload: {
      quantity: number;
      folder_id?: number;
      leave_zero_quantity: boolean;
    } = {
      quantity,
      leave_zero_quantity: leaveZeroQuantity,
    };

    if (folderId !== undefined) {
      payload.folder_id = folderId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Sortly API error: ${response.status} ${response.statusText}. ${errorText}`
      );
    }

    // Check if response has content before parsing JSON
    const responseText = await response.text();
    if (!responseText.trim()) {
      throw new Error('Empty response from Sortly API');
    }

    let data: { data: SortlyItem };
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid JSON response from Sortly API: ${responseText}`);
    }
    
    // Invalidate cache after move
    invalidateCache();
    
    return data.data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to move item in Sortly API');
  }
}

/**
 * Update an item in Sortly API
 * @param itemId Item ID to update
 * @param updates Object with fields to update (parent_id, quantity, etc.)
 */
export async function updateItem(itemId: number, updates: Partial<SortlyItem>): Promise<SortlyItem> {
  try {
    const secretKey = getSecretKey().trim();
    const authHeader = `Bearer ${secretKey}`;

    const url = `${API_BASE_URL}/items/${itemId}`;
    const requestHeaders = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers: requestHeaders,
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Sortly API error: ${response.status} ${response.statusText}. ${errorText}`
      );
    }

    // Check if response has content before parsing JSON
    const responseText = await response.text();
    if (!responseText.trim()) {
      throw new Error('Empty response from Sortly API');
    }

    let data: { data: SortlyItem };
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid JSON response from Sortly API: ${responseText}`);
    }
    
    // Invalidate cache after update
    invalidateCache();
    
    return data.data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to update item in Sortly API');
  }
}

/**
 * Search folders by name
 * @param query Search query string (empty string returns all folders)
 */
export async function searchFolders(query: string): Promise<SortlyItem[]> {
  try {
    const allFolders = await fetchAllFolders();
    
    if (!query || query.trim().length === 0) {
      return allFolders;
    }
    
    const queryLower = query.toLowerCase();
    
    // Filter folders by name (case-insensitive)
    const matchingFolders = allFolders.filter(folder => 
      folder.name?.toLowerCase().includes(queryLower)
    );
    
    return matchingFolders;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to search folders');
  }
}

/**
 * Invalidate cache when items are updated or moved
 * Call this function after any write operations (update, move, delete, etc.)
 */
export function invalidateCache(): void {
  cacheService.invalidateItems();
}

/**
 * Invalidate cache for folders
 * Call this after folder operations
 */
export function invalidateFolderCache(): void {
  cacheService.invalidateFolders();
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
  cacheService.clear();
}
