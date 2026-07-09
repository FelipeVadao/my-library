import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APICallError } from 'ai';

const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText: generateTextMock };
});

import { answerLibraryQuestion } from './gemini.service';

function apiError(statusCode: number) {
  return new APICallError({
    message: 'gateway error',
    url: 'https://ai-gateway.vercel.sh/v1/chat',
    requestBodyValues: {},
    statusCode,
  });
}

describe('answerLibraryQuestion', () => {
  beforeEach(() => {
    generateTextMock.mockReset();
  });

  it('returns the model text on success', async () => {
    generateTextMock.mockResolvedValue({ text: 'Você leu 5 livros este ano.' });

    const result = await answerLibraryQuestion('Quantos livros eu li este ano?', 'Biblioteca do usuário (1 livros):...');

    expect(result).toEqual({ answer: 'Você leu 5 livros este ano.', error: null });
  });

  it('sends the system prompt + context as instructions and the question as the final message', async () => {
    generateTextMock.mockResolvedValue({ text: 'ok' });

    await answerLibraryQuestion('Qual meu livro favorito?', 'CONTEXTO_DA_BIBLIOTECA');

    const call = generateTextMock.mock.calls[0][0];
    expect(call.instructions).toContain('CONTEXTO_DA_BIBLIOTECA');
    expect(call.messages).toEqual([{ role: 'user', content: 'Qual meu livro favorito?' }]);
  });

  it('prepends prior conversation turns before the new question', async () => {
    generateTextMock.mockResolvedValue({ text: 'ok' });
    const history = [
      { role: 'user' as const, content: 'Quais livros de ficção eu tenho?' },
      { role: 'assistant' as const, content: '1984 e Fahrenheit 451.' },
    ];

    await answerLibraryQuestion('E qual deles é mais curto?', 'contexto', history);

    const call = generateTextMock.mock.calls[0][0];
    expect(call.messages).toEqual([...history, { role: 'user', content: 'E qual deles é mais curto?' }]);
  });

  it('forwards tools and a step limit to generateText when tools are provided', async () => {
    generateTextMock.mockResolvedValue({ text: 'ok' });
    const tools = { some_tool: {} } as never;

    await answerLibraryQuestion('pergunta', 'contexto', [], tools);

    const call = generateTextMock.mock.calls[0][0];
    expect(call.tools).toBe(tools);
    expect(call.stopWhen).toBeDefined();
  });

  it('still works without tools (tools undefined)', async () => {
    generateTextMock.mockResolvedValue({ text: 'ok' });

    await answerLibraryQuestion('pergunta', 'contexto');

    const call = generateTextMock.mock.calls[0][0];
    expect(call.tools).toBeUndefined();
  });

  it('degrades gracefully with a quota message on a 402', async () => {
    generateTextMock.mockRejectedValue(apiError(402));

    const result = await answerLibraryQuestion('pergunta', 'contexto');

    expect(result).toEqual({ answer: null, error: 'Cota de IA esgotada.' });
  });

  it('degrades gracefully with a rate-limit message on a 429', async () => {
    generateTextMock.mockRejectedValue(apiError(429));

    const result = await answerLibraryQuestion('pergunta', 'contexto');

    expect(result.error).toBe('Muitas requisições — tente novamente em instantes.');
  });

  it('degrades gracefully on an unexpected error', async () => {
    generateTextMock.mockRejectedValue(new Error('boom'));

    const result = await answerLibraryQuestion('pergunta', 'contexto');

    expect(result).toEqual({ answer: null, error: 'Não foi possível obter uma resposta da IA.' });
  });
});
