import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "adhd-visionboard";
const DB_VERSION = 4; // Added events store

export const DB_STORES = {
  GOALS: "goals",
  EVENTS: "events",
  SETTINGS: "settings",
  ACHIEVEMENTS: "achievements",
  BRAIN_DUMP: "brainDump",
  TIME_LOGS: "timeLogs",
  WEEK_REFLECTIONS: "weekReflections",
  BACKUP: "backups",
} as const;

export type DBStoreName = (typeof DB_STORES)[keyof typeof DB_STORES];

export interface ExportData {
  version: number;
  exportedAt: string;
  data: {
    [storeName: string]: any[];
  };
}

export interface PaginationOptions {
  index?: string | null;
  query?: any;
  limit?: number;
  offset?: number;
  direction?: "next" | "prev";
}

const dbPromise: Promise<IDBPDatabase<any>> = openDB(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion, newVersion, transaction) {
    console.log(`Upgrading database from v${oldVersion} to v${newVersion}`);

    // Version 1: Initial schema creation
    if (oldVersion < 1) {
      console.log("Creating initial schema...");

      // Create object stores with proper indexes
      const goalsStore = db.createObjectStore(DB_STORES.GOALS, {
        keyPath: "id",
      });
      goalsStore.createIndex("byMonthYear", ["month", "year"]);
      goalsStore.createIndex("byStatus", "status");
      goalsStore.createIndex("byPriority", "priority");

      db.createObjectStore(DB_STORES.SETTINGS, { keyPath: "id" });

      const achievementsStore = db.createObjectStore(DB_STORES.ACHIEVEMENTS, {
        keyPath: "id",
      });
      achievementsStore.createIndex("byDate", "date");

      db.createObjectStore(DB_STORES.BRAIN_DUMP, {
        keyPath: "id",
        autoIncrement: true,
      });

      const timeLogsStore = db.createObjectStore(DB_STORES.TIME_LOGS, {
        keyPath: "id",
      });
      timeLogsStore.createIndex("byGoal", "goalId");
      timeLogsStore.createIndex("byDate", "date");

      db.createObjectStore(DB_STORES.BACKUP, { keyPath: "timestamp" });
    }

    // Version 2: Add composite indexes for performance
    if (oldVersion < 2) {
      console.log("Adding composite indexes for faster queries...");

      const goalsStore = transaction.objectStore(DB_STORES.GOALS);

      try {
        // Compound index for active goals by priority
        goalsStore.createIndex("byStatusPriority", ["status", "priority"]);
        console.log("  ✓ Created byStatusPriority index");

        // Compound index for goals in month with status
        goalsStore.createIndex("byMonthYearStatus", [
          "month",
          "year",
          "status",
        ]);
        console.log("  ✓ Created byMonthYearStatus index");

        // Index for "continue where you left off" feature
        goalsStore.createIndex("byLastWorkedOn", "lastWorkedOn");
        console.log("  ✓ Created byLastWorkedOn index");

        // Index for due date sorting
        goalsStore.createIndex("byDueDate", "dueDate");
        console.log("  ✓ Created byDueDate index");
      } catch (e) {
        console.error(
          "Failed to create some indexes (they may already exist):",
          e,
        );
      }

      const timeLogsStore = transaction.objectStore(DB_STORES.TIME_LOGS);

      try {
        // Compound index for goal time logs sorted by date
        timeLogsStore.createIndex("byGoalDate", ["goalId", "date"]);
        console.log("  ✓ Created byGoalDate index on time logs");
      } catch (e) {
        console.error("Failed to create time log index:", e);
      }

      console.log("✓ Database upgraded to v2 with composite indexes");
    }

    // Version 3: Add week reflections (local-only prompts)
    if (oldVersion < 3) {
      console.log("Adding week reflections store...");
      try {
        const reflections = db.createObjectStore(DB_STORES.WEEK_REFLECTIONS, {
          keyPath: "id",
        });
        reflections.createIndex("byWeek", ["weekYear", "weekNum"]);
        reflections.createIndex("byCreatedAt", "createdAt");
        console.log("✓ Week reflections store created");
      } catch (e) {
        console.error("Failed to create week reflections store:", e);
      }
    }

    // Version 4: Add events (synced via Supabase)
    if (oldVersion < 4) {
      console.log("Adding events store...");
      try {
        const events = db.createObjectStore(DB_STORES.EVENTS, {
          keyPath: "id",
        });
        events.createIndex("byStartAt", "startAt");
        events.createIndex("byEndAt", "endAt");
        console.log("✓ Events store created");
      } catch (e) {
        console.error("Failed to create events store:", e);
      }
    }
  },
});

export const DB = {
  // Generic CRUD operations
  async add<T = any>(storeName: string, item: T): Promise<any> {
    const db = await dbPromise;
    return db.add(storeName, item);
  },

  async get<T = any>(storeName: string, key: any): Promise<T | undefined> {
    const db = await dbPromise;
    return db.get(storeName, key);
  },

  async getAll<T = any>(
    storeName: string,
    index?: string,
    query?: any,
  ): Promise<T[]> {
    const db = await dbPromise;
    return index
      ? db.getAllFromIndex(storeName, index, query)
      : db.getAll(storeName);
  },

  async update<T = any>(storeName: string, value: T): Promise<any> {
    const db = await dbPromise;
    return db.put(storeName, value);
  },

  async delete(storeName: string, key: any): Promise<void> {
    const db = await dbPromise;
    return db.delete(storeName, key);
  },

  // Batch operations for performance
  async bulkAdd<T = any>(storeName: string, items: T[]): Promise<T[]> {
    const db = await dbPromise;
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);

    const promises = items.map((item) => store.add(item));
    await Promise.all([...promises, tx.done]);
    return items;
  },

  async bulkUpdate<T = any>(storeName: string, items: T[]): Promise<T[]> {
    const db = await dbPromise;
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);

    const promises = items.map((item) => store.put(item));
    await Promise.all([...promises, tx.done]);
    return items;
  },

  async bulkDelete(storeName: string, keys: any[]): Promise<boolean> {
    const db = await dbPromise;
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);

    const promises = keys.map((key) => store.delete(key));
    await Promise.all([...promises, tx.done]);
    return true;
  },

  // Backup and restore
  async createBackup(): Promise<string> {
    const db = await dbPromise;
    const tx = db.transaction(Object.values(DB_STORES) as any[], "readonly");
    const backup: Record<string, any[]> = {};

    for (const store of Object.values(DB_STORES)) {
      backup[store] = await tx.objectStore(store as any).getAll();
    }

    const timestamp = new Date().toISOString();
    await this.add(DB_STORES.BACKUP, {
      timestamp,
      data: backup,
      version: DB_VERSION,
    });

    return timestamp;
  },

  async restoreBackup(timestamp: string): Promise<boolean> {
    const backup = await this.get<{ data: Record<string, any[]> }>(
      DB_STORES.BACKUP,
      timestamp,
    );
    if (!backup) throw new Error("Backup not found");

    const db = await dbPromise;
    const tx = db.transaction(Object.values(DB_STORES) as any[], "readwrite");

    // Clear existing data
    for (const store of Object.values(DB_STORES)) {
      if (store !== DB_STORES.BACKUP) {
        await tx.objectStore(store as any).clear();
      }
    }

    // Restore data
    for (const [storeName, items] of Object.entries(backup.data)) {
      const store = tx.objectStore(storeName as any);
      for (const item of items) {
        await store.put(item);
      }
    }

    return true;
  },

  // Export/Import
  async exportData(): Promise<ExportData> {
    const db = await dbPromise;
    const tx = db.transaction(Object.values(DB_STORES) as any[], "readonly");
    const data: Record<string, any[]> = {};

    for (const store of Object.values(DB_STORES)) {
      data[store] = await tx.objectStore(store as any).getAll();
    }

    return {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    };
  },

  async importData(backupData: ExportData): Promise<boolean> {
    if (!backupData || !backupData.data) {
      throw new Error("Invalid backup data format");
    }

    // Create a backup before import
    await this.createBackup();

    const db = await dbPromise;
    const tx = db.transaction(Object.values(DB_STORES) as any[], "readwrite");

    // Clear existing data except backups
    for (const store of Object.values(DB_STORES)) {
      if (store !== DB_STORES.BACKUP) {
        await tx.objectStore(store as any).clear();
      }
    }

    // Import new data
    for (const [storeName, items] of Object.entries(backupData.data)) {
      if (Object.values(DB_STORES).includes(storeName as any)) {
        const store = tx.objectStore(storeName as any);
        for (const item of items) {
          await store.put(item);
        }
      }
    }

    return true;
  },

  // Specialized query methods using composite indexes

  /**
   * Get active goals for current month sorted by priority
   * Uses byMonthYearStatus index for fast filtering
   */
  async getActiveGoalsForMonth<T = any>(
    month: number,
    year: number,
  ): Promise<T[]> {
    const db = await dbPromise;
    const tx = db.transaction(DB_STORES.GOALS, "readonly");
    const index = tx.objectStore(DB_STORES.GOALS).index("byMonthYearStatus");

    const results: T[] = [];
    const statuses = ["in-progress", "not-started", "blocked"];

    // Query by status
    for (const status of statuses) {
      const goals = await index.getAll([month, year, status]);
      results.push(...(goals as T[]));
    }

    // Sort by priority
    const priorityOrder: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    results.sort(
      (a: any, b: any) =>
        (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99),
    );

    return results;
  },

  /**
   * Get recently worked goals (for "continue where you left off")
   * Uses byLastWorkedOn index for fast sorting
   */
  async getRecentlyWorkedGoals<T = any>(limit = 5): Promise<T[]> {
    const db = await dbPromise;
    const tx = db.transaction(DB_STORES.GOALS, "readonly");
    const index = tx.objectStore(DB_STORES.GOALS).index("byLastWorkedOn");

    const results: T[] = [];
    let cursor = await index.openCursor(null, "prev"); // Descending order

    while (cursor && results.length < limit) {
      if (cursor.value.lastWorkedOn) {
        results.push(cursor.value as T);
      }
      cursor = await cursor.continue();
    }

    return results;
  },

  /**
   * Get overdue goals
   * Uses byDueDate index for fast filtering
   */
  async getOverdueGoals<T = any>(): Promise<T[]> {
    const db = await dbPromise;
    const tx = db.transaction(DB_STORES.GOALS, "readonly");
    const index = tx.objectStore(DB_STORES.GOALS).index("byDueDate");

    const now = new Date().toISOString();
    const results: T[] = [];

    let cursor = await index.openCursor();
    while (cursor) {
      const goal = cursor.value;
      if (goal.dueDate && goal.dueDate < now && goal.status !== "done") {
        results.push(goal as T);
      }
      cursor = await cursor.continue();
    }

    return results;
  },

  /**
   * Get goals by status and priority
   * Uses byStatusPriority composite index
   */
  async getGoalsByStatusPriority<T = any>(
    status: string,
    priority: string,
  ): Promise<T[]> {
    const db = await dbPromise;
    const index = db
      .transaction(DB_STORES.GOALS, "readonly")
      .objectStore(DB_STORES.GOALS)
      .index("byStatusPriority");

    return index.getAll([status, priority]) as Promise<T[]>;
  },

  /**
   * Pagination helper using cursors (faster than offset for large datasets)
   */
  async getPaginated<T = any>(
    storeName: string,
    options: PaginationOptions = {},
  ): Promise<T[]> {
    const {
      index = null,
      query = null,
      limit = 50,
      offset = 0,
      direction = "next", // 'next' or 'prev'
    } = options;

    const db = await dbPromise;
    const tx = db.transaction(storeName, "readonly");
    const store = index
      ? tx.objectStore(storeName as any).index(index)
      : tx.objectStore(storeName as any);

    const results: T[] = [];
    let cursor = await store.openCursor(query, direction as any);
    let skipped = 0;
    let collected = 0;

    while (cursor) {
      if (skipped < offset) {
        skipped++;
        cursor = await cursor.continue();
        continue;
      }

      if (collected >= limit) break;

      results.push(cursor.value as T);
      collected++;
      cursor = await cursor.continue();
    }

    return results;
  },

  /**
   * Count items (optionally filtered by index)
   */
  async count(
    storeName: string,
    index: string | null = null,
    query: any = null,
  ): Promise<number> {
    const db = await dbPromise;
    const tx = db.transaction(storeName, "readonly");
    const store = index
      ? tx.objectStore(storeName as any).index(index)
      : tx.objectStore(storeName as any);

    return query && index ? await store.count(query) : await store.count();
  },
};

export default DB;
