/**
 * RFC 4180-compliant streaming/in-memory CSV Parser for Open Movie Tracker.
 *
 * Supports:
 * - Multi-line quoted fields (embedded newlines)
 * - Escaped double-quotes ("")
 * - Commas inside quoted strings
 * - UTF-8 BOM (\uFEFF)
 * - CRLF (\r\n) and LF (\n) line endings
 * - Case-insensitive header matching
 * - Formula injection sanitization (leading =, +, -, @, \t, \r)
 * - Multi-table files (e.g. Letterboxd lists with v7 headers and item tables)
 */

export interface ParsedCsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

export interface LetterboxdListExport {
  metadata: {
    date?: string;
    name?: string;
    tags?: string;
    url?: string;
    description?: string;
  };
  items: Array<{
    position?: number;
    name: string;
    year?: string;
    url?: string;
    description?: string;
  }>;
}

export class CsvParser {
  /**
   * Sanitizes potential formula injection characters if present as the very first character.
   */
  public static sanitizeField(val: string): string {
    if (!val || typeof val !== 'string') {
      return '';
    }
    const trimmed = val.trim();
    if (['=', '+', '-', '@', '\t', '\r'].includes(trimmed.charAt(0))) {
      // Prefix with single quote to prevent spreadsheet execution while preserving content
      return '\'' + val;
    }
    return val;
  }

  /**
   * Cleans an ingested field: removes BOM and leading formula injection prefixes.
   */
  public static cleanIngestedField(val: string): string {
    if (!val || typeof val !== 'string') {
      return '';
    }
    let cleaned = val;
    if (cleaned.charCodeAt(0) === 0xfeff) {
      cleaned = cleaned.substring(1);
    }
    // If the imported field was escaped with a leading single quote due to formula protection
    if (cleaned.startsWith('\'=') || cleaned.startsWith('\'+') || cleaned.startsWith('\'-') || cleaned.startsWith('\'@')) {
      cleaned = cleaned.substring(1);
    }
    return cleaned;
  }

  /**
   * Parses raw CSV string into 2D array of string tokens.
   */
  public static tokenize(csvText: string): string[][] {
    if (!csvText) {
      return [];
    }

    let text = csvText;
    // Strip UTF-8 BOM if present at start
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.substring(1);
    }

    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;
    const len = text.length;

    while (i < len) {
      const char = text[i];
      const nextChar = i + 1 < len ? text[i + 1] : '';

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            // Escaped quote: "" -> "
            currentField += '"';
            i += 2;
            continue;
          } else {
            // Closing quote
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          currentField += char;
          i++;
          continue;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i++;
          continue;
        } else if (char === ',') {
          currentRow.push(CsvParser.cleanIngestedField(currentField));
          currentField = '';
          i++;
          continue;
        } else if (char === '\r') {
          if (nextChar === '\n') {
            i++; // skip \r in CRLF
          }
          currentRow.push(CsvParser.cleanIngestedField(currentField));
          currentField = '';
          rows.push(currentRow);
          currentRow = [];
          i++;
          continue;
        } else if (char === '\n') {
          currentRow.push(CsvParser.cleanIngestedField(currentField));
          currentField = '';
          rows.push(currentRow);
          currentRow = [];
          i++;
          continue;
        } else {
          currentField += char;
          i++;
          continue;
        }
      }
    }

    // Flush remaining field/row if any
    if (currentField.length > 0 || inQuotes) {
      currentRow.push(CsvParser.cleanIngestedField(currentField));
    }
    if (currentRow.length > 0) {
      // Don't add a trailing empty row if the file simply ended with newline
      if (!(currentRow.length === 1 && currentRow[0] === '')) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  /**
   * Parses standard single-table CSV into typed rows keyed by normalized header names.
   */
  public static parse(csvText: string): ParsedCsvTable {
    const rawRows = CsvParser.tokenize(csvText);
    if (!rawRows.length) {
      return { headers: [], rows: [] };
    }

    // First non-empty row is header
    let headerRowIndex = -1;
    for (let i = 0; i < rawRows.length; i++) {
      if (rawRows[i].some((cell) => cell.trim().length > 0)) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return { headers: [], rows: [] };
    }

    const headers = rawRows[headerRowIndex].map((h) => h.trim());
    const rows: Record<string, string>[] = [];

    for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
      const line = rawRows[i];
      if (!line || !line.some((c) => c.trim().length > 0)) {
        continue; // skip empty rows
      }
      const rowObj: Record<string, string> = {};
      headers.forEach((header, index) => {
        rowObj[header] = line[index] !== undefined ? line[index] : '';
        // Also add lower-cased header alias for robust lookup
        rowObj[header.toLowerCase()] = rowObj[header];
      });
      rows.push(rowObj);
    }

    return { headers, rows };
  }

  /**
   * Parses Letterboxd list export format (multi-table with header metadata and items).
   * Example:
   * Letterboxd list export v7
   * Date,Name,Tags,URL,Description
   * 2024-02-01,My List,"tag1",https://...,"My description"
   *
   * Position,Name,Year,URL,Description
   * 1,Inception,2010,https://boxd.it/1sz2,"Great film"
   */
  public static parseLetterboxdList(csvText: string): LetterboxdListExport {
    const rawRows = CsvParser.tokenize(csvText);
    const result: LetterboxdListExport = {
      metadata: {},
      items: [],
    };

    if (!rawRows.length) {
      return result;
    }

    let mode: 'preamble' | 'meta_header' | 'meta_row' | 'items_header' | 'items_rows' = 'preamble';
    let metaHeaders: string[] = [];
    let itemHeaders: string[] = [];

    for (const row of rawRows) {
      if (!row || !row.some((c) => c.trim().length > 0)) {
        continue;
      }

      const firstCell = (row[0] || '').trim();

      if (firstCell.startsWith('Letterboxd list export')) {
        mode = 'meta_header';
        continue;
      }

      if (mode === 'meta_header' || (mode === 'preamble' && (firstCell.toLowerCase() === 'date' || firstCell.toLowerCase() === 'name'))) {
        // Check if this row is the metadata header or item header
        const isItemsHeader = row.some((c) => c.trim().toLowerCase() === 'position');
        if (isItemsHeader) {
          itemHeaders = row.map((c) => c.trim().toLowerCase());
          mode = 'items_rows';
          continue;
        } else {
          metaHeaders = row.map((c) => c.trim().toLowerCase());
          mode = 'meta_row';
          continue;
        }
      }

      if (mode === 'meta_row') {
        const metaObj: Record<string, string> = {};
        metaHeaders.forEach((h, idx) => {
          metaObj[h] = row[idx] || '';
        });
        result.metadata = {
          date: metaObj.date,
          name: metaObj.name,
          tags: metaObj.tags,
          url: metaObj.url,
          description: metaObj.description,
        };
        mode = 'items_header';
        continue;
      }

      if (mode === 'items_header') {
        if (row.some((c) => c.trim().toLowerCase() === 'position' || c.trim().toLowerCase() === 'name')) {
          itemHeaders = row.map((c) => c.trim().toLowerCase());
          mode = 'items_rows';
          continue;
        }
      }

      if (mode === 'items_rows') {
        const itemObj: Record<string, string> = {};
        itemHeaders.forEach((h, idx) => {
          itemObj[h] = row[idx] || '';
        });

        const name = itemObj.name || '';
        if (name) {
          result.items.push({
            position: itemObj.position ? parseInt(itemObj.position, 10) : undefined,
            name,
            year: itemObj.year,
            url: itemObj.url,
            description: itemObj.description,
          });
        }
      }
    }

    return result;
  }

  /**
   * Generates RFC 4180-compliant CSV string from headers and objects with formula sanitization.
   */
  public static stringify(headers: string[], rows: Record<string, any>[]): string {
    const formatField = (val: any): string => {
      if (val === null || val === undefined) {
        return '';
      }
      let str = String(val);
      // Sanitize formula injection
      str = CsvParser.sanitizeField(str);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = headers.map(formatField).join(',');
    const lines = [headerLine];

    for (const row of rows) {
      const line = headers.map((h) => formatField(row[h] !== undefined ? row[h] : '')).join(',');
      lines.push(line);
    }

    return lines.join('\r\n') + '\r\n';
  }
}
