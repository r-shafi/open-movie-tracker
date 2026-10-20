import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TmdbMatcher } from './tmdb-matcher';
import { TmdbService } from './tmdb.service';

describe('TmdbMatcher', () => {
  let matcher: TmdbMatcher;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TmdbMatcher, TmdbService],
    });
    matcher = TestBed.inject(TmdbMatcher);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('normalizeTitle', () => {
    it('should strip diacritics and accents', () => {
      expect(TmdbMatcher.normalizeTitle('Amélie')).toBe('amelie');
      expect(TmdbMatcher.normalizeTitle('Pan’s Labyrinth')).toBe('pan s labyrinth');
      expect(TmdbMatcher.normalizeTitle('Crouching Tiger, Hidden Dragon')).toBe('crouching tiger hidden dragon');
    });

    it('should strip common leading articles', () => {
      expect(TmdbMatcher.normalizeTitle('The Matrix')).toBe('matrix');
      expect(TmdbMatcher.normalizeTitle('A Quiet Place')).toBe('quiet place');
      expect(TmdbMatcher.normalizeTitle('An Inconvenient Truth')).toBe('inconvenient truth');
      expect(TmdbMatcher.normalizeTitle('Le Fabuleux Destin d\'Amélie Poulain')).toBe('fabuleux destin d amelie poulain');
    });
  });

  describe('scoreCandidate', () => {
    it('should award confident score (>= 90) for exact title and exact year', () => {
      const score = TmdbMatcher.scoreCandidate('Inception', '2010', {
        title: 'Inception',
        release_date: '2010-07-16',
        vote_count: 35000,
      });
      expect(score).toBeGreaterThanOrEqual(90);
    });

    it('should award high score for festival release year (+/- 1 year)', () => {
      const scoreExact = TmdbMatcher.scoreCandidate('Parasite', '2019', {
        title: 'Parasite',
        release_date: '2019-05-30',
        vote_count: 18000,
      });
      const scoreTolerance = TmdbMatcher.scoreCandidate('Parasite', '2020', {
        title: 'Parasite',
        release_date: '2019-05-30',
        vote_count: 18000,
      });
      expect(scoreTolerance).toBeGreaterThanOrEqual(80);
      expect(scoreExact).toBeGreaterThan(scoreTolerance);
    });

    it('should penalize significant year mismatches', () => {
      const scoreSameYear = TmdbMatcher.scoreCandidate('The Thing', '1982', {
        title: 'The Thing',
        release_date: '1982-06-25',
        vote_count: 5000,
      });
      const scoreDifferentYear = TmdbMatcher.scoreCandidate('The Thing', '2011', {
        title: 'The Thing',
        release_date: '1982-06-25',
        vote_count: 5000,
      });
      expect(scoreSameYear).toBeGreaterThanOrEqual(90);
      expect(scoreDifferentYear).toBeLessThan(scoreSameYear);
    });
  });

  describe('match HTTP calls', () => {
    it('should perform confident match for exact title and year', async () => {
      const matchPromise = matcher.match('Inception', '2010');

      const req = httpMock.expectOne((r) => r.url.includes('/search/movie') && r.url.includes('Inception'));
      expect(req.request.method).toBe('GET');
      req.flush({
        results: [
          {
            id: 27205,
            title: 'Inception',
            original_title: 'Inception',
            release_date: '2010-07-16',
            poster_path: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg',
            vote_count: 35000,
            popularity: 120,
          },
        ],
      });

      const res = await matchPromise;
      expect(res.confidence).toBe('confident');
      expect(res.matched?.id).toBe(27205);
      expect(res.matched?.title).toBe('Inception');
    });

    it('should perform confident match for accented title', async () => {
      const matchPromise = matcher.match('Amélie', '2001');

      const req = httpMock.expectOne((r) => r.url.includes('/search/movie'));
      req.flush({
        results: [
          {
            id: 194,
            title: 'Amélie',
            original_title: 'Le Fabuleux Destin d\'Amélie Poulain',
            release_date: '2001-04-25',
            poster_path: '/amelie.jpg',
            vote_count: 12000,
            popularity: 50,
          },
        ],
      });

      const res = await matchPromise;
      expect(res.confidence).toBe('confident');
      expect(res.matched?.id).toBe(194);
    });

    it('should perform confident match for titles with leading articles', async () => {
      const matchPromise = matcher.match('The Matrix', '1999');

      const req = httpMock.expectOne((r) => r.url.includes('/search/movie'));
      req.flush({
        results: [
          {
            id: 603,
            title: 'The Matrix',
            original_title: 'The Matrix',
            release_date: '1999-03-31',
            poster_path: '/matrix.jpg',
            vote_count: 24000,
            popularity: 80,
          },
        ],
      });

      const res = await matchPromise;
      expect(res.confidence).toBe('confident');
      expect(res.matched?.id).toBe(603);
    });

    it('should discriminate and select the candidate matching source release year', async () => {
      const matchPromise = matcher.match('The Thing', '1982');

      const req = httpMock.expectOne((r) => r.url.includes('/search/movie'));
      req.flush({
        results: [
          {
            id: 1091,
            title: 'The Thing',
            release_date: '1982-06-25',
            vote_count: 5500,
          },
          {
            id: 60935,
            title: 'The Thing',
            release_date: '2011-10-12',
            vote_count: 2100,
          },
        ],
      });

      const res = await matchPromise;
      expect(res.confidence).toBe('confident');
      expect(res.matched?.id).toBe(1091);
    });

    it('should mark confidence as ambiguous when candidates have near-identical top scores', async () => {
      const matchPromise = matcher.match('Solaris', '1972');

      const req = httpMock.expectOne((r) => r.url.includes('/search/movie'));
      req.flush({
        results: [
          {
            id: 593,
            title: 'Solaris',
            release_date: '1972-03-20',
            vote_count: 1400,
          },
          {
            id: 843,
            title: 'Solaris',
            release_date: '1972-09-01',
            vote_count: 1350,
          },
        ],
      });

      const res = await matchPromise;
      expect(res.confidence).toBe('ambiguous');
      expect(res.matched).toBeNull();
      expect(res.candidates.length).toBe(2);
    });

    it('should mark as unmatched when TMDb returns no results', async () => {
      const matchPromise = matcher.match('Nonexistent Film XYZ999', '1990');

      const req1 = httpMock.expectOne((r) => r.url.includes('year=1990'));
      req1.flush({ results: [] });

      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }

      const req2 = httpMock.expectOne((r) => !r.url.includes('&year=1990') && r.url.includes('/search/movie'));
      req2.flush({ results: [] });

      const res = await matchPromise;
      expect(res.confidence).toBe('unmatched');
      expect(res.matched).toBeNull();
      expect(res.candidates.length).toBe(0);
    });

    it('should handle 429 rate limit with backoff and retry successfully', async () => {
      spyOn(window, 'setTimeout').and.callFake(((fn: () => void) => {
        fn();
        return 0 as any;
      }) as any);

      const matchPromise = matcher.match('Dune', '2021');

      const req1 = httpMock.expectOne((r) => r.url.includes('/search/movie'));
      req1.flush('Too many requests', { status: 429, statusText: 'Too Many Requests' });

      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }

      const req2 = httpMock.expectOne((r) => r.url.includes('/search/movie'));
      req2.flush({
        results: [
          {
            id: 438631,
            title: 'Dune',
            release_date: '2021-09-15',
            vote_count: 11000,
          },
        ],
      });

      const res = await matchPromise;
      expect(res.confidence).toBe('confident');
      expect(res.matched?.id).toBe(438631);
    });
  });
});
