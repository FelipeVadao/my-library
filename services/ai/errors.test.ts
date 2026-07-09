import { describe, it, expect } from 'vitest';
import { APICallError } from 'ai';
import {
  GatewayAuthenticationError,
  GatewayInternalServerError,
  GatewayModelNotFoundError,
  GatewayRateLimitError,
} from '@ai-sdk/gateway';
import { describeGatewayError } from './errors';

function apiError(statusCode: number) {
  return new APICallError({
    message: 'gateway error',
    url: 'https://ai-gateway.vercel.sh/v1/chat',
    requestBodyValues: {},
    statusCode,
  });
}

describe('describeGatewayError', () => {
  it('returns a quota message for a 402', () => {
    expect(describeGatewayError(apiError(402), 'fallback')).toBe('Cota de IA esgotada.');
  });

  it('returns a rate-limit message for a 429', () => {
    expect(describeGatewayError(apiError(429), 'fallback')).toBe('Muitas requisições — tente novamente em instantes.');
  });

  it('returns a generic message for other API errors', () => {
    expect(describeGatewayError(apiError(500), 'fallback')).toBe('Erro ao consultar IA.');
  });

  it('returns the fallback message for a non-API error', () => {
    expect(describeGatewayError(new Error('boom'), 'fallback')).toBe('fallback');
  });

  it('returns a billing-setup message for the "no card on file" 403 case', () => {
    const err = new GatewayInternalServerError({ message: 'needs a card', statusCode: 403 });
    expect(describeGatewayError(err, 'fallback')).toContain('cartão cadastrado');
  });

  it('returns a generic Gateway message for other internal server errors', () => {
    const err = new GatewayInternalServerError({ message: 'boom', statusCode: 500 });
    expect(describeGatewayError(err, 'fallback')).toBe('Erro na AI Gateway. Tente novamente.');
  });

  it('returns an auth message for GatewayAuthenticationError', () => {
    const err = new GatewayAuthenticationError({});
    expect(describeGatewayError(err, 'fallback')).toBe('Chave da AI Gateway inválida ou não configurada.');
  });

  it('returns a rate-limit message for GatewayRateLimitError', () => {
    const err = new GatewayRateLimitError({});
    expect(describeGatewayError(err, 'fallback')).toBe('Muitas requisições — tente novamente em instantes.');
  });

  it('returns a model-unavailable message for GatewayModelNotFoundError', () => {
    const err = new GatewayModelNotFoundError({});
    expect(describeGatewayError(err, 'fallback')).toBe('Modelo de IA indisponível no momento.');
  });
});
