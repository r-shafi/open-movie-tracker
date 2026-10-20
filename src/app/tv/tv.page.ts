import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ActionSheetController, ModalController } from '@ionic/angular';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ImageViewerComponent } from '../shared-module/image-viewer/image-viewer.component';
import { TmdbService } from '../services/tmdb.service';
import { LogSheetService } from '../shared-module/log-sheet/log-sheet.service';
import { ToastService } from '../services/toast.service';
import { UserDataService, WatchlistEntry } from '../services/user-data.service';

@Component({
    selector: 'app-tv',
    templateUrl: './tv.page.html',
    styleUrls: ['./tv.page.scss'],
    standalone: false
})
export class TvPage implements OnInit {
  show: any;
  credits: any;
  videos: any[] = [];
  images: any[] = [];
  // slideshow state
  private _slideshowIndex = 0;
  private _slideshowTimer: any = null;
  private _slideshowInterval = 5000; // ms
  private _currentBackdrop: string | null = null;
  private _prevBackdrop: string | null = null;
  public _bgToggle = false;
  similar: any[] = [];
  recommendations: any[] = [];
  reviews: any[] = [];
  isLoading = true;
  featuredLists: any[] = [];
  allListsCount = 0;

  constructor(
    private tmdb: TmdbService,
    private route: ActivatedRoute,
    private modalCtrl: ModalController,
    private actionSheetCtrl: ActionSheetController,
    private logSheet: LogSheetService,
    private userData: UserDataService,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    const id = +this.route.snapshot.paramMap.get('id')!;
    forkJoin({
      show: this.tmdb.getTvDetails(id),
      credits: this.tmdb.getTvCredits(id),
      videos: this.tmdb.getTvVideos(id),
      images: this.tmdb.getTvImages(id),
      similar: this.tmdb.getTvSimilar(id),
      recommendations: this.tmdb.getTvRecommendations(id),
      reviews: this.tmdb.getTvReviews(id),
      lists: this.tmdb.getTvLists(id).pipe(catchError(() => of({ results: [], total_results: 0 }))),
    }).subscribe({
      next: (data: any) => {
        this.show = data.show;
        this.credits = data.credits;
        this.videos = (data.videos?.results || []).filter(
          (v: any) => v.site === 'YouTube',
        );
        this.images = (data.images?.backdrops || []).slice(0, 20);
        // initialize slideshow backdrop
        if (this.images.length) {
          this._currentBackdrop = this._buildImageUrl(
            this.images[0]?.file_path,
            'auto',
          );
          this._prevBackdrop = this._currentBackdrop;
          this.startBackdropSlideshow();
        }
        this.similar = (data.similar?.results || []).map((i: any) => ({
          ...i,
          media_type: 'tv',
        }));
        this.recommendations = (data.recommendations?.results || []).map(
          (i: any) => ({ ...i, media_type: 'tv' }),
        );
        this.reviews = data.reviews?.results || [];
        this.allListsCount = data.lists?.total_results || 0;
        const top3 = (data.lists?.results || []).slice(0, 3);
        if (top3.length) {
          forkJoin(top3.map((l: any) => this.tmdb.getListDetail(l.id).pipe(catchError(() => of({ items: [], created_by: null }))))).subscribe(
            (details: any) => {
              this.featuredLists = top3.map((list: any, i: number) => ({
                ...list,
                creator_username: details[i]?.created_by?.username || '',
                items: details[i]?.items || [],
              }));
            },
          );
        }
        this.isLoading = false;
      },
      error: () => {
        const local = this.userData.getWatchedEntry('tv', id);
        if (local) {
          this.show = {
            id: local.id,
            name: local.title,
            poster_path: local.poster_path,
            first_air_date: local.first_air_date || (local.snapshot?.releaseYear ? `${local.snapshot.releaseYear}-01-01` : ''),
            episode_run_time: local.snapshot?.runtimeMinutes ? [local.snapshot.runtimeMinutes] : [],
            genres: local.snapshot?.genres || (local.tags || []).map((t, idx) => ({ id: idx, name: t })),
            overview: local.review ? `Your Logged Review: ${local.review}` : '',
            vote_average: local.snapshot?.tmdbVoteAverage || (local.rating ? local.rating * 2 : undefined),
            status: 'Ended',
            seasons: [],
          };
          if (local.snapshot?.topCast) {
            this.credits = {
              cast: local.snapshot.topCast,
              crew: local.snapshot?.directors?.map((d) => ({ name: d.name, job: 'Creator' })) || [],
            };
          }
        }
        this.isLoading = false;
      },
    });
  }

  ngOnDestroy() {
    this.stopBackdropSlideshow();
  }

  get backdropUrl(): string {
    if (this._currentBackdrop) {
      return this._currentBackdrop;
    }
    if (this.show?.backdrop_path) {
      return this._buildImageUrl(this.show.backdrop_path, 'auto');
    }
    return '';
  }

  private _preferredSize(): string {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 360;
    const needed = Math.ceil(vw * dpr);

    // Conservative thresholds: avoid picking w1280 for most phones
    if (needed <= 360) {
      return 'w300';
    }
    if (needed <= 800) {
      return 'w780';
    }
    if (needed <= 1400) {
      return 'w1280';
    }
    return 'original';
  }

  private _buildImageUrl(path: string | undefined, size = 'auto') {
    if (!path) {
      return '';
    }
    const chosen = size === 'auto' ? this._preferredSize() : size;
    return `https://image.tmdb.org/t/p/${chosen}${path}`;
  }

  startBackdropSlideshow() {
    this.stopBackdropSlideshow();
    if (!this.images || !this.images.length) {
      return;
    }
    this._slideshowIndex = 0;
    this._slideshowTimer = setInterval(() => {
      this._slideshowIndex = (this._slideshowIndex + 1) % this.images.length;
      const next = this._buildImageUrl(
        this.images[this._slideshowIndex]?.file_path,
        'auto',
      );
      this._prevBackdrop = this._currentBackdrop;
      this._currentBackdrop = next;
      this._bgToggle = !this._bgToggle;
    }, this._slideshowInterval);
  }

  stopBackdropSlideshow() {
    if (this._slideshowTimer) {
      clearInterval(this._slideshowTimer);
      this._slideshowTimer = null;
    }
  }

  get posterUrl(): string {
    return this.show?.poster_path
      ? `https://image.tmdb.org/t/p/w342${this.show.poster_path}`
      : 'assets/no-image.png';
  }

  get fullPosterUrl(): string {
    return this.show?.poster_path
      ? `https://image.tmdb.org/t/p/original${this.show.poster_path}`
      : 'assets/no-image.png';
  }

  async openPoster() {
    const modal = await this.modalCtrl.create({
      component: ImageViewerComponent,
      componentProps: { src: this.fullPosterUrl, alt: this.show?.name },
    });
    await modal.present();
  }

  get backdropA(): string | null {
    // when _bgToggle is true, A is current; otherwise it's prev or current
    if (this._bgToggle) {
      return this._currentBackdrop;
    }
    return this._prevBackdrop || this._currentBackdrop;
  }

  get backdropB(): string | null {
    if (this._bgToggle) {
      return this._prevBackdrop || this._currentBackdrop;
    }
    return this._currentBackdrop;
  }

  get firstAirYear(): string {
    return this.show?.first_air_date?.substring(0, 4) || '';
  }

  get trailerKey(): string | null {
    return (
      this.videos.find((v: any) => v.type === 'Trailer')?.key ||
      this.videos[0]?.key ||
      null
    );
  }

  get cast(): any[] {
    return (this.credits?.cast || []).slice(0, 20);
  }

  get creators(): string {
    return (this.show?.created_by || []).map((c: any) => c.name).join(', ');
  }

  get creatorsWithPhotos(): any[] {
    return this.show?.created_by || [];
  }

  get genres(): string {
    return (this.show?.genres || []).map((g: any) => g.name).join(', ');
  }

  get contentRating(): string {
    const results = this.show?.content_ratings?.results || [];
    const us = results.find((r: any) => r.iso_3166_1 === 'US');
    return us?.rating || '';
  }

  get episodeRuntime(): number | null {
    const rt = this.show?.episode_run_time || [];
    return rt.length > 0 ? rt[0] : null;
  }

  get statusBadgeClass(): string {
    const s = (this.show?.status || '').toLowerCase();
    if (s.includes('returning')) {
      return 'status-returning';
    }
    if (s.includes('ended')) {
      return 'status-ended';
    }
    if (s.includes('cancel')) {
      return 'status-cancelled';
    }
    if (s.includes('planned') || s.includes('production')) {
      return 'status-planned';
    }
    return 'status-default';
  }

  openTrailer() {
    if (this.trailerKey) {
      window.open(
        `https://www.youtube.com/watch?v=${this.trailerKey}`,
        '_blank',
      );
    }
  }

  share() {
    const url = `https://www.themoviedb.org/tv/${this.show?.id}`;
    if (navigator.share) {
      navigator.share({
        title: this.show?.name,
        text: this.show?.overview,
        url,
      });
    } else {
      window.open(url, '_blank');
    }
  }

  get userRating(): number | null {
    if (!this.show) {
      return null;
    }
    return this.userData.getWatchedEntry('tv', this.show.id)?.rating ?? null;
  }

  isWatched(): boolean {
    return this.show ? this.userData.isWatched('tv', this.show.id) : false;
  }

  isLiked(): boolean {
    if (!this.show) {
      return false;
    }
    return this.userData.getWatchedEntry('tv', this.show.id)?.liked ?? false;
  }

  async openLogSheet() {
    if (!this.show) {
      return;
    }
    await this.logSheet.open({
      id: this.show.id,
      media_type: 'tv',
      title: this.show.name || '',
      poster_path: this.show.poster_path || null,
      first_air_date: this.show.first_air_date,
    });
  }

  toggleLiked() {
    if (!this.show) {
      return;
    }
    const existing = this.userData.getWatchedEntry('tv', this.show.id);
    this.userData.logEntry({
      id: this.show.id,
      media_type: 'tv',
      title: this.show.name || '',
      poster_path: this.show.poster_path || null,
      watchedAt: existing ? existing.watchedAt : null,
      dateUnknown: existing ? existing.dateUnknown : true,
      approximateDate: existing?.approximateDate ?? false,
      userEdited: true,
      rewatch: existing?.rewatch ?? false,
      rating: existing?.rating ?? null,
      review: existing?.review ?? '',
      tags: existing?.tags ?? [],
      liked: !(existing?.liked ?? false),
      first_air_date: this.show.first_air_date,
    });
  }

  async openListActionSheet() {
    if (!this.show) {
      return;
    }
    const lists = this.userData.getLists();
    const watchlistItem = this.buildWatchlistItem();
    const buttons = [
      {
        text: 'Add to Watchlist',
        icon: 'bookmark-outline',
        handler: () => {
          this.userData.addToWatchlist(watchlistItem);
          this.toast.showToast('Added to watchlist.');
        },
      },
      ...lists.map((list) => ({
        text: list.name,
        icon: 'list-outline',
        handler: () => {
          this.userData.addToList(list.id, watchlistItem);
          this.toast.showToast(`Added to "${list.name}".`);
        },
      })),
      { text: 'Cancel', role: 'cancel' },
    ];

    const sheet = await this.actionSheetCtrl.create({
      header: 'Add to list',
      buttons,
    });
    await sheet.present();
  }

  isEpisodeWatched(seasonNum: number, epNum: number): boolean {
    return this.userData.isEpisodeWatched(
      this.show?.id,
      seasonNum,
      epNum,
    );
  }

  toggleEpisode(seasonNum: number, epNum: number) {
    this.userData.toggleEpisodeWatched(this.show.id, seasonNum, epNum);
  }

  markSeasonWatched(season: any) {
    const epNums = Array.from(
      { length: season.episode_count },
      (_, i) => i + 1,
    );
    this.userData.markSeasonWatched(
      this.show.id,
      season.season_number,
      epNums,
    );
  }

  get shouldFadePoster(): boolean {
    return this.userData.getSettings().fadeWatched && this.isWatched();
  }

  // ── Lists section ─────────────────────────────────────────────────────

  toggleListBookmark(list: any) {
    if (this.userData.isListBookmarked(list.id)) {
      this.userData.unbookmarkList(list.id);
    } else {
      this.userData.bookmarkList(list);
    }
  }

  isListBookmarked(listId: number): boolean {
    return this.userData.isListBookmarked(listId);
  }

  formatCount(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
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

  private buildWatchlistItem(): Omit<WatchlistEntry, 'addedAt'> {
    return {
      id: this.show.id,
      media_type: 'tv',
      title: this.show.name || '',
      poster_path: this.show.poster_path || null,
      first_air_date: this.show.first_air_date,
    };
  }
}
