import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { LetterboxdImportService } from './letterboxd-import.service';
import { UserDataService } from './user-data.service';
import { TmdbMatcher } from './tmdb-matcher';

describe('LetterboxdImportService', () => {
  let service: LetterboxdImportService;
  let userData: UserDataService;
  let matcher: TmdbMatcher;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LetterboxdImportService, UserDataService, TmdbMatcher],
    });
    service = TestBed.inject(LetterboxdImportService);
    userData = TestBed.inject(UserDataService);
    matcher = TestBed.inject(TmdbMatcher);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should parse and stage diary entries, ratings, reviews, and likes', async () => {
    const files: Record<string, string> = {
      'diary.csv': 'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2024-01-15,Inception,2010,https://boxd.it/1sz2,4.5,Yes,"scifi, heist",2024-01-14\n',
      'reviews.csv': 'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n2024-01-15,Inception,2010,https://boxd.it/1sz2,4.5,Yes,"Masterpiece of sound and mind",scifi,2024-01-14\n',
      'ratings.csv': 'Date,Name,Year,Letterboxd URI,Rating\n2024-01-15,Inception,2010,https://boxd.it/1sz2,4.5\n2023-05-01,The Matrix,1999,https://boxd.it/2a1m,5.0\n',
      'watched.csv': 'Date,Name,Year,Letterboxd URI\n2022-01-01,Casablanca,1942,https://boxd.it/2a7y\n',
      'likes/films.csv': 'Date,Name,Year,Letterboxd URI\n2024-01-15,Inception,2010,https://boxd.it/1sz2\n',
    };

    // Spy on matcher to mock instant confident matches
    spyOn(matcher, 'match').and.callFake(async (title: string, year?: string) => ({
      sourceTitle: title,
      sourceYear: year,
      confidence: 'confident',
      matched: {
        id: 100 + title.length,
        title,
        release_date: `${year || '2000'}-01-01`,
        poster_path: '/poster.jpg',
        media_type: 'movie',
        score: 95,
      },
      candidates: [],
    }));

    const plan = await service.prepareImport(files);

    expect(plan.stagedEntries.length).toBe(3); // Inception, The Matrix, Casablanca

    const inception = plan.stagedEntries.find((e) => e.sourceTitle === 'Inception');
    expect(inception).toBeDefined();
    expect(inception?.watchedAt).toBe('2024-01-14');
    expect(inception?.rating).toBe(4.5);
    expect(inception?.rewatch).toBeTrue();
    expect(inception?.review).toBe('Masterpiece of sound and mind');
    expect(inception?.liked).toBeTrue();
    expect(inception?.dateUnknown).toBeFalse();

    const matrix = plan.stagedEntries.find((e) => e.sourceTitle === 'The Matrix');
    expect(matrix).toBeDefined();
    expect(matrix?.rating).toBe(5.0);
    expect(matrix?.dateUnknown).toBeTrue();
    expect(matrix?.watchedAt).toBeNull();

    const casablanca = plan.stagedEntries.find((e) => e.sourceTitle === 'Casablanca');
    expect(casablanca).toBeDefined();
    expect(casablanca?.dateUnknown).toBeTrue();
    expect(casablanca?.rating).toBeNull();

    // Commit import
    const commitResult = await service.commitImport(plan);
    expect(commitResult.importedCount).toBe(3);

    // Verify UserDataService has entries
    expect(userData.getWatchedCount()).toBe(3);
    const storedInception = userData.getWatchedEntry('movie', inception!.matchedMedia!.id);
    expect(storedInception?.liked).toBeTrue();
    expect(storedInception?.review).toBe('Masterpiece of sound and mind');
  });

  it('should STRICTLY protect privacy and never store email, pronoun, location or family name from profile.csv', async () => {
    const files: Record<string, string> = {
      'profile.csv':
        'Date,Username,Given Name,Family Name,Email Address,Pronoun,Location,Website,Bio\n' +
        '2024-01-01,dan_film,Dan,Miller,leaker@private.org,they/them,Secret Bunker,https://evil.com,Film curator',
    };

    const plan = await service.prepareImport(files, {
      importProfile: true,
      importWatchlist: false,
      importCustomLists: false,
      skipDuplicates: false,
    });

    expect(plan.stagedProfile).toBeDefined();
    expect(plan.stagedProfile?.displayName).toBe('dan_film');
    expect(plan.stagedProfile?.bio).toBe('Film curator');

    await service.commitImport(plan);

    const profile = userData.getProfile();
    expect(profile.displayName).toBe('dan_film');
    expect(profile.bio).toBe('Film curator');

    // Scan all keys in localStorage to ensure zero leaks
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      const val = localStorage.getItem(key)!;
      expect(val).not.toContain('leaker@private.org');
      expect(val).not.toContain('they/them');
      expect(val).not.toContain('Secret Bunker');
      expect(val).not.toContain('https://evil.com');
      expect(val).not.toContain('Miller');
    }
  });

  it('should create atomic pre-import backup and allow complete undo', async () => {
    // Seed initial state
    userData.logEntry({
      id: 999,
      media_type: 'movie',
      title: 'Original Film',
      poster_path: null,
      rating: 4.0,
      rewatch: false,
      review: 'Original review',
      tags: [],
      liked: false,
    });
    expect(userData.getWatchedCount()).toBe(1);

    const files: Record<string, string> = {
      'diary.csv': 'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2024-01-01,New Film,2024,https://boxd.it/new,5.0,No,tag,2024-01-01\n',
    };

    spyOn(matcher, 'match').and.callFake(async (title: string, year?: string) => ({
      sourceTitle: title,
      sourceYear: year,
      confidence: 'confident',
      matched: {
        id: 888,
        title,
        release_date: '2024-01-01',
        poster_path: null,
        media_type: 'movie',
        score: 95,
      },
      candidates: [],
    }));

    const plan = await service.prepareImport(files);
    await service.commitImport(plan);

    expect(userData.getWatchedCount()).toBe(2);
    expect(service.hasBackup()).toBeTrue();

    // Perform rollback / undo
    const undoSuccess = service.undoImport();
    expect(undoSuccess).toBeTrue();
    expect(userData.getWatchedCount()).toBe(1);
    expect(userData.getWatchedEntry('movie', 999)?.title).toBe('Original Film');
    expect(userData.getWatchedEntry('movie', 888)).toBeNull();
    expect(service.hasBackup()).toBeFalse();
  });

  it('should resolve profile favorites locally via Letterboxd URI mapping without external network calls', async () => {
    const files: Record<string, string> = {
      'profile.csv':
        'Date,Username,Given Name,Family Name,Email Address,Pronoun,Location,Website,Bio,Favorite Films\n' +
        '2024-01-01,film_lover,Alex,Lee,alex@test.org,he/him,NYC,https://alex.org,Cinephile,"https://boxd.it/fav1, https://boxd.it/fav2"\n',
      'watched.csv':
        'Date,Name,Year,Letterboxd URI\n' +
        '2023-01-01,Favorite Film One,2020,https://boxd.it/fav1\n' +
        '2023-01-02,Favorite Film Two,2021,https://boxd.it/fav2\n',
    };

    spyOn(matcher, 'match').and.callFake(async (title: string, year?: string) => ({
      sourceTitle: title,
      sourceYear: year,
      confidence: 'confident',
      matched: {
        id: title === 'Favorite Film One' ? 101 : 102,
        title,
        release_date: `${year || '2020'}-01-01`,
        poster_path: null,
        media_type: 'movie',
        score: 95,
      },
      candidates: [],
    }));

    const plan = await service.prepareImport(files, {
      importProfile: true,
      importWatchlist: false,
      importCustomLists: false,
      skipDuplicates: false,
    });

    expect(plan.stagedFavorites.length).toBe(2);
    expect(plan.stagedFavorites[0].matchedMedia?.id).toBe(101);
    expect(plan.stagedFavorites[1].matchedMedia?.id).toBe(102);

    await service.commitImport(plan);

    const favorites = userData.getFavorites();
    expect(favorites.length).toBe(2);
    expect(favorites.map((f) => f.id)).toEqual([101, 102]);
  });

  it('should handle large synthetic export (500 items), maintain zero duplicates on second run, and rollback atomically', async () => {
    const diaryLines = ['Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date'];
    const ratingsLines = ['Date,Name,Year,Letterboxd URI,Rating'];
    const watchedLines = ['Date,Name,Year,Letterboxd URI'];

    // Generate 500 records with unicode, rewatches, quotes, CRLF, and unmatchable titles
    for (let i = 1; i <= 500; i++) {
      const isRewatch = i % 10 === 0;
      const title = i === 1 ? 'Amélie' : i === 2 ? 'Pan\'s Labyrinth' : i === 3 ? 'The Thing' : `Synthetic Title ${i}`;
      const year = i === 3 ? (i % 2 === 0 ? '2011' : '1982') : String(1970 + (i % 50));
      const uri = `https://boxd.it/test_${i}`;
      const date = `2023-01-${String((i % 28) + 1).padStart(2, '0')}`;
      const rating = String(((i % 5) + 1) * 1.0);

      if (i <= 400) {
        diaryLines.push(`${date},"${title}",${year},${uri},${rating},${isRewatch ? 'Yes' : 'No'},"sci-fi, drama",${date}`);
      }
      if (i > 350 && i <= 450) {
        ratingsLines.push(`${date},"${title}",${year},${uri},${rating}`);
      }
      if (i > 450) {
        // Watched-only films
        watchedLines.push(`${date},"${title}",${year},${uri}`);
      }
    }

    const files: Record<string, string> = {
      'diary.csv': diaryLines.join('\r\n'),
      'ratings.csv': ratingsLines.join('\r\n'),
      'watched.csv': watchedLines.join('\r\n'),
      'deleted/reviews.csv': 'Date,Name,Year,Letterboxd URI\r\n',
      'orphaned/diary.csv': 'Date,Name,Year,Letterboxd URI\r\n',
    };

    spyOn(matcher, 'match').and.callFake(async (title: string, year?: string) => ({
      sourceTitle: title,
      sourceYear: year,
      confidence: 'confident',
      matched: {
        id: 1000 + Math.abs(title.length * 37 + (year ? parseInt(year, 10) : 0)),
        title,
        release_date: `${year || '2000'}-01-01`,
        poster_path: null,
        media_type: 'movie',
        score: 95,
      },
      candidates: [],
    }));

    const progressReports: string[] = [];
    const plan = await service.prepareImport(files, {
      importProfile: false,
      importWatchlist: false,
      importCustomLists: false,
      skipDuplicates: true,
    }, (p) => progressReports.push(p.phase));

    expect(progressReports).toContain('parsing');
    expect(progressReports).toContain('matching');
    expect(plan.stagedEntries.length).toBeGreaterThan(400);

    // Initial commit
    const result1 = await service.commitImport(plan);
    const countAfterFirstImport = userData.getWatchedCount();
    expect(result1.importedCount).toBe(countAfterFirstImport);
    expect(countAfterFirstImport).toBeGreaterThan(400);

    // Second import with skipDuplicates should yield zero newly imported entries
    const plan2 = await service.prepareImport(files, {
      importProfile: false,
      importWatchlist: false,
      importCustomLists: false,
      skipDuplicates: true,
    });
    const result2 = await service.commitImport(plan2);
    expect(result2.importedCount).toBe(0);
    expect(userData.getWatchedCount()).toBe(countAfterFirstImport);

    // Rollback restores state prior to plan2
    const rolledBack = service.undoImport();
    expect(rolledBack).toBeTrue();
    expect(userData.getWatchedCount()).toBe(countAfterFirstImport);
  });

  describe('Phase 1: Letterboxd Import Date Precision & Ground Truth', () => {
    beforeEach(() => {
      spyOn(matcher, 'match').and.callFake(async (title: string, year?: string) => ({
        sourceTitle: title,
        sourceYear: year,
        confidence: 'confident',
        matched: {
          id: title.length * 100 + (year ? parseInt(year, 10) : 0),
          title,
          release_date: `${year || '2000'}-01-01`,
          poster_path: null,
          media_type: 'movie',
          score: 95,
        },
        candidates: [],
      }));
    });

    it('1. should import Star Wars diary row with watch date exactly 2020-01-02 (not log date 2020-01-11)', async () => {
      const files: Record<string, string> = {
        'diary.csv':
          'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
          '2020-01-11,Star Wars,1977,https://boxd.it/WcKjz,4,,,2020-01-02\n',
      };

      const plan = await service.prepareImport(files);
      expect(plan.stagedEntries.length).toBe(1);
      const staged = plan.stagedEntries[0];
      expect(staged.watchedAt).toBe('2020-01-02');
      expect(staged.dateUnknown).toBeFalse();
      expect(staged.approximateDate).toBeFalse();

      await service.commitImport(plan);
      const starWarsId = staged.matchedMedia!.id;
      const stored = userData.getWatchedEntry('movie', starWarsId);
      expect(stored).toBeDefined();
      expect(stored?.watchedAt).toBe('2020-01-02');
      expect(stored?.dateUnknown).toBeFalse();
      expect(stored?.approximateDate).toBeFalse();
    });

    it('2. should fall back to Date marked as approximate when Watched Date is empty', async () => {
      const files: Record<string, string> = {
        'diary.csv':
          'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
          '2020-05-20,Blade Runner,1982,https://boxd.it/br,4.5,,,\n',
      };

      const plan = await service.prepareImport(files);
      expect(plan.stagedEntries.length).toBe(1);
      const staged = plan.stagedEntries[0];
      expect(staged.watchedAt).toBe('2020-05-20');
      expect(staged.approximateDate).toBeTrue();
      expect(staged.dateUnknown).toBeFalse();

      await service.commitImport(plan);
      const brId = staged.matchedMedia!.id;
      const stored = userData.getWatchedEntry('movie', brId);
      expect(stored?.watchedAt).toBe('2020-05-20');
      expect(stored?.approximateDate).toBeTrue();
      expect(stored?.dateUnknown).toBeFalse();
    });

    it('3. should import two diary rows for the same film with distinct dates as two separate entries', async () => {
      const files: Record<string, string> = {
        'diary.csv':
          'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
          '2020-01-11,Star Wars,1977,https://boxd.it/WcKjz,4,,,2020-01-02\n' +
          '2021-05-04,Star Wars,1977,https://boxd.it/WcKjz,5,Yes,,2021-05-04\n',
      };

      const plan = await service.prepareImport(files);
      expect(plan.stagedEntries.length).toBe(2);

      await service.commitImport(plan);

      const starWarsId = plan.stagedEntries[0].matchedMedia!.id;
      const allEntries = userData.getAllWatchedEntriesFor('movie', starWarsId);
      expect(allEntries.length).toBe(2);

      const dates = allEntries.map((e) => e.watchedAt).sort();
      expect(dates).toEqual(['2020-01-02', '2021-05-04']);

      const rewatchEntry = allEntries.find((e) => e.watchedAt === '2021-05-04');
      expect(rewatchEntry?.rewatch).toBeTrue();
      expect(rewatchEntry?.rating).toBe(5);

      const firstEntry = allEntries.find((e) => e.watchedAt === '2020-01-02');
      expect(firstEntry?.rewatch).toBeFalse();
      expect(firstEntry?.rating).toBe(4);
    });

    it('4. should import a film only in watched.csv with no watch date (stored as unknown)', async () => {
      const files: Record<string, string> = {
        'watched.csv':
          'Date,Name,Year,Letterboxd URI\n' +
          '2019-12-31,Marriage Story,2019,https://boxd.it/lB4K\n',
      };

      const plan = await service.prepareImport(files);
      expect(plan.stagedEntries.length).toBe(1);
      const staged = plan.stagedEntries[0];
      expect(staged.watchedAt).toBeNull();
      expect(staged.dateUnknown).toBeTrue();

      await service.commitImport(plan);
      const msId = staged.matchedMedia!.id;
      const stored = userData.getWatchedEntry('movie', msId);
      expect(stored).toBeDefined();
      expect(stored?.watchedAt).toBeNull();
      expect(stored?.dateUnknown).toBeTrue();
    });

    it('5. should import The Irishman in watched.csv and ratings.csv with no watch date, rating 3, and neither date leaking', async () => {
      const files: Record<string, string> = {
        'watched.csv':
          'Date,Name,Year,Letterboxd URI\n' +
          '2019-12-31,The Irishman,2019,https://boxd.it/d46q\n',
        'ratings.csv':
          'Date,Name,Year,Letterboxd URI,Rating\n' +
          '2025-05-04,The Irishman,2019,https://boxd.it/d46q,3\n',
      };

      const plan = await service.prepareImport(files);
      expect(plan.stagedEntries.length).toBe(1);
      const staged = plan.stagedEntries[0];
      expect(staged.rating).toBe(3);
      expect(staged.watchedAt).toBeNull();
      expect(staged.dateUnknown).toBeTrue();

      await service.commitImport(plan);
      const irishmanId = staged.matchedMedia!.id;
      const stored = userData.getWatchedEntry('movie', irishmanId);
      expect(stored).toBeDefined();
      expect(stored?.rating).toBe(3);
      expect(stored?.watchedAt).toBeNull();
      expect(stored?.dateUnknown).toBeTrue();
      expect(stored?.watchedAt).not.toBe('2019-12-31');
      expect(stored?.watchedAt).not.toBe('2025-05-04');
    });

    it('6. should import a review row with a Watched Date correctly', async () => {
      const files: Record<string, string> = {
        'reviews.csv':
          'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n' +
          '2021-02-15,Parasite,2019,https://boxd.it/ParasiteRev,5,No,"Brilliant satire",thriller,2021-02-10\n',
      };

      const plan = await service.prepareImport(files);
      expect(plan.stagedEntries.length).toBe(1);
      const staged = plan.stagedEntries[0];
      expect(staged.watchedAt).toBe('2021-02-10');
      expect(staged.dateUnknown).toBeFalse();
      expect(staged.review).toBe('Brilliant satire');
      expect(staged.rating).toBe(5);

      await service.commitImport(plan);
      const parasiteId = staged.matchedMedia!.id;
      const stored = userData.getWatchedEntry('movie', parasiteId);
      expect(stored?.watchedAt).toBe('2021-02-10');
      expect(stored?.dateUnknown).toBeFalse();
      expect(stored?.review).toBe('Brilliant satire');
    });

    it('7. should correctly parse diary row with UTF-8 BOM, CRLF, and reordered columns', async () => {
      const csvWithBomAndCrlf =
        '\uFEFFWatched Date,Letterboxd URI,Rating,Rewatch,Tags,Name,Year,Date\r\n' +
        '2022-03-05,https://boxd.it/BOM1,4.5,No,"drama, awards",Drive My Car,2021,2022-03-10\r\n';

      const files: Record<string, string> = {
        'diary.csv': csvWithBomAndCrlf,
      };

      const plan = await service.prepareImport(files);
      expect(plan.stagedEntries.length).toBe(1);
      const staged = plan.stagedEntries[0];
      expect(staged.sourceTitle).toBe('Drive My Car');
      expect(staged.sourceYear).toBe('2021');
      expect(staged.watchedAt).toBe('2022-03-05');
      expect(staged.dateUnknown).toBeFalse();
      expect(staged.rating).toBe(4.5);

      await service.commitImport(plan);
      const stored = userData.getWatchedEntry('movie', staged.matchedMedia!.id);
      expect(stored?.watchedAt).toBe('2022-03-05');
      expect(stored?.dateUnknown).toBeFalse();
    });

    it('8. should support optional approximate date from watched.csv when option is enabled', async () => {
      const files: Record<string, string> = {
        'watched.csv':
          'Date,Name,Year,Letterboxd URI\n' +
          '2019-12-31,Marriage Story,2019,https://boxd.it/lB4K\n',
      };

      const plan = await service.prepareImport(files, {
        importProfile: false,
        importWatchlist: false,
        importCustomLists: false,
        skipDuplicates: false,
        useLetterboxdWatchedDateAsApproximate: true,
      });

      expect(plan.stagedEntries.length).toBe(1);
      const staged = plan.stagedEntries[0];
      expect(staged.watchedAt).toBe('2019-12-31');
      expect(staged.approximateDate).toBeTrue();
      expect(staged.dateUnknown).toBeFalse();

      await service.commitImport(plan);
      const stored = userData.getWatchedEntry('movie', staged.matchedMedia!.id);
      expect(stored?.watchedAt).toBe('2019-12-31');
      expect(stored?.approximateDate).toBeTrue();
      expect(stored?.dateUnknown).toBeFalse();
    });

    it('9. should idempotently re-import to correct dates on unedited entries without duplicates and preserve user edits', async () => {
      // 1. Initial import with wrong/approx date
      const initialFiles: Record<string, string> = {
        'diary.csv':
          'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
          '2020-01-11,Star Wars,1977,https://boxd.it/WcKjz,4,,,2020-01-02\n' +
          '2020-05-20,Blade Runner,1982,https://boxd.it/br,4.5,,,\n',
      };

      const plan1 = await service.prepareImport(initialFiles);
      await service.commitImport(plan1);
      expect(userData.getWatchedCount()).toBe(2);

      const starWarsId = plan1.stagedEntries[0].matchedMedia!.id;
      const bladeRunnerId = plan1.stagedEntries[1].matchedMedia!.id;

      // User manually edits Blade Runner rating & review
      const brEntry = userData.getWatchedEntry('movie', bladeRunnerId)!;
      userData.logEntry({
        ...brEntry,
        rating: 5.0,
        review: 'User edited review that must be preserved',
        userEdited: true,
      });

      // 2. Re-import the export
      const plan2 = await service.prepareImport(initialFiles);
      const result2 = await service.commitImport(plan2);

      // No duplicate entries created
      expect(userData.getWatchedCount()).toBe(2);

      // Star Wars (unedited) retains/updates clean state
      const updatedStarWars = userData.getWatchedEntry('movie', starWarsId);
      expect(updatedStarWars?.watchedAt).toBe('2020-01-02');

      // Blade Runner preserved user edits
      const updatedBr = userData.getWatchedEntry('movie', bladeRunnerId);
      expect(updatedBr?.rating).toBe(5.0);
      expect(updatedBr?.review).toBe('User edited review that must be preserved');
    });

    it('10. should ensure watch date calendar formatting is invariant to time zones and never shifts days', async () => {
      const files: Record<string, string> = {
        'diary.csv':
          'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
          '2020-01-11,Star Wars,1977,https://boxd.it/WcKjz,4,,,2020-01-02\n',
      };

      const plan = await service.prepareImport(files);
      await service.commitImport(plan);

      const entry = userData.getWatchedList().find((e) => e.title === 'Star Wars');
      expect(entry).toBeDefined();
      expect(entry?.watchedAt).toBe('2020-01-02');

      // Verify that calendar date parsing extracts exactly 2020, 1, 2 regardless of system time zone
      const [year, month, day] = (entry?.watchedAt || '').split('-').map(Number);
      expect(year).toBe(2020);
      expect(month).toBe(1);
      expect(day).toBe(2);
    });
  });
});
