import { randomUUID } from 'node:crypto';
import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import { all, one, run, tx } from '../db.ts';
import { CONTACT_WINDOW_DAYS, addDays, text, today } from '../domain.ts';
import { audit, auditAccess, HttpError, idParam, me, parse, ratingOf, requireAuth, requireRole, type Ctx } from '../http.ts';
import { GIG_SELECT, gigPublic, type GigRow } from './gigs.ts';

type AppRow = {
  id: string; gig_id: string; freelancer_id: string; status: string; note_enc: string | null; created_at: number; decided_at: number | null;
  freelancer_read_at: number; company_read_at: number;
};

const noteSchema = text(0, 400, 'a mensagem').optional();

/**
 * Antes da confirmação, contatos digitados no chat são mascarados antes de serem salvos.
 * Assim o telefone não vaza para quem ainda não foi contratado e o controle continua com o titular.
 */
const CONTACT_PATTERNS = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/g,
  /\b(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com|t\.me)\/\S+/gi,
  /(?:\+?\d[\s().-]*){8,}/g,
];

export function maskContacts(body: string): { body: string; masked: boolean } {
  let out = body;
  for (const pattern of CONTACT_PATTERNS) out = out.replace(pattern, '•••');
  return { body: out, masked: out !== body };
}

/** O contato só existe para as duas partes de um turno confirmado, até 30 dias depois dele. */
export function contactVisible(status: string, gigDate: string): boolean {
  return status === 'accepted' && today() <= addDays(gigDate, CONTACT_WINDOW_DAYS);
}

function loadGig(ctx: Ctx, gigId: string): GigRow {
  const gig = one<GigRow>(ctx.db, `${GIG_SELECT} WHERE g.id = ?`, gigId);
  if (!gig) throw new HttpError(404, 'Não encontrado.');
  return gig;
}

/** Autorização por objeto: só as duas partes enxergam uma candidatura. Para os demais, ela não existe. */
function loadParty(ctx: Ctx, req: Request, applicationId: string) {
  const user = me(req);
  const app = one<AppRow>(ctx.db, 'SELECT * FROM applications WHERE id = ?', applicationId);
  if (!app) throw new HttpError(404, 'Não encontrado.');
  const gig = loadGig(ctx, app.gig_id);
  const isParty = app.freelancer_id === user.id || (gig.company_id === user.id && app.status !== 'withdrawn');
  if (!isParty) throw new HttpError(404, 'Não encontrado.');
  return { app, gig, user };
}

function counterpart(ctx: Ctx, userId: string, reveal: boolean) {
  const row = one<{ display_name: string; phone_enc: string | null; full_name_enc: string | null }>(
    ctx.db, 'SELECT display_name, phone_enc, full_name_enc FROM users WHERE id = ?', userId,
  );
  return {
    displayName: row?.display_name ?? 'Conta removida',
    ...(reveal && row?.phone_enc
      ? {
          contact: {
            fullName: ctx.vault.maybeDecrypt(row?.full_name_enc ?? null, 'user.fullName'),
            phone: ctx.vault.maybeDecrypt(row?.phone_enc ?? null, 'user.phone'),
          },
        }
      : { contact: null }),
  };
}

export function freelancerCard(ctx: Ctx, userId: string) {
  const row = one<{ id: string; display_name: string; city: string | null; categories: string | null; bio: string | null; experience_years: number | null; day_rate_cents: number | null; available: number | null }>(
    ctx.db,
    `SELECT u.id, u.display_name, u.city, p.categories, p.bio, p.experience_years, p.day_rate_cents, p.available
     FROM users u LEFT JOIN freelancer_profiles p ON p.user_id = u.id WHERE u.id = ?`,
    userId,
  );
  if (!row) throw new HttpError(404, 'Não encontrado.');
  return {
    id: row.id,
    displayName: row.display_name,
    city: row.city,
    categories: row.categories ? (JSON.parse(row.categories) as string[]) : [],
    bio: row.bio ?? '',
    experienceYears: row.experience_years ?? 0,
    dayRateCents: row.day_rate_cents,
    available: !!row.available,
    ...ratingOf(ctx, userId),
  };
}

function hasReviewed(ctx: Ctx, applicationId: string, userId: string) {
  return !!one(ctx.db, 'SELECT 1 FROM reviews WHERE application_id = ? AND from_user = ?', applicationId, userId);
}

function lastMessageAt(ctx: Ctx, applicationId: string): number | null {
  return one<{ at: number | null }>(ctx.db, 'SELECT MAX(created_at) AS at FROM messages WHERE application_id = ?', applicationId)?.at ?? null;
}

function applicationSummary(ctx: Ctx, app: AppRow, gig: GigRow, viewerId: string) {
  const viewerIsCompany = gig.company_id === viewerId;
  const unread = one<{ n: number }>(
    ctx.db,
    'SELECT COUNT(*) AS n FROM messages WHERE application_id = ? AND sender_id != ? AND created_at > ?',
    app.id, viewerId, viewerIsCompany ? app.company_read_at : app.freelancer_read_at,
  )?.n ?? 0;
  return {
    id: app.id,
    status: app.status,
    createdAt: app.created_at,
    note: ctx.vault.maybeDecrypt(app.note_enc, 'application.note'),
    gig: gigPublic(gig),
    unread,
    lastMessageAt: lastMessageAt(ctx, app.id),
    canReview: app.status === 'accepted' && gig.date < today() && !hasReviewed(ctx, app.id, viewerId),
    contactUnlocked: contactVisible(app.status, gig.date),
    freelancer: viewerIsCompany ? freelancerCard(ctx, app.freelancer_id) : undefined,
  };
}

export function applicationRoutes(ctx: Ctx, write: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);

  router.post('/gigs/:gigId/apply', requireRole('freelancer'), write, (req, res) => {
    const { note } = parse(z.strictObject({ note: noteSchema }), req.body);
    const gig = loadGig(ctx, idParam(req.params.gigId));
    const user = me(req);
    if (gig.status !== 'open' || gig.date < today()) throw new HttpError(409, 'Esta vaga não está mais aberta.');
    const existing = one<AppRow>(ctx.db, 'SELECT * FROM applications WHERE gig_id = ? AND freelancer_id = ?', gig.id, user.id);
    if (existing) throw new HttpError(409, 'Você já tem uma candidatura nesta vaga.');
    const id = randomUUID();
    const safeNote = note ? maskContacts(note).body : null;
    run(
      ctx.db,
      "INSERT INTO applications (id, gig_id, freelancer_id, status, note_enc, created_at) VALUES (?,?,?,'pending',?,?)",
      id, gig.id, user.id, safeNote ? ctx.vault.encrypt(safeNote, 'application.note') : null, Date.now(),
    );
    audit(ctx, req, 'application.create', { targetUserId: gig.company_id });
    res.status(201).json({ id, status: 'pending' });
  });

  router.get('/applications', (req, res) => {
    const user = me(req);
    const rows = all<AppRow>(
      ctx.db,
      user.role === 'freelancer'
        ? 'SELECT a.* FROM applications a WHERE a.freelancer_id = ? ORDER BY a.created_at DESC LIMIT 100'
        : "SELECT a.* FROM applications a JOIN gigs g ON g.id = a.gig_id WHERE g.company_id = ? AND a.status != 'withdrawn' ORDER BY a.created_at DESC LIMIT 200",
      user.id,
    );
    res.json({ applications: rows.map((app) => applicationSummary(ctx, app, loadGig(ctx, app.gig_id), user.id)) });
  });

  router.get('/gigs/:gigId/applications', requireRole('company'), (req, res) => {
    const user = me(req);
    const gig = one<GigRow>(ctx.db, `${GIG_SELECT} WHERE g.id = ? AND g.company_id = ?`, idParam(req.params.gigId), user.id);
    if (!gig) throw new HttpError(404, 'Vaga não encontrada.');
    // Quem retirou a candidatura sai da lista: a empresa não precisa mais desses dados.
    const rows = all<AppRow>(ctx.db, "SELECT * FROM applications WHERE gig_id = ? AND status != 'withdrawn' ORDER BY created_at", gig.id);
    res.json({ applications: rows.map((app) => applicationSummary(ctx, app, gig, user.id)) });
  });

  router.get('/applications/:id', (req, res) => {
    const { app, gig, user } = loadParty(ctx, req, idParam(req.params.id));
    const viewerIsCompany = gig.company_id === user.id;
    const reveal = contactVisible(app.status, gig.date);
    const otherId = viewerIsCompany ? app.freelancer_id : gig.company_id;
    if (reveal) auditAccess(ctx, req, 'contact.view', otherId);
    res.json({
      ...applicationSummary(ctx, app, gig, user.id),
      other: counterpart(ctx, otherId, reveal),
      address: reveal ? ctx.vault.maybeDecrypt(gig.address_enc, 'gig.address') : null,
    });
  });

  router.post('/applications/:id/decide', write, (req, res) => {
    const { decision } = parse(z.strictObject({ decision: z.enum(['accept', 'reject']) }), req.body);
    const { app, gig, user } = loadParty(ctx, req, idParam(req.params.id));
    const expected = user.role === 'company' ? 'pending' : 'invited';
    if (app.status !== expected) throw new HttpError(409, 'Esta candidatura não está aguardando sua resposta.');

    if (decision === 'reject') {
      run(ctx.db, "UPDATE applications SET status = 'rejected', decided_at = ? WHERE id = ?", Date.now(), app.id);
      audit(ctx, req, 'application.reject');
      return void res.json({ status: 'rejected' });
    }

    tx(ctx.db, () => {
      const fresh = one<{ status: string; slots: number; accepted: number; date: string }>(
        ctx.db,
        `SELECT g.status, g.slots, g.date, (SELECT COUNT(*) FROM applications x WHERE x.gig_id = g.id AND x.status = 'accepted') AS accepted
         FROM gigs g WHERE g.id = ?`,
        gig.id,
      )!;
      if (fresh.status !== 'open' || fresh.date < today() || fresh.accepted >= fresh.slots) {
        throw new HttpError(409, 'Esta vaga não tem mais posições abertas.');
      }
      run(ctx.db, "UPDATE applications SET status = 'accepted', decided_at = ? WHERE id = ?", Date.now(), app.id);
      if (fresh.accepted + 1 >= fresh.slots) {
        run(ctx.db, "UPDATE gigs SET status = 'filled' WHERE id = ?", gig.id);
        run(ctx.db, "UPDATE applications SET status = 'rejected', decided_at = ? WHERE gig_id = ? AND status IN ('pending','invited')", Date.now(), gig.id);
      }
    });
    audit(ctx, req, 'application.accept', { targetUserId: user.role === 'company' ? app.freelancer_id : gig.company_id });
    res.json({ status: 'accepted' });
  });

  router.post('/applications/:id/withdraw', requireRole('freelancer'), write, (req, res) => {
    const { app, gig } = loadParty(ctx, req, idParam(req.params.id));
    if (!['pending', 'invited', 'accepted'].includes(app.status)) throw new HttpError(409, 'Esta candidatura já foi encerrada.');
    tx(ctx.db, () => {
      run(ctx.db, "UPDATE applications SET status = 'withdrawn', decided_at = ? WHERE id = ?", Date.now(), app.id);
      // Liberou uma posição de uma vaga lotada: ela volta a aceitar candidatos.
      if (app.status === 'accepted' && gig.status === 'filled' && gig.date >= today()) {
        run(ctx.db, "UPDATE gigs SET status = 'open' WHERE id = ?", gig.id);
      }
    });
    audit(ctx, req, 'application.withdraw', { targetUserId: gig.company_id });
    res.json({ status: 'withdrawn' });
  });

  router.get('/applications/:id/messages', (req, res) => {
    const { app, gig, user } = loadParty(ctx, req, idParam(req.params.id));
    const after = Number(req.query.after ?? 0);
    const rows = all<{ id: string; sender_id: string; body_enc: string | null; created_at: number }>(
      ctx.db,
      'SELECT * FROM messages WHERE application_id = ? AND created_at > ? ORDER BY created_at LIMIT 200',
      app.id, Number.isFinite(after) ? after : 0,
    );
    const column = gig.company_id === user.id ? 'company_read_at' : 'freelancer_read_at';
    run(ctx.db, `UPDATE applications SET ${column} = ? WHERE id = ?`, Date.now(), app.id);
    res.json({
      status: app.status,
      contactUnlocked: contactVisible(app.status, gig.date),
      messages: rows.map((m) => ({
        id: m.id,
        mine: m.sender_id === user.id,
        body: ctx.vault.maybeDecrypt(m.body_enc, 'message.body'),
        at: m.created_at,
      })),
    });
  });

  router.post('/applications/:id/messages', write, (req, res) => {
    const { body } = parse(z.strictObject({ body: text(1, 1000, 'a mensagem') }), req.body);
    const { app, gig, user } = loadParty(ctx, req, idParam(req.params.id));
    if (!['invited', 'pending', 'accepted'].includes(app.status)) throw new HttpError(409, 'Esta conversa foi encerrada.');
    const unlocked = contactVisible(app.status, gig.date);
    const safe = unlocked ? { body, masked: false } : maskContacts(body);
    const message = { id: randomUUID(), at: Date.now() };
    run(
      ctx.db,
      'INSERT INTO messages (id, application_id, sender_id, body_enc, created_at) VALUES (?,?,?,?,?)',
      message.id, app.id, user.id, ctx.vault.encrypt(safe.body, 'message.body'), message.at,
    );
    res.status(201).json({ ...message, mine: true, body: safe.body, masked: safe.masked });
  });

  router.post('/applications/:id/review', write, (req, res) => {
    const { stars } = parse(z.strictObject({ stars: z.number().int().min(1).max(5) }), req.body);
    const { app, gig, user } = loadParty(ctx, req, idParam(req.params.id));
    if (app.status !== 'accepted' || gig.date >= today()) throw new HttpError(409, 'A avaliação abre depois que o turno acontece.');
    if (hasReviewed(ctx, app.id, user.id)) throw new HttpError(409, 'Você já avaliou este turno.');
    const toUser = gig.company_id === user.id ? app.freelancer_id : gig.company_id;
    run(
      ctx.db,
      'INSERT INTO reviews (id, application_id, from_user, to_user, stars, created_at) VALUES (?,?,?,?,?,?)',
      randomUUID(), app.id, user.id, toUser, stars, Date.now(),
    );
    audit(ctx, req, 'review.create', { targetUserId: toUser });
    res.status(201).json({ ok: true });
  });

  return router;
}
