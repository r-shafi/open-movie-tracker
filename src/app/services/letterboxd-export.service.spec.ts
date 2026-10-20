import { TestBed } from '@angular/core/testing';
import { LetterboxdExportService } from './letterboxd-export.service';
import { UserDataService } from './user-data.service';
import { LetterboxdArchive } from './letterboxd-archive';
import { CsvParser } from './csv-parser';

describe('LetterboxdExportService', () => {
  let service: LetterboxdExportService;
  let userData: UserDataService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [LetterboxdExportService, UserDataService],
    });
    service = TestBed.inject(LetterboxdExportService);
    userData = TestBed.inject(UserDataService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should export diary, ratings, reviews, and watchlist CSVs matching Letterboxd schema', () => {
    userData.logEntry({
      id: 101,
      media_type: 'movie',
      title: 'Inception',
      poster_path: null,
      watchedAt: '2024-01-14T20:00:00Z',
      dateUnknown: false,
      rating: 4.5,
      rewatch: true,
      review: 'Mind bending classic',
      tags: ['scifi', 'heist'],
      liked: true,
      sourceKey: 'https://boxd.it/1sz2',
      release_date: '2010-07-16',
    });

    userData.logEntry({
      id: 102,
      media_type: 'movie',
      title: 'Casablanca',
      poster_path: null,
      watchedAt: null,
      dateUnknown: true,
      rating: 5.0,
      rewatch: false,
      review: '',
      tags: [],
      liked: false,
      release_date: '1942-11-26',
    });

    userData.addToWatchlist({
      id: 103,
      media_type: 'movie',
      title: 'Dune: Part Two',
      poster_path: null,
      release_date: '2024-03-01',
    });

    // 1. Diary CSV (excludes dateUnknown)
    const diaryCsv = service.exportDiaryCsv();
    const parsedDiary = CsvParser.parse(diaryCsv);
    expect(parsedDiary.rows.length).toBe(1);
    expect(parsedDiary.rows[0].Name).toBe('Inception');
    expect(parsedDiary.rows[0].Rating).toBe('4.5');
    expect(parsedDiary.rows[0].Rewatch).toBe('Yes');

    // 2. Ratings CSV (includes both rated films)
    const ratingsCsv = service.exportRatingsCsv();
    const parsedRatings = CsvParser.parse(ratingsCsv);
    expect(parsedRatings.rows.length).toBe(2);

    // 3. Reviews CSV (only Inception)
    const reviewsCsv = service.exportReviewsCsv();
    const parsedReviews = CsvParser.parse(reviewsCsv);
    expect(parsedReviews.rows.length).toBe(1);
    expect(parsedReviews.rows[0].Review).toBe('Mind bending classic');

    // 4. Watchlist CSV
    const watchlistCsv = service.exportWatchlistCsv();
    const parsedWatchlist = CsvParser.parse(watchlistCsv);
    expect(parsedWatchlist.rows.length).toBe(1);
    expect(parsedWatchlist.rows[0].Name).toBe('Dune: Part Two');

    // 5. ZIP bundle export
    const zipBytes = service.exportZip();
    expect(zipBytes.byteLength).toBeGreaterThan(0);
    const unzipped = LetterboxdArchive.unzip(zipBytes);
    expect(unzipped.files['diary.csv']).toContain('Inception');
    expect(unzipped.files['ratings.csv']).toContain('Casablanca');
    expect(unzipped.files['watchlist.csv']).toContain('Dune: Part Two');
  });
});
