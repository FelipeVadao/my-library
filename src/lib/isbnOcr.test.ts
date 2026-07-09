import { describe, it, expect } from 'vitest';
import { extractIsbnFromText } from './isbnOcr';

describe('extractIsbnFromText', () => {
  it('finds a clean ISBN-13', () => {
    expect(extractIsbnFromText('9783161484100')).toBe('9783161484100');
  });

  it('finds a hyphenated ISBN-13', () => {
    expect(extractIsbnFromText('978-3-16-148410-0')).toBe('9783161484100');
  });

  it('ignores surrounding label and price noise', () => {
    expect(extractIsbnFromText('ISBN 978-3-16-148410-0 (Paperback) R$ 49,90')).toBe('9783161484100');
  });

  it('tolerates a line break in the middle of the number', () => {
    expect(extractIsbnFromText('978-3-16-\n148410-0')).toBe('9783161484100');
  });

  it('finds an ISBN-10 with an X check digit', () => {
    expect(extractIsbnFromText('3-8055-7505-X')).toBe('380557505X');
  });

  it('falls back to a checksum-invalid ISBN-13 shaped run when nothing valid is found', () => {
    // last digit corrupted by OCR misread — still 978-prefixed and 13 digits
    expect(extractIsbnFromText('9783161484101')).toBe('9783161484101');
  });

  it('returns null for unrelated short numbers', () => {
    expect(extractIsbnFromText('320 páginas')).toBeNull();
  });

  it('returns null for text with no digit run', () => {
    expect(extractIsbnFromText('capa dura, sem código legível')).toBeNull();
  });

  it('returns null for empty text', () => {
    expect(extractIsbnFromText('')).toBeNull();
  });
});
