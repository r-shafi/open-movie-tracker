import { WatchedEntry, WatchlistEntry } from './user-data.service';

export interface BayesianAffinityItem {
  id?: number | string;
  name: string;
  count: number;
  observedAverage: number;
  shrunkScore: number;
  deltaFromGlobal: number; // positive = affinity, negative = aversion
}

export interface HipsterTierBreakdown {
  obscureCount: number; // < 1,000 TMDb votes
  modestCount: number;  // 1,000 - 5,000 votes
  mainstreamCount: number; // 5,000 - 20,000 votes
  blockbusterCount: number; // > 20,000 votes
  obscurePercent: number;
}

export interface ObscurityInsight {
  hipsterScore: number; // 0 to 100 scale (higher = more obscure)
  label: string; // e.g., 'Mainstream Curator', 'Indie Explorer', 'Deep Diver'
  medianTmdbVotes: number;
  ratedCoverageCount: number;
  tiers: HipsterTierBreakdown;
  hiddenGems: Array<{
    id: number;
    title: string;
    tmdbVoteCount: number;
    userRating: number;
  }>;
}

export interface FilmAgeCategory {
  label: string; // 'Premiere (0y)', 'Modern (1-5y)', 'Recent (6-15y)', 'Classic (16-30y)', 'Vintage (31y+)'
  count: number;
  percent: number;
}

export interface FilmAgeInsight {
  averageAgeYears: number;
  medianAgeYears: number;
  datedCount: number;
  undatedCount: number;
  categories: FilmAgeCategory[];
  oldestWatched?: {
    id: number;
    title: string;
    releaseYear: number;
    ageAtViewing: number;
  };
}

export interface RewatchDynamicsInsight {
  totalRewatches: number;
  uniqueRewatchedTitles: number;
  averageRatingShift: number | null; // e.g. +0.25 stars on second viewing
  ratingShiftCount: number;
  mostRewatched: Array<{
    id: number;
    title: string;
    watchCount: number;
    firstWatchedAt?: string;
    latestWatchedAt?: string;
  }>;
}

export interface WatchlistPredictionItem {
  id: number;
  media_type: 'movie' | 'tv';
  title: string;
  predictedRating: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}

/**
 * Pure analytics calculations for advanced taste metrics, obscurity, film age,
 * rewatch dynamics, and watchlist prediction.
 */
export class AnalyticsTasteEngine {
  /**
   * Calculates Bayesian smoothed affinity scores for genres or people.
   * Prior weight m=3 pulls low-sample outliers toward the user's global mean.
   */
  public static calculateAffinity(
    items: Array<{ id?: number | string; name: string; count: number; ratings: number[] }>,
    globalAverageRating: number,
    priorWeight = 3,
    minCount = 2,
  ): BayesianAffinityItem[] {
    if (!items.length || globalAverageRating <= 0) {
      return [];
    }

    return items
      .filter((item) => item.ratings.length >= minCount)
      .map((item) => {
        const observedSum = item.ratings.reduce((a, b) => a + b, 0);
        const v = item.ratings.length;
        const observedAverage = Number((observedSum / v).toFixed(2));
        // Bayesian Shrinkage: (v * R + m * C) / (v + m)
        const shrunkScore = Number(((v * observedAverage + priorWeight * globalAverageRating) / (v + priorWeight)).toFixed(2));
        const deltaFromGlobal = Number((shrunkScore - globalAverageRating).toFixed(2));

        return {
          id: item.id,
          name: item.name,
          count: v,
          observedAverage,
          shrunkScore,
          deltaFromGlobal,
        };
      })
      .sort((a, b) => b.shrunkScore - a.shrunkScore);
  }

  /**
   * Calculates obscurity and hipster index from TMDb vote counts.
   * Obscurity score: 100 is rarest / deep underground, 0 is most ubiquitous blockbusters.
   */
  public static calculateObscurity(watched: WatchedEntry[]): ObscurityInsight {
    const scored: Array<{
      id: number;
      title: string;
      tmdbVoteCount: number;
      userRating: number;
      obscurityRank: number;
    }> = [];

    let obscureCount = 0;
    let modestCount = 0;
    let mainstreamCount = 0;
    let blockbusterCount = 0;

    const voteCounts: number[] = [];

    watched.forEach((entry) => {
      const votes = entry.snapshot?.tmdbVoteCount;
      if (typeof votes === 'number' && votes > 0) {
        voteCounts.push(votes);
        if (votes < 1000) obscureCount++;
        else if (votes < 5000) modestCount++;
        else if (votes < 20000) mainstreamCount++;
        else blockbusterCount++;

        // Obscurity formula: 100 - min(100, log10(max(10, votes)) * 20)
        // votes = 100 -> log10=2 -> 100 - 40 = 60
        // votes = 1,000 -> log10=3 -> 100 - 60 = 40
        // votes = 10,000 -> log10=4 -> 100 - 80 = 20
        // votes >= 100,000 -> 0
        const logVal = Math.log10(Math.max(10, votes));
        const obscurityRank = Math.max(0, Math.min(100, Math.round(100 - logVal * 20)));

        if (typeof entry.rating === 'number' && entry.rating >= 4.0 && votes < 2000) {
          scored.push({
            id: entry.id,
            title: entry.title,
            tmdbVoteCount: votes,
            userRating: entry.rating,
            obscurityRank,
          });
        }
      }
    });

    const totalWithVotes = voteCounts.length;
    voteCounts.sort((a, b) => a - b);
    const medianTmdbVotes = totalWithVotes > 0 ? voteCounts[Math.floor(totalWithVotes / 2)] : 0;

    let hipsterScore = 50;
    if (totalWithVotes > 0) {
      const obscureWeight = (obscureCount * 100 + modestCount * 65 + mainstreamCount * 30 + blockbusterCount * 5) / totalWithVotes;
      hipsterScore = Math.round(obscureWeight);
    }

    let label = 'Balanced Cinema Explorer';
    if (hipsterScore >= 70) label = 'Deep Diver & Underground Cinephile';
    else if (hipsterScore >= 55) label = 'Indie & Festival Enthusiast';
    else if (hipsterScore <= 30) label = 'Mainstream & Blockbuster Specialist';

    // Top hidden gems (highest user rated with lowest TMDb votes)
    scored.sort((a, b) => {
      if (b.userRating !== a.userRating) return b.userRating - a.userRating;
      return a.tmdbVoteCount - b.tmdbVoteCount;
    });

    return {
      hipsterScore,
      label,
      medianTmdbVotes,
      ratedCoverageCount: totalWithVotes,
      tiers: {
        obscureCount,
        modestCount,
        mainstreamCount,
        blockbusterCount,
        obscurePercent: totalWithVotes > 0 ? Math.round((obscureCount / totalWithVotes) * 100) : 0,
      },
      hiddenGems: scored.slice(0, 5),
    };
  }

  /**
   * Calculates viewing age: difference between movie release year and date watched.
   */
  public static calculateFilmAgeAtViewing(watched: WatchedEntry[]): FilmAgeInsight {
    const ages: number[] = [];
    let undatedCount = 0;
    let oldest: { id: number; title: string; releaseYear: number; ageAtViewing: number } | undefined;

    let premiereCount = 0;   // 0y
    let modernCount = 0;     // 1-5y
    let recentCount = 0;     // 6-15y
    let classicCount = 0;    // 16-30y
    let vintageCount = 0;    // 31y+

    watched.forEach((entry) => {
      const releaseYear = entry.snapshot?.releaseYear || (entry.release_date ? parseInt(entry.release_date.slice(0, 4), 10) : undefined);
      if (!entry.watchedAt || entry.dateUnknown || !releaseYear || releaseYear < 1888) {
        undatedCount++;
        return;
      }

      const watchYear = parseInt(entry.watchedAt.slice(0, 4), 10);
      if (isNaN(watchYear) || watchYear < 1900) {
        undatedCount++;
        return;
      }

      const ageYears = Math.max(0, watchYear - releaseYear);
      ages.push(ageYears);

      if (!oldest || ageYears > oldest.ageAtViewing) {
        oldest = {
          id: entry.id,
          title: entry.title,
          releaseYear,
          ageAtViewing: ageYears,
        };
      }

      if (ageYears === 0) premiereCount++;
      else if (ageYears <= 5) modernCount++;
      else if (ageYears <= 15) recentCount++;
      else if (ageYears <= 30) classicCount++;
      else vintageCount++;
    });

    const datedCount = ages.length;
    ages.sort((a, b) => a - b);
    const medianAgeYears = datedCount > 0 ? ages[Math.floor(datedCount / 2)] : 0;
    const sumAge = ages.reduce((a, b) => a + b, 0);
    const averageAgeYears = datedCount > 0 ? Number((sumAge / datedCount).toFixed(1)) : 0;

    const makeCat = (label: string, count: number): FilmAgeCategory => ({
      label,
      count,
      percent: datedCount > 0 ? Math.round((count / datedCount) * 100) : 0,
    });

    return {
      averageAgeYears,
      medianAgeYears,
      datedCount,
      undatedCount,
      categories: [
        makeCat('Premiere (0y)', premiereCount),
        makeCat('Modern (1–5y)', modernCount),
        makeCat('Recent (6–15y)', recentCount),
        makeCat('Classic (16–30y)', classicCount),
        makeCat('Vintage (31y+)', vintageCount),
      ],
      oldestWatched: oldest,
    };
  }

  /**
   * Evaluates repeat viewing patterns: count, rating trajectory across viewings.
   */
  public static calculateRewatchDynamics(watched: WatchedEntry[]): RewatchDynamicsInsight {
    const grouped = new Map<string, WatchedEntry[]>();

    watched.forEach((entry) => {
      const key = `${entry.media_type}:${entry.id}`;
      const list = grouped.get(key) || [];
      list.push(entry);
      grouped.set(key, list);
    });

    let totalRewatches = 0;
    let uniqueRewatchedTitles = 0;
    const ratingDeltas: number[] = [];

    const repeatedList: Array<{
      id: number;
      title: string;
      watchCount: number;
      firstWatchedAt?: string;
      latestWatchedAt?: string;
    }> = [];

    grouped.forEach((entries) => {
      if (entries.length > 1) {
        uniqueRewatchedTitles++;
        totalRewatches += entries.length - 1;

        // Sort chronologically if watched dates exist
        const dated = [...entries].sort((a, b) => (a.watchedAt || '').localeCompare(b.watchedAt || ''));
        const first = dated[0];
        const last = dated[dated.length - 1];

        repeatedList.push({
          id: first.id,
          title: first.title,
          watchCount: entries.length,
          firstWatchedAt: first.watchedAt || undefined,
          latestWatchedAt: last.watchedAt || undefined,
        });

        // Check rating evolution between first watch and latest rewatch
        if (typeof first.rating === 'number' && typeof last.rating === 'number' && first !== last) {
          ratingDeltas.push(Number((last.rating - first.rating).toFixed(1)));
        }
      }
    });

    repeatedList.sort((a, b) => b.watchCount - a.watchCount);

    const averageRatingShift = ratingDeltas.length > 0
      ? Number((ratingDeltas.reduce((a, b) => a + b, 0) / ratingDeltas.length).toFixed(2))
      : null;

    return {
      totalRewatches,
      uniqueRewatchedTitles,
      averageRatingShift,
      ratingShiftCount: ratingDeltas.length,
      mostRewatched: repeatedList.slice(0, 5),
    };
  }

  /**
   * Predicts rating for watchlist items using user's Bayesian affinities.
   */
  public static predictWatchlistRatings(
    watchlist: WatchlistEntry[],
    globalAverageRating: number,
    genreAffinity: Map<string, number>,
    directorAffinity: Map<number, number>,
    castAffinity: Map<number, number>,
  ): WatchlistPredictionItem[] {
    if (!watchlist.length || globalAverageRating <= 0) {
      return [];
    }

    return watchlist.map((item) => {
      let weightedSum = 0;
      let totalWeight = 0;
      const reasons: string[] = [];

      // Check director affinity (weight 0.40)
      if (item.snapshot?.directors?.length) {
        for (const dir of item.snapshot.directors) {
          if (dir.id && directorAffinity.has(dir.id)) {
            const aff = directorAffinity.get(dir.id)!;
            weightedSum += aff * 0.4;
            totalWeight += 0.4;
            const diff = aff - globalAverageRating;
            if (Math.abs(diff) >= 0.2) {
              reasons.push(`${dir.name} (${aff > globalAverageRating ? '+' : ''}${diff.toFixed(1)}★)`);
            }
            break;
          }
        }
      }

      // Check cast affinity (weight 0.25)
      if (item.snapshot?.topCast?.length) {
        for (const cast of item.snapshot.topCast) {
          if (cast.id && castAffinity.has(cast.id)) {
            const aff = castAffinity.get(cast.id)!;
            weightedSum += aff * 0.25;
            totalWeight += 0.25;
            const diff = aff - globalAverageRating;
            if (Math.abs(diff) >= 0.2) {
              reasons.push(`${cast.name} (${aff > globalAverageRating ? '+' : ''}${diff.toFixed(1)}★)`);
            }
            break;
          }
        }
      }

      // Check genre affinity (weight 0.35)
      if (item.snapshot?.genres?.length) {
        let genreSum = 0;
        let genreMatches = 0;
        for (const g of item.snapshot.genres) {
          if (genreAffinity.has(g.name)) {
            genreSum += genreAffinity.get(g.name)!;
            genreMatches++;
          }
        }
        if (genreMatches > 0) {
          const avgGenreAff = genreSum / genreMatches;
          weightedSum += avgGenreAff * 0.35;
          totalWeight += 0.35;
          const diff = avgGenreAff - globalAverageRating;
          if (Math.abs(diff) >= 0.2) {
            reasons.push(`Preferred genres (${diff > 0 ? '+' : ''}${diff.toFixed(1)}★)`);
          }
        }
      }

      // Blend remaining weight with global baseline average
      const remainingWeight = Math.max(0, 1.0 - totalWeight);
      const predictedRaw = totalWeight > 0
        ? (weightedSum + remainingWeight * globalAverageRating)
        : globalAverageRating;

      // Bound to [0.5, 5.0] and round to nearest 0.1
      const predictedRating = Number((Math.min(5.0, Math.max(0.5, predictedRaw))).toFixed(1));

      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (totalWeight >= 0.65) confidence = 'high';
      else if (totalWeight >= 0.35) confidence = 'medium';

      return {
        id: item.id,
        media_type: item.media_type,
        title: item.title,
        predictedRating,
        confidence,
        reasons: reasons.slice(0, 3),
      };
    }).sort((a, b) => b.predictedRating - a.predictedRating);
  }
}
