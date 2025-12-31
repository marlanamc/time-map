import { TimeBreakdown } from '../../src/utils/TimeBreakdown';

describe('TimeBreakdown.calculateForYear', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows 0 months/quarters when in December', () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-12-30T12:00:00'));

    const breakdown = TimeBreakdown.calculateForYear(2025);
    expect(breakdown.days).toBe(1);
    expect(breakdown.weeks).toBe(0);
    expect(breakdown.months).toBe(0);
    expect(breakdown.quartersLeft).toBe(0);
  });

  it('shows full-year remaining for a future target year', () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-06-15T12:00:00'));

    const breakdown = TimeBreakdown.calculateForYear(2026);
    expect(breakdown.months).toBe(12);
    expect(breakdown.quartersLeft).toBe(4);
    expect(breakdown.isCurrentYear).toBe(false);
  });
});

