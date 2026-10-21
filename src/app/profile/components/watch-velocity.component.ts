import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

interface MonthBar {
  month: string;
  label: string;
  count: number;
  heightPercent: number;
  isPeak: boolean;
}

@Component({
  selector: 'app-watch-velocity',
  templateUrl: './watch-velocity.component.html',
  styleUrls: ['./watch-velocity.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class WatchVelocityComponent {
  @Input() watchedByMonth: { month: string; count: number }[] = [];
  @Input() undatedCount = 0;
  @Input() totalWatched = 0;
  @Input() selectedYear?: string | number;

  private readonly monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  get bars(): MonthBar[] {
    const list = this.watchedByMonth || [];
    const maxCount = Math.max(...list.map((m) => m.count), 0);

    return list.map((m) => {
      const parts = m.month.split('-');
      const monthIdx = parts.length > 1 ? parseInt(parts[1], 10) - 1 : -1;
      const label = monthIdx >= 0 && monthIdx < 12 ? this.monthNames[monthIdx] : m.month;

      return {
        month: m.month,
        label,
        count: m.count,
        heightPercent: maxCount > 0 && m.count > 0 ? Math.max(6, (m.count / maxCount) * 100) : 0,
        isPeak: maxCount > 0 && m.count === maxCount,
      };
    });
  }

  get total12MonthWatched(): number {
    return this.watchedByMonth.reduce((sum, m) => sum + m.count, 0);
  }

  get averagePerMonth(): number {
    const months = this.watchedByMonth.length;
    return months > 0 ? Number((this.total12MonthWatched / months).toFixed(1)) : 0;
  }
}
