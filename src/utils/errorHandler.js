class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    
    // Capture stack trace, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = {}) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details = {}) {
    super(message, 'DATABASE_ERROR', details);
  }
}

class NetworkError extends AppError {
  constructor(message = 'Network request failed', details = {}) {
    super(message, 'NETWORK_ERROR', details);
  }
}

class AuthError extends AppError {
  constructor(message = 'Authentication failed', details = {}) {
    super(message, 'AUTH_ERROR', details);
  }
}

class PermissionError extends AppError {
  constructor(message = 'Permission denied', details = {}) {
    super(message, 'PERMISSION_ERROR', details);
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', details = {}) {
    super(message, 'RATE_LIMIT_ERROR', {
      ...details,
      retryAfter: details.retryAfter || 60 // Default 60 seconds
    });
  }
}

class TimeoutError extends AppError {
  constructor(message = 'Request timed out', details = {}) {
    super(message, 'TIMEOUT_ERROR', details);
  }
}

const errorHandler = (error, context = {}) => {
  // Log the error with context
  console.error(`[${new Date().toISOString()}] Error in ${context.component || 'unknown'}:`, {
    message: error.message,
    code: error.code || 'UNKNOWN_ERROR',
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    context
  });

  // Create user-friendly error message
  const userFacingError = {
    id: `err_${Date.now()}`,
    message: 'Something went wrong',
    code: error.code || 'UNKNOWN_ERROR',
    details: {},
    isOperational: false
  };

  // Handle different error types
  if (error.isOperational) {
    userFacingError.message = error.message || userFacingError.message;
    userFacingError.details = error.details || {};
    userFacingError.isOperational = true;
  } else {
    // Map common error types to user-friendly messages
    const errorMap = {
      'TypeError': 'An unexpected error occurred',
      'ReferenceError': 'A reference error occurred',
      'RangeError': 'A range error occurred',
      'SyntaxError': 'A syntax error occurred',
      'EvalError': 'An evaluation error occurred',
      'URIError': 'A URI handling error occurred',
      'NetworkError': 'Unable to connect to the server. Please check your internet connection.',
      'DOMException': 'A browser error occurred',
    };

    userFacingError.message = errorMap[error.name] || userFacingError.message;
    
    // For development, include more details
    if (process.env.NODE_ENV === 'development') {
      userFacingError.details = {
        originalError: error.message,
        stack: error.stack
      };
    }
  }

  // Show error to user (could be integrated with a UI notification system)
  showErrorToUser(userFacingError);
  
  // Return error information for further handling if needed
  return userFacingError;
};

// Example UI notification function (would be implemented in your UI layer)
function showErrorToUser(error) {
  const errorElement = document.createElement('div');
  errorElement.className = 'error-notification';
  errorElement.innerHTML = `
    <div class="error-header">
      <span class="error-icon">⚠️</span>
      <span class="error-title">${error.message}</span>
      <button class="error-dismiss">×</button>
    </div>
    ${error.details ? `<div class="error-details">${JSON.stringify(error.details, null, 2)}</div>` : ''}
    <div class="error-id">Error ID: ${error.id}</div>
  `;
  
  // Add dismiss functionality
  const dismissBtn = errorElement.querySelector('.error-dismiss');
  dismissBtn.addEventListener('click', () => {
    errorElement.remove();
  });
  
  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (document.body.contains(errorElement)) {
      errorElement.remove();
    }
  }, 10000);
  
  // Add to the DOM
  document.body.appendChild(errorElement);
}

// Global error handler for uncaught exceptions
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    event.preventDefault();
    errorHandler(event.error, { type: 'unhandledException' });
    return false;
  });
  
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    errorHandler(event.reason || new Error('Unhandled promise rejection'), { 
      type: 'unhandledRejection' 
    });
    return false;
  });
}

export {
  AppError,
  ValidationError,
  DatabaseError,
  NetworkError,
  AuthError,
  PermissionError,
  RateLimitError,
  TimeoutError,
  errorHandler
};

export default errorHandler;
