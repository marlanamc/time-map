import { openDB } from 'idb';

const DB_NAME = 'adhd-visionboard';
const DB_VERSION = 4; // Added events store

const DB_STORES = {
  GOALS: 'goals',
  EVENTS: 'events',
  SETTINGS: 'settings',
  ACHIEVEMENTS: 'achievements',
  BRAIN_DUMP: 'brainDump',
  TIME_LOGS: 'timeLogs',
  WEEK_REFLECTIONS: 'weekReflections',
  BACKUP: 'backups'
};

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion, newVersion, transaction) {
    console.log(`Upgrading database from v${oldVersion} to v${newVersion}`);

    // Version 1: Initial schema creation
    if (oldVersion < 1) {
      console.log('Creating initial schema...');

      // Create object stores with proper indexes
      const goalsStore = db.createObjectStore(DB_STORES.GOALS, { keyPath: 'id' });
      goalsStore.createIndex('byMonthYear', ['month', 'year']);
      goalsStore.createIndex('byStatus', 'status');
      goalsStore.createIndex('byPriority', 'priority');

      db.createObjectStore(DB_STORES.SETTINGS, { keyPath: 'id' });

      const achievementsStore = db.createObjectStore(DB_STORES.ACHIEVEMENTS, { keyPath: 'id' });
      achievementsStore.createIndex('byDate', 'date');

      db.createObjectStore(DB_STORES.BRAIN_DUMP, { keyPath: 'id', autoIncrement: true });

      const timeLogsStore = db.createObjectStore(DB_STORES.TIME_LOGS, { keyPath: 'id' });
      timeLogsStore.createIndex('byGoal', 'goalId');
      timeLogsStore.createIndex('byDate', 'date');

      db.createObjectStore(DB_STORES.BACKUP, { keyPath: 'timestamp' });
    }

    // Version 2: Add composite indexes for performance
    if (oldVersion < 2) {
      console.log('Adding composite indexes for faster queries...');

      const goalsStore = transaction.objectStore(DB_STORES.GOALS);

      try {
        // Compound index for active goals by priority
        goalsStore.createIndex('byStatusPriority', ['status', 'priority']);
        console.log('  ✓ Created byStatusPriority index');

        // Compound index for goals in month with status
        goalsStore.createIndex('byMonthYearStatus', ['month', 'year', 'status']);
        console.log('  ✓ Created byMonthYearStatus index');

        // Index for "continue where you left off" feature
        goalsStore.createIndex('byLastWorkedOn', 'lastWorkedOn');
        console.log('  ✓ Created byLastWorkedOn index');

        // Index for due date sorting
        goalsStore.createIndex('byDueDate', 'dueDate');
        console.log('  ✓ Created byDueDate index');
      } catch (e) {
        console.error('Failed to create some indexes (they may already exist):', e);
      }

      const timeLogsStore = transaction.objectStore(DB_STORES.TIME_LOGS);

      try {
        // Compound index for goal time logs sorted by date
        timeLogsStore.createIndex('byGoalDate', ['goalId', 'date']);
        console.log('  ✓ Created byGoalDate index on time logs');
      } catch (e) {
        console.error('Failed to create time log index:', e);
      }

      console.log('✓ Database upgraded to v2 with composite indexes');
    }

    // Version 3: Add week reflections (local-only prompts)
    if (oldVersion < 3) {
      console.log('Adding week reflections store...');
      try {
        const reflections = db.createObjectStore(DB_STORES.WEEK_REFLECTIONS, { keyPath: 'id' });
        reflections.createIndex('byWeek', ['weekYear', 'weekNum']);
        reflections.createIndex('byCreatedAt', 'createdAt');
        console.log('✓ Week reflections store created');
      } catch (e) {
        console.error('Failed to create week reflections store:', e);
      }
    }

    // Version 4: Add events (synced via Supabase)
    if (oldVersion < 4) {
      console.log('Adding events store...');
      try {
        const events = db.createObjectStore(DB_STORES.EVENTS, { keyPath: 'id' });
        events.createIndex('byStartAt', 'startAt');
        events.createIndex('byEndAt', 'endAt');
        console.log('✓ Events store created');
      } catch (e) {
        console.error('Failed to create events store:', e);
      }
    }
  },
});

export const DB = {
  // Generic CRUD operations
  async add(storeName, item) {
    const db = await dbPromise;
    return db.add(storeName, item);
  },
  
  async get(storeName, key) {
    const db = await dbPromise;
    return db.get(storeName, key);
  },
  
  async getAll(storeName, index, query) {
    const db = await dbPromise;
    return index 
      ? db.getAllFromIndex(storeName, index, query)
      : db.getAll(storeName);
  },
  
  async update(storeName, value) {
    const db = await dbPromise;
    return db.put(storeName, value);
  },
  
  async delete(storeName, key) {
    const db = await dbPromise;
    return db.delete(storeName, key);
  },

  // Batch operations for performance
  async bulkAdd(storeName, items) {
    const db = await dbPromise;
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    const promises = items.map(item => store.add(item));
    await Promise.all([...promises, tx.done]);
    return items;
  },

  async bulkUpdate(storeName, items) {
    const db = await dbPromise;
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    const promises = items.map(item => store.put(item));
    await Promise.all([...promises, tx.done]);
    return items;
  },

  async bulkDelete(storeName, keys) {
    const db = await dbPromise;
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    const promises = keys.map(key => store.delete(key));
    await Promise.all([...promises, tx.done]);
    return true;
  },

  // Backup and restore
  async createBackup() {
    const db = await dbPromise;
    const tx = db.transaction(Object.values(DB_STORES), 'readonly');
    const backup = {};
    
    for (const store of Object.values(DB_STORES)) {
      backup[store] = await tx.objectStore(store).getAll();
    }
    
    const timestamp = new Date().toISOString();
    await DB.add(DB_STORES.BACKUP, {
      timestamp,
      data: backup,
      version: DB_VERSION
    });
    
    return timestamp;
  },
  
  async restoreBackup(timestamp) {
    const backup = await DB.get(DB_STORES.BACKUP, timestamp);
    if (!backup) throw new Error('Backup not found');
    
    const db = await dbPromise;
    const tx = db.transaction(Object.values(DB_STORES), 'readwrite');
    
    // Clear existing data
    for (const store of Object.values(DB_STORES)) {
      if (store !== DB_STORES.BACKUP) {
        await tx.objectStore(store).clear();
      }
    }
    
    // Restore data
    for (const [storeName, items] of Object.entries(backup.data)) {
      const store = tx.objectStore(storeName);
      for (const item of items) {
        await store.put(item);
      }
    }
    
    return true;
  },
  
  // Export/Import
  async exportData() {
    const db = await dbPromise;
    const tx = db.transaction(Object.values(DB_STORES), 'readonly');
    const data = {};
    
    for (const store of Object.values(DB_STORES)) {
      data[store] = await tx.objectStore(store).getAll();
    }
    
    return {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      data
    };
  },
  
  async importData(backupData) {
    if (!backupData || !backupData.data) {
      throw new Error('Invalid backup data format');
    }
    
    // Create a backup before import
    await this.createBackup();
    
    const db = await dbPromise;
    const tx = db.transaction(Object.values(DB_STORES), 'readwrite');
    
    // Clear existing data except backups
    for (const store of Object.values(DB_STORES)) {
      if (store !== DB_STORES.BACKUP) {
        await tx.objectStore(store).clear();
      }
    }
    
    // Import new data
    for (const [storeName, items] of Object.entries(backupData.data)) {
      if (storeName in DB_STORES) {
        const store = tx.objectStore(storeName);
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
  async getActiveGoalsForMonth(month, year) {
    const db = await dbPromise;
    const tx = db.transaction(DB_STORES.GOALS, 'readonly');
    const index = tx.objectStore(DB_STORES.GOALS).index('byMonthYearStatus');

    const results = [];
    const statuses = ['in-progress', 'not-started', 'blocked'];

    // Query by status
    for (const status of statuses) {
      const goals = await index.getAll([month, year, status]);
      results.push(...goals);
    }

    // Sort by priority
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    results.sort((a, b) =>
      (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99)
    );

    return results;
  },

  /**
   * Get recently worked goals (for "continue where you left off")
   * Uses byLastWorkedOn index for fast sorting
   */
  async getRecentlyWorkedGoals(limit = 5) {
    const db = await dbPromise;
    const tx = db.transaction(DB_STORES.GOALS, 'readonly');
    const index = tx.objectStore(DB_STORES.GOALS).index('byLastWorkedOn');

    const results = [];
    let cursor = await index.openCursor(null, 'prev'); // Descending order

    while (cursor && results.length < limit) {
      if (cursor.value.lastWorkedOn) {
        results.push(cursor.value);
      }
      cursor = await cursor.continue();
    }

    return results;
  },

  /**
   * Get overdue goals
   * Uses byDueDate index for fast filtering
   */
  async getOverdueGoals() {
    const db = await dbPromise;
    const tx = db.transaction(DB_STORES.GOALS, 'readonly');
    const index = tx.objectStore(DB_STORES.GOALS).index('byDueDate');

    const now = new Date().toISOString();
    const results = [];

    let cursor = await index.openCursor();
    while (cursor) {
      const goal = cursor.value;
      if (goal.dueDate && goal.dueDate < now && goal.status !== 'done') {
        results.push(goal);
      }
      cursor = await cursor.continue();
    }

    return results;
  },

  /**
   * Get goals by status and priority
   * Uses byStatusPriority composite index
   */
  async getGoalsByStatusPriority(status, priority) {
    const db = await dbPromise;
    const index = db.transaction(DB_STORES.GOALS, 'readonly')
      .objectStore(DB_STORES.GOALS)
      .index('byStatusPriority');

    return index.getAll([status, priority]);
  },

  /**
   * Pagination helper using cursors (faster than offset for large datasets)
   */
  async getPaginated(storeName, options = {}) {
    const {
      index = null,
      query = null,
      limit = 50,
      offset = 0,
      direction = 'next' // 'next' or 'prev'
    } = options;

    const db = await dbPromise;
    const tx = db.transaction(storeName, 'readonly');
    const store = index
      ? tx.objectStore(storeName).index(index)
      : tx.objectStore(storeName);

    const results = [];
    let cursor = await store.openCursor(query, direction);
    let skipped = 0;
    let collected = 0;

    while (cursor) {
      if (skipped < offset) {
        skipped++;
        cursor = await cursor.continue();
        continue;
      }

      if (collected >= limit) break;

      results.push(cursor.value);
      collected++;
      cursor = await cursor.continue();
    }

    return results;
  },

  /**
   * Count items (optionally filtered by index)
   */
  async count(storeName, index = null, query = null) {
    const db = await dbPromise;
    const tx = db.transaction(storeName, 'readonly');
    const store = index
      ? tx.objectStore(storeName).index(index)
      : tx.objectStore(storeName);

    return query && index
      ? await store.count(query)
      : await store.count();
  }
};

export { DB_STORES };
export default DB;
