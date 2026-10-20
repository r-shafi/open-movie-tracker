import { CalendarDate } from './calendar-date';

describe('CalendarDate Utility', () => {
  it('should parse YYYY-MM-DD correctly without time zone shifts', () => {
    const parts = CalendarDate.parse('2020-01-02');
    expect(parts).toEqual({ year: 2020, month: 1, day: 2 });
  });

  it('should format display dates correctly', () => {
    expect(CalendarDate.formatDisplay('2020-01-02')).toBe('Jan 2, 2020');
    expect(CalendarDate.formatShort('2020-01-02')).toBe('Jan 02');
    expect(CalendarDate.formatMonthYear('2020-01-02')).toBe('January 2020');
    expect(CalendarDate.getDay('2020-01-02')).toBe('02');
    expect(CalendarDate.getMonthShort('2020-01-02')).toBe('JAN');
    expect(CalendarDate.getYear('2020-01-02')).toBe('2020');
  });

  it('should handle null/empty strings with Date unknown fallback', () => {
    expect(CalendarDate.formatDisplay(null)).toBe('Date unknown');
    expect(CalendarDate.formatShort(null)).toBe('Date unknown');
    expect(CalendarDate.formatMonthYear(null)).toBe('Date unknown');
    expect(CalendarDate.getDay(null)).toBe('--');
    expect(CalendarDate.getMonthShort(null)).toBe('---');
  });

  it('should compute day differences exactly via epoch days', () => {
    // 2020 was a leap year: Jan 31 to Mar 1 is 30 days (Feb has 29)
    const diff = CalendarDate.diffDays('2020-01-31', '2020-03-01');
    expect(diff).toBe(30);

    // Consecutive days diff is 1
    expect(CalendarDate.diffDays('2020-01-01', '2020-01-02')).toBe(1);
    expect(CalendarDate.diffDays('2019-12-31', '2020-01-01')).toBe(1);
  });

  it('should calculate weekday index with 0=Mon, 6=Sun', () => {
    // 2020-01-02 was Thursday (index 3)
    expect(CalendarDate.getWeekdayIndex('2020-01-02')).toBe(3);
    // 2020-01-05 was Sunday (index 6)
    expect(CalendarDate.getWeekdayIndex('2020-01-05')).toBe(6);
    // 2020-01-06 was Monday (index 0)
    expect(CalendarDate.getWeekdayIndex('2020-01-06')).toBe(0);
  });

  it('should return valid YYYY-MM-DD for today()', () => {
    const today = CalendarDate.today();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const parsed = CalendarDate.parse(today);
    expect(parsed).not.toBeNull();
  });

  it('should compare dates lexicographically', () => {
    expect(CalendarDate.compare('2020-01-01', '2020-01-02')).toBeLessThan(0);
    expect(CalendarDate.compare('2020-01-02', '2020-01-01')).toBeGreaterThan(0);
    expect(CalendarDate.compare('2020-01-02', '2020-01-02')).toBe(0);
  });
});
