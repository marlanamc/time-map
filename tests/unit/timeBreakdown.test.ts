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

describe('TimeBreakdown.calculate (month)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not count partial months (Dec 31 → Jan 1 = 0 months)', () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-12-31T12:00:00'));

    const breakdown = TimeBreakdown.calculate(0, 2026); // Jan 2026
    expect(breakdown.days).toBe(1);
    expect(breakdown.weeks).toBe(0);
    expect(breakdown.months).toBe(0);
  });

  it('treats the current month as inclusive through end-of-day', () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-12-31T12:00:00'));

    const breakdown = TimeBreakdown.calculate(11, 2025); // Dec 2025 (current month)
    expect(breakdown.isCurrentMonth).toBe(true);
    expect(breakdown.isPast).toBe(false);
    expect(breakdown.days).toBe(1);
  });
});

describe('TimeBreakdown.generateHTML', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders intention variant with hours left', () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-06-15T12:00:00'));
    const html = TimeBreakdown.generateHTML(0, 2025, false, 'intention');
    expect(html).toContain('hours left today');
  });

  it('renders focus variant with days left this week', () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-06-15T12:00:00'));
    const html = TimeBreakdown.generateHTML(0, 2025, false, 'focus');
    expect(html).toContain('days left this week');
  });

  it('renders vision variant for current year', () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-06-15T12:00:00'));
    const html = TimeBreakdown.generateHTML(0, 2025, false, 'vision');
    expect(html).toContain('this year');
  });

  it('renders compact milestone variant', () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-15T12:00:00'));
    const html = TimeBreakdown.generateHTML(2, 2025, true, 'milestone');
    expect(html).toContain('days');
    expect(html).toContain('weeks');
    expect(html).toContain('months');
  });
});

describe('TimeBreakdown.getSimpleTimeLeft', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns "In the past" for past dates', () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-15T12:00:00'));
    expect(TimeBreakdown.getSimpleTimeLeft(0, 2020)).toBe('In the past');
  });
});
