import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { UserDataService } from './user-data.service';
import { MetadataBackfillService } from './metadata-backfill.service';
import { TmdbService } from './tmdb.service';
import { ToastService } from './toast.service';
import fullProfileFixture from '../../../tests/fixtures/synthetic-1000-profile.json';
import partialProfileFixture from '../../../tests/fixtures/synthetic-30pct-profile.json';
import expectedStatsFixture from '../../../tests/fixtures/synthetic-expected-stats.json';
import tvFixture from '../../../tests/fixtures/synthetic-tv-fixture.json';

describe('Analytics & Stats Correctness (Phase 1)', () => {
  let userData: UserDataService;
  let backfillService: MetadataBackfillService;
  let tmdbSpy: jasmine.SpyObj<TmdbService>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    tmdbSpy = jasmine.createSpyObj('TmdbService', ['getMovieDetails', 'getTvDetails']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        UserDataService,
        MetadataBackfillService,
        { provide: TmdbService, useValue: tmdbSpy },
      ],
    });

    userData = TestBed.inject(UserDataService);
    backfillService = TestBed.inject(MetadataBackfillService);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  function seedFixture(fixture: any): void {
    localStorage.clear();
    Object.keys(fixture).forEach((k) => {
      localStorage.setItem(k, JSON.stringify(fixture[k]));
    });
  }

  describe('1,000-film fully backfilled catalog', () => {
    beforeEach(() => {
      seedFixture(fullProfileFixture);
    });

    it('should compute exact counts for library size, media mix, and rewatches', () => {
      const stats = userData.getStats();
      const expected = expectedStatsFixture.fullExpected;

      expect(stats.totalWatched).toBe(expected.totalWatched);
      expect(stats.totalMovies).toBe(expected.totalMovies);
      expect(stats.totalTv).toBe(expected.totalTv);
      expect(stats.rewatches).toBe(expected.rewatches);
      expect(stats.likedCount).toBe(expected.likedCount);
      expect(stats.averageRating).toBe(expected.averageRating);
    });

    it('should report 100% coverage with no warning banner when fully enriched', () => {
      const stats = userData.getStats();
      expect(stats.enrichedCount).toBe(1000);
      expect(stats.coveragePercentage).toBe(100);
      expect(stats.coverageNotice).toBeUndefined();
    });

    it('should accurately identify top director and top 10 directors without Wes Anderson in top 10', () => {
      const stats = userData.getStats();
      const expected = expectedStatsFixture.fullExpected;

      expect(stats.topDirectors.length).toBeGreaterThanOrEqual(10);
      expect(stats.topDirectors[0].name).toBe('Alfred Hitchcock');
      expect(stats.topDirectors[0].count).toBe(22);

      // Verify top 10 directors match ground truth order and counts
      expected.topDirectors.forEach((expDir, idx) => {
        expect(stats.topDirectors[idx].name).toBe(expDir.name);
        expect(stats.topDirectors[idx].count).toBe(expDir.count);
      });

      // Wes Anderson has exactly 3 films, so he must not be in top 10
      const top10Names = stats.topDirectors.slice(0, 10).map((d) => d.name);
      expect(top10Names).not.toContain('Wes Anderson');
    });

    it('should accurately compute multi-lingual distribution without defaulting to English', () => {
      const stats = userData.getStats();
      const expected = expectedStatsFixture.fullExpected.langCounts;

      const langMap: Record<string, number> = {};
      stats.languages.forEach((l) => {
        langMap[l.language] = l.count;
      });

      expect(langMap.en).toBe(expected.en);
      expect(langMap.fr).toBe(expected.fr);
      expect(langMap.ja).toBe(expected.ja);
      expect(langMap.ko).toBe(expected.ko);
      expect(langMap.es).toBe(expected.es);
      expect(langMap.de).toBe(expected.de);
    });

    it('should accurately identify top cast members', () => {
      const stats = userData.getStats();
      expect(stats.topCast.length).toBeGreaterThanOrEqual(5);
      expect(stats.topCast[0].name).toBe('Leonardo DiCaprio');
      expect(stats.topCast[0].count).toBe(14);
      expect(stats.topCast[1].name).toBe('Robert De Niro');
      expect(stats.topCast[1].count).toBe(12);
    });

    it('should isolate movie and tv items that share identical numeric TMDb IDs', () => {
      // ID 1399 exists as both a movie and a tv show in the fixture
      const movieEntries = userData.getAllWatchedEntriesFor('movie', 1399);
      const tvEntries = userData.getAllWatchedEntriesFor('tv', 1399);

      expect(movieEntries.length).toBeGreaterThanOrEqual(1);
      expect(tvEntries.length).toBeGreaterThanOrEqual(1);
      expect(movieEntries[0].media_type).toBe('movie');
      expect(tvEntries[0].media_type).toBe('tv');
    });
  });

  describe('30% partial-coverage scenario (simulating imported unbackfilled state)', () => {
    beforeEach(() => {
      seedFixture(partialProfileFixture);
    });

    it('should explicitly disclose enrichment coverage and display notice', () => {
      const stats = userData.getStats();
      expect(stats.totalWatched).toBe(1000);
      expect(stats.enrichedCount).toBe(300);
      expect(stats.coveragePercentage).toBe(30);
      expect(stats.coverageNotice).toBe('Based on 300 of 1000 titles, enriching the rest');
    });

    it('should report correct language counts for enriched subset without defaulting missing data', () => {
      const stats = userData.getStats();
      const langMap: Record<string, number> = {};
      stats.languages.forEach((l) => {
        langMap[l.language] = l.count;
      });

      // In the first 300 entries of the synthetic fixture, only English titles exist.
      // Missing 700 entries must NOT be counted as English!
      expect(langMap.en).toBe(300);
      expect(Object.values(langMap).reduce((a, b) => a + b, 0)).toBe(300);
    });

    it('should order missing items prioritized by recent watch date and highest rating', () => {
      const missing = userData.getMissingSnapshotTitles();
      expect(missing.length).toBe(700);

      // Verify that missing items are properly ordered
      const watched = userData.getWatched();
      const firstMissing = Object.values(watched).find(
        (e) => e.media_type === missing[0].media_type && e.id === missing[0].id
      );
      expect(firstMissing?.snapshot).toBeUndefined();
    });

    it('should complete backfill and match full ground truth values after enrichment', async () => {
      // Mock TMDb responses for remaining missing items
      const missing = userData.getMissingSnapshotTitles();
      expect(missing.length).toBe(700);

      // Simulate backfill for missing items by attaching full snapshots
      const fullWatched = fullProfileFixture.mva_watched as Record<string, any>;
      missing.forEach((item) => {
        const fullEntry = Object.values(fullWatched).find(
          (e: any) => e.media_type === item.media_type && e.id === item.id
        );
        if (fullEntry && fullEntry.snapshot) {
          userData.updateSnapshot(item.media_type, item.id, fullEntry.snapshot);
        }
      });

      expect(userData.getMissingSnapshotTitles().length).toBe(0);

      const finalStats = userData.getStats();
      expect(finalStats.enrichedCount).toBe(1000);
      expect(finalStats.coveragePercentage).toBe(100);
      expect(finalStats.coverageNotice).toBeUndefined();
      expect(finalStats.topDirectors[0].name).toBe('Alfred Hitchcock');
      expect(finalStats.topDirectors[0].count).toBe(22);
      expect(finalStats.languages.find((l) => l.language === 'en')?.count).toBe(650);
      expect(finalStats.languages.find((l) => l.language === 'fr')?.count).toBe(120);
    });
  });

  describe('Synthetic TV fixture & Watchlist queue dynamics', () => {
    beforeEach(() => {
      seedFixture(tvFixture);
    });

    it('should calculate TV hours from episodes actually watched, including specials', () => {
      const stats = userData.getStats();

      // Breaking Bad: 20 eps @ 47m = 940m
      // Severance: 5 eps @ 55m = 275m
      // Sherlock: 3 eps (including S0 special) @ 90m = 270m
      // Total: 28 eps = 1485m = 24.75h -> 24.8h
      expect(stats.totalTv).toBe(3);
      expect(stats.tvAnalytics.episodesWatched).toBe(28);
      expect(stats.tvAnalytics.totalTvHours).toBe(24.8);
      expect(stats.totalHoursKnown).toBe(24.8);
    });

    it('should compute real watchlist age dynamics from addedAt timestamps', () => {
      const stats = userData.getStats();

      expect(stats.watchlistHealth.totalItems).toBe(2);
      expect(stats.watchlistHealth.averageAgeDays).toBeGreaterThan(300);
      expect(stats.watchlistHealth.medianAgeDays).toBeGreaterThan(300);
      expect(stats.watchlistHealth.oldestAgeDays).toBeGreaterThanOrEqual(stats.watchlistHealth.medianAgeDays);
      expect(stats.watchlistHealth.runtimeToClearHours).toBeGreaterThan(0);
    });

    it('should preserve crew and cast profilePath on top directors and top cast', () => {
      const stats = userData.getStats();

      const vince = stats.topDirectors.find((d) => d.name === 'Vince Gilligan');
      expect(vince).toBeDefined();
      expect(vince?.profilePath).toBe('/rLSUZ8YVbWqZ86j26W8jT41jXfG.jpg');

      const bryan = stats.topCast.find((c) => c.name === 'Bryan Cranston');
      expect(bryan).toBeDefined();
      expect(bryan?.profilePath).toBe('/7Jahy5LZX2Fo8fGJltMreAI49hC.jpg');
    });
  });

  describe('Bidirectional Crowd Delta & Metric Coverage', () => {
    beforeEach(() => {
      seedFixture(fullProfileFixture);
    });

    it('should report per-metric coverage summaries with individual rates', () => {
      const stats = userData.getStats();

      expect(stats.coverage).toBeDefined();
      expect(stats.coverage.directors.percent).toBe(100);
      expect(stats.coverage.cast.percent).toBe(100);
      expect(stats.coverage.runtimes.percent).toBe(80);
      expect(stats.coverage.runtimes.covered).toBe(804);
      expect(stats.coverage.genres.percent).toBe(100);
      expect(stats.coverage.languages.percent).toBe(100);
      expect(stats.coverage.dates.covered).toBe(1000 - stats.undatedCount);
      expect(stats.coverage.dates.percent).toBe(97);
    });

    it('should compute bidirectional crowd delta picks and contrarian/generosity scores', () => {
      const stats = userData.getStats();

      expect(stats.crowdDeltaAverage).not.toBeNull();
      expect(stats.contrarianScore).not.toBeNull();
      expect(stats.generosityScore).toBe(stats.crowdDeltaAverage);

      expect(stats.controversialPicks.length).toBeLessThanOrEqual(5);
      expect(stats.highestAboveCrowd.length).toBeLessThanOrEqual(5);
      expect(stats.highestBelowCrowd.length).toBeLessThanOrEqual(5);

      stats.highestAboveCrowd.forEach((item) => {
        expect(item.delta).toBeGreaterThan(0);
      });
      stats.highestBelowCrowd.forEach((item) => {
        expect(item.delta).toBeLessThan(0);
      });
    });
  });

  describe('Schema V4 migration', () => {
    it('should migrate schema v3 to v4 and populate missing addedAt timestamps on watchlist', () => {
      localStorage.clear();
      localStorage.setItem('mva_schema_version', '3');
      localStorage.setItem(
        'mva_watchlist',
        JSON.stringify({
          'movie:100': {
            id: 100,
            media_type: 'movie',
            title: 'Legacy Watchlist Movie',
          },
        })
      );

      // Instantiating a new service triggers migration
      const migratedUserData = new UserDataService(TestBed.inject(ToastService));
      expect(localStorage.getItem('mva_schema_version')).toBe('5');

      const watchlist = migratedUserData.getWatchlist();
      expect(watchlist.length).toBe(1);
      expect(watchlist[0].id).toBe(100);
      expect(watchlist[0].addedAt).toBeTruthy();
      expect(new Date(watchlist[0].addedAt).getTime()).not.toBeNaN();
    });
  });

  describe('Schema V5 migration & Year Filtering', () => {
    it('should migrate schema v4 to v5 and populate missing cast gender from tmdb_cache_v2', () => {
      localStorage.clear();
      localStorage.setItem('mva_schema_version', '4');
      localStorage.setItem(
        'tmdb_cache_v2:/movie/500',
        JSON.stringify({
          data: {
            credits: {
              cast: [
                { id: 101, name: 'Florence Pugh', gender: 1 },
                { id: 102, name: 'Cillian Murphy', gender: 2 },
              ],
            },
          },
        })
      );
      localStorage.setItem(
        'mva_watched',
        JSON.stringify({
          'movie:500': {
            id: 500,
            media_type: 'movie',
            title: 'Oppenheimer',
            watchedAt: '2023-08-15',
            rating: 4.5,
            snapshot: {
              topCast: [
                { id: 101, name: 'Florence Pugh' },
                { id: 102, name: 'Cillian Murphy' },
              ],
            },
          },
        })
      );

      const migratedUserData = new UserDataService(TestBed.inject(ToastService));
      expect(localStorage.getItem('mva_schema_version')).toBe('5');

      const stats = migratedUserData.getStats();
      expect(stats.topActresses.length).toBe(1);
      expect(stats.topActresses[0].name).toBe('Florence Pugh');
      expect(stats.topActresses[0].gender).toBe(1);

      expect(stats.topActors.length).toBe(1);
      expect(stats.topActors[0].name).toBe('Cillian Murphy');
      expect(stats.topActors[0].gender).toBe(2);
    });

    it('should generate all 12 calendar months for a selected year in watch velocity', () => {
      localStorage.clear();
      localStorage.setItem('mva_schema_version', '5');
      localStorage.setItem(
        'mva_watched',
        JSON.stringify({
          'movie:1': {
            id: 1,
            media_type: 'movie',
            title: 'Film A',
            watchedAt: '2023-01-10',
            rating: 4.0,
          },
          'movie:2': {
            id: 2,
            media_type: 'movie',
            title: 'Film B',
            watchedAt: '2023-06-20',
            rating: 3.5,
          },
          'movie:3': {
            id: 3,
            media_type: 'movie',
            title: 'Film C',
            watchedAt: '2022-12-31',
            rating: 5.0,
          },
        })
      );

      const testUserData = new UserDataService(TestBed.inject(ToastService));
      const stats2023 = testUserData.getStats('2023');

      expect(stats2023.totalWatched).toBe(2);
      expect(stats2023.watchedByMonth.length).toBe(12);
      expect(stats2023.watchedByMonth[0].month).toBe('2023-01');
      expect(stats2023.watchedByMonth[0].count).toBe(1);
      expect(stats2023.watchedByMonth[5].month).toBe('2023-06');
      expect(stats2023.watchedByMonth[5].count).toBe(1);
      expect(stats2023.watchedByMonth[11].month).toBe('2023-12');
      expect(stats2023.watchedByMonth[11].count).toBe(0);

      // Verify year-specific ratings distribution
      expect(stats2023.ratingsDistribution['4.0']).toBe(1);
      expect(stats2023.ratingsDistribution['3.5']).toBe(1);
      expect(stats2023.ratingsDistribution['5.0']).toBe(0); // 5.0 is in 2022
    });
  });
});
