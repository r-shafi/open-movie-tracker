import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { MediaMetadataSnapshot, UserDataService } from './user-data.service';
import { TmdbService } from './tmdb.service';

export interface BackfillProgress {
  isRunning: boolean;
  isPaused: boolean;
  completed: number;
  total: number;
  currentTitle: string;
  failedCount?: number;
}

@Injectable({
  providedIn: 'root',
})
export class MetadataBackfillService {
  private progress$ = new BehaviorSubject<BackfillProgress>({
    isRunning: false,
    isPaused: false,
    completed: 0,
    total: 0,
    currentTitle: '',
    failedCount: 0,
  });

  private shouldStop = false;

  constructor(
    private userData: UserDataService,
    private tmdb: TmdbService,
  ) {
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', () => {
        if (this.progress$.value.isRunning) {
          this.pause();
        }
      });
      window.addEventListener('online', () => {
        if (this.progress$.value.isPaused) {
          this.resume();
        }
      });

      // Opportunistic background start if online and missing entries exist
      setTimeout(() => {
        if (
          typeof navigator !== 'undefined' &&
          navigator.onLine &&
          !this.progress$.value.isRunning &&
          this.userData.getMissingSnapshotTitles().length > 0
        ) {
          this.start();
        }
      }, 2500);
    }
  }

  public getProgress(): Observable<BackfillProgress> {
    return this.progress$.asObservable();
  }

  public get currentProgress(): BackfillProgress {
    return this.progress$.value;
  }

  public async refreshStats(resetFailures = true): Promise<void> {
    if (resetFailures) {
      this.userData.resetFailedBackfills();
    }
    await this.start();
  }

  public async start(): Promise<void> {
    if (this.progress$.value.isRunning) {
      return;
    }

    const missing = this.userData.getMissingSnapshotTitles();
    if (!missing.length) {
      this.progress$.next({
        isRunning: false,
        isPaused: false,
        completed: 0,
        total: 0,
        currentTitle: '',
        failedCount: 0,
      });
      return;
    }

    this.shouldStop = false;
    this.progress$.next({
      isRunning: true,
      isPaused: false,
      completed: 0,
      total: missing.length,
      currentTitle: missing[0].title,
      failedCount: 0,
    });

    let completed = 0;
    let failedCount = 0;
    const total = missing.length;
    let backoffMs = 0;

    for (const item of missing) {
      if (this.shouldStop) {
        break;
      }

      // Check network connectivity
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.progress$.next({
          ...this.progress$.value,
          isPaused: true,
        });
        break;
      }

      this.progress$.next({
        isRunning: true,
        isPaused: false,
        completed,
        total,
        currentTitle: item.title,
        failedCount,
      });

      if (backoffMs > 0) {
        await new Promise((r) => setTimeout(r, backoffMs));
      }

      try {
        await this.fetchAndSaveSnapshot(item.media_type, item.id);
        backoffMs = 0; // reset on success
      } catch (err: any) {
        failedCount++;
        const isRateLimit = err?.status === 429;
        backoffMs = isRateLimit ? Math.min((backoffMs || 1000) * 2, 16000) : 0;

        const currentStatus = this.userData.getBackfillStatus()[`${item.media_type}:${item.id}`];
        this.userData.setBackfillItemStatus(item.media_type, item.id, {
          status: 'failed',
          attempts: (currentStatus?.attempts || 0) + 1,
          error: err?.message || (isRateLimit ? 'Rate limited (429)' : 'Fetch error'),
          lastAttempt: new Date().toISOString(),
        });
      }

      completed++;

      // Yield to main thread and pace requests
      await new Promise((r) => setTimeout(r, 200));
    }

    this.progress$.next({
      isRunning: false,
      isPaused: false,
      completed,
      total,
      currentTitle: '',
      failedCount,
    });
  }

  public pause(): void {
    this.shouldStop = true;
    this.progress$.next({
      ...this.progress$.value,
      isPaused: true,
      isRunning: false,
    });
  }

  public resume(): void {
    if (this.progress$.value.isPaused) {
      this.start();
    }
  }

  private async fetchAndSaveSnapshot(mediaType: 'movie' | 'tv', id: number): Promise<void> {
    if (mediaType === 'movie') {
      const details: any = await firstValueFrom(this.tmdb.getMovieDetails(id));
      if (!details) return;

      const directors = details.credits?.crew
        ? details.credits.crew
            .filter((c: any) => c.job === 'Director')
            .map((c: any) => ({
              id: c.id,
              name: c.name,
              profilePath: c.profile_path || null,
            }))
        : [];

      const topCast = details.credits?.cast
        ? details.credits.cast
            .slice(0, 5)
            .map((c: any) => ({
              id: c.id,
              name: c.name,
              profilePath: c.profile_path || null,
            }))
        : [];

      const snapshot: MediaMetadataSnapshot = {
        runtimeMinutes: details.runtime || undefined,
        genres: details.genres ? details.genres.map((g: any) => ({ id: g.id, name: g.name })) : [],
        releaseYear: details.release_date ? parseInt(details.release_date.substring(0, 4), 10) : undefined,
        releaseDate: details.release_date,
        originalLanguage: details.original_language,
        productionCountries: details.production_countries ? details.production_countries.map((c: any) => c.iso_3166_1 || c.name) : [],
        directors,
        topCast,
        tmdbVoteAverage: details.vote_average,
        tmdbVoteCount: details.vote_count,
        tmdbPopularity: details.popularity,
        belongsToCollection: details.belongs_to_collection
          ? {
              id: details.belongs_to_collection.id,
              name: details.belongs_to_collection.name,
              posterPath: details.belongs_to_collection.poster_path || null,
            }
          : null,
        productionCompanies: details.production_companies
          ? details.production_companies.map((c: any) => ({
              id: c.id,
              name: c.name,
              country: c.origin_country,
            }))
          : [],
        posterPath: details.poster_path,
        backdropPath: details.backdrop_path,
      };

      this.userData.updateSnapshot('movie', id, snapshot);
    } else {
      const details: any = await firstValueFrom(this.tmdb.getTvDetails(id));
      if (!details) return;

      const runtime = (details.episode_run_time && details.episode_run_time.length)
        ? details.episode_run_time[0]
        : (details.last_episode_to_air?.runtime || undefined);

      const castList = details.aggregate_credits?.cast || details.credits?.cast || [];
      const topCast = castList.slice(0, 5).map((c: any) => ({
        id: c.id,
        name: c.name,
        profilePath: c.profile_path || null,
      }));

      let directors = details.created_by && details.created_by.length
        ? details.created_by.map((c: any) => ({
            id: c.id,
            name: c.name,
            profilePath: c.profile_path || null,
          }))
        : [];

      if (!directors.length && details.credits?.crew) {
        directors = details.credits.crew
          .filter((c: any) => c.job === 'Director')
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            profilePath: c.profile_path || null,
          }));
      }

      const snapshot: MediaMetadataSnapshot = {
        runtimeMinutes: runtime,
        genres: details.genres ? details.genres.map((g: any) => ({ id: g.id, name: g.name })) : [],
        releaseYear: details.first_air_date ? parseInt(details.first_air_date.substring(0, 4), 10) : undefined,
        releaseDate: details.first_air_date,
        originalLanguage: details.original_language,
        productionCountries: details.production_countries ? details.production_countries.map((c: any) => c.iso_3166_1 || c.name) : [],
        directors,
        topCast,
        tmdbVoteAverage: details.vote_average,
        tmdbVoteCount: details.vote_count,
        tmdbPopularity: details.popularity,
        numberOfEpisodes: details.number_of_episodes,
        numberOfSeasons: details.number_of_seasons,
        episodeRuntimes: details.episode_run_time || (runtime ? [runtime] : undefined),
        productionCompanies: details.production_companies
          ? details.production_companies.map((c: any) => ({
              id: c.id,
              name: c.name,
              country: c.origin_country,
            }))
          : [],
        posterPath: details.poster_path,
        backdropPath: details.backdrop_path,
      };

      this.userData.updateSnapshot('tv', id, snapshot);
    }
  }
}
