import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { InfiniteScrollCustomEvent, IonContent } from '@ionic/angular';
import { TmdbService } from '../services/tmdb.service';
import { UserDataService } from '../services/user-data.service';

@Component({
  selector: 'app-list-detail',
  templateUrl: './list-detail.page.html',
  styleUrls: ['./list-detail.page.scss'],
  standalone: false,
})
export class ListDetailPage implements OnInit {
  @ViewChild(IonContent) private content!: IonContent;

  list: any = null;
  allItems: any[] = [];
  currentTmdbPage = 1;
  totalTmdbPages = 1;
  totalItemCount = 0;
  isLoading = true;
  isLoadingMore = false;
  coverPosters: string[] = [];
  isLocalList = false;
  private savedScrollY = 0;
  private hasRestoredScroll = false;

  constructor(
    private route: ActivatedRoute,
    private tmdb: TmdbService,
    private userData: UserDataService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadList(id);
  }

  ionViewDidEnter() {
    // When coming back from an item details page, attempt to restore scroll.
    if (this.list) {
      // slight delay to ensure DOM/content rendered
      setTimeout(() => this.restoreScrollState(), 50);
    }
  }

  ionViewWillLeave() {
    if (this.list) {
      this.userData.saveListScrollState(this.list.id, {
        scrollY: this.savedScrollY,
        tmdbPage: this.currentTmdbPage,
      });
    }
  }

  get hasMore(): boolean {
    if (this.isLocalList) {
      return false;
    }
    return (
      this.currentTmdbPage < this.totalTmdbPages &&
      this.allItems.length < this.totalItemCount
    );
  }

  get isBookmarked(): boolean {
    return this.list && !this.isLocalList ? this.userData.isListBookmarked(this.list.id) : false;
  }

  toggleBookmark() {
    if (!this.list || this.isLocalList) return;
    if (this.isBookmarked) {
      this.userData.unbookmarkList(this.list.id);
    } else {
      this.userData.bookmarkList(this.list);
    }
  }

  onScroll(event: any) {
    this.savedScrollY = event.detail.scrollTop;
  }

  private loadList(id: string) {
    this.isLoading = true;
    this.hasRestoredScroll = false;
    this.currentTmdbPage = 1;
    this.allItems = [];

    const localList = this.userData.getList(id);
    if (localList) {
      this.isLocalList = true;
      this.list = {
        id: localList.id,
        name: localList.name,
        description: localList.description,
        item_count: localList.items.length,
        favorite_count: 0,
        created_by: { username: this.userData.getProfile().displayName || 'You' },
      };
      this.totalTmdbPages = 1;
      this.totalItemCount = localList.items.length;
      this.appendItems(localList.items || []);
      this.buildCoverPosters({ items: localList.items });
      this.isLoading = false;
      return;
    }

    this.isLocalList = false;
    this.tmdb.getListDetail(id, 1).subscribe({
      next: (data: any) => {
        this.list = { ...data, items: undefined };
        this.totalTmdbPages = data.total_pages || 1;
        this.totalItemCount = data.total_results || (data.items || []).length;

        this.appendItems(data.items || []);
        this.buildCoverPosters(data);
        this.isLoading = false;
        this.userData.recordListView(data);
        this.restoreScrollState();
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private restoreScrollState() {
    if (this.hasRestoredScroll) return;
    const id = this.list?.id;
    if (!id) return;
    const saved = this.userData.getListScrollState(id);
    if (!saved) return;
    this.userData.clearListScrollState(id);
    this.hasRestoredScroll = true;

    if (saved.tmdbPage > this.currentTmdbPage) {
      this.fetchPagesUpTo(saved.tmdbPage, () => {
        this.scrollTo(saved.scrollY);
      });
    } else {
      this.scrollTo(saved.scrollY);
    }
  }

  private scrollTo(y: number) {
    requestAnimationFrame(() => {
      this.content.scrollToPoint(0, y, 0);
    });
  }

  private fetchPagesUpTo(targetPage: number, onDone: () => void) {
    if (
      this.currentTmdbPage >= targetPage ||
      this.currentTmdbPage >= this.totalTmdbPages
    ) {
      onDone();
      return;
    }
    this.currentTmdbPage++;
    this.tmdb.getListDetail(this.list.id, this.currentTmdbPage).subscribe({
      next: (data: any) => {
        this.appendItems(data.items || []);
        this.fetchPagesUpTo(targetPage, onDone);
      },
      error: () => onDone(),
    });
  }

  loadMore(event: InfiniteScrollCustomEvent) {
    if (!this.hasMore || this.isLoadingMore) {
      event.target.complete();
      return;
    }

    this.isLoadingMore = true;
    this.currentTmdbPage++;
    this.tmdb.getListDetail(this.list.id, this.currentTmdbPage).subscribe({
      next: (data: any) => {
        this.appendItems(data.items || []);
        this.isLoadingMore = false;
        event.target.complete();

        if (!this.hasMore) {
          event.target.disabled = true;
        }
      },
      error: () => {
        this.isLoadingMore = false;
        event.target.complete();
      },
    });
  }

  private appendItems(newItems: any[]) {
    const unique = newItems.filter(
      (ni: any) =>
        !this.allItems.some(
          (oi) => oi.id === ni.id && oi.media_type === ni.media_type,
        ),
    );
    this.allItems = [...this.allItems, ...unique];
  }

  private buildCoverPosters(data: any) {
    if (data.poster_path) {
      this.coverPosters = [
        `https://image.tmdb.org/t/p/w342${data.poster_path}`,
      ];
      return;
    }
    const posters = (data.items || [])
      .filter((i: any) => i.poster_path)
      .slice(0, 4)
      .map((i: any) => `https://image.tmdb.org/t/p/w154${i.poster_path}`);
    this.coverPosters = posters;
  }

  // ensure we reset restore state when loading a new list

  formatCount(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  get placeholderSlots(): number[] {
    const count = 4 - this.coverPosters.length;
    return count > 0 ? Array(count).fill(0) : [];
  }
}
