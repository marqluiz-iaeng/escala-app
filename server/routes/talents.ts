import { randomUUID } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { all, one, run } from '../db.ts';
import { CATEGORIES, text, today } from '../domain.ts';
import { audit, auditAccess, HttpError, idParam, me, parse, requireRole, type Ctx } from '../http.ts';
import { freelancerCard, maskContacts } from './applications.ts';

const MAX_INVITES_PER_DAY = 30;

const talentQuery = z.object({
  category: z.enum(CATEGORIES).optional(),
  city: z.string().trim().max(60).optional(),
  available: z.enum(['1']).optional(),
});

export function talentRoutes(ctx: Ctx, write: RequestHandler): Router {
  const router = Router();
  router.use(requireRole('company'));

  // Só entra aqui quem deu consentimento (discoverable = 1). Nada de contato ou nome completo.
  router.get('/', (req, res) => {
    const query = parse(talentQuery, req.query);
    const where = ['p.discoverable = 1', "u.status = 'active'"];
    const params: string[] = [];
    if (query.category) {
      where.push('EXISTS (SELECT 1 FROM json_each(p.categories) c WHERE c.value = ?)');
      params.push(query.category);
    }
    if (query.city) { where.push('u.city = ?'); params.push(query.city); }
    if (query.available) where.push('p.available = 1');
    const rows = all<{ id: string }>(
      ctx.db,
      `SELECT u.id FROM users u JOIN freelancer_profiles p ON p.user_id = u.id WHERE ${where.join(' AND ')}
       ORDER BY p.available DESC, (SELECT AVG(r.stars) FROM reviews r WHERE r.to_user = u.id) DESC LIMIT 40`,
      ...params,
    );
    const cities = all<{ city: string }>(
      ctx.db,
      `SELECT DISTINCT u.city FROM users u JOIN freelancer_profiles p ON p.user_id = u.id
       WHERE p.discoverable = 1 AND u.status = 'active' ORDER BY u.city`,
    );
    res.json({ talents: rows.map((r) => freelancerCard(ctx, r.id)), cities: cities.map((c) => c.city) });
  });

  router.get('/:id', (req, res) => {
    const id = idParam(req.params.id);
    const allowed = one(
      ctx.db,
      `SELECT 1 FROM users u JOIN freelancer_profiles p ON p.user_id = u.id
       WHERE u.id = ? AND u.status = 'active' AND (
         p.discoverable = 1 OR EXISTS (
           SELECT 1 FROM applications a JOIN gigs g ON g.id = a.gig_id WHERE a.freelancer_id = u.id AND g.company_id = ? AND a.status != 'withdrawn'
         )
       )`,
      id, me(req).id,
    );
    if (!allowed) throw new HttpError(404, 'Perfil não encontrado.');
    auditAccess(ctx, req, 'profile.view', id);
    res.json(freelancerCard(ctx, id));
  });

  router.post('/:id/invite', write, (req, res) => {
    const id = idParam(req.params.id);
    const user = me(req);
    const body = parse(z.strictObject({ gigId: z.uuid('Escolha uma vaga.'), note: text(0, 400, 'a mensagem').optional() }), req.body);

    const gig = one<{ id: string; status: string; date: string }>(
      ctx.db, 'SELECT id, status, date FROM gigs WHERE id = ? AND company_id = ?', body.gigId, user.id,
    );
    if (!gig) throw new HttpError(404, 'Vaga não encontrada.');
    if (gig.status !== 'open' || gig.date < today()) throw new HttpError(409, 'Esta vaga não está mais aberta.');

    const target = one(
      ctx.db,
      "SELECT 1 FROM users u JOIN freelancer_profiles p ON p.user_id = u.id WHERE u.id = ? AND u.status = 'active' AND p.discoverable = 1",
      id,
    );
    if (!target) throw new HttpError(404, 'Perfil não encontrado.');

    if (one(ctx.db, 'SELECT 1 FROM applications WHERE gig_id = ? AND freelancer_id = ?', gig.id, id)) {
      throw new HttpError(409, 'Esta pessoa já está nesta vaga.');
    }
    const sentToday = one<{ n: number }>(
      ctx.db,
      `SELECT COUNT(*) AS n FROM applications a JOIN gigs g ON g.id = a.gig_id
       WHERE g.company_id = ? AND a.status = 'invited' AND a.created_at > ?`,
      user.id, Date.now() - 86_400_000,
    )?.n ?? 0;
    if (sentToday >= MAX_INVITES_PER_DAY) throw new HttpError(429, 'Limite diário de convites atingido.');

    const note = body.note ? maskContacts(body.note).body : null;
    const appId = randomUUID();
    run(
      ctx.db,
      "INSERT INTO applications (id, gig_id, freelancer_id, status, note_enc, created_at) VALUES (?,?,?,'invited',?,?)",
      appId, gig.id, id, note ? ctx.vault.encrypt(note, 'application.note') : null, Date.now(),
    );
    audit(ctx, req, 'invite.create', { targetUserId: id });
    res.status(201).json({ id: appId, status: 'invited' });
  });

  return router;
}
