const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = '/home/usign/.temp/open-movie-tracker/tests/fixtures';

function createSyntheticProfile(backfillRatio = 1.0) {
  const directors = [
    { id: 2636, name: 'Alfred Hitchcock', targetCount: 22 },
    { id: 488, name: 'Steven Spielberg', targetCount: 18 },
    { id: 1032, name: 'Martin Scorsese', targetCount: 15 },
    { id: 525, name: 'Christopher Nolan', targetCount: 12 },
    { id: 138, name: 'Quentin Tarantino', targetCount: 9 },
    { id: 608, name: 'Hayao Miyazaki', targetCount: 8 },
    { id: 21684, name: 'Bong Joon-ho', targetCount: 7 },
    { id: 137427, name: 'Denis Villeneuve', targetCount: 6 },
    { id: 45400, name: 'Greta Gerwig', targetCount: 5 },
    { id: 10828, name: 'Guillermo del Toro', targetCount: 4 },
    { id: 5655, name: 'Wes Anderson', targetCount: 3 }, // 3 films! Not in top 10!
  ];

  const actors = [
    { id: 6193, name: 'Leonardo DiCaprio', targetCount: 14 },
    { id: 380, name: 'Robert De Niro', targetCount: 12 },
    { id: 287, name: 'Brad Pitt', targetCount: 10 },
    { id: 3894, name: 'Christian Bale', targetCount: 8 },
    { id: 3063, name: 'Tilda Swinton', targetCount: 7 },
  ];

  const genresList = [
    { id: 18, name: 'Drama' },
    { id: 28, name: 'Action' },
    { id: 35, name: 'Comedy' },
    { id: 878, name: 'Science Fiction' },
    { id: 53, name: 'Thriller' },
    { id: 16, name: 'Animation' },
    { id: 27, name: 'Horror' },
  ];

  // Language distribution totaling 1000:
  // en: 650, fr: 120, ja: 90, ko: 60, es: 50, de: 30
  const languagesPlan = [
    ...Array(650).fill({ lang: 'en', country: 'US' }),
    ...Array(120).fill({ lang: 'fr', country: 'FR' }),
    ...Array(90).fill({ lang: 'ja', country: 'JP' }),
    ...Array(60).fill({ lang: 'ko', country: 'KR' }),
    ...Array(50).fill({ lang: 'es', country: 'ES' }),
    ...Array(30).fill({ lang: 'de', country: 'DE' }),
  ];

  // Specific assignment for Wes Anderson films to appear early (indices 0, 10, 20)
  // so that in the 30% sample (first 300 entries), Wes Anderson has 3 films,
  // while other directors have fewer or dispersed counts!
  const directorAssignments = {};
  directors.forEach((d) => {
    directorAssignments[d.id] = 0;
  });

  const actorAssignments = {};
  actors.forEach((a) => {
    actorAssignments[a.id] = 0;
  });

  const watched = {};
  const entriesList = [];

  for (let i = 0; i < 1000; i++) {
    const entryId = `entry-${i + 1}`;
    // 850 movies, 150 TV shows
    // Shared numeric IDs: i=0 is movie 1399, i=1 is TV 1399; i=2 is movie 603, i=3 is TV 603; i=4 is movie 1400, i=5 is TV 1400
    let id;
    let mediaType;

    if (i === 0) {
      id = 1399;
      mediaType = 'movie';
    } else if (i === 1) {
      id = 1399;
      mediaType = 'tv';
    } else if (i === 2) {
      id = 603;
      mediaType = 'movie';
    } else if (i === 3) {
      id = 603;
      mediaType = 'tv';
    } else if (i === 4) {
      id = 1400;
      mediaType = 'movie';
    } else if (i === 5) {
      id = 1400;
      mediaType = 'tv';
    } else {
      id = 10000 + i;
      mediaType = (i % 7 === 0 && i > 150) ? 'tv' : (i < 150 && i % 2 !== 0 ? 'tv' : 'movie');
    }

    const langInfo = languagesPlan[i];
    const isRewatch = i % 7 === 0; // ~142 rewatches
    const rating = (i % 5 === 0) ? null : Number((1.5 + ((i * 3) % 8) * 0.5).toFixed(1));
    const yr = 1950 + (i % 75);
    const m = String((i % 12) + 1).padStart(2, '0');
    const d = String((i % 28) + 1).padStart(2, '0');
    const watchedAt = (i % 30 === 0) ? null : `2023-${m}-${d}T14:00:00.000Z`;
    const dateUnknown = watchedAt === null;

    // Director assignment
    let itemDirectors = [];
    if (i === 0 || i === 10 || i === 20) {
      // Wes Anderson's 3 films are placed at indices 0, 10, 20
      itemDirectors = [{ id: 5655, name: 'Wes Anderson' }];
      directorAssignments[5655]++;
    } else {
      for (const dObj of directors) {
        if (dObj.id === 5655) continue;
        if (directorAssignments[dObj.id] < dObj.targetCount) {
          // Spread them across the 1000 items
          const spacing = Math.floor(1000 / dObj.targetCount);
          const currentCount = directorAssignments[dObj.id];
          if (i >= currentCount * spacing) {
            itemDirectors = [{ id: dObj.id, name: dObj.name }];
            directorAssignments[dObj.id]++;
            break;
          }
        }
      }
    }
    if (itemDirectors.length === 0) {
      itemDirectors = [{ id: 90000 + (i % 400), name: `Independent Director ${i % 400}` }];
    }

    // Actor assignment
    let itemCast = [];
    for (const aObj of actors) {
      if (actorAssignments[aObj.id] < aObj.targetCount) {
        const spacing = Math.floor(1000 / aObj.targetCount);
        const currentCount = actorAssignments[aObj.id];
        if (i >= currentCount * spacing) {
          itemCast.push({ id: aObj.id, name: aObj.name });
          actorAssignments[aObj.id]++;
          break;
        }
      }
    }
    if (itemCast.length === 0) {
      itemCast = [{ id: 80000 + (i % 500), name: `Supporting Actor ${i % 500}` }];
    }

    const genre = genresList[i % genresList.length];
    const runtimeMinutes = 85 + (i % 80);

    const snapshot = {
      runtimeMinutes,
      genres: [genre],
      releaseYear: yr,
      releaseDate: `${yr}-05-01`,
      originalLanguage: langInfo.lang,
      productionCountries: [langInfo.country],
      directors: itemDirectors,
      topCast: itemCast,
      tmdbVoteAverage: 7.2,
      posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
      backdropPath: '/fOy2JurzKANt6Bz7WJm212529.jpg',
    };

    const isBackfilled = i < Math.floor(1000 * backfillRatio);

    const entry = {
      entryId,
      id,
      media_type: mediaType,
      title: `${itemDirectors[0].name} Film ${i + 1}`,
      poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
      watchedAt,
      dateUnknown,
      approximateDate: false,
      rewatch: isRewatch,
      rating,
      review: (i % 4 === 0) ? `Thoughtful review for film ${i + 1}.` : '',
      tags: ['catalog', genre.name.toLowerCase()],
      liked: (i % 3 === 0),
      release_date: `${yr}-05-01`,
      snapshot: isBackfilled ? snapshot : undefined,
    };

    watched[entryId] = entry;
    entriesList.push(entry);
  }

  const profile = {
    displayName: 'Shafi Emojipedia',
    bio: 'Cinema enthusiast with 1,000 films logged.',
    avatarBase64: null,
    coverBase64: null,
    joinedAt: '2023-01-01T00:00:00.000Z',
  };

  const settings = {
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

  const favorites = [
    { id: 1399, media_type: 'movie', title: 'Top Favorite Movie', poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', backdrop_path: '/fOy2JurzKANt6Bz7WJm212529.jpg' },
    { id: 603, media_type: 'movie', title: 'Second Favorite Movie', poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg' },
  ];

  return {
    mva_profile: profile,
    mva_settings: settings,
    mva_watched: watched,
    mva_watchlist: [
      { id: 99001, media_type: 'movie', title: 'Watchlist Film 1', poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', addedAt: '2024-01-01T00:00:00.000Z' },
    ],
    mva_favorites: favorites,
    mva_lists: [
      {
        id: 'list-1',
        name: 'Criterion Collection Picks',
        description: 'Selected masterworks',
        createdAt: '2024-01-01T00:00:00.000Z',
        items: [
          { id: 1399, media_type: 'movie', title: 'Top Favorite Movie', poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg' },
          { id: 603, media_type: 'movie', title: 'Second Favorite Movie', poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg' },
        ],
      },
    ],
    _entriesList: entriesList,
  };
}

function calculateExpectedStats(entriesList, isFullCoverage) {
  const totalWatched = entriesList.length;
  const totalMovies = entriesList.filter(e => e.media_type === 'movie').length;
  const totalTv = entriesList.filter(e => e.media_type === 'tv').length;
  const rewatches = entriesList.filter(e => e.rewatch).length;
  const likedCount = entriesList.filter(e => e.liked).length;
  const rated = entriesList.filter(e => typeof e.rating === 'number');
  const avgRating = rated.length ? Number((rated.reduce((sum, e) => sum + e.rating, 0) / rated.length).toFixed(2)) : null;

  // Enriched only stats:
  const enriched = entriesList.filter(e => e.snapshot);
  const langCounts = {};
  const directorCounts = {};

  enriched.forEach(e => {
    if (e.snapshot.originalLanguage) {
      langCounts[e.snapshot.originalLanguage] = (langCounts[e.snapshot.originalLanguage] || 0) + 1;
    }
    e.snapshot.directors.forEach(d => {
      directorCounts[d.name] = (directorCounts[d.name] || 0) + 1;
    });
  });

  return {
    totalWatched,
    totalMovies,
    totalTv,
    rewatches,
    likedCount,
    averageRating: avgRating,
    enrichedCount: enriched.length,
    langCounts,
    topDirectors: Object.entries(directorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}

function main() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  const fullData = createSyntheticProfile(1.0);
  const partialData = createSyntheticProfile(0.3);

  const fullExpected = calculateExpectedStats(fullData._entriesList, true);
  const partialExpected = calculateExpectedStats(partialData._entriesList, false);

  delete fullData._entriesList;
  delete partialData._entriesList;

  fs.writeFileSync(
    path.join(FIXTURES_DIR, 'synthetic-1000-profile.json'),
    JSON.stringify(fullData, null, 2)
  );

  fs.writeFileSync(
    path.join(FIXTURES_DIR, 'synthetic-30pct-profile.json'),
    JSON.stringify(partialData, null, 2)
  );

  fs.writeFileSync(
    path.join(FIXTURES_DIR, 'synthetic-expected-stats.json'),
    JSON.stringify({ fullExpected, partialExpected }, null, 2)
  );

  console.log('Generated synthetic fixtures and expected stats successfully.');
}

main();
