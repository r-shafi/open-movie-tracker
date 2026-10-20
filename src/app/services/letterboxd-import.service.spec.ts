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
});
