import { CsvParser } from './csv-parser';

describe('CsvParser', () => {
  it('should parse basic CSV with commas and quotes', () => {
    const csv = 'Date,Name,Year\n2024-01-01,Inception,2010\n2024-01-02,Parasite,2019';
    const parsed = CsvParser.parse(csv);
    expect(parsed.headers).toEqual(['Date', 'Name', 'Year']);
    expect(parsed.rows.length).toBe(2);
    expect(parsed.rows[0].Name).toBe('Inception');
    expect(parsed.rows[0].year).toBe('2010'); // case-insensitive alias
    expect(parsed.rows[1].Name).toBe('Parasite');
  });

  it('should handle multi-line fields inside quotes', () => {
    const csv = `Date,Name,Review\n2024-01-01,Inception,"Line 1 of review\nLine 2 with comma, and text\nLine 3"`;
    const parsed = CsvParser.parse(csv);
    expect(parsed.rows.length).toBe(1);
    expect(parsed.rows[0].Name).toBe('Inception');
    expect(parsed.rows[0].Review).toBe('Line 1 of review\nLine 2 with comma, and text\nLine 3');
  });

  it('should handle escaped double quotes ("")', () => {
    const csv = `Name,Review\nEEAAO,"He said, ""In another life, I would have liked laundry and taxes."""`;
    const parsed = CsvParser.parse(csv);
    expect(parsed.rows.length).toBe(1);
    expect(parsed.rows[0].Review).toBe('He said, "In another life, I would have liked laundry and taxes."');
  });

  it('should strip UTF-8 BOM and handle CRLF line endings', () => {
    const csv = '\uFEFFDate,Name,Year\r\n2024-01-01,Amélie,2001\r\n';
    const parsed = CsvParser.parse(csv);
    expect(parsed.headers[0]).toBe('Date');
    expect(parsed.rows.length).toBe(1);
    expect(parsed.rows[0].Name).toBe('Amélie');
  });

  it('should parse Letterboxd list exports with metadata header and item rows', () => {
    const listCsv = [
      'Letterboxd list export v7',
      'Date,Name,Tags,URL,Description',
      '2024-02-01,Essential Noir,"noir, crime",https://boxd.it/list/noir,"The best neo-noirs."',
      '',
      'Position,Name,Year,URL,Description',
      '1,Blade Runner 2049,2017,https://boxd.it/6DcC,Cyberpunk mystery',
      '2,The Thing,1982,https://boxd.it/27bU,Claustrophobic dread',
    ].join('\r\n');

    const parsedList = CsvParser.parseLetterboxdList(listCsv);
    expect(parsedList.metadata.name).toBe('Essential Noir');
    expect(parsedList.metadata.description).toBe('The best neo-noirs.');
    expect(parsedList.items.length).toBe(2);
    expect(parsedList.items[0].position).toBe(1);
    expect(parsedList.items[0].name).toBe('Blade Runner 2049');
    expect(parsedList.items[0].year).toBe('2017');
    expect(parsedList.items[1].position).toBe(2);
    expect(parsedList.items[1].name).toBe('The Thing');
  });

  it('should sanitize formula injection on export and clean on ingest', () => {
    const malicious = '=1+1; cmd.exe';
    const sanitized = CsvParser.sanitizeField(malicious);
    expect(sanitized.startsWith('\'=')).toBeTrue();

    const cleaned = CsvParser.cleanIngestedField(sanitized);
    expect(cleaned).toBe(malicious);

    const stringified = CsvParser.stringify(['Title', 'Formula'], [{ Title: 'Test', Formula: '=SUM(A1:A5)' }]);
    expect(stringified).toContain('\'=SUM(A1:A5)');
  });
});
