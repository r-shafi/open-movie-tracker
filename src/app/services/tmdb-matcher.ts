import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TmdbService } from './tmdb.service';

export interface TmdbMatchCandidate {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  poster_path: string | null;
  overview?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  media_type: 'movie';
  score: number; // 0 - 100
}

export type MatchConfidence = 'confident' | 'ambiguous' | 'unmatched';

export interface MatchResult {
  sourceTitle: string;
  sourceYear?: string;
  confidence: MatchConfidence;
  matched: TmdbMatchCandidate | null;
  candidates: TmdbMatchCandidate[];
}

@Injectable({
  providedIn: 'root',
})
export class TmdbMatcher {
  private static readonly MATCH_CACHE_KEY = 'mva_import_match_cache';
  private matchCache: Record<string, TmdbMatchCandidate | null> = {};

  constructor(
    private http: HttpClient,
    private tmdb: TmdbService,
  ) {
    this.loadCache();
  }

  private loadCache(): void {
    try {
      const raw = localStorage.getItem(TmdbMatcher.MATCH_CACHE_KEY);
      if (raw) {
        this.matchCache = JSON.parse(raw);
      }
    } catch {
      this.matchCache = {};
    }
  }

  public saveCache(): void {
    try {
      localStorage.setItem(TmdbMatcher.MATCH_CACHE_KEY, JSON.stringify(this.matchCache));
    } catch {
      // Ignore if quota reached
    }
  }

  public clearCache(): void {
    this.matchCache = {};
    try {
      localStorage.removeItem(TmdbMatcher.MATCH_CACHE_KEY);
    } catch {
      // Ignore
    }
  }

  /**
   * Normalizes a title for robust comparison:
   * Strips diacritics/accents, lowercases, removes leading articles and special characters.
   */
  public static normalizeTitle(title: string): string {
    if (!title) return '';
    let norm = title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacritics
      .toLowerCase()
      .trim();

    // Strip common leading articles in English, French, Spanish, German
    norm = norm.replace(/^(the|a|an|le|la|les|el|los|las|das|der|die)\s+/i, '');

    // Replace all non-alphanumeric chars (including apostrophes/quotes) with spaces
    norm = norm.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    return norm;
  }

  /**
   * Scores a candidate against a source title and year (0 to 100).
   */
  public static scoreCandidate(
    sourceTitle: string,
    sourceYear: string | undefined,
    candidate: { title?: string; original_title?: string; release_date?: string; vote_count?: number },
  ): number {
    let score = 0;
    const candTitle = candidate.title || candidate.original_title || '';
    const normSource = TmdbMatcher.normalizeTitle(sourceTitle);
    const normCand = TmdbMatcher.normalizeTitle(candTitle);
    const normOrig = TmdbMatcher.normalizeTitle(candidate.original_title || '');

    // Exact title match (case insensitive)
    if (candTitle.toLowerCase() === sourceTitle.toLowerCase()) {
      score += 50;
    } else if (normSource === normCand || normSource === normOrig) {
      score += 42;
    } else if (normCand.includes(normSource) || normSource.includes(normCand)) {
      score += 30;
    } else {
      // Token overlap
      const srcTokens = new Set(normSource.split(' ').filter((t) => t.length > 1));
      const candTokens = new Set(normCand.split(' ').filter((t) => t.length > 1));
      let matches = 0;
      srcTokens.forEach((t) => {
        if (candTokens.has(t)) matches++;
      });
      const overlap = srcTokens.size > 0 ? (matches / srcTokens.size) * 25 : 0;
      score += Math.round(overlap);
    }

    // Year comparison
    const candYear = candidate.release_date ? candidate.release_date.substring(0, 4) : '';
    if (sourceYear && candYear) {
      const srcY = parseInt(sourceYear, 10);
      const candY = parseInt(candYear, 10);
      if (!isNaN(srcY) && !isNaN(candY)) {
        const diff = Math.abs(srcY - candY);
        if (diff === 0) {
          score += 35;
        } else if (diff === 1) {
          // 1 year difference (e.g. festival release vs theatrical)
          score += 25;
        } else if (diff === 2) {
          score += 10;
        } else {
          score -= Math.min(25, (diff - 2) * 5); // penalize big year discrepancies
        }
      }
    } else if (!sourceYear) {
      // If no year was provided, neutral score
      score += 15;
    }

    // Popularity / vote count bonus (helps tie-break iconic titles over obscure student films)
    if (candidate.vote_count && candidate.vote_count > 100) {
      score += Math.min(10, Math.round(Math.log10(candidate.vote_count) * 2.5));
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Matches a single film against TMDb with persistent caching and confidence classification.
   */
  public async match(sourceTitle: string, sourceYear?: string): Promise<MatchResult> {
    const cacheKey = `${sourceTitle.trim().toLowerCase()}|${(sourceYear || '').trim()}`;
    if (this.matchCache[cacheKey] !== undefined) {
      const cached = this.matchCache[cacheKey];
      if (cached) {
        return {
          sourceTitle,
          sourceYear,
          confidence: cached.score >= 90 ? 'confident' : 'ambiguous',
          matched: cached,
          candidates: [cached],
        };
      } else {
        return {
          sourceTitle,
          sourceYear,
          confidence: 'unmatched',
          matched: null,
          candidates: [],
        };
      }
    }

    // Fetch candidates from TMDb
    const candidates = await this.searchTmdb(sourceTitle, sourceYear);

    if (!candidates.length) {
      this.matchCache[cacheKey] = null;
      return {
        sourceTitle,
        sourceYear,
        confidence: 'unmatched',
        matched: null,
        candidates: [],
      };
    }

    // Score and sort candidates
    const scoredCandidates: TmdbMatchCandidate[] = candidates
      .map((c) => ({
        ...c,
        media_type: 'movie' as const,
        score: TmdbMatcher.scoreCandidate(sourceTitle, sourceYear, c),
      }))
      .sort((a, b) => b.score - a.score);

    const top = scoredCandidates[0];
    const second = scoredCandidates[1];

    let confidence: MatchConfidence = 'unmatched';

    if (top.score >= 90) {
      // If second candidate is within 5 points of top and both are > 80, it's ambiguous
      if (second && second.score >= 80 && top.score - second.score < 5) {
        confidence = 'ambiguous';
      } else {
        confidence = 'confident';
      }
    } else if (top.score >= 60) {
      confidence = 'ambiguous';
    } else {
      confidence = 'unmatched';
    }

    if (confidence === 'confident') {
      this.matchCache[cacheKey] = top;
    }

    return {
      sourceTitle,
      sourceYear,
      confidence,
      matched: confidence === 'confident' ? top : null,
      candidates: scoredCandidates.slice(0, 5),
    };
  }

  /**
   * Queries TMDb API with retry on 429 and year tolerance.
   */
  private async searchTmdb(title: string, year?: string): Promise<any[]> {
    const apiKey = this.tmdb.getApiKey();
    const cleanTitle = title.trim();
    const encoded = encodeURIComponent(cleanTitle);

    let url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encoded}&include_adult=false`;
    if (year) {
      url += `&year=${encodeURIComponent(year)}`;
    }

    try {
      let res = await this.fetchWithRetry(url);
      let results: any[] = res?.results || [];

      // If no results and year was provided, retry search without year constraint
      if (!results.length && year) {
        const fallbackUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encoded}&include_adult=false`;
        res = await this.fetchWithRetry(fallbackUrl);
        results = res?.results || [];
      }

      return results;
    } catch {
      return [];
    }
  }

  private async fetchWithRetry(url: string, retries = 3): Promise<any> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await firstValueFrom(this.http.get<any>(url));
      } catch (err: any) {
        if (err?.status === 429 && attempt < retries) {
          // Exponential backoff with jitter
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        if (attempt === retries) {
          throw err;
        }
      }
    }
  }
}
