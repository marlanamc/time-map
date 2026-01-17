import { goalsService } from '../../src/services/supabase/GoalsService';
import { cacheService } from '../../src/services/CacheService';
import { authService } from '../../src/services/supabase/AuthService';
import { getSupabaseClient } from '../../src/services/supabase/client';

jest.mock('../../src/services/supabase/AuthService', () => ({
  authService: {
    getUser: jest.fn(),
  },
}));

jest.mock('../../src/services/CacheService', () => {
  const actual = jest.requireActual('../../src/services/CacheService');
  return {
    cacheService: {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      TTL: actual.cacheService.TTL,
    },
  };
});

jest.mock('../../src/services/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('GoalsService caching', () => {
  const selectMock = jest.fn();
  const fromMock = jest.fn(() => ({ select: selectMock }));

  beforeEach(() => {
    (cacheService.get as jest.Mock).mockReturnValue(null);
    (cacheService.set as jest.Mock).mockReset();
    (cacheService.get as jest.Mock).mockClear();
    (cacheService.invalidate as jest.Mock).mockClear();
    (authService.getUser as jest.Mock).mockReset();
    (getSupabaseClient as jest.Mock).mockResolvedValue({
      from: fromMock,
    });
    fromMock.mockClear();
    selectMock.mockReset().mockResolvedValue({ data: [], error: null });
  });

  it('scopes the goals cache to the user id (not theme)', async () => {
    (authService.getUser as jest.Mock).mockResolvedValue({ id: 'user-123' });

    await goalsService.getGoals();

    expect(cacheService.get).toHaveBeenCalledWith('goals:user-123');
    expect(cacheService.set).toHaveBeenCalledWith(
      'goals:user-123',
      expect.any(Array),
      cacheService.TTL.GOALS,
    );

    const usedKey = (cacheService.set as jest.Mock).mock.calls[0][0];
    expect(usedKey).not.toMatch(/theme/i);
  });

  it('returns empty array and avoids cache when user is missing', async () => {
    (authService.getUser as jest.Mock).mockResolvedValue(null);

    const goals = await goalsService.getGoals();

    expect(goals).toEqual([]);
    expect(cacheService.set).not.toHaveBeenCalled();
    expect(cacheService.get).toHaveBeenCalledWith('goals:anonymous');
  });
});
