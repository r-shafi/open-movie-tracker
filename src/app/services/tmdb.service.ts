import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { UserDataService } from './user-data.service';

export interface DiscoverParams {
  sort_by?: string;
  with_genres?: string;
  primary_release_year?: number;
  first_air_date_year?: number;
  'primary_release_date.gte'?: string;
  'primary_release_date.lte'?: string;
  'vote_average.gte'?: number;
  'vote_average.lte'?: number;
  with_original_language?: string;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class TmdbService {
  private readonly base = environment.tmdbBaseUrl;
  private readonly cachePrefix = 'tmdb_cache_v2:';
  private readonly cacheTTL = 1000 * 60 * 60 * 24 * 7;
  private readonly maxCacheEntries = 250;

  private get key(): string {
    const custom = this.userData.getSettings().tmdbApiKey?.trim();
    return custom || environment.tmdbApiKey;
  }

  constructor(
    private http: HttpClient,
    private userData: UserDataService,
  ) {}

  // ── helpers ────────────────────────────────────────────────────────────────

  private params(extra: Record<string, any> = {}): HttpParams {
    const s = this.userData.getSettings();
    let p = new HttpParams()
      .set('api_key', this.key)
      .set('language', s.language)
      .set('include_adult', String(s.includeAdult));
    Object.entries(extra).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        p = p.set(k, String(v));
      }
    });
    return p;
  }

  private get<T>(path: string, extra: Record<string, any> = {}): Observable<T> {
    const params = this.params(extra);
    const cacheKey = this.cacheKey(path, params);
    const cached = this.readCache<T>(cacheKey);
    const request$ = this.http.get<T>(`${this.base}${path}`, { params }).pipe(
      map((res) => this.applyBlockedLanguageFilter(res)),
      map((res) => {
        this.writeCache(cacheKey, res);
        return res;
      }),
      catchError((err) => {
        if (cached !== null) {
          return of(cached);
        }
        return throwError(() => err);
      }),
    );

    if (!navigator.onLine && cached !== null) {
      return new Observable<T>((subscriber) => {
        subscriber.next(cached);
        subscriber.complete();
      });
    }

    return request$;
  }

  private cacheKey(path: string, params: HttpParams): string {
    const entries = params
      .keys()
      .sort()
      .map((k) => `${k}=${params.getAll(k)?.join(',') || ''}`)
      .join('&');
    return `${this.cachePrefix}${path}?${entries}`;
  }

  private readCache<T>(key: string): T | null {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as { timestamp: number; data: T };
      if (!parsed || typeof parsed.timestamp !== 'number') {
        return null;
      }
      if (Date.now() - parsed.timestamp > this.cacheTTL) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed.data;
    } catch {
      return null;
    }
  }

  private writeCache<T>(key: string, data: T): void {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ timestamp: Date.now(), data }),
      );
      this.pruneCache();
    } catch {
      // Ignore cache write failures to avoid impacting live responses.
    }
  }

  private pruneCache(): void {
    const items: Array<{ key: string; timestamp: number }> = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(this.cachePrefix)) {
        continue;
      }
      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      try {
        const parsed = JSON.parse(raw) as { timestamp?: number };
        if (typeof parsed.timestamp === 'number') {
          items.push({ key, timestamp: parsed.timestamp });
        }
      } catch {
        localStorage.removeItem(key);
      }
    }

    if (items.length <= this.maxCacheEntries) {
      return;
    }

    items
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, items.length - this.maxCacheEntries)
      .forEach((entry) => localStorage.removeItem(entry.key));
  }

  private applyBlockedLanguageFilter<T>(payload: T): T {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }
    const blocked = this.userData.getSettings().excludeLanguages || [];
    if (!blocked.length) {
      return payload;
    }

    const lowerBlocked = new Set(blocked.map((code) => code.toLowerCase()));
    const asRecord = payload as Record<string, any>;
    if (!Array.isArray(asRecord.results)) {
      return payload;
    }

    const nextResults = asRecord.results.filter((item: any) => {
      const lang = (item?.original_language || '').toLowerCase();
      return !lang || !lowerBlocked.has(lang);
    });

    return {
      ...(payload as any),
      results: nextResults,
    } as T;
  }

  // ── Trending ───────────────────────────────────────────────────────────────

  getTrendingAll(
    timeWindow: 'day' | 'week' = 'day',
    page = 1,
  ): Observable<any> {
    return this.get(`/trending/all/${timeWindow}`, { page });
  }

  getTrendingMovies(
    page = 1,
    timeWindow: 'day' | 'week' = 'day',
  ): Observable<any> {
    return this.get(`/trending/movie/${timeWindow}`, { page });
  }

  getTrendingTv(page = 1, timeWindow: 'day' | 'week' = 'day'): Observable<any> {
    return this.get(`/trending/tv/${timeWindow}`, { page });
  }

  getTrendingPeople(
    page = 1,
    timeWindow: 'day' | 'week' = 'day',
  ): Observable<any> {
    return this.get(`/trending/person/${timeWindow}`, { page });
  }

  // ── Movies ─────────────────────────────────────────────────────────────────

  getPopularMovies(page = 1): Observable<any> {
    return this.get('/movie/popular', {
      page,
      region: this.userData.getSettings().region,
    });
  }

  getTopRatedMovies(page = 1): Observable<any> {
    return this.get('/movie/top_rated', {
      page,
      region: this.userData.getSettings().region,
    });
  }

  getNowPlayingMovies(page = 1): Observable<any> {
    return this.get('/movie/now_playing', {
      page,
      region: this.userData.getSettings().region,
    });
  }

  getUpcomingMovies(page = 1): Observable<any> {
    return this.get('/movie/upcoming', {
      page,
      region: this.userData.getSettings().region,
    });
  }

  getMovie(id: number | string): Observable<any> {
    return this.get(`/movie/${id}`, { append_to_response: 'release_dates' });
  }

  getMovieCredits(id: number | string): Observable<any> {
    return this.get(`/movie/${id}/credits`);
  }

  getMovieVideos(id: number | string): Observable<any> {
    return this.get(`/movie/${id}/videos`);
  }

  getMovieImages(id: number | string): Observable<any> {
    return this.get(`/movie/${id}/images`);
  }

  getMovieSimilar(id: number | string, page = 1): Observable<any> {
    return this.get(`/movie/${id}/similar`, { page });
  }

  getMovieRecommendations(id: number | string, page = 1): Observable<any> {
    return this.get(`/movie/${id}/recommendations`, { page });
  }

  getMovieReviews(id: number | string, page = 1): Observable<any> {
    return this.get(`/movie/${id}/reviews`, { page });
  }

  getMovieCollection(collectionId: number | string): Observable<any> {
    return this.get(`/collection/${collectionId}`);
  }

  getMovieKeywords(id: number | string): Observable<any> {
    return this.get(`/movie/${id}/keywords`);
  }

  discoverMovies(extra: DiscoverParams = {}): Observable<any> {
    return this.get('/discover/movie', { ...extra });
  }

  getMovieGenres(): Observable<any> {
    return this.get('/genre/movie/list');
  }

  // ── TV ─────────────────────────────────────────────────────────────────────

  getPopularTv(page = 1): Observable<any> {
    return this.get('/tv/popular', { page });
  }

  getTopRatedTv(page = 1): Observable<any> {
    return this.get('/tv/top_rated', { page });
  }

  getAiringTodayTv(page = 1): Observable<any> {
    return this.get('/tv/airing_today', { page });
  }

  getOnAirTv(page = 1): Observable<any> {
    return this.get('/tv/on_the_air', { page });
  }

  getTvDetails(id: number | string): Observable<any> {
    return this.get(`/tv/${id}`, { append_to_response: 'content_ratings' });
  }

  getTvCredits(id: number | string): Observable<any> {
    return this.get(`/tv/${id}/credits`);
  }

  getTvVideos(id: number | string): Observable<any> {
    return this.get(`/tv/${id}/videos`);
  }

  getTvImages(id: number | string): Observable<any> {
    return this.get(`/tv/${id}/images`);
  }

  getTvSimilar(id: number | string, page = 1): Observable<any> {
    return this.get(`/tv/${id}/similar`, { page });
  }

  getTvRecommendations(id: number | string, page = 1): Observable<any> {
    return this.get(`/tv/${id}/recommendations`, { page });
  }

  getTvReviews(id: number | string, page = 1): Observable<any> {
    return this.get(`/tv/${id}/reviews`, { page });
  }

  getTvSeason(
    tvId: number | string,
    seasonNumber: number | string,
  ): Observable<any> {
    return this.get(`/tv/${tvId}/season/${seasonNumber}`);
  }

  discoverTv(extra: DiscoverParams = {}): Observable<any> {
    return this.get('/discover/tv', { ...extra });
  }

  getTvGenres(): Observable<any> {
    return this.get('/genre/tv/list');
  }

  // ── People ─────────────────────────────────────────────────────────────────

  getPersonDetails(id: number | string): Observable<any> {
    return this.get(`/person/${id}`, {
      append_to_response: 'combined_credits,external_ids',
    });
  }

  getPersonCredits(id: number | string): Observable<any> {
    return this.get(`/person/${id}/combined_credits`);
  }

  getPersonImages(id: number | string): Observable<any> {
    return this.get(`/person/${id}/images`);
  }

  // ── Lists ─────────────────────────────────────────────────────────────────

  getMovieLists(id: number | string, page = 1): Observable<any> {
    return this.get(`/movie/${id}/lists`, { page });
  }

  getTvLists(id: number | string, page = 1): Observable<any> {
    return this.get(`/tv/${id}/lists`, { page });
  }

  getListDetail(id: number | string, page = 1): Observable<any> {
    return this.get(`/list/${id}`, { page });
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  searchMulti(query: string, page = 1): Observable<any> {
    return this.get('/search/multi', { query, page });
  }

  searchMovies(query: string, page = 1): Observable<any> {
    return this.get('/search/movie', { query, page });
  }

  searchTv(query: string, page = 1): Observable<any> {
    return this.get('/search/tv', { query, page });
  }

  searchPeople(query: string, page = 1): Observable<any> {
    return this.get('/search/person', { query, page });
  }
}
