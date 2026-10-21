/**
 * Shared Formatting Module (Section A & Core Analytics)
 *
 * Implements centralized formatting for:
 * - Durations (compact hero approximations and detailed breakdowns)
 * - Ratings (unified to 1 decimal place with ★)
 * - Numbers and percentages with locale rules
 * - Language and Country display names with legacy TMDb code normalization
 */

export class AnalyticsFormat {
  private static pluralRules = new Intl.PluralRules('en-US');
  private static languageNames: Intl.DisplayNames | null = null;
  private static regionNames: Intl.DisplayNames | null = null;

  static {
    try {
      if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
        AnalyticsFormat.languageNames = new Intl.DisplayNames(['en-US'], { type: 'language' });
        AnalyticsFormat.regionNames = new Intl.DisplayNames(['en-US'], { type: 'region' });
      }
    } catch {
      // Fallback if DisplayNames unsupported in environment
    }
  }

  private static pluralize(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  /**
   * Hero / Compact duration approximation.
   * Examples:
   * - 45m
   * - 1.5h, 4h
   * - ~1 day, ~15 days
   * - ~82 days (for 1,964.5h)
   */
  public static formatDurationCompact(minutes: number): string {
    if (minutes <= 0 || isNaN(minutes)) return '0m';

    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }

    const hours = minutes / 60;
    if (hours < 24) {
      const roundedHours = Math.round(hours * 10) / 10;
      return roundedHours % 1 === 0 ? `${roundedHours}h` : `${roundedHours.toFixed(1)}h`;
    }

    const days = Math.round(minutes / 1440);
    return `~${days} ${days === 1 ? 'day' : 'days'}`;
  }

  /**
   * Detailed breakdown duration.
   * Convention: 1 month = 30 days.
   * Units match magnitude:
   * - If >= 1 month: months, days, hours (drops minutes)
   * - If >= 1 day: days, hours (drops minutes)
   * - If >= 1 hour: hours, minutes
   * - If < 1 hour: minutes
   * Drops zero-valued units.
   */
  public static formatDurationDetailed(minutes: number): string {
    if (minutes <= 0 || isNaN(minutes)) return '0 minutes';

    const totalMinutes = Math.round(minutes);
    const MONTH_MINS = 30 * 1440; // 43,200 min
    const DAY_MINS = 1440;
    const HOUR_MINS = 60;

    const months = Math.floor(totalMinutes / MONTH_MINS);
    let rem = totalMinutes % MONTH_MINS;

    const days = Math.floor(rem / DAY_MINS);
    rem = rem % DAY_MINS;

    const hours = Math.floor(rem / HOUR_MINS);
    const mins = rem % HOUR_MINS;

    const parts: string[] = [];

    if (months > 0) {
      parts.push(this.pluralize(months, 'month', 'months'));
      if (days > 0) parts.push(this.pluralize(days, 'day', 'days'));
      if (hours > 0) parts.push(this.pluralize(hours, 'hour', 'hours'));
      return parts.join(', ');
    }

    if (days > 0) {
      parts.push(this.pluralize(days, 'day', 'days'));
      if (hours > 0) parts.push(this.pluralize(hours, 'hour', 'hours'));
      return parts.join(', ');
    }

    if (hours > 0) {
      parts.push(this.pluralize(hours, 'hour', 'hours'));
      if (mins > 0) parts.push(this.pluralize(mins, 'minute', 'minutes'));
      return parts.join(', ');
    }

    return this.pluralize(mins, 'minute', 'minutes');
  }

  /**
   * Rating formatter: 1 decimal place with ★ suffix.
   */
  public static formatRating(rating: number | null | undefined): string {
    if (typeof rating !== 'number' || isNaN(rating)) {
      return '—';
    }
    return `${rating.toFixed(1)}★`;
  }

  /**
   * Locale number formatter.
   */
  public static formatCount(count: number): string {
    if (typeof count !== 'number' || isNaN(count)) return '0';
    return count.toLocaleString('en-US');
  }

  /**
   * Percentage formatter.
   */
  public static formatPercent(pct: number, decimals = 0): string {
    if (typeof pct !== 'number' || isNaN(pct)) return '0%';
    return `${pct.toFixed(decimals)}%`;
  }

  /**
   * Resolves language ISO code to user display name.
   * Normalizes legacy TMDb codes ('cn' -> Cantonese, 'xx' -> No Language).
   */
  public static getLanguageName(code: string): string {
    if (!code) return 'Unknown';
    const lower = code.toLowerCase().trim();

    // Legacy TMDb code normalization
    if (lower === 'cn') return 'Cantonese';
    if (lower === 'xx') return 'No Language';
    if (lower === 'zh') return 'Mandarin';

    if (this.languageNames) {
      try {
        const name = this.languageNames.of(lower);
        if (name && name !== lower) return name;
      } catch {
        // Fallback
      }
    }

    const COMMON_LANGS: Record<string, string> = {
      en: 'English',
      fr: 'French',
      es: 'Spanish',
      ko: 'Korean',
      ja: 'Japanese',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      hi: 'Hindi',
      tr: 'Turkish',
      sv: 'Swedish',
      da: 'Danish',
      no: 'Norwegian',
      pl: 'Polish',
      nl: 'Dutch',
    };

    return COMMON_LANGS[lower] || code;
  }

  /**
   * Resolves country ISO code to user display name.
   */
  public static getCountryName(code: string): string {
    if (!code) return 'Unknown';
    const upper = code.toUpperCase().trim();

    if (this.regionNames) {
      try {
        const name = this.regionNames.of(upper);
        if (name && name !== upper) return name;
      } catch {
        // Fallback
      }
    }

    const COMMON_COUNTRIES: Record<string, string> = {
      US: 'United States',
      GB: 'United Kingdom',
      FR: 'France',
      KR: 'South Korea',
      JP: 'Japan',
      DE: 'Germany',
      IT: 'Italy',
      ES: 'Spain',
      CA: 'Canada',
      HK: 'Hong Kong',
      CN: 'China',
      AU: 'Australia',
      IN: 'India',
      SE: 'Sweden',
      DK: 'Denmark',
      NO: 'Norway',
    };

    return COMMON_COUNTRIES[upper] || upper;
  }
}
