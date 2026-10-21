import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';
import { UserDataService } from './user-data.service';

describe('UserDataService', () => {
  let service: UserDataService;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    toastSpy = jasmine.createSpyObj('ToastService', ['showToast']);

    TestBed.configureTestingModule({
      providers: [
        UserDataService,
        { provide: ToastService, useValue: toastSpy },
      ],
    });
    service = TestBed.inject(UserDataService);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should be created and initialize default schema v4', () => {
    expect(service).toBeTruthy();
    expect(localStorage.getItem(service.SCHEMA_VERSION_KEY)).toBe('4');
    const profile = service.getProfile();
    expect(profile.displayName).toBe('Movie Fan');
  });

  describe('Multi-entry and rewatch logging', () => {
    it('should log a first watch and then log a distinct rewatch for the same film', () => {
      const firstLog = service.logEntry({
        id: 550,
        media_type: 'movie',
        title: 'Fight Club',
        watchedAt: '2022-05-10',
        rating: 4.5,
        review: 'Great first watch',
      });

      expect(firstLog.entryId).toBeTruthy();
      expect(firstLog.rewatch).toBeFalse();
      expect(service.isWatched('movie', 550)).toBeTrue();

      // Log a rewatch for the same movie
      const rewatchLog = service.logEntry({
        id: 550,
        media_type: 'movie',
        title: 'Fight Club',
        watchedAt: '2024-01-15',
        rating: 5.0,
        review: 'Even better on rewatch',
        isNewRewatchLog: true,
      });

      expect(rewatchLog.entryId).toBeTruthy();
      expect(rewatchLog.entryId).not.toEqual(firstLog.entryId);
      expect(rewatchLog.rewatch).toBeTrue();

      const allFightClub = service.getAllWatchedEntriesFor('movie', 550);
      expect(allFightClub.length).toBe(2);
      expect(allFightClub[0].watchedAt).toBe('2024-01-15');
      expect(allFightClub[1].watchedAt).toBe('2022-05-10');

      // getWatchedEntry should return the latest entry
      const latest = service.getWatchedEntry('movie', 550);
      expect(latest?.rating).toBe(5.0);
    });

    it('should support date unknown state without fabricating dates', () => {
      const undated = service.logEntry({
        id: 680,
        media_type: 'movie',
        title: 'Pulp Fiction',
        dateUnknown: true,
        rating: 4.0,
      });

      expect(undated.watchedAt).toBeNull();
      expect(undated.dateUnknown).toBeTrue();
      expect(service.isWatched('movie', 680)).toBeTrue();
    });

    it('should remove a single log entry when entryId is supplied', () => {
      const log1 = service.logEntry({
        id: 11,
        media_type: 'movie',
        title: 'Star Wars',
        watchedAt: '2021-01-01T00:00:00Z',
      });
      const log2 = service.logEntry({
        id: 11,
        media_type: 'movie',
        title: 'Star Wars',
        watchedAt: '2023-01-01T00:00:00Z',
        isNewRewatchLog: true,
      });

      expect(service.getAllWatchedEntriesFor('movie', 11).length).toBe(2);

      service.removeWatched('movie', 11, log1.entryId);
      const remaining = service.getAllWatchedEntriesFor('movie', 11);
      expect(remaining.length).toBe(1);
      expect(remaining[0].entryId).toBe(log2.entryId);
    });
  });

  describe('Watchlist and Favorites', () => {
    it('should add and remove items from watchlist', () => {
      service.addToWatchlist({
        id: 100,
        media_type: 'movie',
        title: 'Inception',
        poster_path: '/poster.jpg',
      });

      expect(service.isOnWatchlist('movie', 100)).toBeTrue();
      expect(service.getWatchlist().length).toBe(1);

      service.removeFromWatchlist('movie', 100);
      expect(service.isOnWatchlist('movie', 100)).toBeFalse();
    });

    it('should limit favorites to 4 items', () => {
      for (let i = 1; i <= 4; i++) {
        service.addFavorite({
          id: i,
          media_type: 'movie',
          title: `Movie ${i}`,
          poster_path: null,
        });
      }
      expect(service.getFavorites().length).toBe(4);

      // Attempt 5th favorite
      service.addFavorite({
        id: 5,
        media_type: 'movie',
        title: 'Movie 5',
        poster_path: null,
      });

      expect(service.getFavorites().length).toBe(4);
      expect(toastSpy.showToast).toHaveBeenCalledWith('Favorites are limited to 4 items.');
    });
  });

  describe('Custom Lists', () => {
    it('should create, add items to, and delete custom lists', () => {
      const list = service.createList('Sci-Fi Favorites', 'My top sci-fi');
      expect(list.id).toBeTruthy();
      expect(service.getList(list.id)?.name).toBe('Sci-Fi Favorites');

      service.addToList(list.id, {
        id: 157336,
        media_type: 'movie',
        title: 'Interstellar',
        poster_path: '/interstellar.jpg',
      });

      const updated = service.getList(list.id);
      expect(updated?.items.length).toBe(1);
      expect(updated?.items[0].title).toBe('Interstellar');

      service.deleteList(list.id);
      expect(service.getList(list.id)).toBeNull();
    });
  });

  describe('Guarded Storage & Quota Exceeded handling', () => {
    it('should purge volatile tmdb_cache_v2 keys if storage quota is hit', () => {
      localStorage.setItem('tmdb_cache_v2:test1', JSON.stringify({ data: 'foo' }));
      localStorage.setItem('tmdb_cache_v2:test2', JSON.stringify({ data: 'bar' }));

      // Spy on localStorage.setItem to simulate QuotaExceededError on first call, then succeed
      let callCount = 0;
      const originalSetItem = localStorage.setItem.bind(localStorage);
      spyOn(localStorage, 'setItem').and.callFake((key: string, value: string) => {
        callCount++;
        if (callCount === 1 && key === service.WATCHED_KEY) {
          const err = new Error('Quota exceeded');
          err.name = 'QuotaExceededError';
          throw err;
        }
        return originalSetItem(key, value);
      });

      const logged = service.logEntry({
        id: 123,
        media_type: 'movie',
        title: 'Test',
      });

      expect(logged).toBeTruthy();
      // Volatile caches should have been purged during retry
      expect(localStorage.getItem('tmdb_cache_v2:test1')).toBeNull();
    });
  });

  describe('Backup export and validated import', () => {
    it('should produce versioned JSON backup and safely import it with merge', () => {
      service.logEntry({ id: 1, media_type: 'movie', title: 'Film A', rating: 4 });
      service.addToWatchlist({ id: 2, media_type: 'movie', title: 'Film B', poster_path: null });

      const exportedJson = service.exportBackup();
      const parsed = JSON.parse(exportedJson);

      expect(parsed.version).toBe(service.SCHEMA_VERSION);
      expect(parsed.app).toBe('Open Movie Tracker');

      // Clear local data and import back
      localStorage.clear();
      const fresh = TestBed.inject(UserDataService);

      const result = fresh.importBackup(exportedJson, 'merge');
      expect(result.success).toBeTrue();
      expect(fresh.isWatched('movie', 1)).toBeTrue();
      expect(fresh.isOnWatchlist('movie', 2)).toBeTrue();
    });

    it('should reject invalid or corrupt JSON safely without throwing', () => {
      const result = service.importBackup('not valid json {{{{', 'merge');
      expect(result.success).toBeFalse();
      expect(result.message).toContain('Invalid JSON');
    });

    it('should support one-tap undo rollback after import', () => {
      service.logEntry({ id: 99, media_type: 'movie', title: 'Original Film' });
      const badBackup = JSON.stringify({
        data: {
          [service.WATCHED_KEY]: {},
        },
      });

      service.importBackup(badBackup, 'replace');
      expect(service.isWatched('movie', 99)).toBeFalse();

      const undone = service.restoreBackupSnapshot();
      expect(undone).toBeTrue();
      expect(service.isWatched('movie', 99)).toBeTrue();
    });
  });
});
