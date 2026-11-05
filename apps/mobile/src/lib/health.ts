import { healthResponseSchema, type HealthResponse } from '@escala/shared';

const TIMEOUT_MS = 8000;

export type Fetcher = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

/** Falha única para a tela: sem rede, tempo esgotado, erro do servidor ou resposta fora do contrato. */
export class ApiUnavailableError extends Error {
  constructor() {
    super('Não foi possível falar com o servidor.');
    this.name = 'ApiUnavailableError';
  }
}

export async function fetchHealth(
  apiUrl: string,
  fetcher: Fetcher = fetch,
): Promise<HealthResponse> {
  try {
    const response = await fetcher(`${apiUrl}/health`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new ApiUnavailableError();
    return healthResponseSchema.parse(await response.json());
  } catch {
    throw new ApiUnavailableError();
  }
}
