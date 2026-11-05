import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { Env } from '../config/env.js';

const SENSITIVE_FIELDS = [
  'authorization',
  'cookie',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'code',
  'email',
  'phone',
  'cpf',
  'cnpj',
  'fullName',
  'legalName',
  'birthDate',
  'address',
];

export const REDACT_PATHS = SENSITIVE_FIELDS.flatMap((field) => [field, `*.${field}`]);

/**
 * Lista do que entra no log, em vez do que sai dele: cabeçalhos, corpo e parâmetros de busca
 * nunca são registrados, porque podem conter tokens e dados pessoais.
 */
export function pathWithoutQuery(url: string | undefined): string {
  return (url ?? '').split('?')[0] ?? '';
}

export function buildLoggerParams(env: Env): Params {
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      redact: { paths: REDACT_PATHS, censor: '[oculto]' },
      genReqId: () => randomUUID(),
      serializers: {
        req: (req: IncomingMessage & { id?: string }) => ({
          id: req.id,
          method: req.method,
          path: pathWithoutQuery(req.url),
        }),
        res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
      },
      autoLogging: { ignore: (req) => pathWithoutQuery(req.url) === '/health' },
    },
  };
}
