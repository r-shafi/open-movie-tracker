/**
 * Pure Calendar Date Utility.
 *
 * Handles YYYY-MM-DD calendar dates strictly without time, time zone, or Date conversions.
 * Guarantees identical representation and day-math across all time zones (e.g. UTC, Asia/Dhaka, America/Los_Angeles).
 */

export interface CalendarDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export class CalendarDate {
  private static readonly MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  private static readonly MONTH_SHORT = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  /**
   * Parses a calendar date string (YYYY-MM-DD or leading YYYY-MM-DD) into year, month, day.
   * Does NOT construct a JavaScript Date object.
   */
  public static parse(dateStr: string | null | undefined): CalendarDateParts | null {
    if (!dateStr || typeof dateStr !== 'string') {
      return null;
    }
    const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      return null;
    }
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);

    if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    return { year, month, day };
  }

  /**
   * Formats string into canonical calendar date YYYY-MM-DD.
   */
  public static toDateString(dateStr: string | null | undefined): string | null {
    const parts = CalendarDate.parse(dateStr);
    if (!parts) {
      return null;
    }
    const y = String(parts.year).padStart(4, '0');
    const m = String(parts.month).padStart(2, '0');
    const d = String(parts.day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Formats for standard display, e.g. "Jan 2, 2020".
   * Returns fallback ("Date unknown") when null/empty.
   */
  public static formatDisplay(dateStr: string | null | undefined, fallback = 'Date unknown'): string {
    const parts = CalendarDate.parse(dateStr);
    if (!parts) {
      return fallback;
    }
    const monthName = CalendarDate.MONTH_SHORT[parts.month - 1];
    return `${monthName} ${parts.day}, ${parts.year}`;
  }

  /**
   * Formats for short display, e.g. "Jan 02".
   */
  public static formatShort(dateStr: string | null | undefined, fallback = 'Date unknown'): string {
    const parts = CalendarDate.parse(dateStr);
    if (!parts) {
      return fallback;
    }
    const monthName = CalendarDate.MONTH_SHORT[parts.month - 1];
    const day = String(parts.day).padStart(2, '0');
    return `${monthName} ${day}`;
  }

  /**
   * Formats month and year for grouping, e.g. "January 2020".
   */
  public static formatMonthYear(dateStr: string | null | undefined, fallback = 'Date unknown'): string {
    const parts = CalendarDate.parse(dateStr);
    if (!parts) {
      return fallback;
    }
    const monthName = CalendarDate.MONTH_NAMES[parts.month - 1];
    return `${monthName} ${parts.year}`;
  }

  /**
   * Extracts two-digit day string, e.g. "02", or "--".
   */
  public static getDay(dateStr: string | null | undefined): string {
    const parts = CalendarDate.parse(dateStr);
    if (!parts) {
      return '--';
    }
    return String(parts.day).padStart(2, '0');
  }

  /**
   * Extracts uppercase 3-letter month string, e.g. "JAN", or "---".
   */
  public static getMonthShort(dateStr: string | null | undefined): string {
    const parts = CalendarDate.parse(dateStr);
    if (!parts) {
      return '---';
    }
    return CalendarDate.MONTH_SHORT[parts.month - 1].toUpperCase();
  }

  /**
   * Extracts 4-digit year string, e.g. "2020", or "".
   */
  public static getYear(dateStr: string | null | undefined): string {
    const parts = CalendarDate.parse(dateStr);
    if (!parts) {
      return '';
    }
    return String(parts.year);
  }

  /**
   * Returns epoch day integer (days since 1970-01-01) pure mathematically.
   * Completely immune to Daylight Savings Time or time zones.
   */
  public static toEpochDays(dateStr: string | null | undefined): number {
    const parts = CalendarDate.parse(dateStr);
    if (!parts) {
      return 0;
    }
    const a = Math.floor((14 - parts.month) / 12);
    const y = parts.year + 4800 - a;
    const m = parts.month + 12 * a - 3;
    const jdn = parts.day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    return jdn - 2440588; // 2440588 is JDN for 1970-01-01
  }

  /**
   * Difference in calendar days between two dates: (date2 - date1).
   */
  public static diffDays(dateStr1: string, dateStr2: string): number {
    return CalendarDate.toEpochDays(dateStr2) - CalendarDate.toEpochDays(dateStr1);
  }

  /**
   * Returns weekday index: 0 = Mon, 1 = Tue, ..., 6 = Sun.
   * Uses Sakamoto's algorithm without any Date conversion.
   */
  public static getWeekdayIndex(dateStr: string): number {
    const parts = CalendarDate.parse(dateStr);
    if (!parts) {
      return 0;
    }
    const y = parts.year - (parts.month < 3 ? 1 : 0);
    const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    const dow = (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[parts.month - 1] + parts.day) % 7;
    // dow: 0 = Sunday, 1 = Monday ... 6 = Saturday
    // Convert so 0 = Monday ... 6 = Sunday:
    return (dow + 6) % 7;
  }

  /**
   * Direct calendar date comparison (lexicographical YYYY-MM-DD).
   */
  public static compare(a: string | null | undefined, b: string | null | undefined): number {
    const strA = CalendarDate.toDateString(a) || '';
    const strB = CalendarDate.toDateString(b) || '';
    return strA.localeCompare(strB);
  }

  /**
   * Returns today's local date as YYYY-MM-DD.
   */
  public static today(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
