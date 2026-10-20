/**
 * Data seeder for visual audit and regression testing.
 * Provides 4 states: 'empty', 'light', 'heavy', 'edge'.
 */

function generateSeedData(state = 'light') {
  const now = new Date().toISOString();

  const baseProfile = {
    displayName: 'Dan Miller',
    bio: 'Film lover, physical media archivist, and 70mm enthusiast.',
    avatarBase64: null,
    coverBase64: null,
    joinedAt: '2023-01-01T00:00:00.000Z',
  };

  const defaultSettings = {
    theme: 'system',
    primaryColor: 'green',
    language: 'en-US',
    region: 'US',
    includeAdult: false,
    blockedLanguages: [],
    customLists: [],
    episodeWatched: {},
    tmdbApiKey: null,
  };

  if (state === 'empty') {
    return {
      mva_profile: baseProfile,
      mva_settings: defaultSettings,
      mva_watched: {},
      mva_watchlist: [],
      mva_favorites: [],
      mva_lists: [],
    };
  }

  if (state === 'light') {
    const watched = {
      'entry-1': {
        entryId: 'entry-1',
        id: 550,
        media_type: 'movie',
        title: 'Fight Club',
        poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
        watchedAt: '2024-01-15T20:00:00.000Z',
        dateUnknown: false,
        rewatch: false,
        rating: 4.5,
        review: 'A brilliant satire of modern consumerism and existential drift.',
        tags: ['cult', 'david fincher', 'drama'],
        liked: true,
        release_date: '1999-10-15',
        snapshot: {
          runtimeMinutes: 139,
          genres: [{ id: 18, name: 'Drama' }],
          releaseYear: 1999,
          directors: [{ id: 7467, name: 'David Fincher' }],
          topCast: [{ id: 819, name: 'Edward Norton' }, { id: 287, name: 'Brad Pitt' }],
        },
      },
      'entry-2': {
        entryId: 'entry-2',
        id: 27205,
        media_type: 'movie',
        title: 'Inception',
        poster_path: '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
        watchedAt: '2024-02-10T19:00:00.000Z',
        dateUnknown: false,
        rewatch: true,
        rating: 5.0,
        review: 'Incredible score by Hans Zimmer and flawless pacing throughout.',
        tags: ['sci-fi', 'christopher nolan', 'heist'],
        liked: true,
        release_date: '2010-07-16',
        snapshot: {
          runtimeMinutes: 148,
          genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }],
          releaseYear: 2010,
          directors: [{ id: 525, name: 'Christopher Nolan' }],
          topCast: [{ id: 6193, name: 'Leonardo DiCaprio' }],
        },
      },
      'entry-3': {
        entryId: 'entry-3',
        id: 496243,
        media_type: 'movie',
        title: 'Parasite',
        poster_path: '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
        watchedAt: '2024-03-01T21:30:00.000Z',
        dateUnknown: false,
        rewatch: false,
        rating: 5.0,
        review: 'A masterwork in structure, tone shifts, and class commentary.',
        tags: ['korean', 'thriller', 'bong joon-ho'],
        liked: true,
        release_date: '2019-05-30',
        snapshot: {
          runtimeMinutes: 132,
          genres: [{ id: 35, name: 'Comedy' }, { id: 18, name: 'Drama' }, { id: 53, name: 'Thriller' }],
          releaseYear: 2019,
          directors: [{ id: 21684, name: 'Bong Joon-ho' }],
          topCast: [{ id: 20738, name: 'Song Kang-ho' }],
        },
      },
      'entry-4': {
        entryId: 'entry-4',
        id: 1399,
        media_type: 'tv',
        title: 'Game of Thrones',
        poster_path: '/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg',
        watchedAt: '2024-03-20T18:00:00.000Z',
        dateUnknown: false,
        rewatch: false,
        rating: 4.0,
        review: 'Seasons 1-4 are peak television.',
        tags: ['fantasy', 'epic', 'hbo'],
        liked: true,
        first_air_date: '2011-04-17',
        snapshot: {
          runtimeMinutes: 60,
          genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }, { id: 18, name: 'Drama' }],
          releaseYear: 2011,
          directors: [],
          topCast: [{ id: 17286, name: 'Emilia Clarke' }],
        },
      },
      'entry-5': {
        entryId: 'entry-5',
        id: 194,
        media_type: 'movie',
        title: 'Amélie',
        poster_path: '/sl43Va5c59mMrLrmv5y5235mP1a.jpg',
        watchedAt: '2024-04-05T14:00:00.000Z',
        dateUnknown: false,
        rewatch: false,
        rating: 4.5,
        review: 'Whimsical and romantic with unforgettable cinematography.',
        tags: ['french', 'romance'],
        liked: true,
        release_date: '2001-04-25',
        snapshot: {
          runtimeMinutes: 122,
          genres: [{ id: 35, name: 'Comedy' }, { id: 10749, name: 'Romance' }],
          releaseYear: 2001,
          directors: [{ id: 578, name: 'Jean-Pierre Jeunet' }],
          topCast: [{ id: 579, name: 'Audrey Tautou' }],
        },
      },
    };

    const watchlist = [
      {
        id: 693134,
        media_type: 'movie',
        title: 'Dune: Part Two',
        poster_path: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
        addedAt: '2024-01-01T00:00:00.000Z',
        release_date: '2024-03-01',
      },
      {
        id: 872585,
        media_type: 'movie',
        title: 'Oppenheimer',
        poster_path: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
        addedAt: '2024-01-02T00:00:00.000Z',
        release_date: '2023-07-21',
      },
    ];

    const favorites = [
      { id: 27205, media_type: 'movie', title: 'Inception', poster_path: '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg' },
      { id: 496243, media_type: 'movie', title: 'Parasite', poster_path: '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg' },
    ];

    const lists = [
      {
        id: 'user-list-1',
        name: 'Neo-Noir Essentials',
        createdAt: '2024-01-01T00:00:00.000Z',
        items: [
          { id: 550, media_type: 'movie', title: 'Fight Club', poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', addedAt: now },
          { id: 27205, media_type: 'movie', title: 'Inception', poster_path: '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg', addedAt: now },
        ],
      },
    ];

    return {
      mva_profile: baseProfile,
      mva_settings: defaultSettings,
      mva_watched: watched,
      mva_watchlist: watchlist,
      mva_favorites: favorites,
      mva_lists: lists,
    };
  }

  if (state === 'heavy') {
    const genres = [
      { id: 28, name: 'Action' },
      { id: 18, name: 'Drama' },
      { id: 878, name: 'Sci-Fi' },
      { id: 53, name: 'Thriller' },
      { id: 35, name: 'Comedy' },
      { id: 27, name: 'Horror' },
    ];

    const watched = {};
    for (let i = 1; i <= 1000; i++) {
      const isMovie = i % 8 !== 0;
      const id = 10000 + i;
      const g = genres[i % genres.length];
      const rating = i % 4 === 0 ? null : (1.0 + ((i * 7) % 9) * 0.5);
      const rewatch = i % 5 === 0;
      const yr = 1960 + (i % 64);
      const month = String((i % 12) + 1).padStart(2, '0');
      const day = String((i % 28) + 1).padStart(2, '0');
      const date = `2023-${month}-${day}T12:00:00.000Z`;

      watched[`entry-${i}`] = {
        entryId: `entry-${i}`,
        id,
        media_type: isMovie ? 'movie' : 'tv',
        title: `Cinema Classic Vol. ${i}`,
        poster_path: i % 10 === 0 ? null : '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
        watchedAt: i % 25 === 0 ? null : date,
        dateUnknown: i % 25 === 0,
        rewatch,
        rating,
        review: i % 3 === 0 ? `Review for title ${i}. Engaging cinematography and performance.` : '',
        tags: ['catalog', g.name.toLowerCase()],
        liked: i % 3 === 0,
        release_date: `${yr}-06-01`,
        snapshot: {
          runtimeMinutes: 90 + (i % 90),
          genres: [g],
          releaseYear: yr,
          directors: [{ id: 100 + (i % 20), name: `Director ${1 + (i % 20)}` }],
          topCast: [{ id: 500 + (i % 30), name: `Actor ${1 + (i % 30)}` }],
        },
      };
    }

    const watchlist = [];
    for (let w = 1; w <= 50; w++) {
      watchlist.push({
        id: 20000 + w,
        media_type: 'movie',
        title: `Watchlist Title ${w}`,
        poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
        addedAt: now,
        release_date: '2024-01-01',
      });
    }

    const favorites = [
      { id: 10001, media_type: 'movie', title: 'Cinema Classic Vol. 1', poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg' },
      { id: 10002, media_type: 'movie', title: 'Cinema Classic Vol. 2', poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg' },
      { id: 10003, media_type: 'movie', title: 'Cinema Classic Vol. 3', poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg' },
      { id: 10004, media_type: 'movie', title: 'Cinema Classic Vol. 4', poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg' },
    ];

    const lists = [
      {
        id: 'heavy-list-1',
        name: 'Curated 100',
        createdAt: now,
        items: Array.from({ length: 50 }, (_, idx) => ({
          id: 10001 + idx,
          media_type: 'movie',
          title: `Cinema Classic Vol. ${idx + 1}`,
          poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
          addedAt: now,
        })),
      },
    ];

    return {
      mva_profile: baseProfile,
      mva_settings: defaultSettings,
      mva_watched: watched,
      mva_watchlist: watchlist,
      mva_favorites: favorites,
      mva_lists: lists,
    };
  }

  if (state === 'edge') {
    const longTitle = 'The Chronological Chronicles of a Very Long Film Title with Multiple Subtitles: Part IX - Extended Edition (Special Director’s Cut with Commentary)';
    const longReview = 'This is an exceptionally long review intended to test typography, line height, word wrapping, scrolling behavior, and container constraints across all phone, tablet, and desktop viewports.\n\n'.repeat(15);
    const unicodeTitle = 'Съешь же ещё этих мягких французских булок, да выпей чаю · 英雄 · 千と千尋の神隠し';

    const watched = {
      'edge-1': {
        entryId: 'edge-1',
        id: 99901,
        media_type: 'movie',
        title: longTitle,
        poster_path: null, // missing poster fallback
        watchedAt: '2024-01-01T00:00:00.000Z',
        dateUnknown: false,
        rewatch: true,
        rating: 5.0,
        review: longReview,
        tags: ['extremely-long-tag-name-that-should-not-overflow-its-container-boundary', 'tag2', 'tag3'],
        liked: true,
        release_date: '2024-01-01',
      },
      'edge-2': {
        entryId: 'edge-2',
        id: 99902,
        media_type: 'movie',
        title: unicodeTitle,
        poster_path: null,
        watchedAt: null, // date unknown
        dateUnknown: true,
        rewatch: false,
        rating: null, // unrated
        review: '',
        tags: [],
        liked: false,
      },
    };

    return {
      mva_profile: {
        displayName: 'Dr. Extremely Long Display Name The Third of Valhalla-Upon-Avon',
        bio: 'A bio that goes on and on and on to verify that bio text truncation or wrapping handles extended text gracefully without blowing up the profile header layout.',
        avatarBase64: null,
        coverBase64: null,
        joinedAt: '2020-01-01T00:00:00.000Z',
      },
      mva_settings: defaultSettings,
      mva_watched: watched,
      mva_watchlist: [{ id: 99901, media_type: 'movie', title: longTitle, poster_path: null, addedAt: now }],
      mva_favorites: [{ id: 99901, media_type: 'movie', title: longTitle, poster_path: null }],
      mva_lists: [],
    };
  }

  return {};
}

module.exports = { generateSeedData };
