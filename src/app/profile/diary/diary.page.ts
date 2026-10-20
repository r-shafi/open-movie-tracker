import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController } from '@ionic/angular';
import {
  UserDataService,
  WatchedEntry,
} from 'src/app/services/user-data.service';

@Component({
  selector: 'app-diary',
  templateUrl: './diary.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class DiaryPage {
  constructor(
    private userData: UserDataService,
    private actionSheetCtrl: ActionSheetController,
    private router: Router,
  ) {}

  get groupedEntries(): Array<{ month: string; entries: WatchedEntry[] }> {
    const entries = this.userData
      .getWatchedList()
      .filter((e) => !e.dateUnknown && e.watchedAt);

    const groups = new Map<string, WatchedEntry[]>();
    entries.forEach((entry) => {
      const d = new Date(entry.watchedAt!);
      const month = d.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
      const prev = groups.get(month) || [];
      prev.push(entry);
      groups.set(month, prev);
    });

    return Array.from(groups.entries()).map(([month, monthEntries]) => ({
      month,
      entries: monthEntries,
    }));
  }

  detailLink(entry: WatchedEntry): any[] {
    return entry.media_type === 'tv' ? ['/tv', entry.id] : ['/movie', entry.id];
  }

  poster(entry: WatchedEntry): string {
    return entry.poster_path
      ? `https://image.tmdb.org/t/p/w92${entry.poster_path}`
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

  watchDay(entry: WatchedEntry): string {
    if (!entry.watchedAt) return '--';
    const day = new Date(entry.watchedAt).getDate();
    return String(day).padStart(2, '0');
  }

  watchMonth(entry: WatchedEntry): string {
    if (!entry.watchedAt) return '---';
    return new Date(entry.watchedAt)
      .toLocaleDateString(undefined, { month: 'short' })
      .toUpperCase();
  }

  goToDetail(entry: WatchedEntry) {
    this.router.navigate(this.detailLink(entry));
  }

  async openEntryActions(event: Event, entry: WatchedEntry) {
    event.preventDefault();
    event.stopPropagation();

    const actionSheet = await this.actionSheetCtrl.create({
      header: entry.title,
      buttons: [
        {
          text: 'Open details',
          icon: 'open-outline',
          handler: () => this.goToDetail(entry),
        },
        {
          text: entry.liked ? 'Remove like' : 'Mark as liked',
          icon: entry.liked ? 'heart-dislike-outline' : 'heart-outline',
          handler: () => {
            this.userData.logEntry({ ...entry, liked: !entry.liked });
          },
        },
        {
          text: 'Remove log',
          role: 'destructive',
          icon: 'trash-outline',
          handler: () => {
            this.userData.removeWatched(entry.media_type, entry.id);
          },
        },
        {
          text: 'Cancel',
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }
}
