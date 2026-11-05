import { healthResponseSchema } from '@escala/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { APP_VERSION } from '../src/version.js';

async function startApp(
  overrides: Partial<NodeJS.ProcessEnv> = {},
): Promise<NestExpressApplication> {
  const env: Env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', ...overrides });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app, env);
  await app.init();
  return app;
}

const http = (app: NestExpressApplication) => request(app.getHttpServer());

describe('API', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startApp({ CORS_ORIGINS: 'http://localhost:8081' });
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /health responde no formato do contrato compartilhado', async () => {
    const res = await http(app).get('/health').expect(200);
    expect(healthResponseSchema.parse(res.body)).toEqual({ status: 'ok', version: APP_VERSION });
  });

  it('envia cabeçalhos de segurança e não se identifica', async () => {
    const { headers } = await http(app).get('/health');
    expect(headers['x-powered-by']).toBeUndefined();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['content-security-policy']).toContain("default-src 'none'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  it('CORS só libera origens configuradas', async () => {
    const allowed = await http(app).get('/health').set('Origin', 'http://localhost:8081');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:8081');
    const denied = await http(app).get('/health').set('Origin', 'https://site-malicioso.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rota inexistente responde JSON, sem pilha de erro', async () => {
    const res = await http(app).get('/nao-existe').expect(404);
    expect(res.body.statusCode).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/\bat .+\.(js|ts):\d+/);
  });

  it('recusa corpo grande demais', async () => {
    const body = JSON.stringify({ a: 'x'.repeat(70_000) });
    await http(app).post('/health').set('Content-Type', 'application/json').send(body).expect(413);
  });

  it('publica o OpenAPI fora de produção, com o schema de resposta', async () => {
    const res = await http(app).get('/openapi.json').expect(200);
    expect(
      res.body.paths['/health'].get.responses['200'].content['application/json'].schema,
    ).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['status', 'version'],
    });
  });

  it('toda rota documenta o schema da resposta de sucesso', async () => {
    const res = await http(app).get('/openapi.json').expect(200);
    const missing: string[] = [];
    for (const [path, operations] of Object.entries<
      Record<string, { responses: Record<string, { content?: object }> }>
    >(res.body.paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        const success = Object.entries(operation.responses).find(([status]) =>
          status.startsWith('2'),
        );
        if (!success?.[1].content) missing.push(`${method.toUpperCase()} ${path}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('API em produção', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startApp({ NODE_ENV: 'production', CORS_ORIGINS: 'https://painel.exemplo.com.br' });
  });
  afterAll(async () => {
    await app.close();
  });

  it('não expõe a documentação da API', async () => {
    await http(app).get('/openapi.json').expect(404);
    await http(app).get('/docs').expect(404);
  });

  it('envia HSTS', async () => {
    const { headers } = await http(app).get('/health');
    expect(headers['strict-transport-security']).toContain('max-age=31536000');
  });
});
