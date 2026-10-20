import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ActionSheetController, ModalController } from '@ionic/angular';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ImageViewerComponent } from '../shared-module/image-viewer/image-viewer.component';
import { LogSheetService } from '../shared-module/log-sheet/log-sheet.service';
import { TmdbService } from '../services/tmdb.service';
import { ToastService } from '../services/toast.service';
import { UserDataService, WatchlistEntry } from '../services/user-data.service';

@Component({
    selector: 'app-film',
    templateUrl: './film.page.html',
    styleUrls: ['./film.page.scss'],
    standalone: false
})
export class FilmPage implements OnInit {
  movie: any;
  credits: any;
  videos: any[] = [];
  images: any[] = [];
  private _slideshowIndex = 0;
  private _slideshowTimer: any = null;
  private _slideshowInterval = 5000;
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
      movie: this.tmdb.getMovie(id),
      credits: this.tmdb.getMovieCredits(id),
      videos: this.tmdb.getMovieVideos(id),
      images: this.tmdb.getMovieImages(id),
      similar: this.tmdb.getMovieSimilar(id),
      recommendations: this.tmdb.getMovieRecommendations(id),
      reviews: this.tmdb.getMovieReviews(id),
      lists: this.tmdb.getMovieLists(id).pipe(catchError(() => of({ results: [], total_results: 0 }))),
    }).subscribe({
      next: (data: any) => {
        this.movie = data.movie;
        this.credits = data.credits;
        this.videos = (data.videos?.results || []).filter(
          (v: any) => v.site === 'YouTube',
        );
        this.images = (data.images?.backdrops || []).slice(0, 20);
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
          media_type: 'movie',
        }));
        this.recommendations = (data.recommendations?.results || []).map(
          (i: any) => ({ ...i, media_type: 'movie' }),
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
        const local = this.userData.getWatchedEntry('movie', id);
        if (local) {
          this.movie = {
            id: local.id,
            title: local.title,
            poster_path: local.poster_path,
            release_date: local.release_date || (local.snapshot?.releaseYear ? `${local.snapshot.releaseYear}-01-01` : ''),
            runtime: local.snapshot?.runtimeMinutes,
            genres: local.snapshot?.genres || (local.tags || []).map((t, idx) => ({ id: idx, name: t })),
            overview: local.review ? `Your Logged Review: ${local.review}` : '',
            vote_average: local.snapshot?.tmdbVoteAverage || (local.rating ? local.rating * 2 : undefined),
            status: 'Released',
          };
          if (local.snapshot?.directors || local.snapshot?.topCast) {
            this.credits = {
              cast: local.snapshot?.topCast || [],
              crew: local.snapshot?.directors?.map((d) => ({ name: d.name, job: 'Director' })) || [],
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
    if (this.movie?.backdrop_path) {
      return this._buildImageUrl(this.movie.backdrop_path, 'auto');
    }
    return '';
  }

  private _preferredSize(): string {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 360;
    const needed = Math.ceil(vw * dpr);

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
    return this.movie?.poster_path
      ? `https://image.tmdb.org/t/p/w342${this.movie.poster_path}`
      : 'assets/no-image.png';
  }

  get fullPosterUrl(): string {
    return this.movie?.poster_path
      ? `https://image.tmdb.org/t/p/original${this.movie.poster_path}`
      : 'assets/no-image.png';
  }

  async openPoster() {
    const modal = await this.modalCtrl.create({
      component: ImageViewerComponent,
      componentProps: { src: this.fullPosterUrl, alt: this.movie?.title },
    });
    await modal.present();
  }

  get backdropA(): string | null {
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

  get runtimeDisplay(): string {
    if (!this.movie?.runtime) return '';
    const h = Math.floor(this.movie.runtime / 60);
    const m = this.movie.runtime % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  get year(): string {
    return this.movie?.release_date?.substring(0, 4) || '';
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

  get crewDirectors(): any[] {
    return (this.credits?.crew || []).filter((c: any) => c.job === 'Director');
  }

  get contentRating(): string {
    const results = this.movie?.release_dates?.results || [];
    const us = results.find((r: any) => r.iso_3166_1 === 'US');
    const releaseDates = us?.release_dates || [];
    const rated = releaseDates.find((rd: any) => rd.certification);
    return rated?.certification || '';
  }

  get statusBadgeClass(): string {
    const s = (this.movie?.status || '').toLowerCase();
    if (s.includes('released')) {
      return 'status-released';
    }
    if (s.includes('production')) {
      return 'status-production';
    }
    if (s.includes('planned')) {
      return 'status-planned';
    }
    if (s.includes('cancel')) {
      return 'status-cancelled';
    }
    return 'status-default';
  }

  get userRating(): number | null {
    if (!this.movie) {
      return null;
    }
    return this.userData.getWatchedEntry('movie', this.movie.id)?.rating ?? null;
  }

  isWatched(): boolean {
    return this.movie ? this.userData.isWatched('movie', this.movie.id) : false;
  }

  isLiked(): boolean {
    if (!this.movie) {
      return false;
    }
    return this.userData.getWatchedEntry('movie', this.movie.id)?.liked ?? false;
  }

  async openLogSheet() {
    if (!this.movie) {
      return;
    }
    await this.logSheet.open({
      id: this.movie.id,
      media_type: 'movie',
      title: this.movie.title || '',
      poster_path: this.movie.poster_path || null,
      release_date: this.movie.release_date,
    });
  }

  toggleLiked() {
    if (!this.movie) {
      return;
    }
    const existing = this.userData.getWatchedEntry('movie', this.movie.id);
    this.userData.logEntry({
      id: this.movie.id,
      media_type: 'movie',
      title: this.movie.title || '',
      poster_path: this.movie.poster_path || null,
      watchedAt: existing?.watchedAt || new Date().toISOString(),
      rewatch: existing?.rewatch ?? false,
      rating: existing?.rating ?? null,
      review: existing?.review ?? '',
      tags: existing?.tags ?? [],
      liked: !(existing?.liked ?? false),
      release_date: this.movie.release_date,
    });
  }

  async openListActionSheet() {
    if (!this.movie) {
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

  openTrailer() {
    if (this.trailerKey) {
      window.open(
        `https://www.youtube.com/watch?v=${this.trailerKey}`,
        '_blank',
      );
    }
  }

  share() {
    const url = `https://www.themoviedb.org/movie/${this.movie?.id}`;
    if (navigator.share) {
      navigator.share({
        title: this.movie?.title,
        text: this.movie?.overview,
        url,
      });
    } else {
      window.open(url, '_blank');
    }
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
      id: this.movie.id,
      media_type: 'movie',
      title: this.movie.title || '',
      poster_path: this.movie.poster_path || null,
      release_date: this.movie.release_date,
    };
  }
}
