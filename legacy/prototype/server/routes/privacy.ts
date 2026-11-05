import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { purgeCodes, sendLater } from '../codes.ts';
import { all, one, run, tx } from '../db.ts';
import { today } from '../domain.ts';
import { audit, endSession, HttpError, me, parse, requireAuth, type Ctx } from '../http.ts';
import { templates } from '../mail.ts';
import { verifyPassword } from '../vault.ts';
import { recordConsent } from './auth.ts';
import { loadOwnProfile } from './me.ts';

const consentSchema = z.strictObject({ purpose: z.enum(['discovery', 'marketing']), granted: z.boolean() });
const passwordOnly = z.strictObject({ password: z.string().min(1).max(128) });
const deleteSchema = z.strictObject({
  password: z.string().min(1).max(128),
  confirm: z.literal('EXCLUIR', { error: 'Digite EXCLUIR para confirmar.' }),
});

const AUDIT_RETENTION_MS = 183 * 24 * 60 * 60 * 1000; // Marco Civil, art. 15: 6 meses.
const MESSAGE_RETENTION_DAYS = 365;

async function confirmPassword(ctx: Ctx, userId: string, password: string) {
  const row = one<{ password_hash: string | null }>(ctx.db, 'SELECT password_hash FROM users WHERE id = ?', userId);
  if (!row?.password_hash || !(await verifyPassword(password, row.password_hash))) {
    throw new HttpError(403, 'Senha incorreta.', { password: 'Senha incorreta.' });
  }
}

function latestConsent(ctx: Ctx, userId: string, purpose: string) {
  const row = one<{ granted: number; version: string; created_at: number }>(
    ctx.db,
    'SELECT granted, version, created_at FROM consents WHERE user_id = ? AND purpose = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',
    userId, purpose,
  );
  return row ? { granted: !!row.granted, version: row.version, at: row.created_at } : null;
}

function buildExport(ctx: Ctx, userId: string, role: 'freelancer' | 'company') {
  const applications = all<{ id: string; status: string; created_at: number; title: string; date: string; company_id: string; note_enc: string | null }>(
    ctx.db,
    role === 'freelancer'
      ? `SELECT a.id, a.status, a.created_at, a.note_enc, g.title, g.date, g.company_id
         FROM applications a JOIN gigs g ON g.id = a.gig_id WHERE a.freelancer_id = ?`
      : `SELECT a.id, a.status, a.created_at, a.note_enc, g.title, g.date, g.company_id
         FROM applications a JOIN gigs g ON g.id = a.gig_id WHERE g.company_id = ?`,
    userId,
  );
  const profile = loadOwnProfile(ctx, userId);
  const fullCnpj = role === 'company'
    ? ctx.vault.decrypt(one<{ cnpj_enc: string }>(ctx.db, 'SELECT cnpj_enc FROM company_profiles WHERE user_id = ?', userId)!.cnpj_enc, 'company.cnpj')
    : undefined;

  return {
    formato: 'escala.exportacao.v1',
    geradoEm: new Date().toISOString(),
    aviso: 'Cópia dos seus dados pessoais (LGPD, art. 18, II e V). Guarde em local seguro.',
    conta: { ...profile, ...(fullCnpj ? { cnpj: fullCnpj } : {}) },
    consentimentos: all(ctx.db, 'SELECT purpose AS finalidade, version AS versao, granted AS concedido, created_at AS em FROM consents WHERE user_id = ? ORDER BY created_at', userId),
    vagasPublicadas: role === 'company'
      ? all(ctx.db, 'SELECT id, title AS titulo, date AS data, city AS cidade, status FROM gigs WHERE company_id = ?', userId)
      : [],
    candidaturas: applications.map((a) => ({
      id: a.id,
      vaga: a.title,
      data: a.date,
      status: a.status,
      criadaEm: a.created_at,
      mensagemInicial: ctx.vault.maybeDecrypt(a.note_enc, 'application.note'),
    })),
    mensagensEnviadas: all<{ application_id: string; body_enc: string | null; created_at: number }>(
      ctx.db, 'SELECT application_id, body_enc, created_at FROM messages WHERE sender_id = ? ORDER BY created_at', userId,
    ).map((m) => ({ candidatura: m.application_id, texto: ctx.vault.maybeDecrypt(m.body_enc, 'message.body'), em: m.created_at })),
    avaliacoesRecebidas: all(ctx.db, 'SELECT stars AS nota, created_at AS em FROM reviews WHERE to_user = ?', userId),
    avaliacoesFeitas: all(ctx.db, 'SELECT stars AS nota, created_at AS em FROM reviews WHERE from_user = ?', userId),
    quemAcessouMeusDados: all(
      ctx.db,
      `SELECT l.action AS acao, l.at AS em, u.display_name AS quem FROM audit_log l LEFT JOIN users u ON u.id = l.actor_id
       WHERE l.target_user_id = ? ORDER BY l.at DESC`,
      userId,
    ),
    minhaAtividade: all(ctx.db, 'SELECT action AS acao, at AS em FROM audit_log WHERE actor_id = ? ORDER BY at DESC', userId),
  };
}

/** Apaga os dados pessoais na hora e mantém só o exigido por lei, sem nada que identifique diretamente. */
function eraseAccount(ctx: Ctx, userId: string, role: 'freelancer' | 'company', email: string) {
  const now = Date.now();
  const emailIndex = ctx.vault.index(email, 'email');
  tx(ctx.db, () => {
    run(ctx.db, "DELETE FROM otp_codes WHERE (purpose = 'email_change' AND subject = ?) OR (purpose = 'password_reset' AND subject = ?)", userId, emailIndex);
    run(ctx.db, 'DELETE FROM email_throttle WHERE email_index = ?', emailIndex);
    if (role === 'freelancer') {
      run(ctx.db, "UPDATE applications SET status = 'withdrawn', decided_at = ?, note_enc = NULL WHERE freelancer_id = ? AND status IN ('pending','invited')", now, userId);
      run(
        ctx.db,
        `UPDATE gigs SET status = 'open' WHERE status = 'filled' AND date >= ? AND id IN (
           SELECT gig_id FROM applications WHERE freelancer_id = ? AND status = 'accepted'
         )`,
        today(), userId,
      );
      run(
        ctx.db,
        `UPDATE applications SET status = 'cancelled', decided_at = ? WHERE freelancer_id = ? AND status = 'accepted'
         AND gig_id IN (SELECT id FROM gigs WHERE date >= ?)`,
        now, userId, today(),
      );
      run(ctx.db, 'UPDATE applications SET note_enc = NULL WHERE freelancer_id = ?', userId);
      run(ctx.db, 'DELETE FROM freelancer_profiles WHERE user_id = ?', userId);
    } else {
      run(
        ctx.db,
        `UPDATE applications SET status = 'cancelled', decided_at = ? WHERE status IN ('pending','invited','accepted')
         AND gig_id IN (SELECT id FROM gigs WHERE company_id = ? AND date >= ?)`,
        now, userId, today(),
      );
      run(ctx.db, 'UPDATE applications SET note_enc = NULL WHERE gig_id IN (SELECT id FROM gigs WHERE company_id = ?)', userId);
      run(ctx.db, "UPDATE gigs SET status = 'cancelled' WHERE company_id = ? AND status IN ('open','filled')", userId);
      run(ctx.db, 'UPDATE gigs SET address_enc = NULL WHERE company_id = ?', userId);
      run(ctx.db, "UPDATE company_profiles SET about = '', cnpj_index = NULL, cnpj_enc = NULL, verified = 0 WHERE user_id = ?", userId);
    }
    run(ctx.db, 'UPDATE messages SET body_enc = NULL WHERE sender_id = ?', userId);
    run(ctx.db, 'DELETE FROM sessions WHERE user_id = ?', userId);
    run(
      ctx.db,
      `UPDATE users SET email_index = NULL, email_enc = NULL, password_hash = NULL, phone_enc = NULL, full_name_enc = NULL,
         display_name = 'Conta removida', city = NULL, failed_logins = 0, locked_until = NULL, status = 'deleted', deleted_at = ? WHERE id = ?`,
      now, userId,
    );
  });
  ctx.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
}

export function purgeExpired(ctx: Ctx) {
  const now = Date.now();
  purgeCodes(ctx);
  run(ctx.db, 'DELETE FROM sessions WHERE expires_at < ?', now);
  run(ctx.db, 'DELETE FROM audit_log WHERE at < ?', now - AUDIT_RETENTION_MS);
  const cutoff = new Date(now - MESSAGE_RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10);
  run(
    ctx.db,
    `DELETE FROM messages WHERE application_id IN (
       SELECT a.id FROM applications a JOIN gigs g ON g.id = a.gig_id WHERE g.date < ?
     )`,
    cutoff,
  );
}

export function privacyRoutes(ctx: Ctx, sensitive: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/overview', (req, res) => {
    const user = me(req);
    res.json({
      consents: {
        terms: latestConsent(ctx, user.id, 'terms'),
        discovery: user.role === 'freelancer' ? latestConsent(ctx, user.id, 'discovery') : null,
        marketing: latestConsent(ctx, user.id, 'marketing'),
      },
      consentHistory: all<{ purpose: string; version: string; granted: number; created_at: number }>(
        ctx.db, 'SELECT purpose, version, granted, created_at FROM consents WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 30', user.id,
      ).map((c) => ({ purpose: c.purpose, version: c.version, granted: !!c.granted, at: c.created_at })),
      accessLog: all<{ action: string; at: number; actor: string | null }>(
        ctx.db,
        `SELECT l.action, l.at, u.display_name AS actor FROM audit_log l LEFT JOIN users u ON u.id = l.actor_id
         WHERE l.target_user_id = ? AND l.actor_id != ? ORDER BY l.at DESC LIMIT 30`,
        user.id, user.id,
      ),
      activity: all<{ action: string; at: number }>(
        ctx.db,
        `SELECT action, at FROM audit_log WHERE actor_id = ? AND target_user_id IS NULL
         AND (action LIKE 'login.%' OR action LIKE 'consent.%' OR action LIKE 'data.%' OR action LIKE 'password.%' OR action IN ('email.change','sessions.revoke'))
         ORDER BY at DESC LIMIT 20`,
        user.id,
      ),
      sessions: all<{ token_hash: string; device: string; created_at: number; last_seen_at: number }>(
        ctx.db, 'SELECT token_hash, device, created_at, last_seen_at FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC', user.id,
      ).map((s) => ({ device: s.device, createdAt: s.created_at, lastSeenAt: s.last_seen_at, current: s.token_hash === req.sessionHash })),
    });
  });

  router.post('/consents', (req, res) => {
    const user = me(req);
    const body = parse(consentSchema, req.body);
    if (body.purpose === 'discovery' && user.role !== 'freelancer') throw new HttpError(403, 'Esta opção é só para freelancers.');
    tx(ctx.db, () => {
      recordConsent(ctx, user.id, body.purpose, body.granted);
      // A revogação vale na hora: a próxima busca já não encontra o perfil.
      if (body.purpose === 'discovery') run(ctx.db, 'UPDATE freelancer_profiles SET discoverable = ? WHERE user_id = ?', body.granted ? 1 : 0, user.id);
    });
    audit(ctx, req, `consent.${body.purpose}.${body.granted ? 'grant' : 'revoke'}`);
    res.json(latestConsent(ctx, user.id, body.purpose));
  });

  router.post('/export', sensitive, async (req, res) => {
    const user = me(req);
    const { password } = parse(passwordOnly, req.body);
    await confirmPassword(ctx, user.id, password);
    audit(ctx, req, 'data.export');
    const data = buildExport(ctx, user.id, user.role);
    // Se a sessão foi roubada, o titular fica sabendo que seus dados saíram do app.
    sendLater(ctx, { to: data.conta.email, ...templates.dataExported() });
    res.setHeader('Content-Disposition', 'attachment; filename="meus-dados-escala.json"');
    res.json(data);
  });

  router.post('/delete', sensitive, async (req, res) => {
    const user = me(req);
    const { password } = parse(deleteSchema, req.body);
    await confirmPassword(ctx, user.id, password);
    audit(ctx, req, 'data.delete');
    const row = one<{ email_enc: string }>(ctx.db, 'SELECT email_enc FROM users WHERE id = ?', user.id)!;
    const email = ctx.vault.decrypt(row.email_enc, 'user.email');
    eraseAccount(ctx, user.id, user.role, email);
    sendLater(ctx, { to: email, ...templates.accountDeleted() });
    endSession(ctx, req, res);
    res.json({ ok: true });
  });

  router.post('/sessions/revoke-others', (req, res) => {
    const user = me(req);
    const result = run(ctx.db, 'DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', user.id, req.sessionHash ?? '');
    audit(ctx, req, 'sessions.revoke');
    res.json({ revoked: Number(result.changes) });
  });

  return router;
}
