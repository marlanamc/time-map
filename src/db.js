import { openDB } from 'idb';

const DB_NAME = 'adhd-visionboard';
const DB_VERSION = 1;

const DB_STORES = {
  GOALS: 'goals',
  SETTINGS: 'settings',
  ACHIEVEMENTS: 'achievements',
  BRAIN_DUMP: 'brainDump',
  TIME_LOGS: 'timeLogs',
  BACKUP: 'backups'
};

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
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
  }
};

export default DB;
