// ===================================
// Core Module Barrel Exports
// ===================================
export { State } from './State';
export { Goals } from './Goals';
export { Planning } from './Planning';
export { Analytics } from './Analytics';
export { Streaks } from './Streaks';

// New modular architecture
export { DataStore } from './DataStore';
export { SyncService, type SyncStatus } from './SyncService';
export { StateController } from './StateController';

// Error handling system
export { 
  ErrorHandler, 
  errorHandler, 
  handleError, 
  withErrorHandling,
  ErrorType,
  ErrorSeverity,
  type AppError 
} from './ErrorHandling';
