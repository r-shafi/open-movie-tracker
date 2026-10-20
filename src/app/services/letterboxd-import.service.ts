import { Injectable } from '@angular/core';
import { CsvParser, LetterboxdListExport } from './csv-parser';
import { LetterboxdArchive } from './letterboxd-archive';
import { MatchResult, TmdbMatchCandidate, TmdbMatcher } from './tmdb-matcher';
import { UserDataService, WatchedEntry, WatchlistEntry, UserList } from './user-data.service';

export interface ImportOptions {
  importProfile: boolean; // Opt-in; default false
  importWatchlist: boolean;
  importCustomLists: boolean;
  skipDuplicates: boolean;
}

export interface StagedFilmEntry {
  sourceTitle: string;
  sourceYear?: string;
  sourceUri?: string;
  watchedAt: string | null;
  dateUnknown: boolean;
  approximateDate: boolean;
  rating: number | null;
  rewatch: boolean;
  review: string;
  tags: string[];
  liked: boolean;
  matchedMedia?: TmdbMatchCandidate;
}

export interface StagedWatchlistItem {
  sourceTitle: string;
  sourceYear?: string;
  sourceUri?: string;
  addedAt: string;
  matchedMedia?: TmdbMatchCandidate;
}

export interface StagedList {
  name: string;
  description: string;
  items: Array<{
    sourceTitle: string;
    sourceYear?: string;
    description?: string;
    position?: number;
    matchedMedia?: TmdbMatchCandidate;
  }>;
}

export interface StagedProfile {
  displayName?: string;
  bio?: string;
}

export interface ImportPlan {
  stagedEntries: StagedFilmEntry[];
  stagedWatchlist: StagedWatchlistItem[];
  stagedLists: StagedList[];
  stagedProfile?: StagedProfile;
  ambiguousMatches: MatchResult[];
  unmatchedItems: Array<{ title: string; year?: string; uri?: string }>;
  stats: {
    totalParsedFiles: number;
    totalTitles: number;
    diaryCount: number;
    ratingsOnlyCount: number;
    watchedOnlyCount: number;
    watchlistCount: number;
    listsCount: number;
    confidentCount: number;
    ambiguousCount: number;
    unmatchedCount: number;
  };
}

export interface ImportProgress {
  phase: 'idle' | 'parsing' | 'matching' | 'ready' | 'committing' | 'done' | 'error';
  current: number;
  total: number;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class LetterboxdImportService {
  private static readonly BACKUP_KEY = 'mva_import_backup';

  constructor(
    private userData: UserDataService,
    private matcher: TmdbMatcher,
  ) {}

  public hasBackup(): boolean {
    return localStorage.getItem(LetterboxdImportService.BACKUP_KEY) !== null;
  }

  public undoImport(): boolean {
    const raw = localStorage.getItem(LetterboxdImportService.BACKUP_KEY);
    if (!raw) {
      return false;
    }
    try {
      const backup = JSON.parse(raw);
      if (backup.watched) localStorage.setItem('mva_watched', JSON.stringify(backup.watched));
      if (backup.watchlist) localStorage.setItem('mva_watchlist', JSON.stringify(backup.watchlist));
      if (backup.lists) localStorage.setItem('mva_lists', JSON.stringify(backup.lists));
      if (backup.profile) localStorage.setItem('mva_profile', JSON.stringify(backup.profile));
      localStorage.removeItem(LetterboxdImportService.BACKUP_KEY);
      return true;
    } catch {
      return false;
    }
  }

  private createBackup(): void {
    try {
      const backup = {
        timestamp: new Date().toISOString(),
        watched: JSON.parse(localStorage.getItem('mva_watched') || '{}'),
        watchlist: JSON.parse(localStorage.getItem('mva_watchlist') || '[]'),
        lists: JSON.parse(localStorage.getItem('mva_lists') || '[]'),
        profile: JSON.parse(localStorage.getItem('mva_profile') || '{}'),
      };
      localStorage.setItem(LetterboxdImportService.BACKUP_KEY, JSON.stringify(backup));
    } catch {
      // Ignore quota error if backup fails
    }
  }

  /**
   * Main entrypoint to process an imported Letterboxd export (ZIP buffer or map of CSV contents).
   */
  public async prepareImport(
    files: Record<string, string>,
    options: ImportOptions = { importProfile: false, importWatchlist: true, importCustomLists: true, skipDuplicates: false },
    onProgress?: (p: ImportProgress) => void,
  ): Promise<ImportPlan> {
    const notify = (current: number, total: number, message: string, phase: ImportProgress['phase'] = 'matching') => {
      if (onProgress) {
        onProgress({ phase, current, total, message });
      }
    };

    notify(0, 100, 'Parsing Letterboxd export files...', 'parsing');

    // 1. Ingest files
    const diaryRows = files['diary.csv'] ? CsvParser.parse(files['diary.csv']).rows : [];
    const reviewRows = files['reviews.csv'] ? CsvParser.parse(files['reviews.csv']).rows : [];
    const ratingRows = files['ratings.csv'] ? CsvParser.parse(files['ratings.csv']).rows : [];
    const watchedRows = files['watched.csv'] ? CsvParser.parse(files['watched.csv']).rows : [];
    const watchlistRows = files['watchlist.csv'] ? CsvParser.parse(files['watchlist.csv']).rows : [];
    const likesRows = files['likes/films.csv'] ? CsvParser.parse(files['likes/films.csv']).rows : [];

    // Parse list files (lists/*.csv)
    const listExports: Array<{ filename: string; parsed: LetterboxdListExport }> = [];
    Object.keys(files).forEach((filename) => {
      if (filename.startsWith('lists/') && filename.endsWith('.csv')) {
        const parsedList = CsvParser.parseLetterboxdList(files[filename]);
        listExports.push({ filename, parsed: parsedList });
      }
    });

    // 2. Parse Profile (Privacy Guaranteed!)
    let stagedProfile: StagedProfile | undefined;
    if (options.importProfile && files['profile.csv']) {
      const parsedProfile = CsvParser.parse(files['profile.csv']).rows[0];
      if (parsedProfile) {
        // STRICT PRIVACY: Only extract Username/Given Name and Bio.
        // Explicitly NEVER touch Email, Family Name, Pronoun, Location, or Website.
        const displayName = parsedProfile.Username || parsedProfile['Given Name'] || '';
        const bio = parsedProfile.Bio || '';
        stagedProfile = {
          displayName: displayName.trim() || undefined,
          bio: bio.trim() || undefined,
        };
      }
    }

    // 3. Aggregate all staged film entries
    const stagedEntries: StagedFilmEntry[] = [];
    // Map by URI and by title+year to correlate reviews, ratings, likes
    const uriToEntryIndex = new Map<string, number>();
    const titleYearToEntryIndex = new Map<string, number>();

    // Process diary.csv (highest fidelity logs with specific dates)
    for (const row of diaryRows) {
      const name = (row.Name || '').trim();
      const year = (row.Year || '').trim();
      const uri = (row['Letterboxd URI'] || '').trim();
      const rawRating = parseFloat(row.Rating || '');
      const rating = isNaN(rawRating) ? null : Math.max(0.5, Math.min(5.0, rawRating));
      const rewatch = (row.Rewatch || '').trim().toLowerCase() === 'yes';
      const watchedDate = (row['Watched Date'] || '').trim();
      const logDate = (row.Date || '').trim();

      const watchedAt = watchedDate || logDate || null;
      const approximateDate = !watchedDate && !!logDate;

      const rawTags = (row.Tags || '').split(',').map((t) => t.trim()).filter((t) => t.length > 0);

      const entry: StagedFilmEntry = {
        sourceTitle: name,
        sourceYear: year || undefined,
        sourceUri: uri || undefined,
        watchedAt,
        dateUnknown: !watchedAt,
        approximateDate,
        rating,
        rewatch,
        review: '',
        tags: rawTags,
        liked: false,
      };

      const idx = stagedEntries.length;
      stagedEntries.push(entry);
      if (uri) {
        uriToEntryIndex.set(uri, idx);
      }
      titleYearToEntryIndex.set(`${name.toLowerCase()}|${year}`, idx);
    }

    // Process reviews.csv (attach reviews to matching diary entries or create entry)
    for (const row of reviewRows) {
      const uri = (row['Letterboxd URI'] || '').trim();
      const name = (row.Name || '').trim();
      const year = (row.Year || '').trim();
      const reviewText = (row.Review || '').replace(/<[^>]*>?/gm, '').trim(); // strip html
      const cappedReview = reviewText.slice(0, 20000);

      let targetIdx = uri ? uriToEntryIndex.get(uri) : undefined;
      if (targetIdx === undefined) {
        targetIdx = titleYearToEntryIndex.get(`${name.toLowerCase()}|${year}`);
      }

      if (targetIdx !== undefined) {
        stagedEntries[targetIdx].review = cappedReview;
      } else if (name) {
        // Create an entry for the review if not already in diary
        const rawRating = parseFloat(row.Rating || '');
        const rating = isNaN(rawRating) ? null : Math.max(0.5, Math.min(5.0, rawRating));
        const watchedDate = (row['Watched Date'] || '').trim();
        const logDate = (row.Date || '').trim();
        const watchedAt = watchedDate || logDate || null;
        const rawTags = (row.Tags || '').split(',').map((t) => t.trim()).filter((t) => t.length > 0);

        const newEntry: StagedFilmEntry = {
          sourceTitle: name,
          sourceYear: year || undefined,
          sourceUri: uri || undefined,
          watchedAt,
          dateUnknown: !watchedAt,
          approximateDate: !watchedDate && !!logDate,
          rating,
          rewatch: (row.Rewatch || '').trim().toLowerCase() === 'yes',
          review: cappedReview,
          tags: rawTags,
          liked: false,
        };
        const idx = stagedEntries.length;
        stagedEntries.push(newEntry);
        if (uri) uriToEntryIndex.set(uri, idx);
        titleYearToEntryIndex.set(`${name.toLowerCase()}|${year}`, idx);
      }
    }

    // Process ratings.csv (add ratings for titles not in diary)
    for (const row of ratingRows) {
      const uri = (row['Letterboxd URI'] || '').trim();
      const name = (row.Name || '').trim();
      const year = (row.Year || '').trim();
      const rawRating = parseFloat(row.Rating || '');
      const rating = isNaN(rawRating) ? null : Math.max(0.5, Math.min(5.0, rawRating));

      let targetIdx = uri ? uriToEntryIndex.get(uri) : undefined;
      if (targetIdx === undefined) {
        targetIdx = titleYearToEntryIndex.get(`${name.toLowerCase()}|${year}`);
      }

      if (targetIdx !== undefined) {
        if (stagedEntries[targetIdx].rating === null && rating !== null) {
          stagedEntries[targetIdx].rating = rating;
        }
      } else if (name && rating !== null) {
        // Film was rated but never dated in diary: imported with dateUnknown: true
        const newEntry: StagedFilmEntry = {
          sourceTitle: name,
          sourceYear: year || undefined,
          sourceUri: uri || undefined,
          watchedAt: null,
          dateUnknown: true,
          approximateDate: false,
          rating,
          rewatch: false,
          review: '',
          tags: [],
          liked: false,
        };
        const idx = stagedEntries.length;
        stagedEntries.push(newEntry);
        if (uri) uriToEntryIndex.set(uri, idx);
        titleYearToEntryIndex.set(`${name.toLowerCase()}|${year}`, idx);
      }
    }

    // Process watched.csv (films marked watched with no rating or diary date)
    for (const row of watchedRows) {
      const uri = (row['Letterboxd URI'] || '').trim();
      const name = (row.Name || '').trim();
      const year = (row.Year || '').trim();

      let targetIdx = uri ? uriToEntryIndex.get(uri) : undefined;
      if (targetIdx === undefined) {
        targetIdx = titleYearToEntryIndex.get(`${name.toLowerCase()}|${year}`);
      }

      if (targetIdx === undefined && name) {
        const newEntry: StagedFilmEntry = {
          sourceTitle: name,
          sourceYear: year || undefined,
          sourceUri: uri || undefined,
          watchedAt: null,
          dateUnknown: true,
          approximateDate: false,
          rating: null,
          rewatch: false,
          review: '',
          tags: [],
          liked: false,
        };
        const idx = stagedEntries.length;
        stagedEntries.push(newEntry);
        if (uri) uriToEntryIndex.set(uri, idx);
        titleYearToEntryIndex.set(`${name.toLowerCase()}|${year}`, idx);
      }
    }

    // Process likes/films.csv (mark liked = true)
    for (const row of likesRows) {
      const uri = (row['Letterboxd URI'] || '').trim();
      const name = (row.Name || '').trim();
      const year = (row.Year || '').trim();

      let targetIdx = uri ? uriToEntryIndex.get(uri) : undefined;
      if (targetIdx === undefined) {
        targetIdx = titleYearToEntryIndex.get(`${name.toLowerCase()}|${year}`);
      }

      if (targetIdx !== undefined) {
        stagedEntries[targetIdx].liked = true;
      } else if (name) {
        // Liked film not yet in list -> add as watched with dateUnknown
        const newEntry: StagedFilmEntry = {
          sourceTitle: name,
          sourceYear: year || undefined,
          sourceUri: uri || undefined,
          watchedAt: null,
          dateUnknown: true,
          approximateDate: false,
          rating: null,
          rewatch: false,
          review: '',
          tags: [],
          liked: true,
        };
        const idx = stagedEntries.length;
        stagedEntries.push(newEntry);
        if (uri) uriToEntryIndex.set(uri, idx);
        titleYearToEntryIndex.set(`${name.toLowerCase()}|${year}`, idx);
      }
    }

    // Process watchlist.csv
    const stagedWatchlist: StagedWatchlistItem[] = [];
    if (options.importWatchlist) {
      for (const row of watchlistRows) {
        const name = (row.Name || '').trim();
        const year = (row.Year || '').trim();
        const uri = (row['Letterboxd URI'] || '').trim();
        const addedAt = (row.Date || '').trim() || new Date().toISOString();
        if (name) {
          stagedWatchlist.push({
            sourceTitle: name,
            sourceYear: year || undefined,
            sourceUri: uri || undefined,
            addedAt,
          });
        }
      }
    }

    // Process Custom Lists
    const stagedLists: StagedList[] = [];
    if (options.importCustomLists) {
      for (const listExp of listExports) {
        const listName = listExp.parsed.metadata.name || listExp.filename.replace(/^lists\//, '').replace(/\.csv$/, '');
        const listDesc = listExp.parsed.metadata.description || '';
        const items = listExp.parsed.items.map((it) => ({
          sourceTitle: it.name,
          sourceYear: it.year || undefined,
          description: it.description,
          position: it.position,
        }));
        stagedLists.push({
          name: listName,
          description: listDesc,
          items,
        });
      }
    }

    // 4. Unique titles to match against TMDb
    const uniqueFilmMap = new Map<string, { title: string; year?: string }>();
    stagedEntries.forEach((e) => {
      const key = `${e.sourceTitle.toLowerCase()}|${e.sourceYear || ''}`;
      if (!uniqueFilmMap.has(key)) {
        uniqueFilmMap.set(key, { title: e.sourceTitle, year: e.sourceYear });
      }
    });
    stagedWatchlist.forEach((w) => {
      const key = `${w.sourceTitle.toLowerCase()}|${w.sourceYear || ''}`;
      if (!uniqueFilmMap.has(key)) {
        uniqueFilmMap.set(key, { title: w.sourceTitle, year: w.sourceYear });
      }
    });
    stagedLists.forEach((l) => {
      l.items.forEach((it) => {
        const key = `${it.sourceTitle.toLowerCase()}|${it.sourceYear || ''}`;
        if (!uniqueFilmMap.has(key)) {
          uniqueFilmMap.set(key, { title: it.sourceTitle, year: it.sourceYear });
        }
      });
    });

    const uniqueTitles = Array.from(uniqueFilmMap.values());
    const totalTitlesToMatch = uniqueTitles.length;

    // 5. Match titles against TMDb with concurrency limiter (3 concurrent)
    const matchLookup = new Map<string, MatchResult>();
    const ambiguousMatches: MatchResult[] = [];
    const unmatchedItems: Array<{ title: string; year?: string }> = [];

    const concurrency = 3;
    let completedCount = 0;

    for (let i = 0; i < uniqueTitles.length; i += concurrency) {
      const batch = uniqueTitles.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (item) => {
          const res = await this.matcher.match(item.title, item.year);
          const key = `${item.title.toLowerCase()}|${item.year || ''}`;
          matchLookup.set(key, res);

          if (res.confidence === 'ambiguous') {
            ambiguousMatches.push(res);
          } else if (res.confidence === 'unmatched') {
            unmatchedItems.push({ title: item.title, year: item.year });
          }

          completedCount++;
          notify(completedCount, totalTitlesToMatch, `Matching: "${item.title}" (${completedCount}/${totalTitlesToMatch})`);
        }),
      );
    }

    // Persist match cache for fast resumption
    this.matcher.saveCache();

    // 6. Associate matched metadata with staged entries
    let confidentCount = 0;
    stagedEntries.forEach((entry) => {
      const key = `${entry.sourceTitle.toLowerCase()}|${entry.sourceYear || ''}`;
      const res = matchLookup.get(key);
      if (res && res.matched) {
        entry.matchedMedia = res.matched;
        confidentCount++;
      }
    });

    stagedWatchlist.forEach((w) => {
      const key = `${w.sourceTitle.toLowerCase()}|${w.sourceYear || ''}`;
      const res = matchLookup.get(key);
      if (res && res.matched) {
        w.matchedMedia = res.matched;
      }
    });

    stagedLists.forEach((l) => {
      l.items.forEach((it) => {
        const key = `${it.sourceTitle.toLowerCase()}|${it.sourceYear || ''}`;
        const res = matchLookup.get(key);
        if (res && res.matched) {
          it.matchedMedia = res.matched;
        }
      });
    });

    notify(totalTitlesToMatch, totalTitlesToMatch, 'Import plan ready for review', 'ready');

    return {
      stagedEntries,
      stagedWatchlist,
      stagedLists,
      stagedProfile,
      ambiguousMatches,
      unmatchedItems,
      stats: {
        totalParsedFiles: Object.keys(files).length,
        totalTitles: totalTitlesToMatch,
        diaryCount: diaryRows.length,
        ratingsOnlyCount: stagedEntries.filter((e) => e.dateUnknown && e.rating !== null).length,
        watchedOnlyCount: stagedEntries.filter((e) => e.dateUnknown && e.rating === null).length,
        watchlistCount: stagedWatchlist.length,
        listsCount: stagedLists.length,
        confidentCount,
        ambiguousCount: ambiguousMatches.length,
        unmatchedCount: unmatchedItems.length,
      },
    };
  }

  /**
   * Commits the staged import atomically to local storage.
   */
  public async commitImport(
    plan: ImportPlan,
    ambiguousResolutions: Map<string, TmdbMatchCandidate | null> = new Map(),
    onProgress?: (p: ImportProgress) => void,
  ): Promise<{ importedCount: number; watchlistCount: number; listsCount: number }> {
    if (onProgress) {
      onProgress({ phase: 'committing', current: 0, total: 100, message: 'Creating pre-import backup...' });
    }

    // 1. Create atomic pre-import backup snapshot
    this.createBackup();

    // 2. Resolve ambiguous items
    ambiguousResolutions.forEach((candidate, key) => {
      if (candidate) {
        plan.stagedEntries.forEach((entry) => {
          const entryKey = `${entry.sourceTitle.toLowerCase()}|${entry.sourceYear || ''}`;
          if (entryKey === key) {
            entry.matchedMedia = candidate;
          }
        });
        plan.stagedWatchlist.forEach((w) => {
          const wKey = `${w.sourceTitle.toLowerCase()}|${w.sourceYear || ''}`;
          if (wKey === key) {
            w.matchedMedia = candidate;
          }
        });
        plan.stagedLists.forEach((l) => {
          l.items.forEach((it) => {
            const itKey = `${it.sourceTitle.toLowerCase()}|${it.sourceYear || ''}`;
            if (itKey === key) {
              it.matchedMedia = candidate;
            }
          });
        });
      }
    });

    // 3. Batch commit watched entries
    let importedCount = 0;
    const entriesToSave = plan.stagedEntries.filter((e) => e.matchedMedia != null);

    entriesToSave.forEach((e) => {
      const media = e.matchedMedia!;
      this.userData.logEntry({
        id: media.id,
        media_type: 'movie',
        title: media.title,
        poster_path: media.poster_path,
        watchedAt: e.watchedAt,
        dateUnknown: e.dateUnknown,
        approximateDate: e.approximateDate,
        rewatch: e.rewatch,
        rating: e.rating,
        review: e.review,
        tags: e.tags,
        liked: e.liked,
        sourceKey: e.sourceUri,
        release_date: media.release_date,
        isNewRewatchLog: true, // each diary entry is logged
      });
      importedCount++;
    });

    // 4. Batch commit watchlist entries
    let watchlistCount = 0;
    plan.stagedWatchlist
      .filter((w) => w.matchedMedia != null)
      .forEach((w) => {
        const media = w.matchedMedia!;
        this.userData.addToWatchlist({
          id: media.id,
          media_type: 'movie',
          title: media.title,
          poster_path: media.poster_path,
          release_date: media.release_date,
        });
        watchlistCount++;
      });

    // 5. Batch commit custom lists
    let listsCount = 0;
    plan.stagedLists.forEach((stagedList) => {
      const createdList = this.userData.createList(stagedList.name);
      stagedList.items
        .filter((it) => it.matchedMedia != null)
        .forEach((it) => {
          const media = it.matchedMedia!;
          this.userData.addToList(createdList.id, {
            id: media.id,
            media_type: 'movie',
            title: media.title,
            poster_path: media.poster_path,
            release_date: media.release_date,
          });
        });
      listsCount++;
    });

    // 6. Profile update (if opted-in)
    if (plan.stagedProfile) {
      this.userData.saveProfile({
        displayName: plan.stagedProfile.displayName,
        bio: plan.stagedProfile.bio,
      });
    }

    if (onProgress) {
      onProgress({ phase: 'done', current: 100, total: 100, message: 'Import completed successfully!' });
    }

    return { importedCount, watchlistCount, listsCount };
  }

  /**
   * Generates a CSV string report of unmatched items for user export.
   */
  public generateUnmatchedReport(unmatched: Array<{ title: string; year?: string; uri?: string }>): string {
    const headers = ['Title', 'Year', 'Letterboxd URI'];
    const rows = unmatched.map((u) => ({
      Title: u.title,
      Year: u.year || '',
      'Letterboxd URI': u.uri || '',
    }));
    return CsvParser.stringify(headers, rows);
  }
}
