/**
 * Supabase Client Mock
 *
 * Provides a mock Supabase client for testing without hitting the real API
 */

export const mockSupabaseQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  like: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  contains: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
};

export const mockSupabaseClient = {
  auth: {
    signUp: jest.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' }, session: { access_token: 'mock-token' } },
      error: null,
    }),
    signInWithPassword: jest.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' }, session: { access_token: 'mock-token' } },
      error: null,
    }),
    signInWithOtp: jest.fn().mockResolvedValue({
      data: {},
      error: null,
    }),
    signOut: jest.fn().mockResolvedValue({
      error: null,
    }),
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null,
    }),
    getSession: jest.fn().mockResolvedValue({
      data: { session: { access_token: 'mock-token', user: { id: 'test-user-id' } } },
      error: null,
    }),
    onAuthStateChange: jest.fn((_callback) => {
      // Mock auth state change listener
      return {
        data: { subscription: { unsubscribe: jest.fn() } },
      };
    }),
  },
  from: jest.fn((_table: string) => mockSupabaseQueryBuilder),
};

/**
 * Mock Supabase responses for common scenarios
 */
export const mockResponses = {
  success: { data: {}, error: null },
  error: { data: null, error: { message: 'Mock error', code: 'MOCK_ERROR' } },
  goals: {
    data: [
      {
        id: 'goal-1',
        user_id: 'test-user-id',
        title: 'Test Goal 1',
        level: 'intention',
        status: 'in-progress',
        progress: 50,
      },
      {
        id: 'goal-2',
        user_id: 'test-user-id',
        title: 'Test Goal 2',
        level: 'milestone',
        status: 'not-started',
        progress: 0,
      },
    ],
    error: null,
  },
};

/**
 * Reset all mocks to initial state
 */
export const resetSupabaseMocks = () => {
  Object.values(mockSupabaseClient.auth).forEach((fn) => {
    if (jest.isMockFunction(fn)) {
      fn.mockClear();
    }
  });
  mockSupabaseClient.from.mockClear();
  Object.values(mockSupabaseQueryBuilder).forEach((fn) => {
    if (jest.isMockFunction(fn)) {
      fn.mockClear();
    }
  });
};
