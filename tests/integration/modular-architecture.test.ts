// ===================================
// Modular Architecture Integration Tests
// ===================================
import { DataStore } from "../../src/core/DataStore";
import { ErrorHandler, ErrorType } from "../../src/core/ErrorHandling";
import type { AppData } from "../../src/types";

describe("Modular Architecture Integration", () => {
  let dataStore: DataStore;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    dataStore = new DataStore();
    errorHandler = ErrorHandler.getInstance();
  });

  afterEach(() => {
    dataStore.clear();
    errorHandler.clearErrorLog();
  });

  describe("DataStore Integration", () => {
    test("should handle complete data lifecycle", () => {
      // Create test data
      const testData = dataStore.createDefaultData();
      testData.goals = [
        {
          id: "test-goal-1",
          title: "Test Goal",
          level: "milestone" as const,
          createdAt: new Date().toISOString(),
          completedAt: null,
          description: "Test description",
          month: null,
          year: new Date().getFullYear(),
          category: "personal",
          subtasks: [],
          streak: 0,
          lastCompletedAt: null,
          isArchived: false,
          tags: [],
          priority: "medium" as const,
          dueDate: null,
          recurring: null,
          estimatedMinutes: 60,
          actualMinutes: 0,
          notes: "",
          visionId: null,
          milestoneId: null,
          focusId: null,
        } as unknown as any,
      ];

      // Set data
      dataStore.setData(testData);
      expect(dataStore.getData()).toEqual(testData);

      // Update partial data
      dataStore.updateData({
        preferences: {
          ...testData.preferences,
          focusMode: true,
        },
      });

      const updated = dataStore.getData();
      expect(updated?.preferences.focusMode).toBe(true);
      expect(updated?.goals).toHaveLength(1);

      // Export and import
      const exported = dataStore.getExportData();
      expect(exported).toHaveProperty("exportedAt");

      dataStore.clear();
      expect(dataStore.getData()).toBeNull();

      dataStore.importData(exported);
      const imported = dataStore.getData();
      expect(imported?.goals).toHaveLength(1);
      expect(imported?.preferences.focusMode).toBe(true);
    });

    test("should handle subscribers correctly", () => {
      const subscriber1 = jest.fn();
      const subscriber2 = jest.fn();

      const unsubscribe1 = dataStore.subscribe(subscriber1);
      dataStore.subscribe(subscriber2);

      const testData = dataStore.createDefaultData();
      dataStore.setData(testData);

      expect(subscriber1).toHaveBeenCalledWith(testData);
      expect(subscriber2).toHaveBeenCalledWith(testData);

      unsubscribe1();
      dataStore.updateData({
        preferences: { ...testData.preferences, focusMode: true },
      });

      expect(subscriber1).toHaveBeenCalledTimes(1); // Unsubscribed
      expect(subscriber2).toHaveBeenCalledTimes(2); // Still subscribed
    });
  });

  describe("Error Handling Integration", () => {
    test("should handle and log errors properly", () => {
      const mockListener = jest.fn();
      errorHandler.onError(mockListener);

      const networkError = errorHandler.createNetworkError("Connection failed");
      errorHandler.handleError(networkError);

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.NETWORK,
          message: "Connection failed",
          userMessage: "Connection problem. Check your internet connection.",
        }),
      );

      const errorLog = errorHandler.getErrorLog();
      expect(errorLog).toHaveLength(1);
      expect(errorLog[0].type).toBe(ErrorType.NETWORK);
    });

    test("should handle async errors gracefully", async () => {
      const mockListener = jest.fn();
      errorHandler.onError(mockListener);

      const result = await errorHandler.withErrorHandling(async () => {
        throw new Error("Async test error");
      }, ErrorType.NETWORK);

      expect(result).toBeNull();
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.NETWORK,
          message: "Async test error",
        }),
      );
    });

    test("should limit error log size", () => {
      // Suppress console output during this test
      const originalWarn = console.warn;
      const originalError = console.error;
      console.warn = jest.fn();
      console.error = jest.fn();

      // Add more errors than the limit
      for (let i = 0; i < 105; i++) {
        const error = errorHandler.createNetworkError(`Error ${i}`);
        errorHandler.handleError(error);
      }

      // Restore console
      console.warn = originalWarn;
      console.error = originalError;

      const log = errorHandler.getErrorLog();
      expect(log).toHaveLength(100); // Should be limited
      expect(log[0].message).toBe("Error 5"); // First 5 removed
      expect(log[99].message).toBe("Error 104"); // Last one remains
    });
  });

  describe("Data Migration", () => {
    test("should migrate old data formats", () => {
      // Simulate old data structure
      const oldData = {
        goals: [],
        events: [],
        streak: { count: 0, lastDate: null },
        achievements: [],
        weeklyReviews: [],
        brainDump: [],
        bodyDoubleHistory: [],
        preferences: {
          focusMode: false,
          nd: {
            accentTheme: "violet" as any, // Old theme name
          },
        },
        analytics: {
          goalsCreated: 0,
          goalsCompleted: 0,
          totalTimeSpent: 0,
          streakBest: 0,
        },
        version: 1,
        createdAt: new Date().toISOString(),
      } as unknown as AppData;

      dataStore.setData(oldData);
      dataStore.migrateDataIfNeeded();

      const migrated = dataStore.getData();
      expect(migrated?.version).toBe(2);
      expect(migrated?.weeklyReviews).toEqual([]);
      expect(migrated?.preferences.nd.accentTheme).toBe("amber"); // Migrated theme
    });
  });

  describe("Data Shape Validation", () => {
    test("should ensure data integrity", () => {
      // Start with incomplete data
      const incompleteData = {
        goals: [],
        events: [],
        // Missing other required properties
      } as unknown as AppData;

      dataStore.setData(incompleteData);
      const changed = dataStore.ensureDataShape();

      expect(changed).toBe(true);
      const validated = dataStore.getData();

      // Should have all required properties
      expect(validated).toHaveProperty("streak");
      expect(validated).toHaveProperty("achievements");
      expect(validated).toHaveProperty("preferences");
      expect(validated).toHaveProperty("analytics");
    });
  });

  describe("Error Recovery", () => {
    test("should provide recovery options for different error types", () => {
      const testCases = [
        {
          type: ErrorType.NETWORK,
          expectedRecoverable: true,
          expectedUserMessage:
            "Connection problem. Check your internet connection.",
        },
        {
          type: ErrorType.AUTHENTICATION,
          expectedRecoverable: true,
          expectedUserMessage: "Authentication problem. Please sign in again.",
        },
        {
          type: ErrorType.VALIDATION,
          expectedRecoverable: true,
          expectedUserMessage: "Please check your input and try again.",
        },
        {
          type: ErrorType.STORAGE,
          expectedRecoverable: true,
          expectedUserMessage:
            "Storage problem. Your data may not be saved properly.",
        },
        {
          type: ErrorType.SYNC,
          expectedRecoverable: true,
          expectedUserMessage:
            "Sync problem. Your changes will be saved locally.",
        },
        {
          type: ErrorType.UI,
          expectedRecoverable: true,
          expectedUserMessage: "Display problem. Try refreshing the page.",
        },
      ];

      testCases.forEach(
        ({ type, expectedRecoverable, expectedUserMessage }) => {
          const error = errorHandler.createNetworkError("Test message");
          error.type = type;
          error.userMessage = expectedUserMessage;

          expect(error.recoverable).toBe(expectedRecoverable);
          expect(error.userMessage).toBe(expectedUserMessage);
        },
      );
    });
  });
});
