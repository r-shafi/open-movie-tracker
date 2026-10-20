import { unzipSync } from 'fflate';

export interface UnzippedArchiveResult {
  files: Record<string, string>;
  totalBytes: number;
  fileCount: number;
}

export class LetterboxdArchive {
  public static readonly MAX_ARCHIVE_BYTES = 50 * 1024 * 1024; // 50 MB
  public static readonly MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024; // 100 MB
  public static readonly MAX_FILE_COUNT = 500;

  /**
   * Unzips a Letterboxd .zip file safely in-memory with zip-bomb safeguards.
   */
  public static unzip(zipBuffer: Uint8Array): UnzippedArchiveResult {
    if (zipBuffer.byteLength > this.MAX_ARCHIVE_BYTES) {
      throw new Error(`Zip archive exceeds maximum allowed size of 50 MB (${Math.round(zipBuffer.byteLength / 1024 / 1024)} MB)`);
    }

    const unzipped = unzipSync(zipBuffer);
    const filenames = Object.keys(unzipped);

    if (filenames.length > this.MAX_FILE_COUNT) {
      throw new Error(`Zip archive contains too many files (${filenames.length} > ${this.MAX_FILE_COUNT})`);
    }

    let totalBytes = 0;
    const files: Record<string, string> = {};
    const textDecoder = new TextDecoder('utf-8');

    for (const rawName of filenames) {
      // Normalize slashes
      const normalizedPath = rawName.replace(/\\/g, '/');

      // Security check: Directory traversal
      if (normalizedPath.includes('../') || normalizedPath.startsWith('/')) {
        throw new Error(`Malicious path detected in archive: ${normalizedPath}`);
      }

      // Ignore macOS metadata and directories
      if (normalizedPath.startsWith('__MACOSX/') || normalizedPath.endsWith('/') || normalizedPath.includes('.DS_Store')) {
        continue;
      }

      // Ignore deleted and orphaned folders from Letterboxd exports
      if (normalizedPath.startsWith('deleted/') || normalizedPath.startsWith('orphaned/')) {
        continue;
      }

      const fileData = unzipped[rawName];
      totalBytes += fileData.byteLength;

      if (totalBytes > this.MAX_UNCOMPRESSED_BYTES) {
        throw new Error('Uncompressed archive size exceeds maximum limit of 100 MB');
      }

      // Convert to string
      const content = textDecoder.decode(fileData);

      // Extract clean relative name, e.g. "likes/films.csv" or "diary.csv" or "lists/my-list.csv"
      // Letterboxd zip might put files in a subfolder like "letterboxd-username-2024-01-01/diary.csv"
      let cleanKey = normalizedPath;
      const parts = normalizedPath.split('/');
      if (parts.length > 1 && !['likes', 'lists'].includes(parts[0])) {
        // Strip top-level export folder if present
        cleanKey = parts.slice(1).join('/');
      }

      files[cleanKey.toLowerCase()] = content;
    }

    return {
      files,
      totalBytes,
      fileCount: Object.keys(files).length,
    };
  }

  /**
   * Reads individually selected File objects (multi-CSV selection) into a map.
   */
  public static async readFiles(fileList: FileList | File[]): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    const array = Array.from(fileList);

    for (const file of array) {
      // Security check on filename
      if (file.name.includes('..')) {
        continue;
      }
      if (!file.name.toLowerCase().endsWith('.csv')) {
        continue;
      }
      const text = await file.text();
      let key = file.name.toLowerCase();
      // If user uploaded likes_films.csv or likes-films.csv or films.csv
      if (key === 'films.csv') {
        key = 'likes/films.csv';
      }
      files[key] = text;
    }

    return files;
  }
}
