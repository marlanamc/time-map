/**
 * TypeScript declarations for the IndexedDB wrapper module (db.js)
 * This file provides type safety for the legacy JavaScript database module
 */

/**
 * Available database store names
 */
export const DB_STORES: {
  readonly GOALS: 'goals';
  readonly SETTINGS: 'settings';
  readonly ACHIEVEMENTS: 'achievements';
  readonly BRAIN_DUMP: 'brainDump';
  readonly TIME_LOGS: 'timeLogs';
  readonly BACKUP: 'backups';
};

/**
 * Export/backup data structure
 */
export interface ExportData {
  version: number;
  exportedAt: string;
  data: {
    [storeName: string]: any[];
  };
}

/**
 * Pagination options for getPaginated
 */
export interface PaginationOptions {
  index?: string | null;
  query?: any;
  limit?: number;
  offset?: number;
  direction?: 'next' | 'prev';
}

/**
 * IndexedDB wrapper with CRUD operations
 */
export const DB: {
  // Basic CRUD operations
  add<T = any>(storeName: string, item: T): Promise<any>;
  get<T = any>(storeName: string, key: any): Promise<T | undefined>;
  getAll<T = any>(storeName: string, index?: string, query?: any): Promise<T[]>;
  update<T = any>(storeName: string, value: T): Promise<any>;
  delete(storeName: string, key: any): Promise<void>;

  // Batch operations
  bulkAdd<T = any>(storeName: string, items: T[]): Promise<T[]>;
  bulkUpdate<T = any>(storeName: string, items: T[]): Promise<T[]>;
  bulkDelete(storeName: string, keys: any[]): Promise<boolean>;

  // Backup and restore
  createBackup(): Promise<string>;
  restoreBackup(timestamp: string): Promise<boolean>;

  // Export/Import
  exportData(): Promise<ExportData>;
  importData(backupData: ExportData): Promise<boolean>;

  // Specialized query methods
  getActiveGoalsForMonth<T = any>(month: number, year: number): Promise<T[]>;
  getRecentlyWorkedGoals<T = any>(limit?: number): Promise<T[]>;
  getOverdueGoals<T = any>(): Promise<T[]>;
  getGoalsByStatusPriority<T = any>(status: string, priority: string): Promise<T[]>;

  // Pagination and counting
  getPaginated<T = any>(storeName: string, options?: PaginationOptions): Promise<T[]>;
  count(storeName: string, index?: string | null, query?: any): Promise<number>;
};

export default DB;
