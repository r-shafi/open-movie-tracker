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
    }
  }

  public getProgress(): Observable<BackfillProgress> {
    return this.progress$.asObservable();
  }

  public get currentProgress(): BackfillProgress {
    return this.progress$.value;
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
    });

    let completed = 0;
    const total = missing.length;

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
      });

      try {
        await this.fetchAndSaveSnapshot(item.media_type, item.id);
      } catch {
        // Continue to next item on network or parse error
      }

      completed++;

      // Yield to main thread and avoid hammering TMDb
      await new Promise((r) => setTimeout(r, 200));
    }

    this.progress$.next({
      isRunning: false,
      isPaused: false,
      completed,
      total,
      currentTitle: '',
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
        ? details.credits.crew.filter((c: any) => c.job === 'Director').map((c: any) => ({ id: c.id, name: c.name }))
        : [];

      const topCast = details.credits?.cast
        ? details.credits.cast.slice(0, 5).map((c: any) => ({ id: c.id, name: c.name }))
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

      const topCast = details.credits?.cast
        ? details.credits.cast.slice(0, 5).map((c: any) => ({ id: c.id, name: c.name }))
        : [];

      const directors = details.created_by
        ? details.created_by.map((c: any) => ({ id: c.id, name: c.name }))
        : [];

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
        posterPath: details.poster_path,
        backdropPath: details.backdrop_path,
      };

      this.userData.updateSnapshot('tv', id, snapshot);
    }
  }
}
