import { zipSync, strToU8 } from 'fflate';
import { LetterboxdArchive } from './letterboxd-archive';

describe('LetterboxdArchive', () => {
  it('should unzip standard Letterboxd files cleanly', () => {
    const zipData = zipSync({
      'diary.csv': strToU8('Date,Name,Year\n2024-01-01,Inception,2010'),
      'reviews.csv': strToU8('Date,Name,Review\n2024-01-01,Inception,Masterpiece'),
      'likes/films.csv': strToU8('Date,Name,Year\n2024-01-01,Inception,2010'),
      'deleted/reviews.csv': strToU8('Date,Name\n2023-01-01,Old'),
      'orphaned/diary.csv': strToU8('Date,Name\n2023-01-01,Old'),
      '__MACOSX/._diary.csv': strToU8('junk'),
    });

    const result = LetterboxdArchive.unzip(zipData);
    expect(result.fileCount).toBe(3);
    expect(result.files['diary.csv']).toContain('Inception');
    expect(result.files['reviews.csv']).toContain('Masterpiece');
    expect(result.files['likes/films.csv']).toContain('Inception');
    expect(result.files['deleted/reviews.csv']).toBeUndefined();
    expect(result.files['orphaned/diary.csv']).toBeUndefined();
    expect(result.files['__macosx/._diary.csv']).toBeUndefined();
  });

  it('should strip top-level archive subfolder prefix if present', () => {
    const zipData = zipSync({
      'letterboxd-user-2024-01-01/diary.csv': strToU8('Date,Name,Year\n2024-01-01,Parasite,2019'),
      'letterboxd-user-2024-01-01/watched.csv': strToU8('Date,Name,Year\n2024-01-01,Parasite,2019'),
    });

    const result = LetterboxdArchive.unzip(zipData);
    expect(result.files['diary.csv']).toBeDefined();
    expect(result.files['diary.csv']).toContain('Parasite');
    expect(result.files['watched.csv']).toBeDefined();
  });

  it('should reject zip with directory traversal', () => {
    const zipData = zipSync({
      '../secret.txt': strToU8('malicious'),
    });

    expect(() => LetterboxdArchive.unzip(zipData)).toThrowError(/Malicious path/);
  });
});
