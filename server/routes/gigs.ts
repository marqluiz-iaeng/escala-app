import { randomUUID } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { all, one, run, tx } from '../db.ts';
import { CATEGORIES, PAY_TYPES, addDays, citySchema, text, today } from '../domain.ts';
import { audit, HttpError, idParam, me, parse, requireAuth, requireRole, type Ctx } from '../http.ts';

const dateSchema = z.string({ error: 'Informe a data.' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.');
const timeSchema = z.string({ error: 'Informe o horário.' }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.');

const gigSchema = z.strictObject({
  title: text(4, 80, 'o título'),
  category: z.enum(CATEGORIES, { error: 'Escolha a função.' }),
  description: text(10, 800, 'a descrição'),
  city: citySchema,
  neighbourhood: text(2, 60, 'o bairro'),
  address: text(5, 160, 'o endereço'),
  date: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  payCents: z.number({ error: 'Informe o valor.' }).int().min(1000, 'Valor mínimo de R$ 10.').max(10_000_000, 'Valor acima do limite.'),
  payType: z.enum(PAY_TYPES, { error: 'Escolha o tipo de pagamento.' }),
  slots: z.number({ error: 'Informe as vagas.' }).int().min(1, 'Mínimo de 1 vaga.').max(50, 'Máximo de 50 vagas.'),
});

const feedQuery = z.object({
  category: z.enum(CATEGORIES).optional(),
  city: z.string().trim().max(60).optional(),
  q: z.string().trim().max(60).optional(),
  when: z.enum(['today', 'weekend', 'week']).optional(),
});

export type GigRow = {
  id: string; company_id: string; title: string; category: string; description: string; city: string; neighbourhood: string;
  address_enc: string | null; date: string; start_time: string; end_time: string; pay_cents: number; pay_type: string; slots: number;
  status: string; created_at: number; company_name: string; company_status: string; segment: string | null; about: string | null; verified: number | null;
  rating: number | null; rating_count: number; accepted_count: number; pending_count: number; my_app_id?: string | null; my_app_status?: string | null;
};

export const GIG_SELECT = `
  SELECT g.*, u.display_name AS company_name, u.status AS company_status, cp.segment, cp.about, cp.verified,
    (SELECT ROUND(AVG(r.stars), 1) FROM reviews r WHERE r.to_user = g.company_id) AS rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.to_user = g.company_id) AS rating_count,
    (SELECT COUNT(*) FROM applications a WHERE a.gig_id = g.id AND a.status = 'accepted') AS accepted_count,
    (SELECT COUNT(*) FROM applications a WHERE a.gig_id = g.id AND a.status = 'pending') AS pending_count
  FROM gigs g JOIN users u ON u.id = g.company_id LEFT JOIN company_profiles cp ON cp.user_id = g.company_id`;

/** Visão pública de uma vaga: o endereço exato nunca aparece aqui. */
export function gigPublic(g: GigRow) {
  return {
    id: g.id,
    title: g.title,
    category: g.category,
    description: g.description,
    city: g.city,
    neighbourhood: g.neighbourhood,
    date: g.date,
    startTime: g.start_time,
    endTime: g.end_time,
    payCents: g.pay_cents,
    payType: g.pay_type,
    slots: g.slots,
    slotsLeft: Math.max(0, g.slots - g.accepted_count),
    status: g.status,
    company: {
      id: g.company_id,
      name: g.company_name,
      segment: g.segment,
      about: g.about ?? '',
      verified: !!g.verified,
      rating: g.rating,
      ratingCount: g.rating_count,
    },
  };
}

function ownedGig(ctx: Ctx, gigId: string, companyId: string): GigRow {
  const gig = one<GigRow>(ctx.db, `${GIG_SELECT} WHERE g.id = ? AND g.company_id = ?`, gigId, companyId);
  // Vaga alheia responde igual a vaga inexistente.
  if (!gig) throw new HttpError(404, 'Vaga não encontrada.');
  return gig;
}

function weekendRange(from: string): [string, string] {
  const day = new Date(`${from}T12:00:00Z`).getUTCDay();
  const friday = day === 0 ? addDays(from, -2) : addDays(from, (5 - day + 7) % 7);
  const start = day === 0 || day === 6 ? from : friday;
  const sunday = day === 0 ? from : addDays(friday, 2);
  return [start, sunday];
}

const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

export function gigRoutes(ctx: Ctx, write: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', requireRole('freelancer'), (req, res) => {
    const query = parse(feedQuery, req.query);
    const user = me(req);
    const now = today();
    const where = ["g.status = 'open'", 'g.date >= ?', "u.status = 'active'"];
    const params: (string | number)[] = [now];
    if (query.category) { where.push('g.category = ?'); params.push(query.category); }
    if (query.city) { where.push('g.city = ?'); params.push(query.city); }
    if (query.q) {
      where.push("(g.title LIKE ? ESCAPE '\\' OR g.description LIKE ? ESCAPE '\\' OR u.display_name LIKE ? ESCAPE '\\')");
      const like = `%${escapeLike(query.q)}%`;
      params.push(like, like, like);
    }
    if (query.when === 'today') { where.push('g.date = ?'); params.push(now); }
    if (query.when === 'week') { where.push('g.date <= ?'); params.push(addDays(now, 7)); }
    if (query.when === 'weekend') {
      const [start, end] = weekendRange(now);
      where.push('g.date BETWEEN ? AND ?');
      params.push(start, end);
    }
    const rows = all<GigRow>(
      ctx.db,
      `SELECT feed.*, a.id AS my_app_id, a.status AS my_app_status FROM (
         ${GIG_SELECT} WHERE ${where.join(' AND ')} ORDER BY g.date, g.start_time LIMIT 60
       ) feed LEFT JOIN applications a ON a.gig_id = feed.id AND a.freelancer_id = ?`,
      ...params, user.id,
    );
    const cities = all<{ city: string }>(ctx.db, "SELECT DISTINCT city FROM gigs WHERE status = 'open' AND date >= ? ORDER BY city", now);
    res.json({
      gigs: rows.map((g) => ({ ...gigPublic(g), myApplication: g.my_app_id ? { id: g.my_app_id, status: g.my_app_status } : null })),
      cities: cities.map((c) => c.city),
    });
  });

  router.get('/mine', requireRole('company'), (req, res) => {
    const rows = all<GigRow>(
      ctx.db,
      `${GIG_SELECT} WHERE g.company_id = ? ORDER BY (g.date < ?) ASC, CASE WHEN g.date >= ? THEN g.date END ASC, g.date DESC LIMIT 100`,
      me(req).id, today(), today(),
    );
    res.json({ gigs: rows.map((g) => ({ ...gigPublic(g), pendingCount: g.pending_count, acceptedCount: g.accepted_count })) });
  });

  router.post('/', requireRole('company'), write, (req, res) => {
    const body = parse(gigSchema, req.body);
    const now = today();
    if (body.date < now || body.date > addDays(now, 365)) {
      throw new HttpError(400, 'Confira os campos destacados.', { date: 'Escolha uma data entre hoje e os próximos 12 meses.' });
    }
    const id = randomUUID();
    run(
      ctx.db,
      `INSERT INTO gigs (id, company_id, title, category, description, city, neighbourhood, address_enc, date, start_time, end_time, pay_cents, pay_type, slots, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, me(req).id, body.title, body.category, body.description, body.city, body.neighbourhood,
      ctx.vault.encrypt(body.address, 'gig.address'), body.date, body.startTime, body.endTime, body.payCents, body.payType, body.slots, Date.now(),
    );
    audit(ctx, req, 'gig.create');
    res.status(201).json(gigPublic(ownedGig(ctx, id, me(req).id)));
  });

  router.get('/:id', requireRole('company'), (req, res) => {
    const gig = ownedGig(ctx, idParam(req.params.id), me(req).id);
    res.json({
      ...gigPublic(gig),
      address: ctx.vault.maybeDecrypt(gig.address_enc, 'gig.address'),
      pendingCount: gig.pending_count,
      acceptedCount: gig.accepted_count,
    });
  });

  router.post('/:id/status', requireRole('company'), write, (req, res) => {
    const { status } = parse(z.strictObject({ status: z.enum(['closed', 'cancelled']) }), req.body);
    const gig = ownedGig(ctx, idParam(req.params.id), me(req).id);
    if (gig.status === 'cancelled' || gig.status === 'closed') throw new HttpError(409, 'Esta vaga já foi encerrada.');
    tx(ctx.db, () => {
      run(ctx.db, 'UPDATE gigs SET status = ? WHERE id = ?', status, gig.id);
      run(ctx.db, "UPDATE applications SET status = 'rejected', decided_at = ? WHERE gig_id = ? AND status IN ('pending','invited')", Date.now(), gig.id);
      if (status === 'cancelled') {
        run(ctx.db, "UPDATE applications SET status = 'cancelled', decided_at = ? WHERE gig_id = ? AND status = 'accepted'", Date.now(), gig.id);
      }
    });
    audit(ctx, req, `gig.${status}`);
    res.json({ ok: true });
  });

  return router;
}
