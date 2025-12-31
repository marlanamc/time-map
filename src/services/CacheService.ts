/**
 * CacheService - In-memory cache with TTL (Time To Live)
 *
 * Eliminates redundant database queries by caching frequently accessed data.
 * Critical for <100ms UI response time for ADHD users.
 *
 * Benefits:
 * - 3-5x faster repeated queries
 * - Reduces database load
 * - Target: 80%+ cache hit rate
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  invalidations: number;
  hitRate: number;
}

export class CacheService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0,
    hitRate: 0
  };

  // TTL configurations (in milliseconds)
  readonly TTL = {
    GOALS: 5 * 60 * 1000,           // 5 minutes
    PREFERENCES: 30 * 60 * 1000,    // 30 minutes
    ACHIEVEMENTS: 60 * 60 * 1000,   // 1 hour
    BRAIN_DUMP: 2 * 60 * 1000,      // 2 minutes (frequently changing)
    WEEKLY_REVIEWS: 15 * 60 * 1000, // 15 minutes
    STATISTICS: 10 * 60 * 1000,     // 10 minutes
    SHORT: 1 * 60 * 1000,           // 1 minute (for rapidly changing data)
    LONG: 2 * 60 * 60 * 1000        // 2 hours (for rarely changing data)
  };

  /**
   * Store data in cache
   *
   * @param key - Cache key (e.g., 'goals:all', 'goal:123')
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds (optional, defaults to GOALS TTL)
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.TTL.GOALS
    };
    this.cache.set(key, entry);
    this.stats.sets++;
  }

  /**
   * Retrieve data from cache
   *
   * Returns null if:
   * - Key doesn't exist
   * - Entry has expired (beyond TTL)
   *
   * @param key - Cache key
   * @returns Cached data or null
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      // Entry expired, remove it
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    this.stats.hits++;
    this.updateHitRate();
    return entry.data as T;
  }

  /**
   * Invalidate cache entries matching a pattern
   *
   * @param pattern - String (exact match) or RegExp (pattern match)
   *
   * Examples:
   * - invalidate('goals:all') - Exact key
   * - invalidate(/^goals:/) - All keys starting with 'goals:'
   * - invalidate(/goal:.*:timelog/) - Specific pattern
   */
  invalidate(pattern: string | RegExp): void {
    if (typeof pattern === 'string') {
      // Exact match
      const deleted = this.cache.delete(pattern);
      if (deleted) {
        this.stats.invalidations++;
      }
    } else {
      // Pattern match (RegExp)
      let deletedCount = 0;
      for (const key of this.cache.keys()) {
        if (pattern.test(key)) {
          this.cache.delete(key);
          deletedCount++;
        }
      }
      this.stats.invalidations += deletedCount;
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.invalidations += size;
  }

  /**
   * Check if key exists and is not expired
   *
   * @param key - Cache key
   * @returns true if exists and valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get cache entry age (how old the cached data is)
   *
   * @param key - Cache key
   * @returns Age in milliseconds or null if not cached
   */
  getAge(key: string): number | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    return Date.now() - entry.timestamp;
  }

  /**
   * Refresh TTL for an entry (reset its expiration time)
   *
   * @param key - Cache key
   * @returns true if refreshed, false if key doesn't exist
   */
  refresh(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    entry.timestamp = Date.now();
    return true;
  }

  /**
   * Clean up expired entries
   *
   * Runs periodically to prevent memory bloat.
   * Browser will call this automatically via interval.
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Start automatic cleanup interval
   *
   * Runs every 5 minutes to remove expired entries.
   */
  startAutoCleanup(): void {
    // Clean up every 5 minutes
    setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000);

    console.log('✓ Cache auto-cleanup started (every 5 minutes)');
  }

  /**
   * Get cache statistics
   *
   * Useful for monitoring cache effectiveness.
   * Target: >80% hit rate
   */
  getStats(): CacheStats & {
    size: number;
    keys: string[];
    memoryEstimate: string;
  } {
    return {
      ...this.stats,
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      memoryEstimate: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate cache memory usage (approximate)
   */
  private estimateMemoryUsage(): string {
    const bytesPerEntry = 1000; // Rough estimate
    const totalBytes = this.cache.size * bytesPerEntry;

    if (totalBytes < 1024) {
      return `${totalBytes} B`;
    } else if (totalBytes < 1024 * 1024) {
      return `${(totalBytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(totalBytes / 1024 / 1024).toFixed(2)} MB`;
    }
  }

  /**
   * Update hit rate percentage
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
      hitRate: 0
    };
  }

  /**
   * Log cache statistics to console
   */
  logStats(): void {
    const stats = this.getStats();
    console.log('📊 Cache Statistics:', {
      'Hit Rate': `${stats.hitRate.toFixed(2)}%`,
      'Hits': stats.hits,
      'Misses': stats.misses,
      'Sets': stats.sets,
      'Invalidations': stats.invalidations,
      'Size': stats.size,
      'Memory': stats.memoryEstimate
    });
  }
}

// Export singleton instance
export const cacheService = new CacheService();

const isTestEnv =
  typeof process !== "undefined" && process.env?.NODE_ENV === "test";

// Start auto-cleanup on module load (skip in Jest to avoid timers/side effects)
if (!isTestEnv) {
  cacheService.startAutoCleanup();
}

export default cacheService;
