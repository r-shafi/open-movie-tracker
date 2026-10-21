import { AnalyticsFormat } from './analytics-format';

describe('AnalyticsFormat (Section A & Shared Formatting)', () => {
  describe('Duration formatting - compact (Hero/Tile)', () => {
    it('should format minutes under 1 hour', () => {
      expect(AnalyticsFormat.formatDurationCompact(0)).toBe('0m');
      expect(AnalyticsFormat.formatDurationCompact(45)).toBe('45m');
      expect(AnalyticsFormat.formatDurationCompact(59)).toBe('59m');
    });

    it('should format hours under 1 day (1,440 min)', () => {
      expect(AnalyticsFormat.formatDurationCompact(60)).toBe('1h');
      expect(AnalyticsFormat.formatDurationCompact(90)).toBe('1.5h');
      expect(AnalyticsFormat.formatDurationCompact(1439)).toBe('24h');
    });

    it('should format days under 1 month (30 days = 43,200 min)', () => {
      expect(AnalyticsFormat.formatDurationCompact(1440)).toBe('~1 day');
      expect(AnalyticsFormat.formatDurationCompact(2880)).toBe('~2 days');
      expect(AnalyticsFormat.formatDurationCompact(1440 * 15)).toBe('~15 days');
      expect(AnalyticsFormat.formatDurationCompact(1440 * 29)).toBe('~29 days');
    });

    it('should format months and days for large durations', () => {
      // 1,964.5 hours = 117,870 minutes = 81.85 days
      expect(AnalyticsFormat.formatDurationCompact(1964.5 * 60)).toBe('~82 days');
      // 365 days
      expect(AnalyticsFormat.formatDurationCompact(365 * 1440)).toBe('~365 days');
    });
  });

  describe('Duration formatting - full breakdown (Detail/Expanded)', () => {
    it('should format sub-hour minutes', () => {
      expect(AnalyticsFormat.formatDurationDetailed(45)).toBe('45 minutes');
      expect(AnalyticsFormat.formatDurationDetailed(1)).toBe('1 minute');
    });

    it('should format hours and minutes', () => {
      expect(AnalyticsFormat.formatDurationDetailed(60)).toBe('1 hour');
      expect(AnalyticsFormat.formatDurationDetailed(90)).toBe('1 hour, 30 minutes');
    });

    it('should format days and hours (dropping zero units)', () => {
      expect(AnalyticsFormat.formatDurationDetailed(1440)).toBe('1 day');
      expect(AnalyticsFormat.formatDurationDetailed(1440 + 120)).toBe('1 day, 2 hours');
      expect(AnalyticsFormat.formatDurationDetailed(2880 + 60)).toBe('2 days, 1 hour');
    });

    it('should follow 1 month = 30 days convention accurately', () => {
      // 29 days
      expect(AnalyticsFormat.formatDurationDetailed(29 * 1440)).toBe('29 days');
      // 30 days = exactly 1 month
      expect(AnalyticsFormat.formatDurationDetailed(30 * 1440)).toBe('1 month');
      // 31 days = 1 month, 1 day
      expect(AnalyticsFormat.formatDurationDetailed(31 * 1440)).toBe('1 month, 1 day');
      // Exactly 1,964.5 hours = 81.85 days = 2 months (60d) + 21 days + 20.4 hours => 20 hours, 24 minutes (or 20 hours)
      expect(AnalyticsFormat.formatDurationDetailed(1964.5 * 60)).toBe('2 months, 21 days, 20 hours');
    });

    it('should handle boundary at 365 days (12 months, 5 days)', () => {
      expect(AnalyticsFormat.formatDurationDetailed(365 * 1440)).toBe('12 months, 5 days');
    });
  });

  describe('Rating formatting', () => {
    it('should format ratings with exactly 1 decimal and star suffix', () => {
      expect(AnalyticsFormat.formatRating(3.1415)).toBe('3.1★');
      expect(AnalyticsFormat.formatRating(3.0)).toBe('3.0★');
      expect(AnalyticsFormat.formatRating(5)).toBe('5.0★');
      expect(AnalyticsFormat.formatRating(null)).toBe('—');
      expect(AnalyticsFormat.formatRating(undefined)).toBe('—');
    });
  });

  describe('Number & Percentage formatting', () => {
    it('should format whole numbers with locale separators', () => {
      expect(AnalyticsFormat.formatCount(1066)).toBe('1,066');
      expect(AnalyticsFormat.formatCount(0)).toBe('0');
    });

    it('should format percentages', () => {
      expect(AnalyticsFormat.formatPercent(87.4)).toBe('87%');
      expect(AnalyticsFormat.formatPercent(100)).toBe('100%');
      expect(AnalyticsFormat.formatPercent(0.6, 1)).toBe('0.6%');
    });
  });

  describe('Language and Country display name resolution', () => {
    it('should resolve standard ISO language codes to readable names', () => {
      expect(AnalyticsFormat.getLanguageName('en')).toBe('English');
      expect(AnalyticsFormat.getLanguageName('fr')).toBe('French');
      expect(AnalyticsFormat.getLanguageName('ko')).toBe('Korean');
      expect(AnalyticsFormat.getLanguageName('ja')).toBe('Japanese');
    });

    it('should normalize legacy TMDb codes cn and xx', () => {
      expect(AnalyticsFormat.getLanguageName('cn')).toBe('Cantonese');
      expect(AnalyticsFormat.getLanguageName('xx')).toBe('No Language');
    });

    it('should resolve country codes to readable display names', () => {
      expect(AnalyticsFormat.getCountryName('US')).toBe('United States');
      expect(AnalyticsFormat.getCountryName('FR')).toBe('France');
      expect(AnalyticsFormat.getCountryName('KR')).toBe('South Korea');
      expect(AnalyticsFormat.getCountryName('GB')).toBe('United Kingdom');
    });

    it('should handle unknown codes gracefully without throwing', () => {
      expect(AnalyticsFormat.getLanguageName('')).toBe('Unknown');
      expect(AnalyticsFormat.getCountryName('')).toBe('Unknown');
      expect(AnalyticsFormat.getLanguageName('unknown_code')).toBe('unknown_code');
    });
  });
});
