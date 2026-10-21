import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { formatRating } from '../../services/analytics-format';

interface HistogramRow {
  label: string;
  ratingValue: number;
  count: number;
  heightPercent: number;
  isPeak: boolean;
}

@Component({
  selector: 'app-ratings-histogram',
  templateUrl: './ratings-histogram.component.html',
  styleUrls: ['./ratings-histogram.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RatingsHistogramComponent {
  @Input() ratingsDistribution: Record<string, number> = {};
  @Input() averageRating: number | null = null;
  @Input() totalRated = 0;
  @Input() selectedYear?: string | number;

  get computedTotalRated(): number {
    if (this.totalRated > 0) return this.totalRated;
    return Object.values(this.ratingsDistribution || {}).reduce((a, b) => a + b, 0);
  }

  get formattedAverage(): string {
    return this.averageRating !== null ? formatRating(this.averageRating, 2) : '—';
  }

  get compactAverage(): string {
    return this.averageRating !== null ? formatRating(this.averageRating, 1) : '—';
  }

  get rows(): HistogramRow[] {
    const keys = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
    const rawRows = keys.map((ratingValue) => {
      const label = ratingValue.toFixed(1);
      const count = this.ratingsDistribution[label] || 0;
      return { label, ratingValue, count };
    });

    const maxCount = Math.max(...rawRows.map((r) => r.count), 0);

    return rawRows.map((r) => ({
      ...r,
      heightPercent: maxCount > 0 && r.count > 0 ? Math.max(5, (r.count / maxCount) * 100) : 0,
      isPeak: maxCount > 0 && r.count === maxCount,
    }));
  }

  get peakRatingLabel(): string | null {
    const peak = this.rows.find((r) => r.isPeak);
    return peak && peak.count > 0 ? `${peak.label}★ (${peak.count})` : null;
  }
}
