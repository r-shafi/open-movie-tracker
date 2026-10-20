import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { AlertController, IonModal, ModalController, Platform } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ToastService } from 'src/app/services/toast.service';
import {
  UserDataService,
  UserList,
  WatchedEntry,
  WatchlistEntry,
} from 'src/app/services/user-data.service';

export interface LogSheetItem {
  id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
}

@Component({
  selector: 'app-log-sheet',
  templateUrl: './log-sheet.component.html',
  styleUrls: ['./log-sheet.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LogSheetComponent implements OnInit, OnDestroy {
  @Input() item!: LogSheetItem;

  private backButtonSub?: Subscription;

  existing: WatchedEntry | null = null;
  rating: number | null = null;
  liked = false;
  rewatch = false;
  review = '';
  tags: string[] = [];
  tagInput = '';
  watchedAt = new Date().toISOString();
  watchlistEnabled = false;
  lists: UserList[] = [];
  selectedListIds: string[] = [];
  tagsExpanded = false;
  tempWatchedAt = new Date().toISOString();

  @ViewChild('dateModal') dateModal!: IonModal;

  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private userData: UserDataService,
    private toast: ToastService,
    private platform: Platform,
  ) {}

  ngOnInit(): void {
    this.backButtonSub = this.platform.backButton.subscribeWithPriority(100, () => {
      this.cancel();
    });
    if (!this.item) {
      return;
    }
    this.existing = this.userData.getWatchedEntry(
      this.item.media_type,
      this.item.id,
    );
    this.watchlistEnabled = this.userData.isOnWatchlist(
      this.item.media_type,
      this.item.id,
    );
    this.lists = this.userData.getLists();
    this.selectedListIds = this.lists
      .filter((list) =>
        list.items.some(
          (entry) =>
            entry.id === this.item.id &&
            entry.media_type === this.item.media_type,
        ),
      )
      .map((list) => list.id);

    if (this.existing) {
      this.rating = this.existing.rating;
      this.liked = this.existing.liked;
      this.rewatch = this.existing.rewatch;
      this.review = this.existing.review || '';
      this.tags = [...(this.existing.tags || [])];
      if (this.tags.length) {
        this.tagsExpanded = true;
      }
      this.watchedAt = this.existing.watchedAt;
    }
  }

  get posterUrl(): string {
    return this.item?.poster_path
      ? `https://image.tmdb.org/t/p/w185${this.item.poster_path}`
      : 'assets/no-image.png';
  }

  get displayTitle(): string {
    return this.item?.title || 'Untitled';
  }

  get yearLabel(): string {
    const date = this.item?.release_date || this.item?.first_air_date || '';
    return date ? date.substring(0, 4) : '';
  }

  get selectedListLabel(): string {
    if (!this.selectedListIds.length) {
      return 'None';
    }
    const names = this.lists
      .filter((list) => this.selectedListIds.includes(list.id))
      .map((list) => list.name);
    return names.join(', ');
  }

  get selectedListCount(): number {
    return this.selectedListIds.length;
  }

  get reviewLength(): number {
    return (this.review || '').length;
  }

  get today(): string {
    return new Date().toISOString().split('T')[0];
  }

  get formattedWatchDate(): string {
    const dateStr = (this.watchedAt || '').split('T')[0];
    const parts = dateStr.split('-').map(Number);
    if (parts.length < 3 || !parts[0]) return 'Select date';
    const [year, month, day] = parts;
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  get saveLabel(): string {
    return this.existing ? 'Save Log' : 'Save Entry';
  }

  addTag(): void {
    const raw = this.tagInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length);
    raw.forEach((tag) => {
      if (!this.tags.includes(tag)) {
        this.tags.push(tag);
      }
    });
    this.tagInput = '';
  }

  removeTag(tag: string): void {
    this.tags = this.tags.filter((t) => t !== tag);
  }

  openDatePicker(): void {
    this.tempWatchedAt = this.watchedAt;
    this.dateModal.present();
  }

  onTempDateChange(value: string | string[] | null): void {
    if (value) {
      this.tempWatchedAt = Array.isArray(value) ? value[0] : value;
    }
  }

  confirmDate(): void {
    if (this.tempWatchedAt) {
      this.watchedAt = this.tempWatchedAt;
    }
  }

  async openListPicker(): Promise<void> {
    if (!this.lists.length) {
      this.toast.showToast('No lists yet. Create one in your profile.');
      return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Add to lists',
      inputs: this.lists.map((list) => ({
        type: 'checkbox',
        label: list.name,
        value: list.id,
        checked: this.selectedListIds.includes(list.id),
      })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Done',
          handler: (selected: string[]) => {
            this.selectedListIds = selected || [];
          },
        },
      ],
    });
    await alert.present();
  }

  async save(): Promise<void> {
    if (!this.item) {
      return;
    }

    const watchlistItem = this.buildWatchlistItem();

    this.userData.logEntry({
      id: this.item.id,
      media_type: this.item.media_type,
      title: this.item.title,
      poster_path: this.item.poster_path,
      watchedAt: this.watchedAt,
      rewatch: this.rewatch,
      rating: this.rating,
      review: this.review || '',
      tags: this.tags,
      liked: this.liked,
      release_date: this.item.release_date,
      first_air_date: this.item.first_air_date,
    });

    if (this.watchlistEnabled) {
      this.userData.addToWatchlist(watchlistItem);
    } else {
      this.userData.removeFromWatchlist(this.item.media_type, this.item.id);
    }

    // Keep user lists in sync with the picker state.
    this.lists.forEach((list) => {
      const isSelected = this.selectedListIds.includes(list.id);
      const exists = list.items.some(
        (entry) =>
          entry.id === this.item.id &&
          entry.media_type === this.item.media_type,
      );

      if (isSelected && !exists) {
        this.userData.addToList(list.id, watchlistItem);
      }

      if (!isSelected && exists) {
        this.userData.removeFromList(
          list.id,
          this.item.media_type,
          this.item.id,
        );
      }
    });

    await this.modalCtrl.dismiss();
    this.toast.showToast('Log saved.');
  }

  async removeLog(): Promise<void> {
    if (!this.existing) {
      return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Remove log?',
      message: 'This will remove the watched entry.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          role: 'destructive',
          handler: async () => {
            this.userData.removeWatched(this.item.media_type, this.item.id);
            await this.modalCtrl.dismiss();
            this.toast.showToast('Log removed.');
          },
        },
      ],
    });
    await alert.present();
  }

  ngOnDestroy(): void {
    this.backButtonSub?.unsubscribe();
  }

  cancel(): void {
    this.modalCtrl.dismiss();
  }

  private buildWatchlistItem(): Omit<WatchlistEntry, 'addedAt'> {
    return {
      id: this.item.id,
      media_type: this.item.media_type,
      title: this.item.title,
      poster_path: this.item.poster_path,
      release_date: this.item.release_date,
      first_air_date: this.item.first_air_date,
    };
  }
}
