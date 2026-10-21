import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { IonSearchbar, ModalController } from '@ionic/angular';
import { Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { CalendarDate } from 'src/app/services/calendar-date';
import { MetadataBackfillService } from 'src/app/services/metadata-backfill.service';
import { TmdbService } from 'src/app/services/tmdb.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserDataService, WatchedEntry } from 'src/app/services/user-data.service';

export interface QuickLogMediaItem {
  id: number;
  media_type: 'movie' | 'tv';
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
}

export async function triggerLightHaptic(): Promise<void> {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12);
      } catch {
        // Ignore fallback errors
      }
    }
  }
}

@Component({
  selector: 'app-quick-log-modal',
  templateUrl: './quick-log-modal.component.html',
  styleUrls: ['./quick-log-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class QuickLogModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('searchBar') searchBar?: IonSearchbar;

  searchQuery = '';
  searchResults: QuickLogMediaItem[] = [];
  isLoading = false;
  recentSearches: string[] = [];
  trendingItems: QuickLogMediaItem[] = [];

  // Compact Log Step state
  selectedItem: QuickLogMediaItem | null = null;
  existingEntry: WatchedEntry | null = null;
  rating: number | null = null;
  watchedDate: string = CalendarDate.today();
  maxDate: string = CalendarDate.today();
  dateUnknown = false;
  rewatch = false;
  liked = false;
  review = '';
  tags: string[] = [];
  tagInput = '';
  showReviewAndTags = false;

  private readonly RECENT_SEARCHES_KEY = 'recentSearches';
  private searchSubject = new Subject<string>();
  private searchSub = Subscription.EMPTY;

  constructor(
    private modalCtrl: ModalController,
    private tmdb: TmdbService,
    private userData: UserDataService,
    private backfill: MetadataBackfillService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadRecentSearches();
    this.loadTrendingItems();

    this.searchSub = this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((rawQuery) => {
          const query = rawQuery.trim();
          if (query.length < 2) {
            this.searchResults = [];
            this.isLoading = false;
            this.cdr.markForCheck();
            return of({ results: [] });
          }
          this.isLoading = true;
          this.cdr.markForCheck();
          return this.tmdb.searchMulti(query).pipe(
            catchError(() => of({ results: [] })),
          );
        }),
      )
      .subscribe({
        next: (res: any) => {
          const all = res?.results || [];
          this.searchResults = all.filter(
            (r: any) => r.media_type === 'movie' || r.media_type === 'tv',
          );
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.searchBar?.setFocus();
    }, 150);
  }

  ngOnDestroy(): void {
    this.searchSub.unsubscribe();
  }

  onSearchInput(event: any): void {
    const val = event?.target?.value || '';
    this.searchQuery = val;
    this.searchSubject.next(val);
  }

  selectRecentSearch(q: string): void {
    this.searchQuery = q;
    if (this.searchBar) {
      this.searchBar.value = q;
    }
    this.searchSubject.next(q);
  }

  clearRecentSearches(): void {
    this.recentSearches = [];
    localStorage.removeItem(this.RECENT_SEARCHES_KEY);
    this.cdr.markForCheck();
  }

  private saveSearchTerm(term: string): void {
    const trimmed = term.trim();
    if (!trimmed) return;
    const filtered = this.recentSearches.filter(
      (s) => s.toLowerCase() !== trimmed.toLowerCase(),
    );
    this.recentSearches = [trimmed, ...filtered].slice(0, 10);
    localStorage.setItem(
      this.RECENT_SEARCHES_KEY,
      JSON.stringify(this.recentSearches),
    );
  }

  private loadRecentSearches(): void {
    try {
      const stored = localStorage.getItem(this.RECENT_SEARCHES_KEY);
      this.recentSearches = stored ? JSON.parse(stored) : [];
    } catch {
      this.recentSearches = [];
    }
  }

  private loadTrendingItems(): void {
    this.tmdb.getTrendingAll('day').subscribe({
      next: (res: any) => {
        const list = res?.results || [];
        this.trendingItems = list
          .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
          .slice(0, 8);
        this.cdr.markForCheck();
      },
      error: () => {
        this.trendingItems = [];
      },
    });
  }

  // ── Quick Actions ──────────────────────────────────────────────────────────

  isWatchlisted(item: QuickLogMediaItem): boolean {
    return this.userData.isOnWatchlist(item.media_type, item.id);
  }

  isWatched(item: QuickLogMediaItem): boolean {
    return !!this.userData.getWatchedEntry(item.media_type, item.id);
  }

  async quickWatchlist(item: QuickLogMediaItem, event: Event): Promise<void> {
    event.stopPropagation();
    event.preventDefault();

    const title = item.title || item.name || 'Title';
    if (this.isWatchlisted(item)) {
      this.userData.removeFromWatchlist(item.media_type, item.id);
      this.toast.showToast(`Removed "${title}" from watchlist`);
    } else {
      this.userData.addToWatchlist({
        id: item.id,
        media_type: item.media_type,
        title,
        poster_path: item.poster_path || null,
        release_date: item.release_date,
        first_air_date: item.first_air_date,
      });
      await triggerLightHaptic();
      await this.toast.showActionToast(
        `Added "${title}" to watchlist`,
        'Undo',
        () => {
          this.userData.removeFromWatchlist(item.media_type, item.id);
          this.toast.showToast('Watchlist addition undone.');
          this.cdr.markForCheck();
        },
      );
    }
    this.cdr.markForCheck();
  }

  async quickMarkWatched(item: QuickLogMediaItem, event: Event): Promise<void> {
    event.stopPropagation();
    event.preventDefault();

    const title = item.title || item.name || 'Title';
    const logged = this.userData.logEntry({
      id: item.id,
      media_type: item.media_type,
      title,
      poster_path: item.poster_path || null,
      watchedAt: CalendarDate.today(),
      dateUnknown: false,
      rating: null,
      liked: false,
      rewatch: false,
      release_date: item.release_date,
      first_air_date: item.first_air_date,
    });

    this.backfill.start();
    await triggerLightHaptic();
    await this.modalCtrl.dismiss();

    await this.toast.showActionToast(
      `Marked "${title}" as watched`,
      'Undo',
      () => {
        this.userData.removeWatched(item.media_type, item.id, logged.entryId);
        this.toast.showToast('Log undone.');
      },
    );
  }

  // ── Compact Log Step ───────────────────────────────────────────────────────

  selectItem(item: QuickLogMediaItem): void {
    this.selectedItem = item;
    if (this.searchQuery) {
      this.saveSearchTerm(this.searchQuery);
    }

    const existing = this.userData.getWatchedEntry(item.media_type, item.id);
    this.existingEntry = existing;

    if (existing) {
      this.rating = existing.rating;
      this.liked = existing.liked;
      this.rewatch = existing.rewatch;
      this.review = existing.review || '';
      this.tags = [...(existing.tags || [])];
      this.dateUnknown = existing.dateUnknown;
      this.watchedDate = existing.watchedAt || CalendarDate.today();
      if (this.review || this.tags.length) {
        this.showReviewAndTags = true;
      }
    } else {
      this.rating = null;
      this.liked = false;
      this.rewatch = false;
      this.review = '';
      this.tags = [];
      this.dateUnknown = false;
      this.watchedDate = CalendarDate.today();
      this.showReviewAndTags = false;
    }

    this.cdr.markForCheck();
  }

  backToSearch(): void {
    this.selectedItem = null;
    this.cdr.markForCheck();
  }

  toggleDateUnknown(): void {
    this.dateUnknown = !this.dateUnknown;
    if (!this.dateUnknown && !this.watchedDate) {
      this.watchedDate = CalendarDate.today();
    }
  }

  addTag(): void {
    const raw = this.tagInput.trim();
    if (!raw) return;
    const parts = raw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && !this.tags.includes(t));
    this.tags.push(...parts);
    this.tagInput = '';
  }

  removeTag(tag: string): void {
    this.tags = this.tags.filter((t) => t !== tag);
  }

  async saveLog(): Promise<void> {
    if (!this.selectedItem) return;

    const item = this.selectedItem;
    const title = item.title || item.name || 'Title';
    const finalWatchedAt = this.dateUnknown ? null : this.watchedDate;

    const logged = this.userData.logEntry({
      id: item.id,
      media_type: item.media_type,
      title,
      poster_path: item.poster_path || null,
      watchedAt: finalWatchedAt,
      dateUnknown: this.dateUnknown,
      rewatch: this.rewatch,
      rating: this.rating,
      liked: this.liked,
      review: this.review.trim(),
      tags: this.tags,
      release_date: item.release_date,
      first_air_date: item.first_air_date,
    });

    this.backfill.start();
    await triggerLightHaptic();
    await this.modalCtrl.dismiss();

    await this.toast.showActionToast(
      `Logged "${title}"`,
      'Undo',
      () => {
        this.userData.removeWatched(item.media_type, item.id, logged.entryId);
        this.toast.showToast('Log undone.');
      },
    );
  }

  close(): void {
    this.modalCtrl.dismiss();
  }

  getItemYear(item: QuickLogMediaItem): string {
    const d = item.release_date || item.first_air_date || '';
    return d.length >= 4 ? d.substring(0, 4) : '';
  }
}
