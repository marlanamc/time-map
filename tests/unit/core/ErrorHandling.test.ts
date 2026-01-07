// ===================================
// Error Handling Tests
// ===================================
import { 
  ErrorHandler, 
  ErrorType, 
  ErrorSeverity,
  type AppError 
} from '../../../src/core/ErrorHandling';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let mockConsoleError: jest.SpyInstance;
  let mockConsoleWarn: jest.SpyInstance;
  let mockConsoleInfo: jest.SpyInstance;

  beforeEach(() => {
    errorHandler = ErrorHandler.getInstance();
    errorHandler.clearErrorLog();
    
    // Mock console methods
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
    mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation();
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    errorHandler.clearErrorLog();
    mockConsoleError.mockRestore();
    mockConsoleWarn.mockRestore();
    mockConsoleInfo.mockRestore();
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Error Creation', () => {
    test('should create network error', () => {
      const error = errorHandler.createNetworkError('Connection failed', { url: 'test.com' });
      
      expect(error.type).toBe(ErrorType.NETWORK);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.message).toBe('Connection failed');
      expect(error.userMessage).toBe('Connection problem. Check your internet connection.');
      expect(error.recoverable).toBe(true);
      expect(error.context).toEqual({ url: 'test.com' });
    });

    test('should create auth error', () => {
      const error = errorHandler.createAuthError('Invalid token');
      
      expect(error.type).toBe(ErrorType.AUTHENTICATION);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.userMessage).toBe('Authentication problem. Please sign in again.');
    });

    test('should create validation error', () => {
      const error = errorHandler.createValidationError('Invalid email');
      
      expect(error.type).toBe(ErrorType.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.userMessage).toBe('Please check your input and try again.');
    });

    test('should create storage error', () => {
      const error = errorHandler.createStorageError('Quota exceeded');
      
      expect(error.type).toBe(ErrorType.STORAGE);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.userMessage).toBe('Storage problem. Your data may not be saved properly.');
    });

    test('should create sync error', () => {
      const error = errorHandler.createSyncError('Server unavailable');
      
      expect(error.type).toBe(ErrorType.SYNC);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.userMessage).toBe('Sync problem. Your changes will be saved locally.');
    });

    test('should create UI error', () => {
      const error = errorHandler.createUIError('Render failed');
      
      expect(error.type).toBe(ErrorType.UI);
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.userMessage).toBe('Display problem. Try refreshing the page.');
    });
  });

  describe('Error Handling', () => {
    test('should handle error with all properties', () => {
      const mockListener = jest.fn();
      errorHandler.onError(mockListener);

      const errorData = {
        type: ErrorType.NETWORK,
        severity: ErrorSeverity.HIGH,
        code: 'TEST_ERROR',
        message: 'Test error message',
        userMessage: 'Test user message',
        recoverable: true,
        context: { test: true }
      };

      errorHandler.handleError(errorData);

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.NETWORK,
          severity: ErrorSeverity.HIGH,
          code: 'TEST_ERROR',
          message: 'Test error message',
          userMessage: 'Test user message',
          recoverable: true,
          context: { test: true },
          timestamp: expect.any(Date)
        })
      );
    });

    test('should use defaults for missing properties', () => {
      const mockListener = jest.fn();
      errorHandler.onError(mockListener);

      errorHandler.handleError({
        message: 'Minimal error'
      });

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.UNKNOWN,
          severity: ErrorSeverity.MEDIUM,
          code: 'UNKNOWN_ERROR',
          message: 'Minimal error',
          userMessage: 'Something went wrong. Try refreshing the page.',
          recoverable: true,
          timestamp: expect.any(Date)
        })
      );
    });

    test('should log to console based on severity', () => {
      // Clear mocks before this specific test
      mockConsoleError.mockClear();
      mockConsoleWarn.mockClear();
      mockConsoleInfo.mockClear();

      // Test LOW severity
      errorHandler.handleError({
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.LOW,
        message: 'Low severity error'
      });
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('[LOW] validation: Low severity error'),
        expect.any(Object)
      );

      // Test MEDIUM severity
      errorHandler.handleError({
        type: ErrorType.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        message: 'Medium severity error'
      });
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[MEDIUM] network: Medium severity error'),
        expect.any(Object)
      );

      // Test HIGH severity
      errorHandler.handleError({
        type: ErrorType.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        message: 'High severity error'
      });
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[HIGH] authentication: High severity error'),
        expect.any(Object)
      );
    });
  });

  describe('Error Logging', () => {
    test('should maintain error log', () => {
      const error1 = errorHandler.createNetworkError('Error 1');
      const error2 = errorHandler.createAuthError('Error 2');

      errorHandler.handleError(error1);
      errorHandler.handleError(error2);

      const log = errorHandler.getErrorLog();
      expect(log).toHaveLength(2);
      expect(log[0].message).toBe('Error 1');
      expect(log[1].message).toBe('Error 2');
    });

    test('should limit error log size', () => {
      // Create more errors than the max log size
      for (let i = 0; i < 105; i++) {
        const error = errorHandler.createNetworkError(`Error ${i}`);
        errorHandler.handleError(error);
      }

      const log = errorHandler.getErrorLog();
      expect(log).toHaveLength(100); // Should be limited to maxLogSize
      expect(log[0].message).toBe('Error 5'); // First 5 should be removed
      expect(log[99].message).toBe('Error 104'); // Last one should remain
    });

    test('should clear error log', () => {
      errorHandler.handleError(errorHandler.createNetworkError('Test error'));
      expect(errorHandler.getErrorLog()).toHaveLength(1);

      errorHandler.clearErrorLog();
      expect(errorHandler.getErrorLog()).toHaveLength(0);
    });
  });

  describe('Error Listeners', () => {
    test('should subscribe and unsubscribe to errors', () => {
      const mockListener = jest.fn();
      const unsubscribe = errorHandler.onError(mockListener);

      errorHandler.handleError(errorHandler.createNetworkError('Test error'));
      expect(mockListener).toHaveBeenCalledTimes(1);

      unsubscribe();
      errorHandler.handleError(errorHandler.createAuthError('Another error'));
      expect(mockListener).toHaveBeenCalledTimes(1); // Should not be called again
    });

    test('should handle multiple listeners', () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();

      errorHandler.onError(mockListener1);
      errorHandler.onError(mockListener2);

      errorHandler.handleError(errorHandler.createNetworkError('Test error'));

      expect(mockListener1).toHaveBeenCalledTimes(1);
      expect(mockListener2).toHaveBeenCalledTimes(1);
    });

    test('should handle errors in listeners gracefully', () => {
      const faultyListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();

      errorHandler.onError(faultyListener);
      errorHandler.onError(goodListener);

      // Should not throw despite faulty listener
      expect(() => {
        errorHandler.handleError(errorHandler.createNetworkError('Test error'));
      }).not.toThrow();

      expect(faultyListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('Async Error Handling', () => {
    test('should handle successful async operation', async () => {
      const result = await errorHandler.withErrorHandling(async () => {
        return 'success';
      });

      expect(result).toBe('success');
    });

    test('should handle async error', async () => {
      const mockListener = jest.fn();
      errorHandler.onError(mockListener);

      const result = await errorHandler.withErrorHandling(async () => {
        throw new Error('Async error');
      });

      expect(result).toBeNull();
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.UNKNOWN,
          message: 'Async error'
        })
      );
    });

    test('should handle async error with custom type', async () => {
      const mockListener = jest.fn();
      errorHandler.onError(mockListener);

      await errorHandler.withErrorHandling(
        async () => {
          throw new Error('Network error');
        },
        ErrorType.NETWORK,
        { url: 'test.com' }
      );

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.NETWORK,
          context: { url: 'test.com' }
        })
      );
    });
  });

  describe('Error Boundary UI', () => {
    test('should create error boundary UI', () => {
      const error: AppError = {
        type: ErrorType.UNKNOWN,
        severity: ErrorSeverity.HIGH,
        code: 'TEST_ERROR',
        message: 'Test error',
        userMessage: 'Test user message',
        recoverable: true,
        timestamp: new Date()
      };

      const ui = errorHandler.createErrorBoundaryUI(error);

      expect(ui.tagName).toBe('DIV');
      expect(ui.className).toBe('error-boundary');
      expect(ui.innerHTML).toContain('Something went wrong');
      expect(ui.innerHTML).toContain('Test user message');
      expect(ui.innerHTML).toContain('Refresh Page');
    });
  });
});
