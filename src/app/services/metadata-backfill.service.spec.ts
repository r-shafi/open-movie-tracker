import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MetadataBackfillService } from './metadata-backfill.service';
import { UserDataService } from './user-data.service';
import { TmdbService } from './tmdb.service';

describe('MetadataBackfillService', () => {
  let service: MetadataBackfillService;
  let userData: UserDataService;
  let tmdbSpy: jasmine.SpyObj<TmdbService>;

  beforeEach(() => {
    localStorage.clear();
    tmdbSpy = jasmine.createSpyObj('TmdbService', ['getMovieDetails', 'getTvDetails']);

    TestBed.configureTestingModule({
      providers: [
        MetadataBackfillService,
        UserDataService,
        { provide: TmdbService, useValue: tmdbSpy },
      ],
    });

    service = TestBed.inject(MetadataBackfillService);
    userData = TestBed.inject(UserDataService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should backfill missing snapshots for logged entries', async () => {
    // Log entry without snapshot
    userData.logEntry({
      id: 550,
      media_type: 'movie',
      title: 'Fight Club',
      poster_path: null,
      rating: 4.5,
      rewatch: false,
      review: '',
      tags: [],
      liked: true,
    });

    expect(userData.getMissingSnapshotTitles().length).toBe(1);

    tmdbSpy.getMovieDetails.and.returnValue(
      of({
        id: 550,
        title: 'Fight Club',
        runtime: 139,
        genres: [{ id: 18, name: 'Drama' }],
        release_date: '1999-10-15',
        original_language: 'en',
        vote_average: 8.4,
        poster_path: '/fightclub.jpg',
        credits: {
          crew: [{ id: 7467, name: 'David Fincher', job: 'Director' }],
          cast: [
            { id: 819, name: 'Edward Norton' },
            { id: 287, name: 'Brad Pitt' },
          ],
        },
      }),
    );

    await service.start();

    expect(userData.getMissingSnapshotTitles().length).toBe(0);
    const entry = userData.getWatchedEntry('movie', 550);
    expect(entry?.snapshot).toBeDefined();
    expect(entry?.snapshot?.runtimeMinutes).toBe(139);
    expect(entry?.snapshot?.genres?.[0].name).toBe('Drama');
    expect(entry?.snapshot?.directors?.[0].name).toBe('David Fincher');
    expect(entry?.snapshot?.topCast?.length).toBe(2);
  });
});
