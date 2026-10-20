import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  UserDataService,
  WatchedEntry,
} from 'src/app/services/user-data.service';

@Component({
  selector: 'app-user-reviews',
  templateUrl: './user-reviews.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class UserReviewsPage {
  searchTerm = '';

  constructor(private userData: UserDataService) {}

  get reviewEntries(): WatchedEntry[] {
    const base = Object.values(this.userData.getWatched())
      .filter((entry) => !!entry.review.trim())
      .sort((a, b) => (b.watchedAt || '').localeCompare(a.watchedAt || ''));

    const q = this.searchTerm.trim().toLowerCase();
    if (!q) {
      return base;
    }
    return base.filter(
      (entry) =>
        entry.title.toLowerCase().includes(q) ||
        entry.review.toLowerCase().includes(q),
    );
  }

  detailLink(entry: WatchedEntry): any[] {
    return entry.media_type === 'tv' ? ['/tv', entry.id] : ['/movie', entry.id];
  }

  poster(entry: WatchedEntry): string {
    return entry.poster_path
      ? `https://image.tmdb.org/t/p/w185${entry.poster_path}`
      : 'assets/no-image.png';
  }

  watchDate(entry: WatchedEntry): string {
    if (!entry.watchedAt) return 'Unknown date';
    return new Date(entry.watchedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
