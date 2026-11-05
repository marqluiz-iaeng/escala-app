import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('aceita a resposta esperada', () => {
    expect(healthResponseSchema.parse({ status: 'ok', version: '0.2.0' })).toEqual({
      status: 'ok',
      version: '0.2.0',
    });
  });

  it('recusa status desconhecido e campos extras', () => {
    expect(healthResponseSchema.safeParse({ status: 'down', version: '1' }).success).toBe(false);
    expect(
      healthResponseSchema.safeParse({ status: 'ok', version: '1', debug: true }).success,
    ).toBe(false);
  });
});
