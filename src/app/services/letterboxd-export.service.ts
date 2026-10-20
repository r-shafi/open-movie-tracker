import { Injectable } from '@angular/core';
import { zipSync, strToU8 } from 'fflate';
import { CsvParser } from './csv-parser';
import { UserDataService, WatchedEntry, WatchlistEntry } from './user-data.service';

@Injectable({
  providedIn: 'root',
})
export class LetterboxdExportService {
  constructor(private userData: UserDataService) {}

  public exportDiaryCsv(): string {
    const entries = this.userData.getWatchedList().filter((e) => !e.dateUnknown && e.watchedAt);
    const headers = ['Date', 'Name', 'Year', 'Letterboxd URI', 'Rating', 'Rewatch', 'Tags', 'Watched Date'];

    const rows = entries.map((e) => {
      const watchedDate = (e.watchedAt || '').split('T')[0];
      const year = e.release_date ? e.release_date.substring(0, 4) : '';
      return {
        Date: watchedDate,
        Name: e.title,
        Year: year,
        'Letterboxd URI': e.sourceKey || '',
        Rating: e.rating !== null ? e.rating.toFixed(1) : '',
        Rewatch: e.rewatch ? 'Yes' : 'No',
        Tags: (e.tags || []).join(', '),
        'Watched Date': watchedDate,
      };
    });

    return CsvParser.stringify(headers, rows);
  }

  public exportRatingsCsv(): string {
    const entries = this.userData.getWatchedList().filter((e) => e.rating !== null);
    const headers = ['Date', 'Name', 'Year', 'Letterboxd URI', 'Rating'];

    const rows = entries.map((e) => {
      const date = (e.watchedAt || new Date().toISOString()).split('T')[0];
      const year = e.release_date ? e.release_date.substring(0, 4) : '';
      return {
        Date: date,
        Name: e.title,
        Year: year,
        'Letterboxd URI': e.sourceKey || '',
        Rating: e.rating!.toFixed(1),
      };
    });

    return CsvParser.stringify(headers, rows);
  }

  public exportReviewsCsv(): string {
    const entries = this.userData.getWatchedList().filter((e) => e.review && e.review.trim().length > 0);
    const headers = ['Date', 'Name', 'Year', 'Letterboxd URI', 'Rating', 'Rewatch', 'Review', 'Tags', 'Watched Date'];

    const rows = entries.map((e) => {
      const watchedDate = (e.watchedAt || new Date().toISOString()).split('T')[0];
      const year = e.release_date ? e.release_date.substring(0, 4) : '';
      return {
        Date: watchedDate,
        Name: e.title,
        Year: year,
        'Letterboxd URI': e.sourceKey || '',
        Rating: e.rating !== null ? e.rating.toFixed(1) : '',
        Rewatch: e.rewatch ? 'Yes' : 'No',
        Review: e.review,
        Tags: (e.tags || []).join(', '),
        'Watched Date': e.dateUnknown ? '' : watchedDate,
      };
    });

    return CsvParser.stringify(headers, rows);
  }

  public exportWatchlistCsv(): string {
    const watchlist = this.userData.getWatchlist();
    const headers = ['Date', 'Name', 'Year', 'Letterboxd URI'];

    const rows = watchlist.map((item) => {
      const date = (item.addedAt || new Date().toISOString()).split('T')[0];
      const year = item.release_date ? item.release_date.substring(0, 4) : '';
      return {
        Date: date,
        Name: item.title,
        Year: year,
        'Letterboxd URI': '',
      };
    });

    return CsvParser.stringify(headers, rows);
  }

  public exportZip(): Uint8Array {
    const diaryCsv = this.exportDiaryCsv();
    const ratingsCsv = this.exportRatingsCsv();
    const reviewsCsv = this.exportReviewsCsv();
    const watchlistCsv = this.exportWatchlistCsv();

    return zipSync({
      'diary.csv': strToU8(diaryCsv),
      'ratings.csv': strToU8(ratingsCsv),
      'reviews.csv': strToU8(reviewsCsv),
      'watchlist.csv': strToU8(watchlistCsv),
    });
  }

  public downloadBlob(data: any, filename: string, mimeType: string): void {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
