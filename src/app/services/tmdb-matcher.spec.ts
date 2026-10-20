import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TmdbMatcher } from './tmdb-matcher';
import { TmdbService } from './tmdb.service';

describe('TmdbMatcher', () => {
  let matcher: TmdbMatcher;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TmdbMatcher, TmdbService],
    });
    matcher = TestBed.inject(TmdbMatcher);
  });

  afterEach(() => {
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
});
