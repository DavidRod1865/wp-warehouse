/**
 * Cache service with TTL (Time To Live) support
 * Caches API responses for 5 minutes
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class CacheService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  /**
   * Generate a cache key from URL and parameters
   */
  private generateKey(url: string, params?: Record<string, unknown>): string {
    const sortedParams = params ? Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&') : '';
    return `${url}${sortedParams ? '?' + sortedParams : ''}`;
  }

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(url: string, params?: Record<string, unknown>): T | null {
    const key = this.generateKey(url, params);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl) {
      // Cache expired, remove it
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set data in cache with TTL
   */
  set<T>(url: string, data: T, params?: Record<string, unknown>, ttl?: number): void {
    const key = this.generateKey(url, params);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL,
    };

    this.cache.set(key, entry);
  }

  /**
   * Invalidate cache for a specific URL pattern
   */
  invalidate(pattern?: string): void {
    if (!pattern) {
      // Clear all cache
      this.cache.clear();
      return;
    }

    // Clear cache entries that match the pattern
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Invalidate all item-related caches (used when items are updated/moved)
   */
  invalidateItems(): void {
    // Invalidate all caches related to items
    this.invalidate('/items');
  }

  /**
   * Invalidate folder-related caches
   */
  invalidateFolders(): void {
    this.invalidate('/items?type=folder');
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics (for debugging)
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Check if cache exists and is still valid
   */
  isValid(url: string, params?: Record<string, unknown>): boolean {
    const key = this.generateKey(url, params);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    const now = Date.now();
    const age = now - entry.timestamp;
    return age <= entry.ttl;
  }

  /**
   * Get time until cache expires (in seconds)
   */
  getTimeUntilExpiry(url: string, params?: Record<string, unknown>): number | null {
    const key = this.generateKey(url, params);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;
    const remaining = entry.ttl - age;

    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }
}

// Export singleton instance
export const cacheService = new CacheService();
