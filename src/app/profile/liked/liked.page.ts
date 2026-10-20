import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CalendarDate } from 'src/app/services/calendar-date';
import {
  UserDataService,
  WatchedEntry,
} from 'src/app/services/user-data.service';

@Component({
  selector: 'app-liked',
  templateUrl: './liked.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LikedPage {
  activeTab: 'all' | 'movie' | 'tv' = 'all';
  searchTerm = '';

  constructor(public userData: UserDataService) {}

  get likedEntries(): WatchedEntry[] {
    const all = Object.values(this.userData.getWatched())
      .filter((entry) => entry.liked)
      .sort((a, b) => {
        if (a.dateUnknown && !b.dateUnknown) return 1;
        if (!a.dateUnknown && b.dateUnknown) return -1;
        return CalendarDate.compare(b.watchedAt, a.watchedAt);
      });

    if (this.activeTab === 'all') {
      return this.filterSearch(all);
    }
    return this.filterSearch(
      all.filter((entry) => entry.media_type === this.activeTab),
    );
  }

  poster(entry: WatchedEntry): string {
    return entry.poster_path
      ? `https://image.tmdb.org/t/p/w342${entry.poster_path}`
      : 'assets/no-image.png';
  }

  watchedDate(entry: WatchedEntry): string {
    return CalendarDate.formatDisplay(entry.watchedAt, 'Date unknown');
  }

  private filterSearch(entries: WatchedEntry[]): WatchedEntry[] {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) {
      return entries;
    }
    return entries.filter((entry) => entry.title.toLowerCase().includes(q));
  }
}
