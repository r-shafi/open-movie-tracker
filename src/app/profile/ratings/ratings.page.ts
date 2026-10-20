import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CalendarDate } from 'src/app/services/calendar-date';
import {
  UserDataService,
  WatchedEntry,
} from 'src/app/services/user-data.service';

@Component({
  selector: 'app-ratings',
  templateUrl: './ratings.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RatingsPage {
  activeTab: 'all' | 'movie' | 'tv' = 'all';
  sortBy: 'highest' | 'lowest' | 'recent' = 'highest';

  constructor(private userData: UserDataService) {}

  get ratedEntries(): WatchedEntry[] {
    const all = Object.values(this.userData.getWatched()).filter(
      (entry) => entry.rating !== null,
    );
    const mediaFiltered =
      this.activeTab === 'all'
        ? all
        : all.filter((entry) => entry.media_type === this.activeTab);

    if (this.sortBy === 'highest') {
      return mediaFiltered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    if (this.sortBy === 'lowest') {
      return mediaFiltered.sort((a, b) => (a.rating || 0) - (b.rating || 0));
    }
    return mediaFiltered.sort((a, b) => {
      if (a.dateUnknown && !b.dateUnknown) return 1;
      if (!a.dateUnknown && b.dateUnknown) return -1;
      return CalendarDate.compare(b.watchedAt, a.watchedAt);
    });
  }

  detailLink(entry: WatchedEntry): any[] {
    return entry.media_type === 'tv' ? ['/tv', entry.id] : ['/movie', entry.id];
  }

  poster(entry: WatchedEntry): string {
    return entry.poster_path
      ? `https://image.tmdb.org/t/p/w342${entry.poster_path}`
      : 'assets/no-image.png';
  }
}
