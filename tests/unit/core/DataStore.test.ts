// ===================================
// Data Store Tests
// ===================================
import { DataStore } from '../../../src/core/DataStore';
import type { AppData } from '../../../src/types';

describe('DataStore', () => {
  let dataStore: DataStore;

  beforeEach(() => {
    dataStore = new DataStore();
  });

  afterEach(() => {
    dataStore.clear();
  });

  describe('Basic Operations', () => {
    test('should initialize with null data', () => {
      expect(dataStore.getData()).toBeNull();
    });

    test('should set and get data', () => {
      const testData = { goals: [], events: [] } as unknown as AppData;
      dataStore.setData(testData);
      expect(dataStore.getData()).toEqual(testData);
    });

    test('should update partial data', () => {
      const initialData = {
        goals: [],
        events: [],
        preferences: { focusMode: false } as any,
        analytics: { goalsCreated: 0 } as any,
        streak: { count: 0, lastDate: null },
        achievements: [],
        weeklyReviews: [],
        brainDump: [],
        bodyDoubleHistory: [],
        createdAt: new Date().toISOString(),
        version: 2
      } as AppData;
      
      dataStore.setData(initialData);
      dataStore.updateData({ preferences: { focusMode: true } as any });
      
      const updated = dataStore.getData();
      expect(updated?.preferences.focusMode).toBe(true);
      expect(updated?.goals).toEqual([]);
    });
  });

  describe('Subscriptions', () => {
    test('should notify subscribers on data change', () => {
      const mockCallback = jest.fn();
      dataStore.subscribe(mockCallback);

      const testData = { goals: [], events: [] } as unknown as AppData;
      dataStore.setData(testData);

      expect(mockCallback).toHaveBeenCalledWith(testData);
    });

    test('should unsubscribe correctly', () => {
      const mockCallback = jest.fn();
      const unsubscribe = dataStore.subscribe(mockCallback);

      unsubscribe();
      
      const testData = { goals: [], events: [] } as unknown as AppData;
      dataStore.setData(testData);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    test('should handle multiple subscribers', () => {
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();
      
      dataStore.subscribe(mockCallback1);
      dataStore.subscribe(mockCallback2);

      const testData = { goals: [], events: [] } as unknown as AppData;
      dataStore.setData(testData);

      expect(mockCallback1).toHaveBeenCalledWith(testData);
      expect(mockCallback2).toHaveBeenCalledWith(testData);
    });
  });

  describe('Default Data', () => {
    test('should create valid default data', () => {
      const defaultData = dataStore.createDefaultData();
      
      expect(defaultData).toHaveProperty('goals');
      expect(defaultData).toHaveProperty('events');
      expect(defaultData).toHaveProperty('preferences');
      expect(defaultData).toHaveProperty('analytics');
      expect(defaultData).toHaveProperty('version', 2);
      expect(defaultData).toHaveProperty('createdAt');
      expect(Array.isArray(defaultData.goals)).toBe(true);
      expect(Array.isArray(defaultData.events)).toBe(true);
    });

    test('should have valid preferences structure', () => {
      const defaultData = dataStore.createDefaultData();
      const prefs = defaultData.preferences;
      
      expect(prefs).toHaveProperty('focusMode');
      expect(prefs).toHaveProperty('theme');
      expect(prefs).toHaveProperty('layout');
      expect(prefs).toHaveProperty('nd');
      expect(prefs.nd).toHaveProperty('accentTheme');
    });
  });

  describe('Data Shape Validation', () => {
    test('should ensure data shape integrity', () => {
      const invalidData = { goals: 'invalid' } as any;
      dataStore.setData(invalidData);
      
      const changed = dataStore.ensureDataShape();
      expect(changed).toBe(true);
      
      const validData = dataStore.getData();
      expect(Array.isArray(validData?.goals)).toBe(true);
    });

    test('should not change valid data shape', () => {
      const validData = dataStore.createDefaultData();
      dataStore.setData(validData);
      
      const changed = dataStore.ensureDataShape();
      expect(changed).toBe(false);
    });

    test('should handle null data', () => {
      dataStore.setData(null);
      
      const changed = dataStore.ensureDataShape();
      expect(changed).toBe(true);
      
      const data = dataStore.getData();
      expect(data).not.toBeNull();
    });
  });

  describe('Data Migration', () => {
    test('should migrate version 1 to version 2', () => {
      const oldData = {
        goals: [],
        events: [],
        version: 1,
        preferences: { focusMode: false } as any,
        analytics: { goalsCreated: 0 } as any
      } as any;
      
      dataStore.setData(oldData);
      dataStore.migrateDataIfNeeded();
      
      const migrated = dataStore.getData();
      expect(migrated?.version).toBe(2);
      expect(migrated?.weeklyReviews).toEqual([]);
    });

    test('should migrate violet accent theme to amber', () => {
      const dataWithViolet = {
        ...dataStore.createDefaultData(),
        preferences: {
          ...dataStore.createDefaultData().preferences,
          nd: {
            ...dataStore.createDefaultData().preferences.nd,
            accentTheme: 'violet' as any
          }
        }
      };
      
      dataStore.setData(dataWithViolet);
      dataStore.migrateDataIfNeeded();
      
      const migrated = dataStore.getData();
      expect(migrated?.preferences.nd.accentTheme).toBe('amber');
    });
  });

  describe('Import/Export', () => {
    test('should export data with timestamp', () => {
      const testData = dataStore.createDefaultData();
      dataStore.setData(testData);
      
      const exported = dataStore.getExportData();
      expect(exported).toHaveProperty('exportedAt');
      expect(typeof exported.exportedAt).toBe('string');
    });

    test('should import data correctly', () => {
      const now = new Date().toISOString();
      const importData = {
        ...dataStore.createDefaultData(),
        goals: [{
          id: 'test',
          title: 'Test Goal',
          level: 'intention' as const,
          description: '',
          month: new Date().getMonth(),
          year: new Date().getFullYear(),
          category: null,
          priority: 'medium' as const,
          status: 'not-started' as const,
          progress: 0,
          subtasks: [],
          notes: [],
          timeLog: [],
          createdAt: now,
          updatedAt: now,
          completedAt: null,
          lastWorkedOn: null,
          dueDate: null,
          tags: [],
        }]
      };
      
      dataStore.importData(importData);
      const imported = dataStore.getData();
      
      expect(imported?.goals).toHaveLength(1);
      expect(imported?.goals[0].title).toBe('Test Goal');
    });

    test('should handle invalid import data', () => {
      const invalidImport = { invalid: 'data' } as any;
      const defaultData = dataStore.createDefaultData();
      
      dataStore.importData(invalidImport);
      const result = dataStore.getData();
      
      // The invalid data should be merged with defaults, not replace entirely
      expect(result).toEqual(expect.objectContaining({
        ...defaultData,
        createdAt: expect.any(String),
        invalid: 'data' // The invalid property should still be present
      }));
    });
  });

  describe('Clear Operations', () => {
    test('should clear all data', () => {
      dataStore.setData(dataStore.createDefaultData());
      expect(dataStore.getData()).not.toBeNull();
      
      dataStore.clear();
      expect(dataStore.getData()).toBeNull();
    });
  });
});
