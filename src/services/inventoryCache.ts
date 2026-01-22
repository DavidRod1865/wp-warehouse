import type { SortlyItem } from '../types/sortly';

interface FolderCache {
  items: SortlyItem[];
  timestamp: number;
}

/**
 * Inventory cache manager for storing items per folder with TTL
 * Only caches the current folder being viewed to reduce memory usage
 */
class InventoryCache {
  private folderCaches: Map<string, FolderCache> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get folder key (null becomes 'root')
   */
  private getFolderKey(folderId: number | null): string {
    return folderId === null ? 'root' : folderId.toString();
  }

  /**
   * Get cached items for a folder if cache is still valid
   */
  get(folderId: number | null): SortlyItem[] | null {
    const key = this.getFolderKey(folderId);
    const cache = this.folderCaches.get(key);

    if (!cache) {
      return null;
    }

    const age = Date.now() - cache.timestamp;
    if (age > this.TTL) {
      this.folderCaches.delete(key);
      return null;
    }

    return cache.items;
  }

  /**
   * Set items in cache for a folder
   */
  set(folderId: number | null, items: SortlyItem[]): void {
    const key = this.getFolderKey(folderId);
    this.folderCaches.set(key, {
      items,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if cache is valid for a folder
   */
  isValid(folderId: number | null): boolean {
    const key = this.getFolderKey(folderId);
    const cache = this.folderCaches.get(key);

    if (!cache) {
      return false;
    }

    const age = Date.now() - cache.timestamp;
    return age <= this.TTL;
  }

  /**
   * Get time until cache expires for a folder (in seconds)
   */
  getTimeUntilExpiry(folderId: number | null): number {
    const key = this.getFolderKey(folderId);
    const cache = this.folderCaches.get(key);

    if (!cache) {
      return 0;
    }

    const age = Date.now() - cache.timestamp;
    const remaining = this.TTL - age;
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  /**
   * Update an item in the cache (updates all folders that contain this item)
   */
  updateItem(itemId: number, updates: Partial<SortlyItem>): void {
    this.folderCaches.forEach((cache) => {
      const index = cache.items.findIndex(item => item.id === itemId);
      if (index !== -1) {
        cache.items[index] = { ...cache.items[index], ...updates };
      }
    });
  }

  /**
   * Add a new item to a specific folder cache
   */
  addItem(folderId: number | null, item: SortlyItem): void {
    const key = this.getFolderKey(folderId);
    const cache = this.folderCaches.get(key);

    if (cache) {
      cache.items.push(item);
    }
  }

  /**
   * Remove an item from all folder caches
   */
  removeItem(itemId: number): void {
    this.folderCaches.forEach((cache) => {
      cache.items = cache.items.filter(item => item.id !== itemId);
    });
  }

  /**
   * Invalidate cache for a specific folder
   */
  invalidateFolder(folderId: number | null): void {
    const key = this.getFolderKey(folderId);
    this.folderCaches.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.folderCaches.clear();
  }

  /**
   * Get cache timestamp for a folder
   */
  getTimestamp(folderId: number | null): Date | null {
    const key = this.getFolderKey(folderId);
    const cache = this.folderCaches.get(key);
    return cache ? new Date(cache.timestamp) : null;
  }
}

// Export singleton instance
export const inventoryCache = new InventoryCache();
