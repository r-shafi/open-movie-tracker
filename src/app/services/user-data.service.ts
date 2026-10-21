import { Injectable } from '@angular/core';
import { ToastService } from './toast.service';
import { CalendarDate } from './calendar-date';

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
  watchedAt: string | null; // Calendar date YYYY-MM-DD, or null when watch date is unknown
  dateUnknown?: boolean; // true if film was logged without a specific date
  approximateDate?: boolean; // true if date was inferred or fallback
  importerCreated?: boolean; // true if entry was created by importer
  userEdited?: boolean; // true if user manually modified the entry
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

export interface UserStats {
  totalWatched: number;
  totalMovies: number;
  totalTv: number;
  totalHoursEstimated: number;
  averageRating: number | null;
  ratingsDistribution: Record<string, number>;
  watchedByMonth: { month: string; count: number }[];
  topGenres: { name: string; count: number }[];
  likedCount: number;
  rewatches: number;
  firstWatches: number;
  rewatchPercentage: number;
  decades: { decade: string; count: number }[];
  topDirectors: { id?: number; name: string; count: number; avgRating: number | null }[];
  topCast: { id?: number; name: string; count: number; avgRating: number | null }[];
  availableYears: string[];
  undatedCount: number;
  enrichedCount: number;
  coveragePercentage: number;
  coverageNotice?: string;

  // Letterboxd Pro Analytics
  activityHeatmap: { date: string; count: number; level: number }[];
  currentStreak: number;
  longestStreak: number;
  watchedByWeekday: { day: string; count: number }[];
  runtimeDistribution: { range: string; count: number }[];
  productionCountries: { country: string; count: number }[];
  languages: { language: string; count: number }[];
  crowdDeltaAverage: number | null;
  controversialPicks: { id: number; title: string; userRating: number; tmdbRating: number; delta: number }[];
  genreAverages: { name: string; avgRating: number; count: number }[];
  decadeAverages: { decade: string; avgRating: number; count: number }[];
  tvAnalytics: {
    episodesWatched: number;
    completedSeasons: number;
    inProgressShows: number;
    totalTvHours: number;
  };
  watchlistHealth: {
    totalItems: number;
    completionRate: number;
    averageAgeDays: number;
    runtimeToClearHours: number;
  };
}

export interface BackfillItemStatus {
  status: 'pending' | 'done' | 'failed';
  attempts: number;
  lastAttempt?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class UserDataService {
  readonly SCHEMA_VERSION = 3;
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
  readonly BACKFILL_STATUS_KEY = 'mva_backfill_status';

  constructor(private toast: ToastService) {
    this.initializeStorage();
  }

  private initializeStorage(): void {
    this.migrateFromLegacy();
    this.migrateToSchemaV2();
    this.migrateToSchemaV3();
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
      importerCreated?: boolean;
      userEdited?: boolean;
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

    const isExplicitlyUnknown = entry.dateUnknown === true || entry.watchedAt === null;
    let watchedAt: string | null = null;
    if (!isExplicitlyUnknown) {
      if (entry.watchedAt) {
        watchedAt = CalendarDate.toDateString(entry.watchedAt);
      } else if (existingTarget && existingTarget.watchedAt && !existingTarget.dateUnknown) {
        watchedAt = CalendarDate.toDateString(existingTarget.watchedAt);
      }
    }

    const isDateUnknown = isExplicitlyUnknown || watchedAt === null;
    const finalWatchedAt = isDateUnknown ? null : watchedAt;

    const rating = this.normalizeRating(
      entry.rating !== undefined ? entry.rating : (existingTarget?.rating ?? null),
    );

    const fullEntry: WatchedEntry = {
      entryId: targetEntryId,
      id: entry.id,
      media_type: entry.media_type,
      title: entry.title,
      poster_path: entry.poster_path !== undefined ? entry.poster_path : (existingTarget?.poster_path ?? null),
      watchedAt: finalWatchedAt,
      dateUnknown: isDateUnknown,
      approximateDate: isDateUnknown ? false : (entry.approximateDate ?? existingTarget?.approximateDate ?? false),
      importerCreated: entry.importerCreated ?? existingTarget?.importerCreated ?? false,
      userEdited: entry.userEdited !== undefined ? entry.userEdited : (existingTarget?.userEdited ?? false),
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

  logEntries(
    entries: Array<{
      entryId?: string;
      id: number;
      media_type: 'movie' | 'tv';
      title: string;
      poster_path?: string | null;
      watchedAt?: string | null;
      dateUnknown?: boolean;
      approximateDate?: boolean;
      importerCreated?: boolean;
      userEdited?: boolean;
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
    }>,
  ): WatchedEntry[] {
    const watched = this.getWatched();
    const result: WatchedEntry[] = [];

    const existingById = new Map<string, WatchedEntry>();
    Object.values(watched).forEach((w) => {
      const key = `${w.media_type}:${w.id}`;
      if (!existingById.has(key)) {
        existingById.set(key, w);
      }
    });

    for (const entry of entries) {
      const sameTitleKey = `${entry.media_type}:${entry.id}`;
      const existingSameTitle = existingById.get(sameTitleKey);

      let targetEntryId = entry.entryId;
      if (!targetEntryId) {
        if (existingSameTitle && !entry.isNewRewatchLog) {
          targetEntryId = existingSameTitle.entryId;
        } else {
          targetEntryId = crypto.randomUUID();
        }
      }

      const existingTarget = watched[targetEntryId] || existingSameTitle;

      const isExplicitlyUnknown = entry.dateUnknown === true || entry.watchedAt === null;
      let watchedAt: string | null = null;
      if (!isExplicitlyUnknown) {
        if (entry.watchedAt) {
          watchedAt = CalendarDate.toDateString(entry.watchedAt);
        } else if (existingTarget && existingTarget.watchedAt && !existingTarget.dateUnknown) {
          watchedAt = CalendarDate.toDateString(existingTarget.watchedAt);
        }
      }

      const isDateUnknown = isExplicitlyUnknown || watchedAt === null;
      const finalWatchedAt = isDateUnknown ? null : watchedAt;

      const rating = this.normalizeRating(
        entry.rating !== undefined ? entry.rating : (existingTarget?.rating ?? null),
      );

      const fullEntry: WatchedEntry = {
        entryId: targetEntryId,
        id: entry.id,
        media_type: entry.media_type,
        title: entry.title,
        poster_path: entry.poster_path !== undefined ? entry.poster_path : (existingTarget?.poster_path ?? null),
        watchedAt: finalWatchedAt,
        dateUnknown: isDateUnknown,
        approximateDate: isDateUnknown ? false : (entry.approximateDate ?? existingTarget?.approximateDate ?? false),
        importerCreated: entry.importerCreated ?? existingTarget?.importerCreated ?? false,
        userEdited: entry.userEdited !== undefined ? entry.userEdited : (existingTarget?.userEdited ?? false),
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
      if (!existingById.has(sameTitleKey)) {
        existingById.set(sameTitleKey, fullEntry);
      }
      result.push(fullEntry);
    }

    this.writeJson(this.WATCHED_KEY, watched);
    return result;
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

  getBackfillStatus(): Record<string, BackfillItemStatus> {
    return this.readJson<Record<string, BackfillItemStatus>>(this.BACKFILL_STATUS_KEY, {});
  }

  setBackfillItemStatus(mediaType: string, id: number, status: BackfillItemStatus): void {
    const all = this.getBackfillStatus();
    all[`${mediaType}:${id}`] = status;
    this.writeJson(this.BACKFILL_STATUS_KEY, all);
  }

  resetFailedBackfills(): void {
    const all = this.getBackfillStatus();
    let modified = false;
    Object.keys(all).forEach((k) => {
      if (all[k]?.status === 'failed') {
        delete all[k];
        modified = true;
      }
    });
    if (modified) {
      this.writeJson(this.BACKFILL_STATUS_KEY, all);
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
    this.setBackfillItemStatus(mediaType, id, {
      status: 'done',
      attempts: 1,
      lastAttempt: new Date().toISOString(),
    });
  }

  getMissingSnapshotTitles(): Array<{ media_type: 'movie' | 'tv'; id: number; title: string }> {
    const watched = Object.values(this.getWatched());
    const seen = new Map<string, { media_type: 'movie' | 'tv'; id: number; title: string; watchedAt: string | null; rating: number | null }>();
    const backfillStatus = this.getBackfillStatus();

    watched.forEach((e) => {
      const key = `${e.media_type}:${e.id}`;
      const status = backfillStatus[key];
      // Skip if explicitly marked done or failed with max attempts >= 3
      if (status && (status.status === 'done' || (status.status === 'failed' && status.attempts >= 3))) {
        return;
      }
      const hasSnapshot = !!e.snapshot && (!!e.snapshot.directors || !!e.snapshot.genres || e.snapshot.runtimeMinutes !== undefined || !!e.snapshot.originalLanguage);
      if (!hasSnapshot) {
        const existing = seen.get(key);
        if (!existing) {
          seen.set(key, {
            media_type: e.media_type,
            id: e.id,
            title: e.title,
            watchedAt: e.watchedAt || null,
            rating: typeof e.rating === 'number' ? e.rating : null,
          });
        } else {
          if (e.watchedAt && (!existing.watchedAt || e.watchedAt > existing.watchedAt)) {
            existing.watchedAt = e.watchedAt;
          }
          if (typeof e.rating === 'number' && (existing.rating === null || e.rating > existing.rating)) {
            existing.rating = e.rating;
          }
        }
      }
    });

    const missing = Array.from(seen.values());
    missing.sort((a, b) => {
      if (a.watchedAt && b.watchedAt) {
        const cmp = b.watchedAt.localeCompare(a.watchedAt);
        if (cmp !== 0) return cmp;
      } else if (a.watchedAt && !b.watchedAt) {
        return -1;
      } else if (!a.watchedAt && b.watchedAt) {
        return 1;
      }
      const ratingA = a.rating ?? -1;
      const ratingB = b.rating ?? -1;
      return ratingB - ratingA;
    });

    return missing.map((m) => ({ media_type: m.media_type, id: m.id, title: m.title }));
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

  public static calculateStreaks(dates: string[]): { currentStreak: number; longestStreak: number } {
    if (!dates.length) {
      return { currentStreak: 0, longestStreak: 0 };
    }
    const uniqueDays = Array.from(
      new Set(dates.map((d) => CalendarDate.toDateString(d)).filter((d): d is string => !!d)),
    ).sort();

    if (!uniqueDays.length) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    let longest = 1;
    let current = 1;

    for (let i = 1; i < uniqueDays.length; i++) {
      const diffDays = CalendarDate.diffDays(uniqueDays[i - 1], uniqueDays[i]);

      if (diffDays === 1) {
        current++;
        if (current > longest) longest = current;
      } else if (diffDays > 1) {
        current = 1;
      }
    }

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const lastDay = uniqueDays[uniqueDays.length - 1];
    const diffFromToday = CalendarDate.diffDays(lastDay, today);
    const isCurrentActive = diffFromToday === 0 || diffFromToday === 1;
    const activeCurrentStreak = isCurrentActive ? current : 0;

    return { currentStreak: activeCurrentStreak, longestStreak: Math.max(longest, activeCurrentStreak) };
  }

  public static calculateActivityHeatmap(
    watched: WatchedEntry[],
    days = 364,
  ): { date: string; count: number; level: number }[] {
    const dayCounts: Record<string, number> = {};
    watched.forEach((e) => {
      if (e.watchedAt && !e.dateUnknown && !e.approximateDate) {
        const day = CalendarDate.toDateString(e.watchedAt);
        if (day) {
          dayCounts[day] = (dayCounts[day] || 0) + 1;
        }
      }
    });

    const result: { date: string; count: number; level: number }[] = [];
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayEpoch = CalendarDate.toEpochDays(todayStr);

    for (let i = days - 1; i >= 0; i--) {
      const targetEpoch = todayEpoch - i;
      // Convert epoch days to YYYY-MM-DD mathematically without timezone conversions
      const a = targetEpoch + 2440588 + 32044;
      const b = Math.floor((4 * a + 3) / 146097);
      const c = a - Math.floor((146097 * b) / 4);
      const d = Math.floor((4 * c + 3) / 1461);
      const e = c - Math.floor((1461 * d) / 4);
      const m = Math.floor((5 * e + 2) / 153);
      const day = e - Math.floor((153 * m + 2) / 5) + 1;
      const month = m + 3 - 12 * Math.floor(m / 10);
      const year = 100 * b + d - 4800 + Math.floor(m / 10);
      const dateStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const count = dayCounts[dateStr] || 0;
      let level = 0;
      if (count === 1) level = 1;
      else if (count === 2) level = 2;
      else if (count === 3) level = 3;
      else if (count >= 4) level = 4;

      result.push({ date: dateStr, count, level });
    }

    return result;
  }

  public static calculateWeekdayDistribution(
    watched: WatchedEntry[],
  ): { day: string; count: number }[] {
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    watched.forEach((e) => {
      if (e.watchedAt && !e.dateUnknown && !e.approximateDate) {
        const dayIdx = CalendarDate.getWeekdayIndex(e.watchedAt);
        counts[dayIdx]++;
      }
    });

    return weekdays.map((day, idx) => ({ day, count: counts[idx] }));
  }

  public static calculateRuntimeDistribution(
    watched: WatchedEntry[],
  ): { range: string; count: number }[] {
    const buckets = [
      { range: '< 90m', count: 0 },
      { range: '90–120m', count: 0 },
      { range: '120–150m', count: 0 },
      { range: '150m+', count: 0 },
    ];

    watched.forEach((e) => {
      const mins = e.snapshot?.runtimeMinutes || (e.media_type === 'tv' ? 45 : 108);
      if (mins < 90) buckets[0].count++;
      else if (mins <= 120) buckets[1].count++;
      else if (mins <= 150) buckets[2].count++;
      else buckets[3].count++;
    });

    return buckets;
  }

  public static calculateControversialPicks(
    watched: WatchedEntry[],
  ): {
    crowdDeltaAverage: number | null;
    controversialPicks: { id: number; title: string; userRating: number; tmdbRating: number; delta: number }[];
  } {
    const scored: { id: number; title: string; userRating: number; tmdbRating: number; delta: number }[] = [];
    let deltaSum = 0;

    watched.forEach((e) => {
      if (typeof e.rating === 'number' && e.snapshot?.tmdbVoteAverage) {
        const tmdbRating = Number((e.snapshot.tmdbVoteAverage / 2).toFixed(1));
        const delta = Number((e.rating - tmdbRating).toFixed(1));
        deltaSum += delta;
        scored.push({
          id: e.id,
          title: e.title,
          userRating: e.rating,
          tmdbRating,
          delta,
        });
      }
    });

    scored.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const crowdDeltaAverage = scored.length ? Number((deltaSum / scored.length).toFixed(2)) : null;

    return {
      crowdDeltaAverage,
      controversialPicks: scored.slice(0, 5),
    };
  }

  getStats(yearFilter?: string): UserStats {
    const allWatched = Object.values(this.getWatched());

    // Compute all years for dropdown
    const yearsSet = new Set<string>();
    allWatched.forEach((e) => {
      if (e.watchedAt && !e.dateUnknown && !e.approximateDate) {
        yearsSet.add(e.watchedAt.slice(0, 4));
      }
    });
    const availableYears = Array.from(yearsSet).sort().reverse();

    // Filter by year if requested
    const watched = (yearFilter && yearFilter !== 'all')
      ? allWatched.filter((e) => e.watchedAt && !e.dateUnknown && !e.approximateDate && e.watchedAt.startsWith(yearFilter))
      : allWatched;

    const totalWatched = watched.length;
    const totalMovies = watched.filter((e) => e.media_type === 'movie').length;
    const totalTv = watched.filter((e) => e.media_type === 'tv').length;
    const undatedCount = allWatched.filter((e) => e.dateUnknown || !e.watchedAt || e.approximateDate).length;

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
    const genreRatingSum: Record<string, number> = {};
    const genreRatingCount: Record<string, number> = {};

    watched.forEach((entry) => {
      const genres = (entry.snapshot?.genres && entry.snapshot.genres.length > 0)
        ? entry.snapshot.genres.map((g) => g.name).filter(Boolean)
        : (entry.tags || []);

      genres.forEach((name) => {
        if (!name) return;
        genreCounts[name] = (genreCounts[name] || 0) + 1;
        if (typeof entry.rating === 'number') {
          genreRatingSum[name] = (genreRatingSum[name] || 0) + entry.rating;
          genreRatingCount[name] = (genreRatingCount[name] || 0) + 1;
        }
      });
    });

    const topGenres = Object.entries(genreCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const genreAverages = Object.entries(genreRatingCount)
      .map(([name, count]) => ({
        name,
        count,
        avgRating: Number((genreRatingSum[name] / count).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const likedCount = watched.filter((e) => e.liked).length;

    // Rewatches
    const rewatches = watched.filter((e) => e.rewatch).length;
    const firstWatches = totalWatched - rewatches;
    const rewatchPercentage = totalWatched > 0 ? Math.round((rewatches / totalWatched) * 100) : 0;

    // Decades distribution and averages
    const decadeCounts: Record<string, number> = {};
    const decadeRatingSum: Record<string, number> = {};
    const decadeRatingCount: Record<string, number> = {};

    watched.forEach((e) => {
      const year = e.snapshot?.releaseYear || (e.release_date ? parseInt(e.release_date.slice(0, 4), 10) : undefined);
      if (year && year >= 1900 && year <= 2099) {
        const dec = `${Math.floor(year / 10) * 10}s`;
        decadeCounts[dec] = (decadeCounts[dec] || 0) + 1;
        if (typeof e.rating === 'number') {
          decadeRatingSum[dec] = (decadeRatingSum[dec] || 0) + e.rating;
          decadeRatingCount[dec] = (decadeRatingCount[dec] || 0) + 1;
        }
      }
    });

    const decades = Object.entries(decadeCounts)
      .map(([decade, count]) => ({ decade, count }))
      .sort((a, b) => a.decade.localeCompare(b.decade));

    const decadeAverages = Object.entries(decadeRatingCount)
      .map(([decade, count]) => ({
        decade,
        count,
        avgRating: Number((decadeRatingSum[decade] / count).toFixed(1)),
      }))
      .sort((a, b) => a.decade.localeCompare(b.decade));

    // Metadata coverage
    const enrichedEntries = watched.filter(
      (e) =>
        !!e.snapshot &&
        (!!e.snapshot.directors ||
          !!e.snapshot.genres ||
          e.snapshot.runtimeMinutes !== undefined ||
          !!e.snapshot.originalLanguage),
    );
    const enrichedCount = enrichedEntries.length;
    const coveragePercentage =
      totalWatched > 0 ? Math.round((enrichedCount / totalWatched) * 100) : 100;
    const coverageNotice =
      enrichedCount < totalWatched
        ? `Based on ${enrichedCount} of ${totalWatched} titles, enriching the rest`
        : undefined;

    // Top Directors (aggregated by TMDb person id, fallback to name; min 3 ratings for avgRating)
    const directorMap = new Map<
      string | number,
      { id?: number; name: string; count: number; ratings: number[] }
    >();
    watched.forEach((e) => {
      e.snapshot?.directors?.forEach((d) => {
        if (!d.id && !d.name) return;
        const key = d.id ?? d.name;
        const current = directorMap.get(key) || {
          id: d.id,
          name: d.name,
          count: 0,
          ratings: [],
        };
        current.count++;
        if (typeof e.rating === 'number') current.ratings.push(e.rating);
        directorMap.set(key, current);
      });
    });
    const topDirectors = Array.from(directorMap.values())
      .map((data) => ({
        id: data.id,
        name: data.name,
        count: data.count,
        avgRating:
          data.ratings.length >= 3
            ? Number(
                (
                  data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length
                ).toFixed(1),
              )
            : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top Cast (aggregated by TMDb person id, fallback to name; min 3 ratings for avgRating)
    const castMap = new Map<
      string | number,
      { id?: number; name: string; count: number; ratings: number[] }
    >();
    watched.forEach((e) => {
      e.snapshot?.topCast?.forEach((c) => {
        if (!c.id && !c.name) return;
        const key = c.id ?? c.name;
        const current = castMap.get(key) || {
          id: c.id,
          name: c.name,
          count: 0,
          ratings: [],
        };
        current.count++;
        if (typeof e.rating === 'number') current.ratings.push(e.rating);
        castMap.set(key, current);
      });
    });
    const topCast = Array.from(castMap.values())
      .map((data) => ({
        id: data.id,
        name: data.name,
        count: data.count,
        avgRating:
          data.ratings.length >= 3
            ? Number(
                (
                  data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length
                ).toFixed(1),
              )
            : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Activity heatmap & streaks
    const activityHeatmap = UserDataService.calculateActivityHeatmap(watched);
    const validDates = watched
      .filter((e) => e.watchedAt && !e.dateUnknown && !e.approximateDate)
      .map((e) => e.watchedAt!);
    const { currentStreak, longestStreak } = UserDataService.calculateStreaks(validDates);

    // Weekdays
    const watchedByWeekday = UserDataService.calculateWeekdayDistribution(watched);

    // Runtime distribution
    const runtimeDistribution = UserDataService.calculateRuntimeDistribution(watched);

    // Production countries & languages (never defaulting missing languages)
    const countryCounts: Record<string, number> = {};
    const langCounts: Record<string, number> = {};
    watched.forEach((e) => {
      (e.snapshot?.productionCountries || []).forEach((c) => {
        if (c) countryCounts[c] = (countryCounts[c] || 0) + 1;
      });
      if (e.snapshot?.originalLanguage) {
        langCounts[e.snapshot.originalLanguage] = (langCounts[e.snapshot.originalLanguage] || 0) + 1;
      }
    });

    const productionCountries = Object.entries(countryCounts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const languages = Object.entries(langCounts)
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Crowd Delta & Controversy
    const { crowdDeltaAverage, controversialPicks } = UserDataService.calculateControversialPicks(watched);

    // TV Analytics
    const settings = this.getSettingsRecord();
    const episodeMap = settings.episodeWatched || {};
    const episodesWatched = Object.values(episodeMap).filter(Boolean).length;
    const tvShowIds = new Set(Object.keys(episodeMap).map((k) => k.split('-')[0]));
    const inProgressShows = tvShowIds.size;
    const tvAnalytics = {
      episodesWatched,
      completedSeasons: Math.floor(episodesWatched / 10), // approximate full season equivalent
      inProgressShows,
      totalTvHours: Number(((totalTv * 45) / 60).toFixed(1)),
    };

    // Watchlist Health
    const watchlist = this.getWatchlist();
    const now = new Date().getTime();
    let totalAgeMs = 0;
    watchlist.forEach((w) => {
      const addedTime = w.addedAt ? new Date(w.addedAt).getTime() : now;
      totalAgeMs += Math.max(0, now - addedTime);
    });
    const averageAgeDays = watchlist.length ? Math.round(totalAgeMs / (watchlist.length * 1000 * 60 * 60 * 24)) : 0;
    const totalPotential = totalWatched + watchlist.length;
    const completionRate = totalPotential > 0 ? Math.round((totalWatched / totalPotential) * 100) : 0;
    const runtimeToClearHours = Number(((watchlist.length * 108) / 60).toFixed(1));

    const watchlistHealth = {
      totalItems: watchlist.length,
      completionRate,
      averageAgeDays,
      runtimeToClearHours,
    };

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
      rewatches,
      firstWatches,
      rewatchPercentage,
      decades,
      topDirectors,
      topCast,
      availableYears,
      undatedCount,
      enrichedCount,
      coveragePercentage,
      coverageNotice,
      activityHeatmap,
      currentStreak,
      longestStreak,
      watchedByWeekday,
      runtimeDistribution,
      productionCountries,
      languages,
      crowdDeltaAverage,
      controversialPicks,
      genreAverages,
      decadeAverages,
      tvAnalytics,
      watchlistHealth,
    };
  }

  public pickWatchlistRoulette(): WatchlistEntry | null {
    const watchlist = this.getWatchlist();
    if (!watchlist.length) {
      return null;
    }
    const idx = Math.floor(Math.random() * watchlist.length);
    return watchlist[idx];
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
      if (!entry.watchedAt || entry.dateUnknown || entry.approximateDate) {
        return;
      }
      const parts = CalendarDate.parse(entry.watchedAt);
      if (!parts) {
        return;
      }
      const key = `${parts.year}-${String(parts.month).padStart(2, '0')}`;
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

  public purgeVolatileCache(): void {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith('tmdb_cache_v2:') ||
          key.startsWith('mva_recent_lists') ||
          key === 'mva_import_session' ||
          key === 'mva_import_match_cache')
      ) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  }

  public estimateRemainingQuota(): number {
    try {
      let totalUsage = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key !== 'mva_import_session') {
          const val = localStorage.getItem(key) || '';
          totalUsage += (key.length + val.length) * 2;
        }
      }
      const standardQuota = 10 * 1024 * 1024; // 10 MB (standard browser quota)
      return Math.max(0, standardQuota - totalUsage);
    } catch {
      return 10 * 1024 * 1024;
    }
  }

  private migrateToSchemaV2(): void {
    const currentVersion = Number(localStorage.getItem(this.SCHEMA_VERSION_KEY) || '1');
    if (currentVersion >= 2) {
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
    localStorage.setItem(this.SCHEMA_VERSION_KEY, '2');
  }

  private migrateToSchemaV3(): void {
    const currentVersion = Number(localStorage.getItem(this.SCHEMA_VERSION_KEY) || '1');
    if (currentVersion >= 3) {
      return;
    }

    const rawWatched = this.readJson<Record<string, any>>(this.WATCHED_KEY, {});
    let modified = false;

    Object.keys(rawWatched).forEach((key) => {
      const item = rawWatched[key];
      if (!item || typeof item.id !== 'number') return;

      if (item.watchedAt && typeof item.watchedAt === 'string') {
        const calendarDate = CalendarDate.toDateString(item.watchedAt);
        if (calendarDate !== item.watchedAt) {
          item.watchedAt = calendarDate;
          modified = true;
        }
      }

      if (item.sourceKey && item.importerCreated === undefined) {
        item.importerCreated = true;
        item.userEdited = false;
        modified = true;
      }

      if (!item.watchedAt && item.dateUnknown !== true) {
        item.dateUnknown = true;
        modified = true;
      }
    });

    if (modified) {
      this.writeJson(this.WATCHED_KEY, rawWatched);
    }
    localStorage.setItem(this.SCHEMA_VERSION_KEY, '3');
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
