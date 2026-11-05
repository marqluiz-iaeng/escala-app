import { describe, expect, it } from 'vitest';
import { ApiUnavailableError, fetchHealth, type Fetcher } from './health';

const respondWith =
  (body: unknown, status = 200): Fetcher =>
  () =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('fetchHealth', () => {
  it('devolve a resposta quando ela segue o contrato', async () => {
    const health = await fetchHealth('http://api', respondWith({ status: 'ok', version: '1.0.0' }));
    expect(health).toEqual({ status: 'ok', version: '1.0.0' });
  });

  it('consulta o endereço configurado', async () => {
    let requested = '';
    await fetchHealth('https://api.exemplo.com.br', (url) => {
      requested = url;
      return Promise.resolve(new Response(JSON.stringify({ status: 'ok', version: '1' })));
    });
    expect(requested).toBe('https://api.exemplo.com.br/health');
  });

  it.each([
    ['erro do servidor', respondWith({ status: 'ok', version: '1' }, 500)],
    ['resposta fora do contrato', respondWith({ status: 'quebrado' })],
    ['falha de rede', () => Promise.reject(new TypeError('Network request failed'))],
    ['corpo inválido', () => Promise.resolve(new Response('<html>'))],
  ] as [string, Fetcher][])('trata %s como indisponível', async (_, fetcher) => {
    await expect(fetchHealth('http://api', fetcher)).rejects.toBeInstanceOf(ApiUnavailableError);
  });
});
