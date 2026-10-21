import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { WatchedEntry, WatchlistEntry } from '../../services/user-data.service';
import {
  AnalyticsTasteEngine,
  BayesianAffinityItem,
  FilmAgeInsight,
  ObscurityInsight,
  RewatchDynamicsInsight,
  WatchlistPredictionItem,
} from '../../services/analytics-taste';

@Component({
  selector: 'app-taste-insights',
  templateUrl: './taste-insights.component.html',
  styleUrls: ['./taste-insights.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TasteInsightsComponent implements OnChanges {
  @Input() watched: WatchedEntry[] = [];
  @Input() watchlist: WatchlistEntry[] = [];
  @Input() globalAverageRating = 3.0;

  genreAffinity: BayesianAffinityItem[] = [];
  directorAffinity: BayesianAffinityItem[] = [];
  obscurity: ObscurityInsight | null = null;
  filmAge: FilmAgeInsight | null = null;
  rewatchDynamics: RewatchDynamicsInsight | null = null;
  watchlistPredictions: WatchlistPredictionItem[] = [];

  ngOnChanges(): void {
    this.computeAll();
  }

  private computeAll(): void {
    if (!this.watched || !this.watched.length) {
      this.genreAffinity = [];
      this.directorAffinity = [];
      this.obscurity = null;
      this.filmAge = null;
      this.rewatchDynamics = null;
      this.watchlistPredictions = [];
      return;
    }

    const avg = this.globalAverageRating > 0 ? this.globalAverageRating : 3.0;

    // 1. Genre affinity map
    const genreMap = new Map<string, { name: string; count: number; ratings: number[] }>();
    this.watched.forEach((entry) => {
      const genres = entry.snapshot?.genres?.map((g) => g.name).filter(Boolean) || entry.tags || [];
      genres.forEach((name) => {
        const cur = genreMap.get(name) || { name, count: 0, ratings: [] };
        cur.count++;
        if (typeof entry.rating === 'number') cur.ratings.push(entry.rating);
        genreMap.set(name, cur);
      });
    });

    this.genreAffinity = AnalyticsTasteEngine.calculateAffinity(
      Array.from(genreMap.values()),
      avg,
      3,
      2
    );

    // 2. Director affinity map
    const directorMap = new Map<number, { id: number; name: string; count: number; ratings: number[] }>();
    this.watched.forEach((entry) => {
      entry.snapshot?.directors?.forEach((d) => {
        if (!d.id) return;
        const cur = directorMap.get(d.id) || { id: d.id, name: d.name, count: 0, ratings: [] };
        cur.count++;
        if (typeof entry.rating === 'number') cur.ratings.push(entry.rating);
        directorMap.set(d.id, cur);
      });
    });

    this.directorAffinity = AnalyticsTasteEngine.calculateAffinity(
      Array.from(directorMap.values()),
      avg,
      3,
      2
    );

    // 3. Obscurity / Hipster index
    this.obscurity = AnalyticsTasteEngine.calculateObscurity(this.watched);

    // 4. Film age at viewing
    this.filmAge = AnalyticsTasteEngine.calculateFilmAgeAtViewing(this.watched);

    // 5. Rewatch dynamics
    this.rewatchDynamics = AnalyticsTasteEngine.calculateRewatchDynamics(this.watched);

    // 6. Watchlist predictions
    const genreScoreMap = new Map<string, number>();
    this.genreAffinity.forEach((g) => genreScoreMap.set(g.name, g.shrunkScore));

    const directorScoreMap = new Map<number, number>();
    this.directorAffinity.forEach((d) => {
      if (typeof d.id === 'number') directorScoreMap.set(d.id, d.shrunkScore);
    });

    const castScoreMap = new Map<number, number>();

    this.watchlistPredictions = AnalyticsTasteEngine.predictWatchlistRatings(
      this.watchlist || [],
      avg,
      genreScoreMap,
      directorScoreMap,
      castScoreMap
    ).slice(0, 5);
  }
}
