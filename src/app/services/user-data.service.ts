import { Injectable } from '@angular/core';
import { ToastService } from './toast.service';

export interface UserProfile {
  displayName: string;
  bio: string;
  avatarBase64: string | null;
  coverBase64: string | null;
  joinedAt: string;
}

export interface MediaMetadataSnapshot {
  runtimeMinutes?: number;
  genres?: Array<{ id: number; name: string }>;
  releaseYear?: number;
  releaseDate?: string;
  originalLanguage?: string;
  productionCountries?: string[];
  directors?: Array<{ id: number; name: string }>;
  topCast?: Array<{ id: number; name: string }>;
  tmdbVoteAverage?: number;
  posterPath?: string | null;
  backdropPath?: string | null;
}

export interface WatchedEntry {
  entryId: string; // Unique UUID per log event (supports rewatches/multiple logs for same title)
  id: number; // TMDb media ID
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  watchedAt: string | null; // ISO 8601 string, or null when watch date is unknown
  dateUnknown?: boolean; // true if film was logged without a specific date
  approximateDate?: boolean; // true if date was inferred or fallback
  rewatch: boolean;
  rating: number | null; // 0.5 to 5.0 in 0.5 steps
  review: string;
  tags: string[];
  liked: boolean;
  sourceKey?: string; // Stable external reference key (e.g. Letterboxd URI)
  release_date?: string;
  first_air_date?: string;
  snapshot?: MediaMetadataSnapshot;
}

export interface WatchlistEntry {
  id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  addedAt: string;
  release_date?: string;
  first_air_date?: string;
}

export interface FavoriteEntry {
  id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
}

export interface UserList {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  items: WatchlistEntry[];
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  language: string;
  region: string;
  includeAdult: boolean;
  displayName: string;
  excludeLanguages: string[];
  fadeWatched: boolean;
  defaultMediaTab: 'movies' | 'tv';
  primaryColor: 'green' | 'red';
  tmdbApiKey?: string;
  autoCheckUpdates?: boolean;
}

type SettingsRecord = AppSettings & {
  episodeWatched?: Record<string, boolean>;
};

interface LegacyUserRating {
  rating: number;
  date: string;
}

interface LegacyUserReview {
  text: string;
  rating?: number;
  spoilers: boolean;
  date: string;
}

export interface ImportResult {
  success: boolean;
  message: string;
  importedCounts?: {
    watched: number;
    watchlist: number;
    favorites: number;
    lists: number;
  };
}

@Injectable({ providedIn: 'root' })
export class UserDataService {
  readonly SCHEMA_VERSION = 2;
  readonly SCHEMA_VERSION_KEY = 'mva_schema_version';
  readonly PROFILE_KEY = 'mva_profile';
  readonly WATCHED_KEY = 'mva_watched';
  readonly WATCHLIST_KEY = 'mva_watchlist';
  readonly FAVORITES_KEY = 'mva_favorites';
  readonly LISTS_KEY = 'mva_lists';
  readonly SETTINGS_KEY = 'mva_settings';
  readonly BOOKMARKED_LISTS_KEY = 'mva_bookmarked_lists';
  readonly RECENT_LISTS_KEY = 'mva_recent_lists';
  readonly LIST_SCROLL_KEY = 'mva_list_scroll';
  readonly BACKUP_KEY = 'mva_backup_before_import';

  constructor(private toast: ToastService) {
    this.initializeStorage();
  }

  private initializeStorage(): void {
    this.migrateFromLegacy();
    this.migrateToSchemaV2();
  }

  // ── Profile ──────────────────────────────────────────────────────────────

  getProfile(): UserProfile {
    const stored = this.readJson<UserProfile | null>(this.PROFILE_KEY, null);
    if (!stored) {
      const fresh = this.buildDefaultProfile();
      this.writeJson(this.PROFILE_KEY, fresh);
      return fresh;
    }
    const joinedAt = stored.joinedAt || new Date().toISOString();
    const merged: UserProfile = {
      displayName: stored.displayName || 'Movie Fan',
      bio: stored.bio || '',
      avatarBase64: stored.avatarBase64 ?? null,
      coverBase64: stored.coverBase64 ?? null,
      joinedAt,
    };
    if (joinedAt !== stored.joinedAt) {
      this.writeJson(this.PROFILE_KEY, merged);
    }
    return merged;
  }

  saveProfile(patch: Partial<UserProfile>): void {
    const current = this.getProfile();
    const updated: UserProfile = {
      ...current,
      ...patch,
      joinedAt: current.joinedAt || patch.joinedAt || new Date().toISOString(),
    };
    this.writeJson(this.PROFILE_KEY, updated);
  }

  // ── Watched (Multi-Entry & Rewatch Support) ───────────────────────────────

  getWatched(): Record<string, WatchedEntry> {
    return this.readJson<Record<string, WatchedEntry>>(this.WATCHED_KEY, {});
  }

  getWatchedList(): WatchedEntry[] {
    const entries = Object.values(this.getWatched());
    return entries.sort((a, b) => {
      if (a.dateUnknown && !b.dateUnknown) return 1;
      if (!a.dateUnknown && b.dateUnknown) return -1;
      return (b.watchedAt || '').localeCompare(a.watchedAt || '');
    });
  }

  getWatchedCount(): number {
    return Object.keys(this.getWatched()).length;
  }

  getWatchedEntry(mediaType: string, id: number): WatchedEntry | null {
    const all = this.getAllWatchedEntriesFor(mediaType, id);
    return all.length ? all[0] : null;
  }

  getAllWatchedEntriesFor(mediaType: string, id: number): WatchedEntry[] {
    const watched = Object.values(this.getWatched());
    return watched
      .filter((e) => e.media_type === mediaType && e.id === id)
      .sort((a, b) => {
        if (a.dateUnknown && !b.dateUnknown) return 1;
        if (!a.dateUnknown && b.dateUnknown) return -1;
        return (b.watchedAt || '').localeCompare(a.watchedAt || '');
      });
  }

  logEntry(
    entry: {
      entryId?: string;
      id: number;
      media_type: 'movie' | 'tv';
      title: string;
      poster_path?: string | null;
      watchedAt?: string | null;
      dateUnknown?: boolean;
      approximateDate?: boolean;
      rewatch?: boolean;
      rating?: number | null;
      review?: string;
      tags?: string[];
      liked?: boolean;
      sourceKey?: string;
      release_date?: string;
      first_air_date?: string;
      snapshot?: MediaMetadataSnapshot;
      isNewRewatchLog?: boolean;
    },
  ): WatchedEntry {
    const watched = this.getWatched();
    const existingSameTitle = this.getWatchedEntry(entry.media_type, entry.id);

    // If explicit entryId is provided, update that entry.
    // If not provided and not explicitly a new rewatch log, update existing entry if present, else create new.
    let targetEntryId = entry.entryId;
    if (!targetEntryId) {
      if (existingSameTitle && !entry.isNewRewatchLog) {
        targetEntryId = existingSameTitle.entryId;
      } else {
        targetEntryId = crypto.randomUUID();
      }
    }

    const existingTarget = watched[targetEntryId] || existingSameTitle;

    const isDateUnknown =
      entry.dateUnknown === true ||
      (entry.watchedAt === null && entry.dateUnknown !== false);

    const watchedAt = isDateUnknown
      ? null
      : entry.watchedAt || existingTarget?.watchedAt || new Date().toISOString();

    const rating = this.normalizeRating(
      entry.rating !== undefined ? entry.rating : (existingTarget?.rating ?? null),
    );

    const fullEntry: WatchedEntry = {
      entryId: targetEntryId,
      id: entry.id,
      media_type: entry.media_type,
      title: entry.title,
      poster_path: entry.poster_path !== undefined ? entry.poster_path : (existingTarget?.poster_path ?? null),
      watchedAt,
      dateUnknown: isDateUnknown,
      approximateDate: entry.approximateDate ?? existingTarget?.approximateDate ?? false,
      rewatch: entry.rewatch ?? (existingSameTitle ? true : false),
      rating,
      review: entry.review ?? existingTarget?.review ?? '',
      tags: entry.tags ?? existingTarget?.tags ?? [],
      liked: entry.liked ?? existingTarget?.liked ?? false,
      sourceKey: entry.sourceKey ?? existingTarget?.sourceKey,
      release_date: entry.release_date ?? existingTarget?.release_date,
      first_air_date: entry.first_air_date ?? existingTarget?.first_air_date,
      snapshot: entry.snapshot ?? existingTarget?.snapshot,
    };

    watched[targetEntryId] = fullEntry;
    this.writeJson(this.WATCHED_KEY, watched);
    return fullEntry;
  }

  removeWatched(mediaType: string, id: number, entryId?: string): void {
    const watched = this.getWatched();
    if (entryId && watched[entryId]) {
      delete watched[entryId];
      this.writeJson(this.WATCHED_KEY, watched);
      return;
    }

    let modified = false;
    Object.keys(watched).forEach((k) => {
      const e = watched[k];
      if (e && e.media_type === mediaType && e.id === id) {
        delete watched[k];
        modified = true;
      }
    });

    if (modified) {
      this.writeJson(this.WATCHED_KEY, watched);
    }
  }

  updateSnapshot(mediaType: string, id: number, snapshot: MediaMetadataSnapshot): void {
    const watched = this.getWatched();
    let modified = false;
    Object.keys(watched).forEach((k) => {
      const e = watched[k];
      if (e && e.media_type === mediaType && e.id === id) {
        e.snapshot = snapshot;
        modified = true;
      }
    });
    if (modified) {
      this.writeJson(this.WATCHED_KEY, watched);
    }
  }

  getMissingSnapshotTitles(): Array<{ media_type: 'movie' | 'tv'; id: number; title: string }> {
    const watched = Object.values(this.getWatched());
    const seen = new Set<string>();
    const missing: Array<{ media_type: 'movie' | 'tv'; id: number; title: string }> = [];

    watched.forEach((e) => {
      const key = `${e.media_type}:${e.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        if (!e.snapshot || e.snapshot.runtimeMinutes === undefined || !e.snapshot.genres) {
          missing.push({ media_type: e.media_type, id: e.id, title: e.title });
        }
      }
    });

    return missing;
  }

  isWatched(mediaType: string, id: number): boolean {
    return this.getAllWatchedEntriesFor(mediaType, id).length > 0;
  }

  isLiked(mediaType: string, id: number): boolean {
    return this.getAllWatchedEntriesFor(mediaType, id).some((e) => e.liked);
  }

  // ── Watchlist ────────────────────────────────────────────────────────────

  getWatchlist(): WatchlistEntry[] {
    const record = this.readJson<Record<string, WatchlistEntry>>(
      this.WATCHLIST_KEY,
      {},
    );
    return Object.values(record).sort((a, b) =>
      b.addedAt.localeCompare(a.addedAt),
    );
  }

  addToWatchlist(item: Omit<WatchlistEntry, 'addedAt'>): void {
    const record = this.readJson<Record<string, WatchlistEntry>>(
      this.WATCHLIST_KEY,
      {},
    );
    const key = `${item.media_type}:${item.id}`;
    if (!record[key]) {
      record[key] = { ...item, addedAt: new Date().toISOString() };
      this.writeJson(this.WATCHLIST_KEY, record);
    }
  }

  removeFromWatchlist(mediaType: string, id: number): void {
    const record = this.readJson<Record<string, WatchlistEntry>>(
      this.WATCHLIST_KEY,
      {},
    );
    const key = `${mediaType}:${id}`;
    if (record[key]) {
      delete record[key];
      this.writeJson(this.WATCHLIST_KEY, record);
    }
  }

  isOnWatchlist(mediaType: string, id: number): boolean {
    const record = this.readJson<Record<string, WatchlistEntry>>(
      this.WATCHLIST_KEY,
      {},
    );
    return !!record[`${mediaType}:${id}`];
  }

  // ── Favorites ────────────────────────────────────────────────────────────

  getFavorites(): FavoriteEntry[] {
    const list = this.readJson<FavoriteEntry[]>(this.FAVORITES_KEY, []);
    return list.slice(0, 4);
  }

  addFavorite(item: FavoriteEntry): void {
    const list = this.readJson<FavoriteEntry[]>(this.FAVORITES_KEY, []);
    if (
      list.some((f) => f.id === item.id && f.media_type === item.media_type)
    ) {
      return;
    }
    if (list.length >= 4) {
      this.toast.showToast('Favorites are limited to 4 items.');
      return;
    }
    list.push(item);
    this.writeJson(this.FAVORITES_KEY, list);
  }

  removeFavorite(mediaType: string, id: number): void {
    const list = this.readJson<FavoriteEntry[]>(this.FAVORITES_KEY, []);
    const next = list.filter(
      (f) => !(f.id === id && f.media_type === mediaType),
    );
    this.writeJson(this.FAVORITES_KEY, next);
  }

  reorderFavorites(ordered: FavoriteEntry[]): void {
    const seen = new Set<string>();
    const next: FavoriteEntry[] = [];
    ordered.forEach((item) => {
      const key = `${item.media_type}:${item.id}`;
      if (!seen.has(key) && next.length < 4) {
        seen.add(key);
        next.push(item);
      }
    });
    this.writeJson(this.FAVORITES_KEY, next);
  }

  // ── Lists ────────────────────────────────────────────────────────────────

  getLists(): UserList[] {
    const record = this.readJson<Record<string, UserList>>(this.LISTS_KEY, {});
    return Object.values(record).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }

  getList(id: string): UserList | null {
    const record = this.readJson<Record<string, UserList>>(this.LISTS_KEY, {});
    return record[id] || null;
  }

  createList(name: string, description = ''): UserList {
    const record = this.readJson<Record<string, UserList>>(this.LISTS_KEY, {});
    const list: UserList = {
      id: crypto.randomUUID(),
      name,
      description,
      createdAt: new Date().toISOString(),
      items: [],
    };
    record[list.id] = list;
    this.writeJson(this.LISTS_KEY, record);
    return list;
  }

  deleteList(id: string): void {
    const record = this.readJson<Record<string, UserList>>(this.LISTS_KEY, {});
    if (record[id]) {
      delete record[id];
      this.writeJson(this.LISTS_KEY, record);
    }
  }

  addToList(listId: string, item: Omit<WatchlistEntry, 'addedAt'>): void {
    const record = this.readJson<Record<string, UserList>>(this.LISTS_KEY, {});
    const list = record[listId];
    if (!list) {
      return;
    }
    const exists = list.items.some(
      (i) => i.id === item.id && i.media_type === item.media_type,
    );
    if (exists) {
      return;
    }
    const nextItem: WatchlistEntry = {
      ...item,
      addedAt: new Date().toISOString(),
    };
    record[listId] = { ...list, items: [...list.items, nextItem] };
    this.writeJson(this.LISTS_KEY, record);
  }

  removeFromList(listId: string, mediaType: string, id: number): void {
    const record = this.readJson<Record<string, UserList>>(this.LISTS_KEY, {});
    const list = record[listId];
    if (!list) {
      return;
    }
    record[listId] = {
      ...list,
      items: list.items.filter(
        (item) => !(item.id === id && item.media_type === mediaType),
      ),
    };
    this.writeJson(this.LISTS_KEY, record);
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  getSettings(): AppSettings {
    const settings = this.getSettingsRecord();
    return this.stripSettings(settings);
  }

  saveSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ): void {
    const settings = this.getSettingsRecord();
    const updated: SettingsRecord = { ...settings, [key]: value };
    this.writeJson(this.SETTINGS_KEY, updated);
  }

  // ── Bookmarked Lists ─────────────────────────────────────────────────────

  bookmarkList(list: any): void {
    const bookmarks = this.readJson<any[]>(this.BOOKMARKED_LISTS_KEY, []);
    if (!bookmarks.some((b) => b.id === list.id)) {
      const coverItems = (list.items || [])
        .filter((i: any) => i.poster_path)
        .slice(0, 4)
        .map((i: any) => ({
          id: i.id,
          poster_path: i.poster_path,
          media_type: i.media_type,
        }));
      bookmarks.unshift({
        id: list.id,
        name: list.name,
        description: list.description || '',
        item_count: list.item_count || 0,
        favorite_count: list.favorite_count || 0,
        poster_path: list.poster_path || null,
        creator_username:
          list.created_by?.username || list.creator_username || '',
        items: coverItems,
      });
      this.writeJson(this.BOOKMARKED_LISTS_KEY, bookmarks);
    }
  }

  unbookmarkList(listId: number): void {
    const bookmarks = this.readJson<any[]>(this.BOOKMARKED_LISTS_KEY, []);
    const next = bookmarks.filter((b) => b.id !== listId);
    this.writeJson(this.BOOKMARKED_LISTS_KEY, next);
  }

  isListBookmarked(listId: number): boolean {
    const bookmarks = this.readJson<any[]>(this.BOOKMARKED_LISTS_KEY, []);
    return bookmarks.some((b) => b.id === listId);
  }

  getBookmarkedLists(): any[] {
    return this.readJson<any[]>(this.BOOKMARKED_LISTS_KEY, []);
  }

  recordListView(list: any): void {
    let recent = this.readJson<any[]>(this.RECENT_LISTS_KEY, []);
    recent = recent.filter((r) => r.id !== list.id);
    const coverItems = (list.items || [])
      .filter((i: any) => i.poster_path)
      .slice(0, 4)
      .map((i: any) => ({
        id: i.id,
        poster_path: i.poster_path,
        media_type: i.media_type,
      }));
    recent.unshift({
      id: list.id,
      name: list.name,
      description: list.description || '',
      item_count: list.item_count || 0,
      favorite_count: list.favorite_count || 0,
      poster_path: list.poster_path || null,
      creator_username:
        list.created_by?.username || list.creator_username || '',
      items: coverItems,
    });
    if (recent.length > 10) {
      recent = recent.slice(0, 10);
    }
    this.writeJson(this.RECENT_LISTS_KEY, recent);
  }

  getRecentlyViewedLists(): any[] {
    return this.readJson<any[]>(this.RECENT_LISTS_KEY, []);
  }

  // ── List Scroll Position ─────────────────────────────────────────────────

  saveListScrollState(
    listId: number,
    state: { scrollY: number; tmdbPage: number },
  ): void {
    const states = this.readJson<
      Record<string, { scrollY: number; tmdbPage: number }>
    >(this.LIST_SCROLL_KEY, {});
    states[String(listId)] = state;
    this.writeJson(this.LIST_SCROLL_KEY, states);
  }

  getListScrollState(
    listId: number,
  ): { scrollY: number; tmdbPage: number } | null {
    const states = this.readJson<
      Record<string, { scrollY: number; tmdbPage: number }>
    >(this.LIST_SCROLL_KEY, {});
    return states[String(listId)] || null;
  }

  clearListScrollState(listId: number): void {
    const states = this.readJson<
      Record<string, { scrollY: number; tmdbPage: number }>
    >(this.LIST_SCROLL_KEY, {});
    delete states[String(listId)];
    this.writeJson(this.LIST_SCROLL_KEY, states);
  }

  // ── Analytics ────────────────────────────────────────────────────────────

  getStats(): {
    totalWatched: number;
    totalMovies: number;
    totalTv: number;
    totalHoursEstimated: number;
    averageRating: number | null;
    ratingsDistribution: Record<string, number>;
    watchedByMonth: { month: string; count: number }[];
    topGenres: { name: string; count: number }[];
    likedCount: number;
  } {
    const watched = Object.values(this.getWatched());
    const totalWatched = watched.length;
    const totalMovies = watched.filter((e) => e.media_type === 'movie').length;
    const totalTv = watched.filter((e) => e.media_type === 'tv').length;

    // Use actual snapshot runtimes where available, otherwise fall back to 1.8h (108 mins)
    let totalMinutes = 0;
    watched.forEach((entry) => {
      if (entry.snapshot?.runtimeMinutes && entry.snapshot.runtimeMinutes > 0) {
        totalMinutes += entry.snapshot.runtimeMinutes;
      } else {
        totalMinutes += entry.media_type === 'tv' ? 45 : 108;
      }
    });
    const totalHoursEstimated = Number((totalMinutes / 60).toFixed(1));

    const rated = watched.filter((e) => typeof e.rating === 'number');
    const averageRating = rated.length
      ? Number(
          (
            rated.reduce((sum, e) => sum + (e.rating || 0), 0) / rated.length
          ).toFixed(2),
        )
      : null;

    const ratingsDistribution: Record<string, number> = {};
    for (let i = 0.5; i <= 5; i += 0.5) {
      ratingsDistribution[i.toFixed(1)] = 0;
    }
    watched.forEach((entry) => {
      if (typeof entry.rating === 'number') {
        const key = entry.rating.toFixed(1);
        if (ratingsDistribution[key] !== undefined) {
          ratingsDistribution[key] += 1;
        }
      }
    });

    const watchedByMonth = this.buildWatchedByMonth(watched);

    // Compute real genres from snapshots if present, otherwise fall back to entry tags
    const genreCounts: Record<string, number> = {};
    watched.forEach((entry) => {
      if (entry.snapshot?.genres && entry.snapshot.genres.length > 0) {
        entry.snapshot.genres.forEach((g) => {
          if (g.name) {
            genreCounts[g.name] = (genreCounts[g.name] || 0) + 1;
          }
        });
      } else if (entry.tags && entry.tags.length > 0) {
        entry.tags.forEach((tag) => {
          if (tag) {
            genreCounts[tag] = (genreCounts[tag] || 0) + 1;
          }
        });
      }
    });

    const topGenres = Object.entries(genreCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const likedCount = watched.filter((e) => e.liked).length;

    return {
      totalWatched,
      totalMovies,
      totalTv,
      totalHoursEstimated,
      averageRating,
      ratingsDistribution,
      watchedByMonth,
      topGenres,
      likedCount,
    };
  }

  // ── Episode Helpers ──────────────────────────────────────────────────────

  isEpisodeWatched(tvId: number, season: number, episode: number): boolean {
    const settings = this.getSettingsRecord();
    const map = settings.episodeWatched || {};
    return !!map[`${tvId}-${season}-${episode}`];
  }

  toggleEpisodeWatched(tvId: number, season: number, episode: number): boolean {
    const settings = this.getSettingsRecord();
    const map = { ...(settings.episodeWatched || {}) };
    const key = `${tvId}-${season}-${episode}`;
    map[key] = !map[key];
    const updated: SettingsRecord = { ...settings, episodeWatched: map };
    this.writeJson(this.SETTINGS_KEY, updated);
    return map[key];
  }

  markSeasonWatched(tvId: number, season: number, episodes: number[]): void {
    const settings = this.getSettingsRecord();
    const map = { ...(settings.episodeWatched || {}) };
    episodes.forEach((ep) => {
      map[`${tvId}-${season}-${ep}`] = true;
    });
    const updated: SettingsRecord = { ...settings, episodeWatched: map };
    this.writeJson(this.SETTINGS_KEY, updated);
  }

  // ── Export / Import Backup ───────────────────────────────────────────────

  exportBackup(): string {
    const backup = {
      app: 'Open Movie Tracker',
      version: this.SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        [this.PROFILE_KEY]: this.getProfile(),
        [this.WATCHED_KEY]: this.getWatched(),
        [this.WATCHLIST_KEY]: this.readJson(this.WATCHLIST_KEY, {}),
        [this.FAVORITES_KEY]: this.getFavorites(),
        [this.LISTS_KEY]: this.readJson(this.LISTS_KEY, {}),
        [this.SETTINGS_KEY]: this.getSettingsRecord(),
        [this.BOOKMARKED_LISTS_KEY]: this.getBookmarkedLists(),
        [this.RECENT_LISTS_KEY]: this.getRecentlyViewedLists(),
      },
    };
    return JSON.stringify(backup, null, 2);
  }

  importBackup(rawJson: string, mode: 'merge' | 'replace' = 'merge'): ImportResult {
    let parsed: any;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      return { success: false, message: 'Invalid JSON file format.' };
    }

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, message: 'Backup file is empty or corrupted.' };
    }

    // Capture safety snapshot before making changes
    this.saveBackupSnapshot();

    const dataPayload = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
    let watchedCount = 0;
    let watchlistCount = 0;
    let favoritesCount = 0;
    let listsCount = 0;

    try {
      // 1. Watched
      if (dataPayload[this.WATCHED_KEY] && typeof dataPayload[this.WATCHED_KEY] === 'object') {
        const incomingWatched = dataPayload[this.WATCHED_KEY];
        const currentWatched = mode === 'replace' ? {} : this.getWatched();

        Object.keys(incomingWatched).forEach((k) => {
          const item = incomingWatched[k];
          if (!item || typeof item.id !== 'number' || !item.media_type || !item.title) {
            return;
          }
          const entryId = item.entryId || crypto.randomUUID();
          currentWatched[entryId] = {
            entryId,
            id: item.id,
            media_type: item.media_type === 'tv' ? 'tv' : 'movie',
            title: String(item.title),
            poster_path: item.poster_path ? String(item.poster_path) : null,
            watchedAt: item.watchedAt ? String(item.watchedAt) : null,
            dateUnknown: item.dateUnknown ?? !item.watchedAt,
            approximateDate: item.approximateDate ?? false,
            rewatch: Boolean(item.rewatch),
            rating: this.normalizeRating(item.rating),
            review: item.review ? String(item.review).slice(0, 20000) : '',
            tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
            liked: Boolean(item.liked),
            sourceKey: item.sourceKey ? String(item.sourceKey) : undefined,
            release_date: item.release_date ? String(item.release_date) : undefined,
            first_air_date: item.first_air_date ? String(item.first_air_date) : undefined,
            snapshot: item.snapshot && typeof item.snapshot === 'object' ? item.snapshot : undefined,
          };
          watchedCount++;
        });

        this.writeJson(this.WATCHED_KEY, currentWatched);
      }

      // 2. Watchlist
      if (dataPayload[this.WATCHLIST_KEY] && typeof dataPayload[this.WATCHLIST_KEY] === 'object') {
        const incomingWatchlist = dataPayload[this.WATCHLIST_KEY];
        const currentWatchlist = mode === 'replace' ? {} : this.readJson<Record<string, WatchlistEntry>>(this.WATCHLIST_KEY, {});

        Object.keys(incomingWatchlist).forEach((k) => {
          const item = incomingWatchlist[k];
          if (item && typeof item.id === 'number' && item.media_type) {
            const key = `${item.media_type}:${item.id}`;
            currentWatchlist[key] = {
              id: item.id,
              media_type: item.media_type,
              title: String(item.title || ''),
              poster_path: item.poster_path ? String(item.poster_path) : null,
              addedAt: item.addedAt || new Date().toISOString(),
              release_date: item.release_date,
              first_air_date: item.first_air_date,
            };
            watchlistCount++;
          }
        });

        this.writeJson(this.WATCHLIST_KEY, currentWatchlist);
      }

      // 3. Favorites
      if (Array.isArray(dataPayload[this.FAVORITES_KEY])) {
        const incomingFavorites = dataPayload[this.FAVORITES_KEY];
        const currentFavorites = mode === 'replace' ? [] : this.getFavorites();
        const seen = new Set(currentFavorites.map((f) => `${f.media_type}:${f.id}`));

        incomingFavorites.forEach((item: any) => {
          if (item && typeof item.id === 'number' && item.media_type) {
            const key = `${item.media_type}:${item.id}`;
            if (!seen.has(key) && currentFavorites.length < 4) {
              seen.add(key);
              currentFavorites.push({
                id: item.id,
                media_type: item.media_type,
                title: String(item.title || ''),
                poster_path: item.poster_path ? String(item.poster_path) : null,
              });
              favoritesCount++;
            }
          }
        });

        this.writeJson(this.FAVORITES_KEY, currentFavorites.slice(0, 4));
      }

      // 4. Custom Lists
      if (dataPayload[this.LISTS_KEY] && typeof dataPayload[this.LISTS_KEY] === 'object') {
        const incomingLists = dataPayload[this.LISTS_KEY];
        const currentLists = mode === 'replace' ? {} : this.readJson<Record<string, UserList>>(this.LISTS_KEY, {});

        Object.keys(incomingLists).forEach((id) => {
          const l = incomingLists[id];
          if (l && l.name) {
            currentLists[id] = {
              id: l.id || id,
              name: String(l.name),
              description: l.description ? String(l.description) : '',
              createdAt: l.createdAt || new Date().toISOString(),
              items: Array.isArray(l.items) ? l.items : [],
            };
            listsCount++;
          }
        });

        this.writeJson(this.LISTS_KEY, currentLists);
      }

      // 5. Settings & Profile
      if (dataPayload[this.PROFILE_KEY] && typeof dataPayload[this.PROFILE_KEY] === 'object') {
        const p = dataPayload[this.PROFILE_KEY];
        this.saveProfile({
          displayName: p.displayName ? String(p.displayName).slice(0, 50) : undefined,
          bio: p.bio ? String(p.bio).slice(0, 500) : undefined,
        });
      }

      if (dataPayload[this.SETTINGS_KEY] && typeof dataPayload[this.SETTINGS_KEY] === 'object') {
        const s = dataPayload[this.SETTINGS_KEY];
        const current = this.getSettingsRecord();
        const merged: SettingsRecord = {
          ...current,
          theme: s.theme || current.theme,
          language: s.language || current.language,
          region: s.region || current.region,
          includeAdult: typeof s.includeAdult === 'boolean' ? s.includeAdult : current.includeAdult,
          excludeLanguages: Array.isArray(s.excludeLanguages) ? s.excludeLanguages : current.excludeLanguages,
          primaryColor: s.primaryColor === 'red' ? 'red' : 'green',
          tmdbApiKey: s.tmdbApiKey !== undefined ? String(s.tmdbApiKey).trim() : current.tmdbApiKey,
        };
        this.writeJson(this.SETTINGS_KEY, merged);
      }

      return {
        success: true,
        message: 'Backup imported successfully.',
        importedCounts: {
          watched: watchedCount,
          watchlist: watchlistCount,
          favorites: favoritesCount,
          lists: listsCount,
        },
      };
    } catch (e: any) {
      this.restoreBackupSnapshot();
      return { success: false, message: `Import failed: ${e?.message || 'unknown error'}` };
    }
  }

  saveBackupSnapshot(): void {
    const snapshot = {
      profile: localStorage.getItem(this.PROFILE_KEY),
      watched: localStorage.getItem(this.WATCHED_KEY),
      watchlist: localStorage.getItem(this.WATCHLIST_KEY),
      favorites: localStorage.getItem(this.FAVORITES_KEY),
      lists: localStorage.getItem(this.LISTS_KEY),
      settings: localStorage.getItem(this.SETTINGS_KEY),
      schema: localStorage.getItem(this.SCHEMA_VERSION_KEY),
    };
    try {
      sessionStorage.setItem(this.BACKUP_KEY, JSON.stringify(snapshot));
    } catch {
      // ignore session storage fallback
    }
  }

  restoreBackupSnapshot(): boolean {
    const raw = sessionStorage.getItem(this.BACKUP_KEY);
    if (!raw) return false;
    try {
      const snapshot = JSON.parse(raw);
      if (snapshot.profile) localStorage.setItem(this.PROFILE_KEY, snapshot.profile);
      if (snapshot.watched) localStorage.setItem(this.WATCHED_KEY, snapshot.watched);
      if (snapshot.watchlist) localStorage.setItem(this.WATCHLIST_KEY, snapshot.watchlist);
      if (snapshot.favorites) localStorage.setItem(this.FAVORITES_KEY, snapshot.favorites);
      if (snapshot.lists) localStorage.setItem(this.LISTS_KEY, snapshot.lists);
      if (snapshot.settings) localStorage.setItem(this.SETTINGS_KEY, snapshot.settings);
      if (snapshot.schema) localStorage.setItem(this.SCHEMA_VERSION_KEY, snapshot.schema);
      return true;
    } catch {
      return false;
    }
  }

  // ── Internal Helpers & Storage Guard ─────────────────────────────────────

  private buildDefaultProfile(): UserProfile {
    return {
      displayName: 'Movie Fan',
      bio: '',
      avatarBase64: null,
      coverBase64: null,
      joinedAt: new Date().toISOString(),
    };
  }

  private buildDefaultSettings(): SettingsRecord {
    return {
      theme: 'system',
      language: 'en-US',
      region: 'US',
      includeAdult: false,
      displayName: 'Movie Fan',
      excludeLanguages: [],
      fadeWatched: false,
      defaultMediaTab: 'movies',
      primaryColor: 'green',
      tmdbApiKey: '',
      autoCheckUpdates: false,
    };
  }

  private getSettingsRecord(): SettingsRecord {
    const stored = this.readJson<SettingsRecord | null>(
      this.SETTINGS_KEY,
      null,
    );
    if (!stored) {
      const fresh = this.buildDefaultSettings();
      this.writeJson(this.SETTINGS_KEY, fresh);
      return fresh;
    }
    const merged = { ...this.buildDefaultSettings(), ...stored };
    if (!stored.displayName && stored.displayName !== '') {
      merged.displayName = 'Movie Fan';
    }
    return merged;
  }

  private stripSettings(settings: SettingsRecord): AppSettings {
    const { episodeWatched: _episodeWatched, ...clean } = settings;
    return clean;
  }

  private buildWatchedByMonth(
    watched: WatchedEntry[],
  ): { month: string; count: number }[] {
    const result: { month: string; count: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = this.monthKey(d);
      result.push({ month: key, count: 0 });
    }
    const monthMap = new Map(result.map((m) => [m.month, m]));
    watched.forEach((entry) => {
      if (!entry.watchedAt || entry.dateUnknown) {
        return;
      }
      const d = new Date(entry.watchedAt);
      if (Number.isNaN(d.getTime())) {
        return;
      }
      const key = this.monthKey(d);
      const target = monthMap.get(key);
      if (target) {
        target.count += 1;
      }
    });
    return result;
  }

  private monthKey(d: Date): string {
    const year = d.getFullYear();
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  }

  normalizeRating(value: number | null | undefined): number | null {
    if (value === null || value === undefined || isNaN(value)) {
      return null;
    }
    const rounded = Math.round(value * 2) / 2;
    if (rounded < 0.5) {
      return 0.5;
    }
    if (rounded > 5) {
      return 5;
    }
    return rounded;
  }

  readJson<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return fallback;
      }
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  writeJson<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      // Handle quota exceeded: purge volatile tmdb_cache_v2 entries first
      this.purgeVolatileCache();
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (retryErr) {
        this.toast.showToast('Storage quota exceeded. Please export and clear old logs.');
        return false;
      }
    }
  }

  private purgeVolatileCache(): void {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tmdb_cache_v2:')) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  }

  private migrateToSchemaV2(): void {
    const currentVersion = Number(localStorage.getItem(this.SCHEMA_VERSION_KEY) || '1');
    if (currentVersion >= this.SCHEMA_VERSION) {
      return;
    }

    const rawWatched = this.readJson<Record<string, any>>(this.WATCHED_KEY, {});
    const upgradedWatched: Record<string, WatchedEntry> = {};

    Object.keys(rawWatched).forEach((key) => {
      const item = rawWatched[key];
      if (!item || typeof item.id !== 'number') return;
      const entryId = item.entryId || crypto.randomUUID();
      upgradedWatched[entryId] = {
        entryId,
        id: item.id,
        media_type: item.media_type || 'movie',
        title: item.title || '',
        poster_path: item.poster_path ?? null,
        watchedAt: item.watchedAt ?? null,
        dateUnknown: item.dateUnknown ?? !item.watchedAt,
        approximateDate: item.approximateDate ?? false,
        rewatch: Boolean(item.rewatch),
        rating: this.normalizeRating(item.rating),
        review: item.review || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        liked: Boolean(item.liked),
        sourceKey: item.sourceKey,
        release_date: item.release_date,
        first_air_date: item.first_air_date,
        snapshot: item.snapshot,
      };
    });

    this.writeJson(this.WATCHED_KEY, upgradedWatched);
    localStorage.setItem(this.SCHEMA_VERSION_KEY, String(this.SCHEMA_VERSION));
  }

  private migrateFromLegacy(): void {
    const hasMvaData =
      localStorage.getItem(this.PROFILE_KEY) ||
      localStorage.getItem(this.WATCHED_KEY) ||
      localStorage.getItem(this.WATCHLIST_KEY) ||
      localStorage.getItem(this.FAVORITES_KEY) ||
      localStorage.getItem(this.LISTS_KEY) ||
      localStorage.getItem(this.SETTINGS_KEY);
    if (hasMvaData) {
      return;
    }

    const watchedMovies = this.readJson<any[]>('watchedMovies', []);
    const watchedTv = this.readJson<any[]>('watchedTv', []);
    const favoriteMovies = this.readJson<any[]>('favoriteMovies', []);
    const favoriteTv = this.readJson<any[]>('favoriteTv', []);
    const watchlist = this.readJson<any[]>('watchlist', []);
    const ratings = this.readJson<Record<string, LegacyUserRating>>('ratings', {});
    const reviews = this.readJson<Record<string, LegacyUserReview>>('reviews', {});
    const customLists = this.readJson<any[]>('customLists', []);
    const legacySettings = this.readJson<any>('appSettings', null);
    const watchedEpisodes = this.readJson<Record<string, boolean>>('watchedEpisodes', {});

    const favoriteSet = new Set<string>([
      ...favoriteMovies.map((m) => `movie:${m.id}`),
      ...favoriteTv.map((t) => `tv:${t.id}`),
    ]);

    const itemIndex = new Map<string, any>();
    [...watchedMovies, ...watchedTv, ...watchlist, ...favoriteMovies, ...favoriteTv].forEach((item) => {
      const mt = item.media_type || (item.first_air_date ? 'tv' : 'movie');
      itemIndex.set(`${mt}:${item.id}`, item);
    });

    const watched: Record<string, WatchedEntry> = {};
    const applyEntry = (item: any, mediaType: 'movie' | 'tv') => {
      if (!item) {
        return;
      }
      const ratingKey = `${mediaType}-${item.id}`;
      const legacyRating = ratings[ratingKey];
      const legacyReview = reviews[ratingKey];
      const watchedAt = item.date_added || legacyReview?.date || legacyRating?.date || new Date().toISOString();
      const rating = legacyRating?.rating ?? legacyReview?.rating ?? null;
      const entryId = crypto.randomUUID();
      watched[entryId] = {
        entryId,
        id: item.id,
        media_type: mediaType,
        title: item.title || item.name || '',
        poster_path: item.poster_path || null,
        watchedAt,
        dateUnknown: false,
        rewatch: false,
        rating: this.normalizeRating(rating),
        review: legacyReview?.text || '',
        tags: [],
        liked: favoriteSet.has(`${mediaType}:${item.id}`),
        release_date: item.release_date,
        first_air_date: item.first_air_date,
      };
    };

    watchedMovies.forEach((m) => applyEntry(m, 'movie'));
    watchedTv.forEach((t) => applyEntry(t, 'tv'));

    Object.keys(ratings).forEach((key) => {
      const [mediaType, idStr] = key.split('-');
      if (!mediaType || !idStr) {
        return;
      }
      const numId = Number(idStr);
      const exists = Object.values(watched).some((w) => w.media_type === mediaType && w.id === numId);
      if (exists) {
        return;
      }
      const item = itemIndex.get(`${mediaType}:${idStr}`);
      if (!item) {
        return;
      }
      applyEntry(item, mediaType as 'movie' | 'tv');
    });

    const watchlistRecord: Record<string, WatchlistEntry> = {};
    watchlist.forEach((item) => {
      const mediaType = (item.media_type || (item.first_air_date ? 'tv' : 'movie')) as 'movie' | 'tv';
      const key = `${mediaType}:${item.id}`;
      watchlistRecord[key] = {
        id: item.id,
        media_type: mediaType,
        title: item.title || item.name || '',
        poster_path: item.poster_path || null,
        addedAt: item.date_added || new Date().toISOString(),
        release_date: item.release_date,
        first_air_date: item.first_air_date,
      };
    });

    const favorites: FavoriteEntry[] = [
      ...favoriteMovies.map((m) => ({
        id: m.id,
        media_type: 'movie' as const,
        title: m.title || m.name || '',
        poster_path: m.poster_path || null,
      })),
      ...favoriteTv.map((t) => ({
        id: t.id,
        media_type: 'tv' as const,
        title: t.title || t.name || '',
        poster_path: t.poster_path || null,
      })),
    ].slice(0, 4);

    const listsRecord: Record<string, UserList> = {};
    customLists.forEach((list) => {
      const listId = list.id || crypto.randomUUID();
      const items: WatchlistEntry[] = (list.items || []).map((item: any) => {
        const mediaType = (item.media_type || (item.first_air_date ? 'tv' : 'movie')) as 'movie' | 'tv';
        return {
          id: item.id,
          media_type: mediaType,
          title: item.title || item.name || '',
          poster_path: item.poster_path || null,
          addedAt: item.date_added || list.createdAt || new Date().toISOString(),
          release_date: item.release_date,
          first_air_date: item.first_air_date,
        };
      });
      listsRecord[listId] = {
        id: listId,
        name: list.name || 'Untitled List',
        description: list.description || '',
        createdAt: list.createdAt || new Date().toISOString(),
        items,
      };
    });

    const settings: SettingsRecord = {
      ...this.buildDefaultSettings(),
      ...(legacySettings || {}),
      fadeWatched: false,
      defaultMediaTab: (legacySettings?.defaultMediaTab as 'movies' | 'tv') || 'movies',
      episodeWatched: Object.keys(watchedEpisodes).length ? watchedEpisodes : undefined,
    };

    const profile: UserProfile = {
      displayName: settings.displayName || 'Movie Fan',
      bio: '',
      avatarBase64: null,
      coverBase64: null,
      joinedAt: new Date().toISOString(),
    };

    this.writeJson(this.PROFILE_KEY, profile);
    this.writeJson(this.WATCHED_KEY, watched);
    this.writeJson(this.WATCHLIST_KEY, watchlistRecord);
    this.writeJson(this.FAVORITES_KEY, favorites);
    this.writeJson(this.LISTS_KEY, listsRecord);
    this.writeJson(this.SETTINGS_KEY, settings);

    [
      'watchedMovies',
      'watchedTv',
      'favoriteMovies',
      'favoriteTv',
      'watchlist',
      'ratings',
      'reviews',
      'customLists',
      'activity',
      'watchedEpisodes',
      'appSettings',
    ].forEach((key) => localStorage.removeItem(key));
  }
}
