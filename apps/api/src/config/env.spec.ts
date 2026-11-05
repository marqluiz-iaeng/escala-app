import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('usa padrões seguros: só na máquina local e sem origens liberadas', () => {
    const env = loadEnv({});
    expect(env.API_HOST).toBe('127.0.0.1');
    expect(env.CORS_ORIGINS).toEqual([]);
  });

  it('aceita lista de origens', () => {
    const env = loadEnv({ CORS_ORIGINS: 'http://localhost:8081, https://painel.exemplo.com.br' });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:8081', 'https://painel.exemplo.com.br']);
  });

  it('recusa curinga e origem com caminho', () => {
    expect(() => loadEnv({ CORS_ORIGINS: '*' })).toThrow(/CORS_ORIGINS/);
    expect(() => loadEnv({ CORS_ORIGINS: 'https://exemplo.com.br/painel' })).toThrow(
      /CORS_ORIGINS/,
    );
  });

  it('em produção, recusa origem sem https', () => {
    expect(() =>
      loadEnv({ NODE_ENV: 'production', CORS_ORIGINS: 'http://exemplo.com.br' }),
    ).toThrow(/https/);
  });

  it('o erro cita a variável, nunca o valor', () => {
    const secret = 'valor-que-nao-pode-vazar';
    expect(() => loadEnv({ API_PORT: secret })).toThrow(/API_PORT/);
    try {
      loadEnv({ API_PORT: secret });
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
