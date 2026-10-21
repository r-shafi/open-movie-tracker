import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { of } from 'rxjs';
import { CalendarDate } from 'src/app/services/calendar-date';
import { MetadataBackfillService } from 'src/app/services/metadata-backfill.service';
import { TmdbService } from 'src/app/services/tmdb.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserDataService, WatchedEntry } from 'src/app/services/user-data.service';
import { StarRatingComponent } from '../star-rating/star-rating.component';
import { QuickLogMediaItem, QuickLogModalComponent } from './quick-log-modal.component';

describe('QuickLogModalComponent', () => {
  let component: QuickLogModalComponent;
  let fixture: ComponentFixture<QuickLogModalComponent>;

  let mockModalCtrl: jasmine.SpyObj<ModalController>;
  let mockTmdb: jasmine.SpyObj<TmdbService>;
  let mockUserData: jasmine.SpyObj<UserDataService>;
  let mockBackfill: jasmine.SpyObj<MetadataBackfillService>;
  let mockToast: jasmine.SpyObj<ToastService>;

  const sampleMovie: QuickLogMediaItem = {
    id: 550,
    media_type: 'movie',
    title: 'Fight Club',
    poster_path: '/fightclub.jpg',
    release_date: '1999-10-15',
  };

  const sampleTv: QuickLogMediaItem = {
    id: 1399,
    media_type: 'tv',
    name: 'Game of Thrones',
    poster_path: '/got.jpg',
    first_air_date: '2011-04-17',
  };

  beforeEach(async () => {
    mockModalCtrl = jasmine.createSpyObj('ModalController', ['dismiss']);
    mockModalCtrl.dismiss.and.returnValue(Promise.resolve(true));

    mockTmdb = jasmine.createSpyObj('TmdbService', ['searchMulti', 'getTrendingAll']);
    mockTmdb.searchMulti.and.returnValue(
      of({
        results: [
          sampleMovie,
          sampleTv,
          { id: 999, media_type: 'person', name: 'Brad Pitt' }, // Should be filtered out
        ],
      }),
    );
    mockTmdb.getTrendingAll.and.returnValue(
      of({
        results: [sampleMovie, sampleTv],
      }),
    );

    mockUserData = jasmine.createSpyObj('UserDataService', [
      'isOnWatchlist',
      'addToWatchlist',
      'removeFromWatchlist',
      'getWatchedEntry',
      'logEntry',
      'removeWatched',
    ]);
    mockUserData.isOnWatchlist.and.returnValue(false);
    mockUserData.getWatchedEntry.and.returnValue(null);
    mockUserData.logEntry.and.callFake((entry: any) => ({
      entryId: 'entry-test-123',
      ...entry,
    } as WatchedEntry));

    mockBackfill = jasmine.createSpyObj('MetadataBackfillService', ['start']);
    mockBackfill.start.and.returnValue(Promise.resolve());

    mockToast = jasmine.createSpyObj('ToastService', ['showToast', 'showActionToast']);
    mockToast.showActionToast.and.returnValue(
      Promise.resolve({} as HTMLIonToastElement),
    );

    await TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), FormsModule],
      declarations: [QuickLogModalComponent, StarRatingComponent],
      providers: [
        { provide: ModalController, useValue: mockModalCtrl },
        { provide: TmdbService, useValue: mockTmdb },
        { provide: UserDataService, useValue: mockUserData },
        { provide: MetadataBackfillService, useValue: mockBackfill },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuickLogModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load trending items excluding non-movie/tv', () => {
    expect(component).toBeTruthy();
    expect(mockTmdb.getTrendingAll).toHaveBeenCalledWith('day');
    expect(component.trendingItems.length).toBe(2);
    expect(component.trendingItems[0].media_type).toBe('movie');
    expect(component.trendingItems[1].media_type).toBe('tv');
  });

  it('should debounce search input (300ms) and filter results to movie and tv', fakeAsync(() => {
    component.onSearchInput({ target: { value: 'Fight' } });
    expect(mockTmdb.searchMulti).not.toHaveBeenCalled();

    tick(300);
    expect(mockTmdb.searchMulti).toHaveBeenCalledWith('Fight');
    expect(component.searchResults.length).toBe(2);
    expect(component.searchResults[0].id).toBe(550);
    expect(component.searchResults[1].id).toBe(1399);
  }));

  it('should handle quick-action Watchlist with undo capability', async () => {
    const dummyEvent = new MouseEvent('click');
    spyOn(dummyEvent, 'stopPropagation');
    spyOn(dummyEvent, 'preventDefault');

    await component.quickWatchlist(sampleMovie, dummyEvent);

    expect(dummyEvent.stopPropagation).toHaveBeenCalled();
    expect(mockUserData.addToWatchlist).toHaveBeenCalledWith(
      jasmine.objectContaining({
        id: 550,
        media_type: 'movie',
        title: 'Fight Club',
      }),
    );
    expect(mockToast.showActionToast).toHaveBeenCalled();

    // Verify undo callback removes from watchlist
    const args = mockToast.showActionToast.calls.mostRecent().args;
    expect(args[1]).toBe('Undo');
    const undoCallback = args[2];
    undoCallback();
    expect(mockUserData.removeFromWatchlist).toHaveBeenCalledWith('movie', 550);
  });

  it('should handle quick-action Mark Watched with instant logging, backfill start, and undo', async () => {
    const dummyEvent = new MouseEvent('click');
    spyOn(dummyEvent, 'stopPropagation');
    spyOn(dummyEvent, 'preventDefault');

    await component.quickMarkWatched(sampleMovie, dummyEvent);

    expect(mockUserData.logEntry).toHaveBeenCalledWith(
      jasmine.objectContaining({
        id: 550,
        media_type: 'movie',
        title: 'Fight Club',
        watchedAt: CalendarDate.today(),
        dateUnknown: false,
        rating: null,
      }),
    );
    expect(mockBackfill.start).toHaveBeenCalled();
    expect(mockModalCtrl.dismiss).toHaveBeenCalled();
    expect(mockToast.showActionToast).toHaveBeenCalled();

    // Verify undo callback removes the newly logged entry
    const args = mockToast.showActionToast.calls.mostRecent().args;
    expect(args[1]).toBe('Undo');
    const undoCallback = args[2];
    undoCallback();
    expect(mockUserData.removeWatched).toHaveBeenCalledWith('movie', 550, 'entry-test-123');
  });

  it('should open compact log step when an item is selected', () => {
    component.selectItem(sampleTv);
    expect(component.selectedItem).toBe(sampleTv);
    expect(component.rating).toBeNull();
    expect(component.watchedDate).toBe(CalendarDate.today());
    expect(component.dateUnknown).toBeFalse();
  });

  it('should save full log with half-star rating, tags, and review', async () => {
    component.selectItem(sampleMovie);
    component.rating = 4.5;
    component.liked = true;
    component.rewatch = true;
    component.review = 'Incredible movie.';
    component.tags = ['classic', 'fincher'];

    await component.saveLog();

    expect(mockUserData.logEntry).toHaveBeenCalledWith(
      jasmine.objectContaining({
        id: 550,
        media_type: 'movie',
        title: 'Fight Club',
        rating: 4.5,
        liked: true,
        rewatch: true,
        review: 'Incredible movie.',
        tags: ['classic', 'fincher'],
      }),
    );
    expect(mockBackfill.start).toHaveBeenCalled();
    expect(mockModalCtrl.dismiss).toHaveBeenCalled();

    // Test undo reverts log
    const args = mockToast.showActionToast.calls.mostRecent().args;
    const undoCallback = args[2];
    undoCallback();
    expect(mockUserData.removeWatched).toHaveBeenCalledWith('movie', 550, 'entry-test-123');
  });

  it('should support Date Unknown toggle saving null watchedAt', async () => {
    component.selectItem(sampleMovie);
    component.toggleDateUnknown();
    expect(component.dateUnknown).toBeTrue();

    await component.saveLog();

    expect(mockUserData.logEntry).toHaveBeenCalledWith(
      jasmine.objectContaining({
        id: 550,
        media_type: 'movie',
        watchedAt: null,
        dateUnknown: true,
      }),
    );
  });
});
