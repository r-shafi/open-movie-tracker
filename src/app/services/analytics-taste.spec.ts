import { AnalyticsTasteEngine } from './analytics-taste';
import { WatchedEntry, WatchlistEntry } from './user-data.service';

function createWatchedEntry(partial: Partial<WatchedEntry> & { id: number; title: string }): WatchedEntry {
  return {
    entryId: partial.entryId || `entry-${partial.id}-${Math.random()}`,
    id: partial.id,
    media_type: partial.media_type || 'movie',
    title: partial.title,
    poster_path: partial.poster_path ?? null,
    watchedAt: partial.watchedAt !== undefined ? partial.watchedAt : '2024-01-01',
    dateUnknown: partial.dateUnknown ?? false,
    approximateDate: partial.approximateDate ?? false,
    rewatch: partial.rewatch ?? false,
    rating: partial.rating !== undefined ? partial.rating : null,
    review: partial.review ?? '',
    tags: partial.tags ?? [],
    liked: partial.liked ?? false,
    release_date: partial.release_date,
    snapshot: partial.snapshot,
  };
}

describe('AnalyticsTasteEngine', () => {
  describe('calculateAffinity (Bayesian Shrinkage)', () => {
    it('should correctly shrink small-sample averages towards the global mean', () => {
      const items = [
        { name: 'Nolan', count: 2, ratings: [5.0, 5.0] }, // observed 5.0, v=2, m=3, C=3.0 -> (10 + 9)/5 = 3.80
        { name: 'Tarantino', count: 10, ratings: [4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5] }, // v=10, m=3, C=3.0 -> (45 + 9)/13 = 4.15
        { name: 'Single Movie Dir', count: 1, ratings: [5.0] }, // filtered out due to minCount=2
      ];

      const result = AnalyticsTasteEngine.calculateAffinity(items, 3.0, 3, 2);

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Tarantino');
      expect(result[0].shrunkScore).toBe(4.15);
      expect(result[0].deltaFromGlobal).toBe(1.15);

      expect(result[1].name).toBe('Nolan');
      expect(result[1].observedAverage).toBe(5.0);
      expect(result[1].shrunkScore).toBe(3.8); // Shrunk down from 5.0 towards 3.0!
      expect(result[1].deltaFromGlobal).toBe(0.8);
    });

    it('should return empty list when no items meet minCount or global average is 0', () => {
      const emptyResult = AnalyticsTasteEngine.calculateAffinity([], 3.5);
      expect(emptyResult).toEqual([]);

      const zeroMean = AnalyticsTasteEngine.calculateAffinity([{ name: 'Test', count: 5, ratings: [4, 4] }], 0);
      expect(zeroMean).toEqual([]);
    });
  });

  describe('calculateObscurity (Hipster Index)', () => {
    const mockEntries: WatchedEntry[] = [
      createWatchedEntry({
        id: 1,
        title: 'Blockbuster Film',
        rating: 4.0,
        snapshot: { tmdbVoteCount: 35000 },
      }),
      createWatchedEntry({
        id: 2,
        title: 'Indie Gem',
        rating: 4.5,
        snapshot: { tmdbVoteCount: 450 },
      }),
      createWatchedEntry({
        id: 3,
        title: 'Rare Art Film',
        rating: 5.0,
        snapshot: { tmdbVoteCount: 120 },
      }),
      createWatchedEntry({
        id: 4,
        title: 'Unenriched Entry',
        rating: 3.5,
      }),
    ];

    it('should classify entries into tiers and compute hipster index score', () => {
      const result = AnalyticsTasteEngine.calculateObscurity(mockEntries);

      expect(result.ratedCoverageCount).toBe(3);
      expect(result.tiers.obscureCount).toBe(2); // 450 and 120
      expect(result.tiers.blockbusterCount).toBe(1); // 35000
      expect(result.tiers.obscurePercent).toBe(67);
      expect(result.hipsterScore).toBeGreaterThan(50);
      expect(result.hiddenGems.length).toBe(2);
      expect(result.hiddenGems[0].title).toBe('Rare Art Film');
      expect(result.hiddenGems[1].title).toBe('Indie Gem');
    });
  });

  describe('calculateFilmAgeAtViewing', () => {
    const mockEntries: WatchedEntry[] = [
      createWatchedEntry({
        id: 1,
        title: 'New Release',
        watchedAt: '2024-05-10',
        snapshot: { releaseYear: 2024 },
      }),
      createWatchedEntry({
        id: 2,
        title: 'Modern Film',
        watchedAt: '2024-06-15',
        snapshot: { releaseYear: 2021 }, // age 3
      }),
      createWatchedEntry({
        id: 3,
        title: 'Classic Film',
        watchedAt: '2024-07-20',
        snapshot: { releaseYear: 1974 }, // age 50 -> Vintage
      }),
      createWatchedEntry({
        id: 4,
        title: 'Undated Entry',
        watchedAt: null,
        dateUnknown: true,
        snapshot: { releaseYear: 2000 },
      }),
    ];

    it('should calculate film age categories and accurately identify oldest watched', () => {
      const result = AnalyticsTasteEngine.calculateFilmAgeAtViewing(mockEntries);

      expect(result.datedCount).toBe(3);
      expect(result.undatedCount).toBe(1);
      expect(result.categories.find((c) => c.label.includes('Premiere'))?.count).toBe(1);
      expect(result.categories.find((c) => c.label.includes('Modern'))?.count).toBe(1);
      expect(result.categories.find((c) => c.label.includes('Vintage'))?.count).toBe(1);
      expect(result.oldestWatched?.title).toBe('Classic Film');
      expect(result.oldestWatched?.ageAtViewing).toBe(50);
    });
  });

  describe('calculateRewatchDynamics', () => {
    const mockEntries: WatchedEntry[] = [
      createWatchedEntry({
        entryId: 'e1',
        id: 101,
        title: 'The Matrix',
        watchedAt: '2020-01-01',
        rating: 4.0,
      }),
      createWatchedEntry({
        entryId: 'e2',
        id: 101,
        title: 'The Matrix',
        watchedAt: '2022-01-01',
        rewatch: true,
        rating: 5.0,
      }),
      createWatchedEntry({
        entryId: 'e3',
        id: 202,
        title: 'Inception',
        watchedAt: '2021-05-01',
        rating: 4.5,
      }),
    ];

    it('should aggregate repeated viewings and compute average rating trajectory', () => {
      const result = AnalyticsTasteEngine.calculateRewatchDynamics(mockEntries);

      expect(result.uniqueRewatchedTitles).toBe(1);
      expect(result.totalRewatches).toBe(1);
      expect(result.mostRewatched[0].title).toBe('The Matrix');
      expect(result.mostRewatched[0].watchCount).toBe(2);
      expect(result.averageRatingShift).toBe(1.0); // 5.0 - 4.0 = +1.0
    });
  });

  describe('predictWatchlistRatings', () => {
    const mockWatchlist: WatchlistEntry[] = [
      {
        id: 500,
        media_type: 'movie',
        title: 'Oppenheimer',
        addedAt: '2024-01-01',
        poster_path: null,
        snapshot: {
          directors: [{ id: 525, name: 'Christopher Nolan' }],
          genres: [{ id: 18, name: 'Drama' }, { id: 36, name: 'History' }],
        },
      },
    ];

    it('should predict rating by weighting director and genre affinities', () => {
      const directorAff = new Map<number, number>([[525, 4.6]]);
      const genreAff = new Map<string, number>([['Drama', 4.0], ['History', 3.8]]);
      const castAff = new Map<number, number>();

      const predictions = AnalyticsTasteEngine.predictWatchlistRatings(
        mockWatchlist,
        3.2,
        genreAff,
        directorAff,
        castAff
      );

      expect(predictions.length).toBe(1);
      expect(predictions[0].title).toBe('Oppenheimer');
      expect(predictions[0].predictedRating).toBeGreaterThan(3.5);
      expect(predictions[0].confidence).toBe('high');
      expect(predictions[0].reasons.some((r) => r.includes('Christopher Nolan'))).toBeTrue();
    });
  });
});
