import { randomBytes, randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import type { Config } from './config.ts';
import { one, run, type DB } from './db.ts';
import { uuid } from './domain.ts';
import type { Mailer } from './mail.ts';
import { sha256, type Vault } from './vault.ts';

export type Ctx = { config: Config; db: DB; vault: Vault; mailer: Mailer };

export class HttpError extends Error {
  status: number;
  fields?: Record<string, string>;
  code?: string;
  constructor(status: number, message: string, fields?: Record<string, string>, code?: string) {
    super(message);
    this.status = status;
    if (fields) this.fields = fields;
    if (code) this.code = code;
  }
}

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.code === 'unrecognized_keys' ? 'Campo não permitido.' : issue.message;
  }
  throw new HttpError(400, 'Confira os campos destacados.', fields);
}

/** IDs inválidos viram 404: quem não tem acesso não aprende nada sobre o que existe. */
export function idParam(value: unknown): string {
  const result = uuid.safeParse(value);
  if (!result.success) throw new HttpError(404, 'Não encontrado.');
  return result.data;
}

const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;
const SESSION_MAX_MS = 7 * 24 * 60 * 60 * 1000;

const cookieName = (config: Config) => (config.secureCookies ? '__Host-escala_sid' : 'escala_sid');

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

/** Só uma etiqueta genérica do aparelho: o User-Agent completo não é guardado. */
function deviceLabel(req: Request): string {
  const ua = req.headers['user-agent'] ?? '';
  if (/iPhone|iPad/.test(ua)) return 'iPhone ou iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Outro aparelho';
}

export function startSession(ctx: Ctx, req: Request, res: Response, userId: string) {
  // Token opaco de 256 bits. No banco fica só o hash: um vazamento não permite sequestrar sessões.
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  run(
    ctx.db,
    'INSERT INTO sessions (token_hash, user_id, device, created_at, last_seen_at, expires_at) VALUES (?,?,?,?,?,?)',
    sha256(token), userId, deviceLabel(req), now, now, now + SESSION_MAX_MS,
  );
  res.cookie(cookieName(ctx.config), token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: ctx.config.secureCookies,
    path: '/',
    maxAge: SESSION_MAX_MS,
  });
}

export function endSession(ctx: Ctx, req: Request, res: Response) {
  if (req.sessionHash) run(ctx.db, 'DELETE FROM sessions WHERE token_hash = ?', req.sessionHash);
  res.clearCookie(cookieName(ctx.config), { path: '/', httpOnly: true, sameSite: 'strict', secure: ctx.config.secureCookies });
}

export function sessionLoader(ctx: Ctx): RequestHandler {
  return (req, res, next) => {
    const token = readCookie(req, cookieName(ctx.config));
    if (!token || token.length > 100) return next();
    const hash = sha256(token);
    const row = one<{ user_id: string; last_seen_at: number; expires_at: number; role: 'freelancer' | 'company'; display_name: string; status: string }>(
      ctx.db,
      `SELECT s.user_id, s.last_seen_at, s.expires_at, u.role, u.display_name, u.status
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
      hash,
    );
    const now = Date.now();
    if (!row || row.status !== 'active' || row.expires_at < now || row.last_seen_at + SESSION_IDLE_MS < now) {
      if (row) run(ctx.db, 'DELETE FROM sessions WHERE token_hash = ?', hash);
      res.clearCookie(cookieName(ctx.config), { path: '/' });
      return next();
    }
    if (now - row.last_seen_at > 60_000) run(ctx.db, 'UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?', now, hash);
    req.user = { id: row.user_id, role: row.role, displayName: row.display_name };
    req.sessionHash = hash;
    next();
  };
}

/**
 * Defesa contra CSRF em camadas, somada ao cookie SameSite=Strict:
 * cabeçalho próprio (força preflight, e não há CORS), Origin permitida e Sec-Fetch-Site coerente.
 */
export function csrfGuard(config: Config): RequestHandler {
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin;
    const site = req.headers['sec-fetch-site'];
    const blocked =
      req.headers['x-escala-request'] !== '1' ||
      (origin !== undefined && !config.allowedOrigins.includes(origin)) ||
      (site !== undefined && site !== 'same-origin' && site !== 'none');
    next(blocked ? new HttpError(403, 'Requisição bloqueada por segurança.') : undefined);
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  next(req.user ? undefined : new HttpError(401, 'Entre na sua conta para continuar.'));
};

export const requireRole = (role: 'freelancer' | 'company'): RequestHandler => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Entre na sua conta para continuar.'));
  next(req.user.role === role ? undefined : new HttpError(403, 'Seu tipo de conta não permite esta ação.'));
};

export function me(req: Request) {
  if (!req.user) throw new HttpError(401, 'Entre na sua conta para continuar.');
  return req.user;
}

export function audit(ctx: Ctx, req: Request | null, action: string, opts: { actorId?: string | null; targetUserId?: string | null } = {}) {
  run(
    ctx.db,
    'INSERT INTO audit_log (id, at, actor_id, action, target_user_id, ip_enc) VALUES (?,?,?,?,?,?)',
    randomUUID(),
    Date.now(),
    opts.actorId ?? req?.user?.id ?? null,
    action,
    opts.targetUserId ?? null,
    req?.ip ? ctx.vault.encrypt(req.ip, 'audit.ip') : null,
  );
}

/** Registra no máximo uma vez por hora o mesmo acesso, para o histórico continuar legível. */
export function auditAccess(ctx: Ctx, req: Request, action: string, targetUserId: string) {
  const actorId = me(req).id;
  if (actorId === targetUserId) return;
  const recent = one(
    ctx.db,
    'SELECT 1 FROM audit_log WHERE actor_id = ? AND target_user_id = ? AND action = ? AND at > ? LIMIT 1',
    actorId, targetUserId, action, Date.now() - 3_600_000,
  );
  if (!recent) audit(ctx, req, action, { targetUserId });
}

/** Middleware final: respostas de erro nunca carregam detalhes internos. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, fields: err.fields, code: err.code });
    return;
  }
  const status = (err as { status?: number }).status;
  if (status === 413) return void res.status(413).json({ error: 'Conteúdo grande demais.' });
  if (status === 400) return void res.status(400).json({ error: 'Requisição inválida.' });
  console.error(`[erro] ${req.method} ${req.path}:`, (err as Error).message);
  res.status(500).json({ error: 'Algo deu errado do nosso lado. Tente de novo.' });
}

export function unreadCount(ctx: Ctx, userId: string, role: 'freelancer' | 'company'): number {
  const sql =
    role === 'freelancer'
      ? `SELECT COUNT(*) AS n FROM messages m JOIN applications a ON a.id = m.application_id
         WHERE a.freelancer_id = ? AND m.sender_id != a.freelancer_id AND m.created_at > a.freelancer_read_at`
      : `SELECT COUNT(*) AS n FROM messages m JOIN applications a ON a.id = m.application_id JOIN gigs g ON g.id = a.gig_id
         WHERE g.company_id = ? AND m.sender_id != g.company_id AND m.created_at > a.company_read_at`;
  return one<{ n: number }>(ctx.db, sql, userId)?.n ?? 0;
}

export function ratingOf(ctx: Ctx, userId: string) {
  const row = one<{ avg: number | null; n: number }>(ctx.db, 'SELECT ROUND(AVG(stars), 1) AS avg, COUNT(*) AS n FROM reviews WHERE to_user = ?', userId);
  return { rating: row?.avg ?? null, ratingCount: row?.n ?? 0 };
}
