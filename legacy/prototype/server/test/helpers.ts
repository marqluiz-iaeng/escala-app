import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../app.ts';
import type { Config } from '../config.ts';
import type { Ctx } from '../http.ts';

export const STRONG_PASSWORD = 'cavalo-bateria-grampo-42';

export type TestApp = { base: string; ctx: Ctx; dbPath: string; close: () => Promise<void> };

const running = new Map<string, Ctx>();

/** Último código de 6 dígitos enviado para o endereço, lido da caixa de saída em memória. */
export function lastCode(ctx: Ctx, email: string): string {
  const mail = (ctx.mailer.outbox ?? []).filter((m) => m.to === email).findLast((m) => /\b\d{6}\b/.test(m.text));
  const match = mail?.text.match(/\b\d{6}\b/);
  if (!match) throw new Error(`Nenhum código enviado para ${email}`);
  return match[0];
}

export function mailsTo(ctx: Ctx, email: string) {
  return (ctx.mailer.outbox ?? []).filter((m) => m.to === email);
}

export async function startTestApp(overrides: Partial<Config> = {}): Promise<TestApp> {
  const dir = mkdtempSync(join(tmpdir(), 'escala-test-'));
  const dbPath = join(dir, 'test.db');
  const config: Config = {
    production: false,
    host: '127.0.0.1',
    port: 0,
    dbPath,
    encKey: randomBytes(32),
    hmacKey: randomBytes(32),
    demoMode: false,
    demoPassword: null,
    allowedOrigins: ['http://localhost:4173'],
    trustProxy: 0,
    secureCookies: false,
    smtpUrl: null,
    mailFrom: 'Escala <teste@example.com>',
    limits: { authPerWindow: 500, writePerMinute: 1000, globalPerMinute: 5000 },
    ...overrides,
  };
  const { app, ctx } = createApp(config);
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  running.set(base, ctx);
  return {
    base,
    ctx,
    dbPath,
    close: () =>
      new Promise((resolve) => {
        running.delete(base);
        server.closeAllConnections();
        server.close(() => {
          ctx.db.close();
          rmSync(dir, { recursive: true, force: true });
          resolve();
        });
      }),
  };
}

export type Res = { status: number; body: any; headers: Headers };

/** Cliente HTTP com cookie próprio: cada instância representa uma pessoa em um aparelho. */
export class Client {
  base: string;
  cookie = '';
  constructor(base: string) {
    this.base = base;
  }
  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
    const res = await fetch(this.base + path, {
      method,
      headers: {
        'x-escala-request': '1',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const set = res.headers.get('set-cookie');
    if (set) {
      const pair = set.split(';')[0] ?? '';
      this.cookie = pair.endsWith('=') ? '' : pair;
    }
    const type = res.headers.get('content-type') ?? '';
    return { status: res.status, body: type.includes('json') ? await res.json() : await res.text(), headers: res.headers };
  }
  get(path: string) { return this.req('GET', path); }
  post(path: string, body: unknown = {}) { return this.req('POST', path, body); }
  patch(path: string, body: unknown) { return this.req('PATCH', path, body); }
}

let counter = 0;

function cnpj(): string {
  // Gera CNPJ válido e único para cada teste.
  counter += 1;
  const base = `TEST${String(counter).padStart(8, '0')}`;
  const digit = (chars: string) => {
    let weight = 2;
    let sum = 0;
    for (let i = chars.length - 1; i >= 0; i--) {
      sum += (chars.charCodeAt(i) - 48) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = digit(base);
  return `${base}${first}${digit(base + first)}`;
}

export const consents = (over: Partial<{ discovery: boolean; marketing: boolean }> = {}) => ({
  terms: true, adult: true, discovery: false, marketing: false, ...over,
});

export function freelancerPayload(name = 'Ana Moreira', over: Record<string, unknown> = {}) {
  counter += 1;
  return {
    role: 'freelancer',
    fullName: name,
    email: `free${counter}-${randomBytes(3).toString('hex')}@example.com`,
    password: STRONG_PASSWORD,
    phone: '(21) 98888-7777',
    city: 'Rio de Janeiro',
    categories: ['bartender'],
    consents: consents({ discovery: true }),
    ...over,
  };
}

export function companyPayload(over: Record<string, unknown> = {}) {
  counter += 1;
  return {
    role: 'company',
    tradeName: `Bar de Teste ${counter}`,
    contactName: 'Marina Duarte',
    cnpj: cnpj(),
    email: `empresa${counter}-${randomBytes(3).toString('hex')}@example.com`,
    password: STRONG_PASSWORD,
    phone: '(21) 3333-4444',
    city: 'Rio de Janeiro',
    segment: 'bar_restaurante',
    consents: consents(),
    ...over,
  };
}

export function gigPayload(over: Record<string, unknown> = {}) {
  const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  return {
    title: 'Bartender para sexta',
    category: 'bartender',
    description: 'Noite de coquetelaria com casa cheia.',
    city: 'Rio de Janeiro',
    neighbourhood: 'Botafogo',
    address: 'Rua Secreta Fictícia, 99',
    date: future,
    startTime: '18:00',
    endTime: '02:00',
    payCents: 22000,
    payType: 'diaria',
    slots: 1,
    ...over,
  };
}

/** Faz o cadastro completo, como a tela: envia os dados e confirma com o código recebido. */
export async function completeSignup(base: string, payload: Record<string, unknown>): Promise<{ client: Client; res: Res }> {
  const ctx = running.get(base);
  if (!ctx) throw new Error('App de teste não encontrado');
  const client = new Client(base);
  const registered = await client.post('/api/auth/register', payload);
  if (registered.status !== 202) throw new Error(`Falha no cadastro: ${JSON.stringify(registered.body)}`);
  const email = payload.email as string;
  const res = await client.post('/api/auth/verify', { email, code: lastCode(ctx, email), password: payload.password });
  if (res.status !== 201) throw new Error(`Falha na confirmação: ${JSON.stringify(res.body)}`);
  return { client, res };
}

export async function signUp(base: string, payload: Record<string, unknown>): Promise<Client> {
  return (await completeSignup(base, payload)).client;
}
