import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { allowSend, burnCode, checkCode, codeSchema, invalidCode, issueCode, sendLater } from '../codes.ts';
import { one, run, tx } from '../db.ts';
import { CATEGORIES, SEGMENTS, citySchema, emailSchema, nameSchema, passwordSchema, phoneSchema, publicName, text } from '../domain.ts';
import { audit, HttpError, me, parse, ratingOf, requireAuth, startSession, unreadCount, type Ctx } from '../http.ts';
import { maskEmail, templates } from '../mail.ts';
import { hashPassword, verifyPassword } from '../vault.ts';

const freelancerPatch = z.strictObject({
  fullName: nameSchema.optional(),
  phone: phoneSchema.optional(),
  city: citySchema.optional(),
  categories: z.array(z.enum(CATEGORIES)).min(1, 'Escolha ao menos uma função.').max(4, 'Escolha até 4 funções.').optional(),
  bio: text(0, 400, 'a apresentação').optional(),
  experienceYears: z.number().int().min(0).max(60).optional(),
  dayRateCents: z.number().int().min(1000).max(10_000_000).nullable().optional(),
  available: z.boolean().optional(),
});

const companyPatch = z.strictObject({
  tradeName: text(2, 80, 'o nome da empresa').optional(),
  contactName: nameSchema.optional(),
  phone: phoneSchema.optional(),
  city: citySchema.optional(),
  segment: z.enum(SEGMENTS).optional(),
  about: text(0, 400, 'a descrição').optional(),
});

const passwordChange = z.strictObject({ current: z.string().min(1).max(128), next: passwordSchema });
const emailChange = z.strictObject({ email: emailSchema, password: z.string().min(1).max(128) });
const emailConfirm = z.strictObject({ code: codeSchema });
const EMAIL_CHANGE_CONTEXT = 'otp.email_change';

type UserRow = {
  id: string; role: 'freelancer' | 'company'; email_enc: string; phone_enc: string; full_name_enc: string; display_name: string; city: string; created_at: number;
};

export function loadOwnProfile(ctx: Ctx, userId: string) {
  const user = one<UserRow>(ctx.db, 'SELECT * FROM users WHERE id = ?', userId);
  if (!user) throw new HttpError(404, 'Não encontrado.');
  const base = {
    id: user.id,
    role: user.role,
    displayName: user.display_name,
    fullName: ctx.vault.decrypt(user.full_name_enc, 'user.fullName'),
    email: ctx.vault.decrypt(user.email_enc, 'user.email'),
    phone: ctx.vault.decrypt(user.phone_enc, 'user.phone'),
    city: user.city,
    createdAt: user.created_at,
    ...ratingOf(ctx, user.id),
  };
  if (user.role === 'freelancer') {
    const p = one<{ categories: string; bio: string; experience_years: number; day_rate_cents: number | null; available: number; discoverable: number }>(
      ctx.db, 'SELECT * FROM freelancer_profiles WHERE user_id = ?', user.id,
    )!;
    return {
      ...base,
      freelancer: {
        categories: JSON.parse(p.categories) as string[],
        bio: p.bio,
        experienceYears: p.experience_years,
        dayRateCents: p.day_rate_cents,
        available: !!p.available,
        discoverable: !!p.discoverable,
      },
    };
  }
  const c = one<{ segment: string; about: string; cnpj_enc: string; verified: number }>(ctx.db, 'SELECT * FROM company_profiles WHERE user_id = ?', user.id)!;
  const cnpj = ctx.vault.decrypt(c.cnpj_enc, 'company.cnpj');
  return {
    ...base,
    company: {
      segment: c.segment,
      about: c.about,
      verified: !!c.verified,
      // Nem o próprio dono recebe o CNPJ inteiro em respostas de rotina.
      cnpjMasked: `${cnpj.slice(0, 2)}•••••••••${cnpj.slice(-3)}`,
    },
  };
}

export function meRoutes(ctx: Ctx, sensitive: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const user = me(req);
    res.json({ ...loadOwnProfile(ctx, user.id), unread: unreadCount(ctx, user.id, user.role) });
  });

  router.patch('/profile', (req, res) => {
    const user = me(req);
    if (user.role === 'freelancer') {
      const body = parse(freelancerPatch, req.body);
      tx(ctx.db, () => {
        if (body.fullName !== undefined) {
          run(ctx.db, 'UPDATE users SET full_name_enc = ?, display_name = ? WHERE id = ?',
            ctx.vault.encrypt(body.fullName, 'user.fullName'), publicName(body.fullName), user.id);
        }
        if (body.phone !== undefined) run(ctx.db, 'UPDATE users SET phone_enc = ? WHERE id = ?', ctx.vault.encrypt(body.phone, 'user.phone'), user.id);
        if (body.city !== undefined) run(ctx.db, 'UPDATE users SET city = ? WHERE id = ?', body.city, user.id);
        if (body.categories !== undefined) run(ctx.db, 'UPDATE freelancer_profiles SET categories = ? WHERE user_id = ?', JSON.stringify(body.categories), user.id);
        if (body.bio !== undefined) run(ctx.db, 'UPDATE freelancer_profiles SET bio = ? WHERE user_id = ?', body.bio, user.id);
        if (body.experienceYears !== undefined) run(ctx.db, 'UPDATE freelancer_profiles SET experience_years = ? WHERE user_id = ?', body.experienceYears, user.id);
        if (body.dayRateCents !== undefined) run(ctx.db, 'UPDATE freelancer_profiles SET day_rate_cents = ? WHERE user_id = ?', body.dayRateCents, user.id);
        if (body.available !== undefined) run(ctx.db, 'UPDATE freelancer_profiles SET available = ? WHERE user_id = ?', body.available ? 1 : 0, user.id);
      });
    } else {
      const body = parse(companyPatch, req.body);
      tx(ctx.db, () => {
        if (body.tradeName !== undefined) {
          // Trocar o nome derruba o selo: evita usar uma conta verificada para se passar por outra empresa.
          run(ctx.db, 'UPDATE users SET display_name = ? WHERE id = ?', body.tradeName, user.id);
          run(ctx.db, 'UPDATE company_profiles SET verified = 0 WHERE user_id = ?', user.id);
        }
        if (body.contactName !== undefined) run(ctx.db, 'UPDATE users SET full_name_enc = ? WHERE id = ?', ctx.vault.encrypt(body.contactName, 'user.fullName'), user.id);
        if (body.phone !== undefined) run(ctx.db, 'UPDATE users SET phone_enc = ? WHERE id = ?', ctx.vault.encrypt(body.phone, 'user.phone'), user.id);
        if (body.city !== undefined) run(ctx.db, 'UPDATE users SET city = ? WHERE id = ?', body.city, user.id);
        if (body.segment !== undefined) run(ctx.db, 'UPDATE company_profiles SET segment = ? WHERE user_id = ?', body.segment, user.id);
        if (body.about !== undefined) run(ctx.db, 'UPDATE company_profiles SET about = ? WHERE user_id = ?', body.about, user.id);
      });
    }
    audit(ctx, req, 'profile.update');
    res.json({ ...loadOwnProfile(ctx, user.id), unread: unreadCount(ctx, user.id, user.role) });
  });

  router.post('/password', sensitive, async (req, res) => {
    const user = me(req);
    const body = parse(passwordChange, req.body);
    const row = one<{ password_hash: string; email_enc: string }>(ctx.db, 'SELECT password_hash, email_enc FROM users WHERE id = ?', user.id)!;
    if (!(await verifyPassword(body.current, row.password_hash))) {
      throw new HttpError(403, 'Confira os campos destacados.', { current: 'Senha atual incorreta.' });
    }
    const hash = await hashPassword(body.next);
    // Trocar a senha encerra todas as sessões e abre uma nova só para este aparelho.
    tx(ctx.db, () => {
      run(ctx.db, 'UPDATE users SET password_hash = ? WHERE id = ?', hash, user.id);
      run(ctx.db, 'DELETE FROM sessions WHERE user_id = ?', user.id);
    });
    startSession(ctx, req, res, user.id);
    audit(ctx, req, 'password.change');
    sendLater(ctx, { to: ctx.vault.decrypt(row.email_enc, 'user.email'), ...templates.passwordChanged() });
    res.json({ ok: true });
  });

  // O código vai para o endereço novo, provando que ele é da pessoa. Se já tiver dono, a resposta é a mesma.
  router.post('/email', sensitive, async (req, res) => {
    const user = me(req);
    const body = parse(emailChange, req.body);
    const row = one<{ password_hash: string; email_enc: string }>(ctx.db, 'SELECT password_hash, email_enc FROM users WHERE id = ?', user.id)!;
    if (!(await verifyPassword(body.password, row.password_hash))) {
      throw new HttpError(403, 'Senha incorreta.', { password: 'Senha incorreta.' });
    }
    if (body.email === ctx.vault.decrypt(row.email_enc, 'user.email')) {
      throw new HttpError(400, 'Confira os campos destacados.', { email: 'Este já é o seu e-mail.' });
    }
    const emailIndex = ctx.vault.index(body.email, 'email');
    if (allowSend(ctx, emailIndex)) {
      if (one(ctx.db, 'SELECT 1 FROM users WHERE email_index = ?', emailIndex)) {
        sendLater(ctx, { to: body.email, ...templates.emailInUse() });
      } else {
        const code = issueCode(ctx, 'email_change', user.id, ctx.vault.encrypt(body.email, EMAIL_CHANGE_CONTEXT));
        sendLater(ctx, { to: body.email, ...templates.emailChangeCode(code) });
      }
    }
    res.status(202).json({ ok: true });
  });

  router.post('/email/confirm', sensitive, (req, res) => {
    const user = me(req);
    const { code } = parse(emailConfirm, req.body);
    const row = checkCode(ctx, 'email_change', user.id, code);
    const next = ctx.vault.decrypt(row.payload_enc ?? '', EMAIL_CHANGE_CONTEXT);
    const current = one<{ email_enc: string }>(ctx.db, 'SELECT email_enc FROM users WHERE id = ?', user.id)!;
    try {
      tx(ctx.db, () => {
        if (!burnCode(ctx, 'email_change', user.id)) throw invalidCode();
        run(
          ctx.db,
          'UPDATE users SET email_index = ?, email_enc = ? WHERE id = ?',
          ctx.vault.index(next, 'email'), ctx.vault.encrypt(next, 'user.email'), user.id,
        );
        run(ctx.db, 'DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', user.id, req.sessionHash ?? '');
      });
    } catch (err) {
      // O endereço foi ocupado depois de o código ser enviado.
      if ((err as Error).message.includes('UNIQUE')) throw invalidCode();
      throw err;
    }
    audit(ctx, req, 'email.change');
    sendLater(ctx, { to: ctx.vault.decrypt(current.email_enc, 'user.email'), ...templates.emailChanged(maskEmail(next)) });
    res.json({ ...loadOwnProfile(ctx, user.id), unread: unreadCount(ctx, user.id, user.role) });
  });

  return router;
}
