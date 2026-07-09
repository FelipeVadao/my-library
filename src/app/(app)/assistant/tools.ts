import type { SupabaseClient } from '@supabase/supabase-js';
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { updateReadingStatus, rateBook, toggleBookFavorite } from '@/app/actions';
import { escapeIlikeTerm } from '@/lib/bookQuery';

type ResolvedBook = { id: string; title: string };
type ResolveResult = ResolvedBook | { errorMessage: string };

async function resolveBookByTitle(supabase: SupabaseClient, operatorId: string, title: string): Promise<ResolveResult> {
  const { data } = await supabase
    .from('books')
    .select('id, title')
    .eq('operator_id', operatorId)
    .ilike('title', `%${escapeIlikeTerm(title)}%`);

  const matches = (data ?? []) as ResolvedBook[];
  if (matches.length === 0) {
    return { errorMessage: `Nenhum livro encontrado com o título "${title}".` };
  }
  if (matches.length > 1) {
    const titles = matches.map((m) => m.title).join(', ');
    return { errorMessage: `Mais de um livro corresponde a "${title}": ${titles}. Peça pro usuário ser mais específico.` };
  }
  return matches[0];
}

// Scoped per-request to the authenticated user — no global state, so the
// operatorId can never leak across requests.
export function buildLibraryTools(supabase: SupabaseClient, operatorId: string): ToolSet {
  return {
    update_reading_status: tool({
      description: 'Atualiza o status de leitura (quero_ler, lendo ou lido) de um livro do usuário, a partir do título.',
      inputSchema: z.object({
        title: z.string().describe('Título (ou parte do título) do livro'),
        status: z.enum(['quero_ler', 'lendo', 'lido']),
      }),
      execute: async ({ title, status }) => {
        const resolved = await resolveBookByTitle(supabase, operatorId, title);
        if ('errorMessage' in resolved) return { ok: false, message: resolved.errorMessage };

        const { error } = await updateReadingStatus(resolved.id, status);
        return error
          ? { ok: false, message: error }
          : { ok: true, message: `"${resolved.title}" atualizado para status "${status}".` };
      },
    }),

    rate_book: tool({
      description: 'Define a nota (1 a 5) de um livro do usuário, a partir do título.',
      inputSchema: z.object({
        title: z.string().describe('Título (ou parte do título) do livro'),
        rating: z.number().int().min(1).max(5),
      }),
      execute: async ({ title, rating }) => {
        const resolved = await resolveBookByTitle(supabase, operatorId, title);
        if ('errorMessage' in resolved) return { ok: false, message: resolved.errorMessage };

        const { error } = await rateBook(resolved.id, rating);
        return error
          ? { ok: false, message: error }
          : { ok: true, message: `"${resolved.title}" avaliado com nota ${rating}.` };
      },
    }),

    toggle_favorite: tool({
      description: 'Marca ou desmarca um livro do usuário como favorito, a partir do título.',
      inputSchema: z.object({
        title: z.string().describe('Título (ou parte do título) do livro'),
        favorite: z.boolean(),
      }),
      execute: async ({ title, favorite }) => {
        const resolved = await resolveBookByTitle(supabase, operatorId, title);
        if ('errorMessage' in resolved) return { ok: false, message: resolved.errorMessage };

        const { error } = await toggleBookFavorite(resolved.id, favorite);
        return error
          ? { ok: false, message: error }
          : { ok: true, message: `"${resolved.title}" ${favorite ? 'marcado' : 'desmarcado'} como favorito.` };
      },
    }),
  };
}
