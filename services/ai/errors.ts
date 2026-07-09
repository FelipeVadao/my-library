import { APICallError } from 'ai';
import { GatewayError } from '@ai-sdk/gateway';

export function describeGatewayError(err: unknown, fallbackMessage: string): string {
  // GatewayError (from @ai-sdk/gateway) is thrown for problems with the
  // Gateway itself — auth, billing, routing — distinct from APICallError,
  // which covers errors surfaced by the underlying model provider.
  if (GatewayError.isInstance(err)) {
    if (err.name === 'GatewayInternalServerError' && err.statusCode === 403) {
      return 'A conta Vercel precisa de um cartão cadastrado para liberar o uso gratuito da AI Gateway (não gera cobrança) — Settings → AI Gateway no dashboard da Vercel.';
    }
    if (err.type === 'authentication_error') return 'Chave da AI Gateway inválida ou não configurada.';
    if (err.type === 'rate_limit_exceeded') return 'Muitas requisições — tente novamente em instantes.';
    if (err.type === 'model_not_found') return 'Modelo de IA indisponível no momento.';
    return 'Erro na AI Gateway. Tente novamente.';
  }
  if (APICallError.isInstance(err)) {
    if (err.statusCode === 402) return 'Cota de IA esgotada.';
    if (err.statusCode === 429) return 'Muitas requisições — tente novamente em instantes.';
    return 'Erro ao consultar IA.';
  }
  return fallbackMessage;
}
