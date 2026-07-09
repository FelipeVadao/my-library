'use server';

import { generateText, Output, APICallError } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const CoverIdentificationSchema = z.object({
  title: z.string().nullable(),
  author: z.string().nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
});

export interface IdentifyBookFromCoverResult {
  title: string | null;
  author: string | null;
  confidence: 'high' | 'medium' | 'low';
  error: string | null;
}

const NOT_IDENTIFIED: Omit<IdentifyBookFromCoverResult, 'error'> = {
  title: null,
  author: null,
  confidence: 'low',
};

// Every DB-touching action in src/app/actions.ts is backstopped by RLS even
// without an explicit auth check. This action never touches the database, so
// nothing else stops a forged direct call from burning through the shared
// AI Gateway quota — hence the explicit getUser() guard below.
export async function identifyBookFromCover(imageDataUrl: string): Promise<IdentifyBookFromCoverResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...NOT_IDENTIFIED, error: 'Não autenticado.' };

  if (!imageDataUrl.startsWith('data:image/')) {
    return { ...NOT_IDENTIFIED, error: 'Imagem inválida.' };
  }

  try {
    const result = await generateText({
      model: 'google/gemini-3.5-flash',
      output: Output.object({ schema: CoverIdentificationSchema }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Você está vendo a foto da capa de um livro. Identifique o título e ' +
                'o(s) autor(es) exatamente como aparecem impressos na capa. Se não ' +
                'conseguir identificar com confiança, retorne title e author como ' +
                'null e confidence "low". Não invente informações que não estão visíveis.',
            },
            { type: 'file', mediaType: 'image', data: imageDataUrl },
          ],
        },
      ],
    });
    return { ...result.output, error: null };
  } catch (err) {
    if (APICallError.isInstance(err)) {
      if (err.statusCode === 402) return { ...NOT_IDENTIFIED, error: 'Cota de IA esgotada.' };
      if (err.statusCode === 429) return { ...NOT_IDENTIFIED, error: 'Muitas requisições — tente novamente em instantes.' };
      return { ...NOT_IDENTIFIED, error: 'Erro ao consultar IA.' };
    }
    return { ...NOT_IDENTIFIED, error: 'Não foi possível identificar o livro pela capa.' };
  }
}
