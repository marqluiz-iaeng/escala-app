export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  code?: string;
  constructor(status: number, message: string, fields: Record<string, string> = {}, code?: string) {
    super(message);
    this.status = status;
    this.fields = fields;
    if (code) this.code = code;
  }
}

export const SESSION_LOST = 'escala:sessao-perdida';

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      credentials: 'same-origin',
      headers: {
        'X-Escala-Request': '1',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    throw new ApiError(0, 'Sem conexão. Verifique sua internet e tente de novo.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event(SESSION_LOST));
    throw new ApiError(res.status, data?.error ?? 'Não foi possível concluir. Tente de novo.', data?.fields, data?.code);
  }
  return data as T;
}
