import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController } from '@ionic/angular';
import { CalendarDate } from 'src/app/services/calendar-date';
import {
  UserDataService,
  WatchedEntry,
} from 'src/app/services/user-data.service';

@Component({
  selector: 'app-watched',
  templateUrl: './watched.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class WatchedPage {
  activeTab: 'all' | 'movies' | 'tv' = 'all';
  searchTerm = '';
  sortBy: 'newest' | 'oldest' | 'rating' | 'title' = 'newest';

  constructor(
    public userData: UserDataService,
    private actionSheetCtrl: ActionSheetController,
    private router: Router,
  ) {}

  get watched(): WatchedEntry[] {
    const all = Object.values(this.userData.getWatched());
    return this.sortEntries(all);
  }

  get movieWatched(): WatchedEntry[] {
    return this.watched.filter((e) => e.media_type === 'movie');
  }

  get tvWatched(): WatchedEntry[] {
    return this.watched.filter((e) => e.media_type === 'tv');
  }

  get filteredEntries(): WatchedEntry[] {
    const base =
      this.activeTab === 'movies'
        ? this.movieWatched
        : this.activeTab === 'tv'
          ? this.tvWatched
          : this.watched;

    const q = this.searchTerm.trim().toLowerCase();
    if (!q) {
      return base;
    }
    return base.filter((entry) => entry.title.toLowerCase().includes(q));
  }

  watchedYear(entry: WatchedEntry): string {
    return (entry.release_date || entry.first_air_date || '').slice(0, 4);
  }

  watchedDate(entry: WatchedEntry): string {
    return CalendarDate.formatDisplay(entry.watchedAt, 'Date unknown');
  }

  poster(entry: WatchedEntry): string {
    return entry.poster_path
      ? `https://image.tmdb.org/t/p/w342${entry.poster_path}`
      : 'assets/no-image.png';
  }

  remove(item: WatchedEntry) {
    this.userData.removeWatched(item.media_type, item.id);
  }

  async openEntryActions(event: Event, item: WatchedEntry) {
    event.preventDefault();
    event.stopPropagation();

    const actionSheet = await this.actionSheetCtrl.create({
      header: item.title,
      buttons: [
        {
          text: 'Open details',
          icon: 'open-outline',
          handler: () => {
            this.router.navigate(
              item.media_type === 'tv' ? ['/tv', item.id] : ['/movie', item.id],
            );
          },
        },
        {
          text: item.liked ? 'Remove like' : 'Mark as liked',
          icon: item.liked ? 'heart-dislike-outline' : 'heart-outline',
          handler: () => {
            this.userData.logEntry({ ...item, liked: !item.liked });
          },
        },
        {
          text: 'Remove log',
          role: 'destructive',
          icon: 'trash-outline',
          handler: () => this.remove(item),
        },
        {
          text: 'Cancel',
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

  private sortEntries(entries: WatchedEntry[]): WatchedEntry[] {
    const sorted = [...entries];
    if (this.sortBy === 'newest') {
      return sorted.sort((a, b) => {
        if (a.dateUnknown && !b.dateUnknown) return 1;
        if (!a.dateUnknown && b.dateUnknown) return -1;
        return CalendarDate.compare(b.watchedAt, a.watchedAt);
      });
    }
    if (this.sortBy === 'oldest') {
      return sorted.sort((a, b) => {
        if (a.dateUnknown && !b.dateUnknown) return 1;
        if (!a.dateUnknown && b.dateUnknown) return -1;
        return CalendarDate.compare(a.watchedAt, b.watchedAt);
      });
    }
    if (this.sortBy === 'rating') {
      return sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    }
    return sorted.sort((a, b) => a.title.localeCompare(b.title));
  }
}
