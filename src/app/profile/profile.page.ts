import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import {
  ActionSheetController,
  AlertController,
  ModalController,
} from '@ionic/angular';
import {
  FavoriteEntry,
  UserDataService,
  UserList,
  UserStats,
  WatchedEntry,
  WatchlistEntry,
} from '../services/user-data.service';
import { CalendarDate } from '../services/calendar-date';
import { HapticFeedbackService } from '../services/haptic-feedback.service';
import { ToastService } from '../services/toast.service';
import { MetadataBackfillService } from '../services/metadata-backfill.service';
import { ImageViewerComponent } from '../shared-module/image-viewer/image-viewer.component';
import {
  formatCountry,
  formatDurationDetail,
  formatDurationHero,
  formatLanguage,
  formatRating,
} from '../services/analytics-format';
import { AddFavoriteModalComponent } from './add-favorite-modal/add-favorite-modal.component';
import { EditProfileComponent } from './edit-profile/edit-profile.component';
import { SetCoverModalComponent } from './set-cover-modal/set-cover-modal.component';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ProfilePage implements OnInit {
  isEditingFavorites = false;
  activityPage = 0;
  readonly pageSize = 20;

  selectedStatsYear = 'all';
  statsTab: 'overview' | 'ratings' | 'time' | 'people' | 'genres' = 'overview';
  coverImageFailed = false;

  private cachedStats: UserStats | null = null;
  private cachedYear: string | null = null;
  private cachedWatchedCount: number | null = null;

  readonly genreColorPalette = [
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#f59e0b', // Amber
    '#8b5cf6', // Purple
    '#ef4444', // Rose
    '#10b981', // Emerald
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#84cc16', // Lime
  ];

  private cachedCoverUrl: string | null = null;

  constructor(
    public userData: UserDataService,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private metadataBackfill: MetadataBackfillService,
    private haptics: HapticFeedbackService,
  ) {}

  ngOnInit(): void {
    this.refreshStatsCache();
  }

  ionViewWillEnter(): void {
    this.refreshStatsCache();
    this.cdr.markForCheck();
  }

  get profile() {
    return this.userData.getProfile();
  }

  get backfillProgress$() {
    return this.metadataBackfill.getProgress();
  }

  get stats(): UserStats {
    const watched = this.watchedEntries;
    if (
      !this.cachedStats ||
      this.cachedYear !== this.selectedStatsYear ||
      this.cachedWatchedCount !== watched.length
    ) {
      this.cachedStats = this.userData.getStats(this.selectedStatsYear);
      this.cachedYear = this.selectedStatsYear;
      this.cachedWatchedCount = watched.length;
    }
    return this.cachedStats;
  }

  refreshStatsCache(): void {
    this.cachedStats = null;
    this.cachedYear = null;
    this.cachedWatchedCount = null;
    this.computeCoverUrl();
  }

  private computeCoverUrl(): void {
    if (this.coverImageFailed) {
      this.cachedCoverUrl = null;
      return;
    }

    const custom = this.userData.getSettings().customCover;
    if (custom?.backdropPath) {
      this.cachedCoverUrl = `https://image.tmdb.org/t/p/w1280${custom.backdropPath}`;
      return;
    }

    const favs = this.favorites;
    if (favs.length > 0) {
      if (favs[0].backdrop_path) {
        this.cachedCoverUrl = `https://image.tmdb.org/t/p/w1280${favs[0].backdrop_path}`;
        return;
      }
      const favEntry = this.userData.getWatchedEntry(favs[0].media_type, favs[0].id);
      if (favEntry?.snapshot?.backdropPath) {
        this.cachedCoverUrl = `https://image.tmdb.org/t/p/w1280${favEntry.snapshot.backdropPath}`;
        return;
      }
    }

    const highestRated = [...this.watchedEntries]
      .filter((e) => typeof e.rating === 'number' && e.snapshot?.backdropPath)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
    if (highestRated?.snapshot?.backdropPath) {
      this.cachedCoverUrl = `https://image.tmdb.org/t/p/w1280${highestRated.snapshot.backdropPath}`;
      return;
    }

    if (this.profile.coverBase64) {
      this.cachedCoverUrl = this.profile.coverBase64;
      return;
    }

    this.cachedCoverUrl = null;
  }

  setStatsYear(year: string): void {
    this.selectedStatsYear = year;
    this.refreshStatsCache();
    this.cdr.markForCheck();
  }

  async refreshStatsData(): Promise<void> {
    this.haptics.lightImpact();
    await this.metadataBackfill.refreshStats(true);
    this.refreshStatsCache();
    this.cdr.markForCheck();
  }

  get coverBackdropUrl(): string | null {
    return this.cachedCoverUrl;
  }

  onCoverError(): void {
    this.coverImageFailed = true;
    this.cdr.markForCheck();
  }

  async openCoverActions(): Promise<void> {
    const buttons: any[] = [
      {
        text: 'Choose movie backdrop',
        icon: 'film-outline',
        handler: () => this.openSetCoverModal(),
      },
      {
        text: 'Upload custom image',
        icon: 'image-outline',
        handler: () => this.pickImage('cover'),
      },
    ];

    const custom = this.userData.getSettings().customCover;
    const hasCustom = !!custom || !!this.profile.coverBase64;
    if (hasCustom) {
      buttons.push({
        text: 'Use top favorite (default)',
        icon: 'refresh-outline',
        handler: () => {
          this.userData.saveSetting('customCover', null);
          this.userData.saveProfile({ coverBase64: null });
          this.coverImageFailed = false;
          this.refreshStatsCache();
          this.cdr.markForCheck();
          this.toast.showToast('Reset to default favorite cover.');
        },
      });
      buttons.push({
        text: 'Remove cover (gradient only)',
        role: 'destructive',
        icon: 'trash-outline',
        handler: () => {
          this.userData.saveSetting('customCover', null);
          this.userData.saveProfile({ coverBase64: null });
          this.coverImageFailed = true;
          this.refreshStatsCache();
          this.cdr.markForCheck();
        },
      });
    }

    buttons.push({ text: 'Cancel', role: 'cancel' });

    const sheet = await this.actionSheetCtrl.create({
      header: 'Profile Cover',
      buttons,
    });
    await sheet.present();
  }

  async openSetCoverModal(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: SetCoverModalComponent,
      breakpoints: [0, 0.95],
      initialBreakpoint: 0.95,
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data?.updated) {
      this.coverImageFailed = false;
      this.refreshStatsCache();
      this.cdr.markForCheck();
    }
  }

  async openAvatarActions(): Promise<void> {
    const buttons: any[] = [];
    if (this.profile.avatarBase64) {
      buttons.push({
        text: 'View avatar',
        icon: 'eye-outline',
        handler: () => this.viewImage(this.profile.avatarBase64!, 'Avatar'),
      });
    }
    buttons.push({
      text: 'Change avatar',
      icon: 'image-outline',
      handler: () => this.pickImage('avatar'),
    });
    if (this.profile.avatarBase64) {
      buttons.push({
        text: 'Remove avatar',
        role: 'destructive',
        icon: 'trash-outline',
        handler: () => {
          this.userData.saveProfile({ avatarBase64: null });
          this.cdr.markForCheck();
        },
      });
    }
    buttons.push({ text: 'Cancel', role: 'cancel' });

    const sheet = await this.actionSheetCtrl.create({
      header: 'Avatar',
      buttons,
    });
    await sheet.present();
  }

  private async viewImage(src: string, alt: string): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ImageViewerComponent,
      componentProps: { src, alt },
    });
    await modal.present();
  }

  private pickImage(type: 'avatar' | 'cover'): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const rawUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const maxDim = type === 'avatar' ? 300 : 1280;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const resizedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            const patch =
              type === 'avatar'
                ? { avatarBase64: resizedBase64 }
                : { coverBase64: resizedBase64 };
            this.userData.saveProfile(patch);
            this.coverImageFailed = false;
            this.refreshStatsCache();
            this.cdr.markForCheck();
          }
        };
        img.src = rawUrl;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async openEditProfile(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: EditProfileComponent,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    await modal.onDidDismiss();
    this.refreshStatsCache();
    this.cdr.markForCheck();
  }

  // ── Favorites ──────────────────────────────────────────────────────────

  get favorites(): FavoriteEntry[] {
    return this.userData.getFavorites();
  }

  get visibleFavorites(): FavoriteEntry[] {
    return this.favorites.slice(0, 4);
  }

  async openAddFavorite(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AddFavoriteModalComponent,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    await modal.onDidDismiss();
    this.refreshStatsCache();
    this.cdr.markForCheck();
  }

  toggleFavoritesEdit(): void {
    this.isEditingFavorites = !this.isEditingFavorites;
    this.cdr.markForCheck();
  }

  moveFavorite(index: number, direction: -1 | 1): void {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= this.visibleFavorites.length) {
      return;
    }
    const next = [...this.visibleFavorites];
    const current = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = current;
    this.userData.reorderFavorites(next);
    this.haptics.lightImpact();
    this.refreshStatsCache();
    this.cdr.markForCheck();
  }

  removeFavorite(entry: FavoriteEntry): void {
    this.userData.removeFavorite(entry.media_type, entry.id);
    this.haptics.lightImpact();
    this.refreshStatsCache();
    this.cdr.markForCheck();
  }

  canMoveFavoriteLeft(index: number): boolean {
    return index > 0;
  }

  canMoveFavoriteRight(index: number): boolean {
    return index < this.visibleFavorites.length - 1;
  }

  // ── List Cards Posters & Data ───────────────────────────────────────────

  get watchedEntries(): WatchedEntry[] {
    return this.userData.getWatchedList();
  }

  get watchedPosters(): string[] {
    return this.watchedEntries
      .filter((e) => e.poster_path)
      .slice(0, 4)
      .map((e) => `https://image.tmdb.org/t/p/w185${e.poster_path}`);
  }

  get watchlistPosters(): string[] {
    return this.userData.getWatchlist()
      .filter((w) => w.poster_path)
      .slice(0, 4)
      .map((w) => `https://image.tmdb.org/t/p/w185${w.poster_path}`);
  }

  get likedPosters(): string[] {
    return this.watchedEntries
      .filter((e) => e.liked && e.poster_path)
      .slice(0, 4)
      .map((e) => `https://image.tmdb.org/t/p/w185${e.poster_path}`);
  }

  get diaryPosters(): string[] {
    return this.watchedEntries
      .filter((e) => !e.dateUnknown && e.watchedAt && e.poster_path)
      .slice(0, 4)
      .map((e) => `https://image.tmdb.org/t/p/w185${e.poster_path}`);
  }

  get ratedPosters(): string[] {
    return this.watchedEntries
      .filter((e) => typeof e.rating === 'number' && e.poster_path)
      .slice(0, 4)
      .map((e) => `https://image.tmdb.org/t/p/w185${e.poster_path}`);
  }

  get reviewsPosters(): string[] {
    return this.watchedEntries
      .filter((e) => !!e.review?.trim() && e.poster_path)
      .slice(0, 4)
      .map((e) => `https://image.tmdb.org/t/p/w185${e.poster_path}`);
  }

  get allLists(): UserList[] {
    return this.userData.getLists();
  }

  getListPosters(list: UserList): string[] {
    return (list.items || [])
      .filter((i) => i.poster_path)
      .slice(0, 4)
      .map((i) => `https://image.tmdb.org/t/p/w185${i.poster_path}`);
  }

  async createList(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'New List',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'List name' },
        { name: 'description', type: 'text', placeholder: 'Description (optional)' },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Create',
          handler: (data) => {
            if (data.name?.trim()) {
              this.userData.createList(data.name.trim(), data.description?.trim() || '');
              this.refreshStatsCache();
              this.cdr.markForCheck();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async deleteList(id: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete list?',
      message: 'This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.userData.deleteList(id);
            this.refreshStatsCache();
            this.cdr.markForCheck();
          },
        },
      ],
    });
    await alert.present();
  }

  toggleListBookmark(list: any): void {
    if (this.userData.isListBookmarked(list.id)) {
      this.userData.unbookmarkList(list.id);
    } else {
      this.userData.bookmarkList(list);
    }
    this.cdr.markForCheck();
  }

  isListBookmarked(listId: string | number): boolean {
    return this.userData.isListBookmarked(listId);
  }

  // ── Stats Visualizations Data ──────────────────────────────────────────

  get currentYearWatchedCount(): number {
    const yr = String(new Date().getFullYear());
    return this.watchedEntries.filter(
      (e) => !e.dateUnknown && e.watchedAt && e.watchedAt.startsWith(yr)
    ).length;
  }

  get ratedEntriesCount(): number {
    if (this.selectedStatsYear && this.selectedStatsYear !== 'all' && this.stats?.ratingsDistribution) {
      return Object.values(this.stats.ratingsDistribution).reduce((sum, count) => sum + count, 0);
    }
    return this.watchedEntries.filter((e) => typeof e.rating === 'number').length;
  }

  get reviewsCount(): number {
    return this.watchedEntries.filter((e) => !!e.review?.trim()).length;
  }

  get moviePercentage(): number {
    const total = this.stats.totalMovies + this.stats.totalTv;
    return total > 0 ? Math.round((this.stats.totalMovies / total) * 100) : 0;
  }

  get tvPercentage(): number {
    const total = this.stats.totalMovies + this.stats.totalTv;
    return total > 0 ? Math.round((this.stats.totalTv / total) * 100) : 0;
  }

  ratingRows(): Array<{ label: string; count: number; pct: number; isPeak: boolean }> {
    const keys = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].reverse();
    const rows = keys.map((value) => {
      const label = value.toFixed(1);
      const count = this.stats.ratingsDistribution[label] || 0;
      return { label, count };
    });
    const max = Math.max(...rows.map((r) => r.count), 1);
    const hasData = rows.some((r) => r.count > 0);
    return rows.map((r) => ({
      ...r,
      pct: (r.count / max) * 100,
      isPeak: hasData && r.count === max,
    }));
  }

  get maxDirectorCount(): number {
    const dirs = this.stats.topDirectors || [];
    return dirs.length ? Math.max(...dirs.map((d) => d.count), 1) : 1;
  }

  get maxCastCount(): number {
    const cast = this.stats.topCast || [];
    return cast.length ? Math.max(...cast.map((c) => c.count), 1) : 1;
  }

  get maxGenreCount(): number {
    const genres = this.stats.topGenres || [];
    return genres.length ? Math.max(...genres.map((g) => g.count), 1) : 1;
  }

  get maxDecadeCount(): number {
    const list = this.stats.decades || [];
    return list.length ? Math.max(...list.map((d) => d.count), 1) : 1;
  }

  get maxMonthCount(): number {
    const list = this.stats.watchedByMonth || [];
    return list.length ? Math.max(...list.map((m) => m.count), 1) : 1;
  }

  get maxLanguageCount(): number {
    const list = this.stats.languages || [];
    return list.length ? Math.max(...list.map((l) => l.count), 1) : 1;
  }

  get maxCountryCount(): number {
    const list = this.stats.productionCountries || [];
    return list.length ? Math.max(...list.map((c) => c.count), 1) : 1;
  }

  get maxWeekdayCount(): number {
    const list = this.stats.watchedByWeekday || [];
    return list.length ? Math.max(...list.map((w) => w.count), 1) : 1;
  }

  getPeakWeekday(): string {
    const list = this.stats.watchedByWeekday || [];
    if (!list.length) return '—';
    const sorted = [...list].sort((a, b) => b.count - a.count);
    return sorted[0].count > 0 ? sorted[0].day : '—';
  }

  get heatmapWeeks(): { weekIndex: number; days: { date: string; count: number; level: number }[] }[] {
    const days = this.stats.activityHeatmap || [];
    const weeks: { weekIndex: number; days: { date: string; count: number; level: number }[] }[] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push({
        weekIndex: Math.floor(i / 7),
        days: days.slice(i, i + 7),
      });
    }
    return weeks;
  }

  getGenreColor(index: number): string {
    return this.genreColorPalette[index % this.genreColorPalette.length];
  }

  monthLabel(iso: string): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = iso.split('-');
    if (parts.length < 2) return iso;
    const m = parseInt(parts[1], 10);
    return months[m - 1] || iso;
  }

  get watchlistEntries(): WatchlistEntry[] {
    return this.userData.getWatchlist();
  }

  formatHeroDuration(hours: number): string {
    return formatDurationHero(hours);
  }

  formatDetailDuration(hours: number): string {
    return formatDurationDetail(hours);
  }

  getLanguageDisplayName(code: string): string {
    return formatLanguage(code);
  }

  getCountryDisplayName(code: string): string {
    return formatCountry(code);
  }

  get isDegenerateFormat(): boolean {
    return this.stats.totalMovies === 0 || this.stats.totalTv === 0;
  }
}
