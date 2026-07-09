import { describe, it, expect } from 'vitest';
import { buildLibraryContext, type BookContextRow } from './libraryContext';

function book(overrides: Partial<BookContextRow> = {}): BookContextRow {
  return {
    title: 'Dom Casmurro',
    author: 'Machado de Assis',
    genre: 'Romance',
    reading_status: 'lido',
    rating: 5,
    added_at: '2024-03-01T00:00:00.000Z',
    finished_at: '2023-03-15T00:00:00.000Z',
    page_count: 256,
    favorite: true,
    ...overrides,
  };
}

describe('buildLibraryContext', () => {
  it('returns a fixed message for an empty library', () => {
    const result = buildLibraryContext([]);
    expect(result).toBe('O usuário ainda não tem nenhum livro cadastrado na biblioteca.');
  });

  it('includes all provided fields for a fully-populated book', () => {
    const result = buildLibraryContext([book()]);
    expect(result).toContain('"Dom Casmurro"');
    expect(result).toContain('Machado de Assis');
    expect(result).toContain('gênero: Romance');
    expect(result).toContain('status: lido');
    expect(result).toContain('nota: 5/5');
    expect(result).toContain('páginas: 256');
    expect(result).toContain('lido em: 15/03/2023');
    expect(result).toContain('favorito');
  });

  it('omits null/missing fields instead of printing placeholders', () => {
    const result = buildLibraryContext([
      book({ author: null, genre: null, rating: null, page_count: null, favorite: false, finished_at: null }),
    ]);
    expect(result.toLowerCase()).not.toContain('null');
    expect(result).not.toContain('favorito');
    expect(result).not.toContain('nota:');
    expect(result).not.toContain('gênero:');
    expect(result).not.toContain('páginas:');
  });

  it('only prints "lido em" for books marked as lido', () => {
    const result = buildLibraryContext([book({ reading_status: 'lendo', finished_at: '2023-01-01T00:00:00.000Z' })]);
    expect(result).not.toContain('lido em');
  });

  it('includes a header with the book count when not truncated', () => {
    const result = buildLibraryContext([book(), book({ title: '1984' })]);
    expect(result).toContain('Biblioteca do usuário (2 livros):');
    expect(result).not.toContain('AVISO');
  });

  it('adds a truncation warning when totalCount exceeds the fetched books', () => {
    const result = buildLibraryContext([book()], { totalCount: 50 });
    expect(result).toContain('AVISO');
    expect(result).toContain('mostra apenas 1 dos 50 livros');
    expect(result).toContain('mostrando 1 de 50 livros');
  });

  it('does not warn when totalCount equals the fetched books', () => {
    const result = buildLibraryContext([book()], { totalCount: 1 });
    expect(result).not.toContain('AVISO');
  });

  it('numbers books sequentially starting at 1', () => {
    const result = buildLibraryContext([book({ title: 'A' }), book({ title: 'B' }), book({ title: 'C' })]);
    expect(result).toContain('1. "A"');
    expect(result).toContain('2. "B"');
    expect(result).toContain('3. "C"');
  });
});
