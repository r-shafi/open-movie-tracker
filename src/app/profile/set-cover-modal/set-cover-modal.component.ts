import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { ModalController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { TmdbService } from 'src/app/services/tmdb.service';
import { ToastService } from 'src/app/services/toast.service';
import {
  FavoriteEntry,
  UserDataService,
  WatchedEntry,
} from 'src/app/services/user-data.service';

export interface BackdropCandidate {
  file_path: string;
  vote_average?: number;
  width?: number;
  height?: number;
  aspect_ratio?: number;
}

@Component({
  selector: 'app-set-cover-modal',
  templateUrl: './set-cover-modal.component.html',
  styleUrls: ['./set-cover-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SetCoverModalComponent implements OnInit {
  selectedTitle: { id: number; media_type: 'movie' | 'tv'; title: string } | null = null;
  searchQuery = '';
  backdrops: BackdropCandidate[] = [];
  isLoading = false;
  favorites: FavoriteEntry[] = [];
  recentWatched: WatchedEntry[] = [];
  searchResults: Array<{ id: number; media_type: 'movie' | 'tv'; title: string; poster_path: string | null }> = [];

  constructor(
    private modalCtrl: ModalController,
    private userData: UserDataService,
    private tmdb: TmdbService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.favorites = this.userData.getFavorites();
    const watched = this.userData.getWatchedList();
    this.recentWatched = watched.slice(0, 8);
  }

  get currentCover() {
    return this.userData.getSettings().customCover;
  }

  async selectMedia(media: { id: number; media_type: 'movie' | 'tv'; title: string }): Promise<void> {
    this.selectedTitle = media;
    this.isLoading = true;
    this.backdrops = [];
    this.cdr.markForCheck();

    try {
      let res: any;
      if (media.media_type === 'movie') {
        res = await firstValueFrom(this.tmdb.getMovieImages(media.id));
      } else {
        res = await firstValueFrom(this.tmdb.getTvImages(media.id));
      }

      const rawBackdrops: BackdropCandidate[] = res?.backdrops || [];
      // Filter out low quality and prefer language-neutral
      this.backdrops = rawBackdrops.slice(0, 18);
    } catch {
      this.toast.showToast('Could not load images for this title.');
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  onSearchChange(): void {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      this.searchResults = [];
      this.cdr.markForCheck();
      return;
    }

    const watched = this.userData.getWatchedList();
    const matches = watched
      .filter((e) => e.title.toLowerCase().includes(q))
      .slice(0, 10)
      .map((e) => ({
        id: e.id,
        media_type: e.media_type,
        title: e.title,
        poster_path: e.poster_path,
      }));

    this.searchResults = matches;
    this.cdr.markForCheck();
  }

  chooseBackdrop(backdrop: BackdropCandidate): void {
    if (!this.selectedTitle) return;

    this.userData.saveSetting('customCover', {
      mediaType: this.selectedTitle.media_type,
      id: this.selectedTitle.id,
      backdropPath: backdrop.file_path,
      title: this.selectedTitle.title,
    });

    // Cache image in browser for offline resilience
    const img = new Image();
    img.src = `https://image.tmdb.org/t/p/w1280${backdrop.file_path}`;

    this.toast.showToast('Profile cover updated.');
    this.modalCtrl.dismiss({ updated: true });
  }

  resetToDefault(): void {
    this.userData.saveSetting('customCover', null);
    this.toast.showToast('Reset to default favorite cover.');
    this.modalCtrl.dismiss({ updated: true });
  }

  dismiss(): void {
    this.modalCtrl.dismiss();
  }

  backToSelection(): void {
    this.selectedTitle = null;
    this.backdrops = [];
    this.cdr.markForCheck();
  }
}
