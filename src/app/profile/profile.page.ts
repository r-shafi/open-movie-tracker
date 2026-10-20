import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
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
  WatchedEntry,
  WatchlistEntry,
} from '../services/user-data.service';
import { ToastService } from '../services/toast.service';
import { ImageViewerComponent } from '../shared-module/image-viewer/image-viewer.component';
import { AddFavoriteModalComponent } from './add-favorite-modal/add-favorite-modal.component';
import { EditProfileComponent } from './edit-profile/edit-profile.component';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ProfilePage {
  activeTab: 'stats' | 'activity' | 'lists' = 'stats';
  isEditingFavorites = false;
  activityPage = 0;
  readonly pageSize = 20;

  ionViewWillEnter() {
    this.cdr.markForCheck();
  }
  readonly quickLinks = [
    {
      label: 'Watched',
      icon: 'eye-outline',
      route: '/profile/watched',
      subtitle: 'All logged titles',
      countGetter: () => this.stats.totalWatched,
    },
    {
      label: 'Watchlist',
      icon: 'bookmark-outline',
      route: '/profile/watchlist',
      subtitle: 'What to watch next',
      countGetter: () => this.userData.getWatchlist().length,
    },
    {
      label: 'Liked',
      icon: 'heart-outline',
      route: '/profile/liked',
      subtitle: 'Films and shows you liked',
      countGetter: () => this.watchedEntries.filter((e) => e.liked).length,
    },
    {
      label: 'Diary',
      icon: 'calendar-clear-outline',
      route: '/profile/diary',
      subtitle: 'Logs by watch date',
      countGetter: () => this.watchedEntries.length,
    },
    {
      label: 'Ratings',
      icon: 'star-outline',
      route: '/profile/ratings',
      subtitle: 'Your scored entries',
      countGetter: () =>
        this.watchedEntries.filter((e) => e.rating !== null).length,
    },
    {
      label: 'Reviews',
      icon: 'chatbubble-ellipses-outline',
      route: '/profile/reviews',
      subtitle: 'Written thoughts',
      countGetter: () =>
        this.watchedEntries.filter((e) => !!e.review.trim()).length,
    },
  ];

  constructor(
    public userData: UserDataService,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
  ) {}

  get profile() {
    return this.userData.getProfile();
  }

  selectedStatsYear = 'all';
  roulettePick: WatchlistEntry | null = null;

  spinRoulette(): void {
    this.roulettePick = this.userData.pickWatchlistRoulette();
    if (!this.roulettePick) {
      this.toast.showToast('Your watchlist is empty! Add titles to spin.');
    } else {
      this.toast.showToast(`Roulette picked: "${this.roulettePick.title}"`);
    }
    this.cdr.markForCheck();
  }

  generateShareCard(): void {
    const stats = this.stats;
    const profile = this.profile;
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dark gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, 1350);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1350);

    // Subtle emerald radial glow
    ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
    ctx.beginPath();
    ctx.arc(1080, 0, 500, 0, Math.PI * 2);
    ctx.fill();

    // App header
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.fillText('OPEN MOVIE TRACKER', 80, 120);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 24px system-ui, -apple-system, sans-serif';
    ctx.fillText('100% On-Device · Privacy-First Analytics', 80, 160);

    // User profile title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
    ctx.fillText(profile.displayName || 'Film Curator', 80, 260);

    if (profile.bio) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'normal 26px system-ui, -apple-system, sans-serif';
      ctx.fillText(profile.bio.slice(0, 60), 80, 305);
    }

    // Divider line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 350);
    ctx.lineTo(1000, 350);
    ctx.stroke();

    // 4 Key Stats cards
    const cards = [
      { label: 'TITLES WATCHED', val: String(stats.totalWatched) },
      { label: 'HOURS ESTIMATED', val: `${stats.totalHoursEstimated}h` },
      { label: 'AVERAGE RATING', val: stats.averageRating ? `★ ${stats.averageRating}` : 'N/A' },
      { label: 'LONGEST STREAK', val: `${stats.longestStreak} days` },
    ];

    cards.forEach((c, idx) => {
      const x = 80 + (idx % 2) * 470;
      const y = 400 + Math.floor(idx / 2) * 200;

      ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
      ctx.beginPath();
      ctx.roundRect(x, y, 440, 160, 20);
      ctx.fill();

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
      ctx.fillText(c.val, x + 30, y + 80);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.fillText(c.label, x + 30, y + 125);
    });

    // Top genres
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.fillText('TOP GENRES', 80, 880);

    const genresText = stats.topGenres.map((g) => `${g.name} (${g.count})`).join('  ·  ') || 'None recorded';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 28px system-ui, -apple-system, sans-serif';
    ctx.fillText(genresText, 80, 935);

    // Watchlist health & streak
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.fillText('WATCHLIST HEALTH', 80, 1040);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 28px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${stats.watchlistHealth.totalItems} queued  ·  ${stats.watchlistHealth.completionRate}% completion rate  ·  ${stats.watchlistHealth.averageAgeDays}d avg age`, 80, 1095);

    // Footer
    ctx.fillStyle = '#64748b';
    ctx.font = '500 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Generated offline on ${new Date().toLocaleDateString()}`, 80, 1260);

    // Trigger local PNG download
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `open-movie-tracker-stats-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.toast.showToast('Stats card downloaded as PNG.');
  }

  get stats() {
    return this.userData.getStats(this.selectedStatsYear);
  }

  setStatsYear(year: string): void {
    this.selectedStatsYear = year;
    this.cdr.markForCheck();
  }

  maxDecadeCount(): number {
    const list = this.stats.decades || [];
    if (!list.length) return 1;
    return Math.max(...list.map((d) => d.count), 1);
  }

  get favorites(): FavoriteEntry[] {
    return this.userData.getFavorites();
  }

  get visibleFavorites(): FavoriteEntry[] {
    return this.favorites.slice(0, 4);
  }

  get watchedEntries(): WatchedEntry[] {
    return this.userData.getWatchedList();
  }

  get visibleActivity(): WatchedEntry[] {
    return this.watchedEntries.slice(
      0,
      (this.activityPage + 1) * this.pageSize,
    );
  }

  get hasMoreActivity(): boolean {
    return this.visibleActivity.length < this.watchedEntries.length;
  }

  get allLists(): UserList[] {
    return this.userData.getLists();
  }

  get bookmarkedLists(): any[] {
    return this.userData.getBookmarkedLists() || [];
  }

  get recentActivityEntries(): WatchedEntry[] {
    return this.watchedEntries.slice(0, 5);
  }

  get previewLists(): UserList[] {
    return this.allLists.slice(0, 3);
  }

  quickLinkCount(getter: () => number): number {
    return getter();
  }

  get monthGroups(): { month: string; entries: WatchedEntry[] }[] {
    const groups: { month: string; entries: WatchedEntry[] }[] = [];
    const seen = new Set<string>();
    for (const entry of this.visibleActivity) {
      if (!entry.watchedAt || entry.dateUnknown) {
        continue;
      }
      const d = new Date(entry.watchedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!seen.has(key)) {
        seen.add(key);
        groups.push({ month: key, entries: [] });
      }
      const group = groups.find((g) => g.month === key);
      if (group) {
        group.entries.push(entry);
      }
    }
    return groups;
  }

  loadMore(event: any) {
    this.activityPage++;
    event.target.complete();
    if (!this.hasMoreActivity) {
      event.target.disabled = true;
    }
  }

  async openEditProfile() {
    const modal = await this.modalCtrl.create({
      component: EditProfileComponent,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    await modal.onDidDismiss();
    this.cdr.markForCheck();
  }

  async openCoverActions() {
    await this.openImageActionSheet('cover');
  }

  async openAvatarActions() {
    await this.openImageActionSheet('avatar');
  }

  private async openImageActionSheet(type: 'avatar' | 'cover') {
    const src =
      type === 'avatar' ? this.profile.avatarBase64 : this.profile.coverBase64;
    const label = type === 'avatar' ? 'Avatar' : 'Cover image';

    const buttons: any[] = [];
    if (src) {
      buttons.push({
        text: `View ${label.toLowerCase()}`,
        icon: 'eye-outline',
        handler: () => this.viewImage(src, label),
      });
    }
    buttons.push({
      text: `Change ${label.toLowerCase()}`,
      icon: 'image-outline',
      handler: () => this.pickImage(type),
    });
    if (src) {
      buttons.push({
        text: `Remove ${label.toLowerCase()}`,
        role: 'destructive',
        icon: 'trash-outline',
        handler: () => {
          const patch =
            type === 'avatar' ? { avatarBase64: null } : { coverBase64: null };
          this.userData.saveProfile(patch);
          this.cdr.markForCheck();
        },
      });
    }
    buttons.push({ text: 'Cancel', role: 'cancel' });

    const sheet = await this.actionSheetCtrl.create({
      header: label,
      buttons,
    });
    await sheet.present();
  }

  private async viewImage(src: string, alt: string) {
    const modal = await this.modalCtrl.create({
      component: ImageViewerComponent,
      componentProps: { src, alt },
    });
    await modal.present();
  }

  private pickImage(type: 'avatar' | 'cover') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const rawUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const maxDim = type === 'avatar' ? 300 : 800;
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
            const resizedBase64 = canvas.toDataURL('image/jpeg', 0.8);
            const patch =
              type === 'avatar'
                ? { avatarBase64: resizedBase64 }
                : { coverBase64: resizedBase64 };
            this.userData.saveProfile(patch);
            this.cdr.markForCheck();
          }
        };
        img.src = rawUrl;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async openAddFavorite() {
    const modal = await this.modalCtrl.create({
      component: AddFavoriteModalComponent,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    await modal.onDidDismiss();
    this.cdr.markForCheck();
  }

  toggleFavoritesEdit() {
    this.isEditingFavorites = !this.isEditingFavorites;
    this.cdr.markForCheck();
  }

  moveFavorite(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= this.visibleFavorites.length) {
      return;
    }
    const next = [...this.visibleFavorites];
    const current = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = current;
    this.userData.reorderFavorites(next);
    this.cdr.markForCheck();
  }

  removeFavorite(entry: FavoriteEntry) {
    this.userData.removeFavorite(entry.media_type, entry.id);
    this.cdr.markForCheck();
  }

  canMoveFavoriteLeft(index: number): boolean {
    return index > 0;
  }

  canMoveFavoriteRight(index: number): boolean {
    return index < this.visibleFavorites.length - 1;
  }

  async createList() {
    const alert = await this.alertCtrl.create({
      header: 'New List',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'List name' },
        {
          name: 'description',
          type: 'text',
          placeholder: 'Description (optional)',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Create',
          handler: (data) => {
            if (data.name?.trim()) {
              this.userData.createList(
                data.name.trim(),
                data.description?.trim() || '',
              );
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async deleteList(id: string) {
    const alert = await this.alertCtrl.create({
      header: 'Delete list?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.userData.deleteList(id),
        },
      ],
    });
    await alert.present();
  }

  statCards() {
    const s = this.stats;
    return [
      { label: 'Total Watched', value: s.totalWatched },
      { label: 'Total Hours', value: s.totalHoursEstimated },
      {
        label: 'Avg Rating',
        value: s.averageRating !== null ? s.averageRating.toFixed(1) : '-',
      },
      { label: 'Total Liked', value: s.likedCount },
    ];
  }

  get ratedEntriesCount(): number {
    return this.watchedEntries.filter((entry) => entry.rating !== null).length;
  }

  get unratedEntriesCount(): number {
    return this.stats.totalWatched - this.ratedEntriesCount;
  }

  get watchlistCount(): number {
    return this.userData.getWatchlist().length;
  }

  get averageRatingDisplay(): string {
    return this.stats.averageRating !== null
      ? this.stats.averageRating.toFixed(1)
      : '-';
  }

  get ratedCoverageDisplay(): string {
    return this.formatPercent(this.ratedEntriesCount, this.stats.totalWatched);
  }

  get likedRatioDisplay(): string {
    return this.formatPercent(this.stats.likedCount, this.stats.totalWatched);
  }

  get movieTvMixDisplay(): string {
    return `${this.stats.totalMovies}M / ${this.stats.totalTv}TV`;
  }

  get currentMonthWatchedCount(): number {
    const currentMonth = this.monthKey(new Date());
    const bucket = this.stats.watchedByMonth.find(
      (entry) => entry.month === currentMonth,
    );
    return bucket?.count || 0;
  }

  peakMonthLabel(): string {
    if (!this.stats.watchedByMonth.length) {
      return '-';
    }
    const best = [...this.stats.watchedByMonth].sort(
      (a, b) => b.count - a.count,
    )[0];
    if (!best || best.count === 0) {
      return '-';
    }
    return `${this.monthLabel(best.month)} ${best.month.split('-')[0]}`;
  }

  ratingRows(): Array<{
    label: string;
    count: number;
    pct: number;
    isPeak: boolean;
  }> {
    const keys = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].reverse();
    const rows = keys.map((value) => {
      const label = value.toFixed(1);
      const count = this.stats.ratingsDistribution[label] || 0;
      return { label, count };
    });
    const max = Math.max(...rows.map((row) => row.count), 1);
    const hasData = rows.some((row) => row.count > 0);
    return rows.map((row) => ({
      ...row,
      pct: (row.count / max) * 100,
      isPeak: hasData && row.count === max,
    }));
  }

  monthMomentumRows(): Array<{
    label: string;
    count: number;
    pct: number;
    isPeak: boolean;
  }> {
    const latest = this.stats.watchedByMonth.slice(-6);
    const max = Math.max(...latest.map((row) => row.count), 1);
    const hasData = latest.some((row) => row.count > 0);
    return latest.map((row) => ({
      label: this.monthLabel(row.month),
      count: row.count,
      pct: (row.count / max) * 100,
      isPeak: hasData && row.count === max,
    }));
  }

  get hasRatingData(): boolean {
    return this.ratingRows().some((row) => row.count > 0);
  }

  get hasMomentumData(): boolean {
    return this.monthMomentumRows().some((row) => row.count > 0);
  }

  get ratingPeakSummary(): string {
    const peak = this.ratingRows()
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count)[0];
    if (!peak) {
      return 'No rating data yet';
    }
    const suffix = peak.count === 1 ? 'log' : 'logs';
    return `Most common: ${peak.label}★ (${peak.count} ${suffix})`;
  }

  get momentumPeakSummary(): string {
    const peak = this.monthMomentumRows()
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count)[0];
    if (!peak) {
      return 'No monthly data yet';
    }
    const suffix = peak.count === 1 ? 'title' : 'titles';
    return `Top month: ${peak.label} (${peak.count} ${suffix})`;
  }

  ratingBarTooltip(label: string, count: number): string {
    const suffix = count === 1 ? 'log' : 'logs';
    return `${label} stars: ${count} ${suffix}`;
  }

  momentumBarTooltip(label: string, count: number): string {
    const suffix = count === 1 ? 'title' : 'titles';
    return `${label}: ${count} ${suffix} watched`;
  }

  ratingBarHeight(count: number): number {
    const max = Math.max(...Object.values(this.stats.ratingsDistribution), 1);
    return max > 0 ? (count / max) * 100 : 0;
  }

  monthBarHeight(count: number): number {
    const max = Math.max(...this.stats.watchedByMonth.map((m) => m.count), 1);
    return max > 0 ? (count / max) * 100 : 0;
  }

  genreBarWidth(count: number): number {
    const max = Math.max(...this.stats.topGenres.map((g) => g.count), 1);
    return max > 0 ? (count / max) * 100 : 0;
  }

  monthLabel(iso: string): string {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const m = parseInt(iso.split('-')[1], 10);
    return months[m - 1] || iso;
  }

  getMonthLabel(iso: string): string {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const m = parseInt(iso.split('-')[1], 10);
    return months[m - 1] || iso;
  }

  entryRating(entry: WatchedEntry): string {
    if (entry.rating === null) {
      return '';
    }
    return `★${entry.rating}`;
  }

  entryPoster(entry: WatchedEntry): string {
    return entry.poster_path
      ? `https://image.tmdb.org/t/p/w92${entry.poster_path}`
      : 'assets/no-image.png';
  }

  listPoster(item: any): string {
    return item.poster_path
      ? `https://image.tmdb.org/t/p/w92${item.poster_path}`
      : 'assets/no-image.png';
  }

  activityRoute(entry: WatchedEntry): any[] {
    return ['/' + (entry.media_type === 'tv' ? 'tv' : 'movie'), entry.id];
  }

  listCoverRoute(list: UserList): any[] {
    return ['/list', list.id];
  }

  private monthKey(d: Date): string {
    const year = d.getFullYear();
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  }

  getListCoverPosters(list: any): string[] {
    if (list.poster_path) {
      return [`https://image.tmdb.org/t/p/w185${list.poster_path}`];
    }
    return (list.items || [])
      .filter((i: any) => i.poster_path)
      .slice(0, 4)
      .map((i: any) => `https://image.tmdb.org/t/p/w92${i.poster_path}`);
  }

  getPlaceholderSlots(list: any): number[] {
    const count = 4 - this.getListCoverPosters(list).length;
    return count > 0 ? Array(count).fill(0) : [];
  }

  toggleListBookmark(list: any, event: Event) {
    event.stopPropagation();
    if (this.userData.isListBookmarked(list.id)) {
      this.userData.unbookmarkList(list.id);
    } else {
      this.userData.bookmarkList(list);
    }
  }

  isListBookmarked(listId: number): boolean {
    return this.userData.isListBookmarked(listId);
  }

  private formatPercent(value: number, total: number): string {
    if (!total) {
      return '0%';
    }
    return `${Math.round((value / total) * 100)}%`;
  }
}
