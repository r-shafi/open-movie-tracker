import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

interface DayCell {
  date: string;
  count: number;
  level: number;
}

interface WeekColumn {
  weekIndex: number;
  days: DayCell[];
}

interface MonthHeader {
  label: string;
  colIndex: number;
}

@Component({
  selector: 'app-activity-calendar',
  templateUrl: './activity-calendar.component.html',
  styleUrls: ['./activity-calendar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ActivityCalendarComponent {
  @Input() activityHeatmap: DayCell[] = [];
  @Input() currentStreak = 0;
  @Input() longestStreak = 0;
  @Input() undatedCount = 0;

  private readonly monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  get weeks(): WeekColumn[] {
    const days = this.activityHeatmap || [];
    const result: WeekColumn[] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push({
        weekIndex: Math.floor(i / 7),
        days: days.slice(i, i + 7),
      });
    }
    return result;
  }

  get monthHeaders(): MonthHeader[] {
    const headers: MonthHeader[] = [];
    let lastMonth = -1;

    this.weeks.forEach((w, colIdx) => {
      if (w.days.length > 0) {
        const dateStr = w.days[0].date;
        const parts = dateStr.split('-');
        if (parts.length >= 2) {
          const m = parseInt(parts[1], 10) - 1;
          if (m !== lastMonth) {
            headers.push({
              label: this.monthNames[m],
              colIndex: colIdx,
            });
            lastMonth = m;
          }
        }
      }
    });

    return headers;
  }
}
