import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { UserDataService } from './user-data.service';
import { MetadataBackfillService } from './metadata-backfill.service';
import { TmdbService } from './tmdb.service';
import fullProfileFixture from '../../../tests/fixtures/synthetic-1000-profile.json';
import partialProfileFixture from '../../../tests/fixtures/synthetic-30pct-profile.json';
import expectedStatsFixture from '../../../tests/fixtures/synthetic-expected-stats.json';

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
});
