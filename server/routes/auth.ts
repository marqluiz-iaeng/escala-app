import { randomUUID } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { allowSend, burnCode, checkCode, codeSchema, invalidCode, issueCode, loadCode, recordFailure, sendLater, type CodeRow } from '../codes.ts';
import { POLICY_VERSION } from '../config.ts';
import { one, run, tx } from '../db.ts';
import {
  CATEGORIES, SEGMENTS, citySchema, emailSchema, isValidCnpj, nameSchema, passwordSchema, phoneSchema, publicName, text,
} from '../domain.ts';
import { audit, endSession, HttpError, parse, requireAuth, startSession, type Ctx } from '../http.ts';
import { templates } from '../mail.ts';
import { hashPassword, verifyPassword } from '../vault.ts';

const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;
const GENERIC_LOGIN_ERROR = 'E-mail ou senha incorretos, ou acesso temporariamente bloqueado.';
const PAYLOAD_CONTEXT = 'otp.signup';

const consentsSchema = z.strictObject({
  terms: z.literal(true, { error: 'É preciso aceitar os termos e a política para criar a conta.' }),
  adult: z.literal(true, { error: 'A plataforma é exclusiva para maiores de 18 anos.' }),
  discovery: z.boolean(),
  marketing: z.boolean(),
});

const common = { email: emailSchema, password: passwordSchema, phone: phoneSchema, city: citySchema, consents: consentsSchema };

const registerSchema = z.discriminatedUnion('role', [
  z.strictObject({
    role: z.literal('freelancer'),
    fullName: nameSchema,
    categories: z.array(z.enum(CATEGORIES)).min(1, 'Escolha ao menos uma função.').max(4, 'Escolha até 4 funções.'),
    bio: text(0, 400, 'a apresentação').default(''),
    experienceYears: z.number().int().min(0).max(60).default(0),
    dayRateCents: z.number().int().min(1000, 'Valor mínimo de R$ 10.').max(10_000_000).nullable().default(null),
    ...common,
  }),
  z.strictObject({
    role: z.literal('company'),
    tradeName: text(2, 80, 'o nome da empresa'),
    contactName: nameSchema,
    cnpj: z
      .string({ error: 'Informe o CNPJ.' })
      .transform((v) => v.toUpperCase().replace(/[^0-9A-Z]/g, ''))
      .refine(isValidCnpj, 'CNPJ inválido.'),
    segment: z.enum(SEGMENTS, { error: 'Escolha o segmento.' }),
    about: text(0, 400, 'a descrição').default(''),
    ...common,
  }),
], { error: 'Escolha o tipo de conta.' });

type Registration = z.infer<typeof registerSchema>;
type WithoutPassword<T> = T extends unknown ? Omit<T, 'password'> : never;
/** O que fica guardado, cifrado, enquanto o e-mail não é confirmado. Nunca a senha em si. */
type PendingSignup = WithoutPassword<Registration> & { passwordHash: string; consentedAt: number };

const loginSchema = z.strictObject({ email: emailSchema, password: z.string().min(1).max(128) });
const emailOnly = z.strictObject({ email: emailSchema });
const verifySchema = z.strictObject({ email: emailSchema, code: codeSchema, password: z.string().min(1).max(128) });
const resetSchema = z.strictObject({ email: emailSchema, code: codeSchema, password: passwordSchema });

export function recordConsent(ctx: Ctx, userId: string, purpose: string, granted: boolean, at = Date.now()) {
  run(
    ctx.db,
    'INSERT INTO consents (id, user_id, purpose, version, granted, created_at) VALUES (?,?,?,?,?,?)',
    randomUUID(), userId, purpose, POLICY_VERSION, granted ? 1 : 0, at,
  );
}

function passwordContainsEmail(password: string, email: string): boolean {
  const local = email.split('@')[0] ?? '';
  return local.length >= 4 && password.toLowerCase().includes(local);
}

function createAccount(ctx: Ctx, pending: PendingSignup): string {
  const id = randomUUID();
  const fullName = pending.role === 'freelancer' ? pending.fullName : pending.contactName;
  const displayName = pending.role === 'freelancer' ? publicName(pending.fullName) : pending.tradeName;
  run(
    ctx.db,
    `INSERT INTO users (id, role, email_index, email_enc, password_hash, phone_enc, full_name_enc, display_name, city, created_at, last_login_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    id, pending.role, ctx.vault.index(pending.email, 'email'), ctx.vault.encrypt(pending.email, 'user.email'), pending.passwordHash,
    ctx.vault.encrypt(pending.phone, 'user.phone'), ctx.vault.encrypt(fullName, 'user.fullName'),
    displayName, pending.city, Date.now(), Date.now(),
  );
  if (pending.role === 'freelancer') {
    run(
      ctx.db,
      'INSERT INTO freelancer_profiles (user_id, categories, bio, experience_years, day_rate_cents, discoverable) VALUES (?,?,?,?,?,?)',
      id, JSON.stringify(pending.categories), pending.bio, pending.experienceYears, pending.dayRateCents, pending.consents.discovery ? 1 : 0,
    );
    recordConsent(ctx, id, 'discovery', pending.consents.discovery, pending.consentedAt);
  } else {
    // Empresa nasce não verificada: o selo depende de checagem externa, fora do protótipo.
    run(
      ctx.db,
      'INSERT INTO company_profiles (user_id, segment, about, cnpj_index, cnpj_enc, verified) VALUES (?,?,?,?,?,0)',
      id, pending.segment, pending.about, ctx.vault.index(pending.cnpj, 'cnpj'), ctx.vault.encrypt(pending.cnpj, 'company.cnpj'),
    );
  }
  recordConsent(ctx, id, 'terms', true, pending.consentedAt);
  recordConsent(ctx, id, 'adult_declaration', true, pending.consentedAt);
  recordConsent(ctx, id, 'marketing', pending.consents.marketing, pending.consentedAt);
  return id;
}

export function authRoutes(ctx: Ctx, sensitive: RequestHandler): Router {
  const router = Router();
  let dummyHash: Promise<string> | null = null;
  const conflict = () => new HttpError(409, 'Não foi possível concluir o cadastro com esses dados. Se já tem conta, tente entrar.');
  const readPending = (row: CodeRow) => JSON.parse(ctx.vault.decrypt(row.payload_enc ?? '', PAYLOAD_CONTEXT)) as PendingSignup;

  const resendSignupCode = (row: CodeRow, email: string, emailIndex: string) => {
    if (!allowSend(ctx, emailIndex)) return;
    sendLater(ctx, { to: email, ...templates.signupCode(issueCode(ctx, 'signup', emailIndex, row.payload_enc, row.created_at)) });
  };

  /**
   * Nada é criado em `users` aqui. E-mail novo ou já cadastrado recebem exatamente a mesma resposta,
   * e o hash da senha é sempre calculado, para o tempo de resposta também não denunciar.
   * Só quem controla a caixa de entrada descobre qual foi o caso.
   */
  router.post('/register', sensitive, async (req, res) => {
    const body = parse(registerSchema, req.body);
    if (passwordContainsEmail(body.password, body.email)) {
      throw new HttpError(400, 'Confira os campos destacados.', { password: 'A senha não pode conter seu e-mail.' });
    }
    // O CNPJ identifica a empresa e não é segredo: avisar que já existe não expõe o e-mail de ninguém.
    if (body.role === 'company' && one(ctx.db, 'SELECT 1 FROM company_profiles WHERE cnpj_index = ?', ctx.vault.index(body.cnpj, 'cnpj'))) {
      throw conflict();
    }

    const { password, ...data } = body;
    const passwordHash = await hashPassword(password);
    const emailIndex = ctx.vault.index(body.email, 'email');

    if (allowSend(ctx, emailIndex)) {
      if (one(ctx.db, 'SELECT 1 FROM users WHERE email_index = ?', emailIndex)) {
        sendLater(ctx, { to: body.email, ...templates.accountExists() });
      } else {
        const pending: PendingSignup = { ...data, passwordHash, consentedAt: Date.now() };
        const code = issueCode(ctx, 'signup', emailIndex, ctx.vault.encrypt(JSON.stringify(pending), PAYLOAD_CONTEXT));
        sendLater(ctx, { to: body.email, ...templates.signupCode(code) });
      }
    }
    res.status(202).json({ ok: true });
  });

  /**
   * A senha é exigida junto com o código. Sem isso, um atacante poderia iniciar um cadastro com o
   * e-mail da vítima e a senha dele; se a vítima digitasse o código, ele teria acesso à conta (pré-sequestro).
   * A tela envia a senha sozinha, porque ela acabou de ser digitada.
   */
  router.post('/verify', sensitive, async (req, res) => {
    const body = parse(verifySchema, req.body);
    const emailIndex = ctx.vault.index(body.email, 'email');
    const row = checkCode(ctx, 'signup', emailIndex, body.code);
    const pending = readPending(row);
    if (!(await verifyPassword(body.password, pending.passwordHash))) {
      recordFailure(ctx, 'signup', emailIndex);
      throw invalidCode();
    }

    let id: string;
    try {
      id = tx(ctx.db, () => {
        if (!burnCode(ctx, 'signup', emailIndex)) throw invalidCode();
        return createAccount(ctx, pending);
      });
    } catch (err) {
      if ((err as Error).message.includes('UNIQUE')) throw conflict();
      throw err;
    }
    audit(ctx, req, 'account.create', { actorId: id });
    startSession(ctx, req, res, id);
    res.status(201).json({ ok: true });
  });

  router.post('/verify/resend', sensitive, (req, res) => {
    const { email } = parse(emailOnly, req.body);
    const emailIndex = ctx.vault.index(email, 'email');
    const row = loadCode(ctx, 'signup', emailIndex);
    if (row) resendSignupCode(row, email, emailIndex);
    res.status(202).json({ ok: true });
  });

  router.post('/login', sensitive, async (req, res) => {
    const body = parse(loginSchema, req.body);
    const emailIndex = ctx.vault.index(body.email, 'email');
    const user = one<{ id: string; password_hash: string; failed_logins: number; locked_until: number | null }>(
      ctx.db,
      "SELECT id, password_hash, failed_logins, locked_until FROM users WHERE email_index = ? AND status = 'active'",
      emailIndex,
    );

    // Conta inexistente ou bloqueada também calcula um hash: o tempo de resposta não revela nada.
    dummyHash ??= hashPassword('senha-que-nunca-sera-usada');

    if (!user) {
      // Cadastro sem confirmar: só quem digitou a senha certa fica sabendo que ele existe.
      const pendingRow = loadCode(ctx, 'signup', emailIndex);
      const pending = pendingRow ? readPending(pendingRow) : null;
      const valid = await verifyPassword(body.password, pending?.passwordHash ?? (await dummyHash));
      if (pendingRow && valid) {
        resendSignupCode(pendingRow, body.email, emailIndex);
        throw new HttpError(403, 'Confirme seu e-mail para entrar.', undefined, 'email_unverified');
      }
      throw new HttpError(401, GENERIC_LOGIN_ERROR);
    }

    const locked = !!user.locked_until && user.locked_until > Date.now();
    const valid = await verifyPassword(body.password, locked ? await dummyHash : user.password_hash);

    if (locked || !valid) {
      if (!locked) {
        const failures = user.failed_logins + 1;
        const lock = failures >= MAX_FAILED_LOGINS;
        run(
          ctx.db,
          'UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?',
          lock ? 0 : failures, lock ? Date.now() + LOCK_MS : null, user.id,
        );
        audit(ctx, req, lock ? 'login.locked' : 'login.failed', { actorId: user.id });
        if (lock && allowSend(ctx, emailIndex)) sendLater(ctx, { to: body.email, ...templates.accountLocked() });
      }
      throw new HttpError(401, GENERIC_LOGIN_ERROR);
    }

    run(ctx.db, 'UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = ? WHERE id = ?', Date.now(), user.id);
    audit(ctx, req, 'login.success', { actorId: user.id });
    startSession(ctx, req, res, user.id);
    res.json({ ok: true });
  });

  router.post('/logout', requireAuth, (req, res) => {
    audit(ctx, req, 'logout');
    endSession(ctx, req, res);
    res.json({ ok: true });
  });

  // A resposta é sempre a mesma: esta rota não pode servir para descobrir quem tem conta.
  router.post('/password/forgot', sensitive, (req, res) => {
    const { email } = parse(emailOnly, req.body);
    const emailIndex = ctx.vault.index(email, 'email');
    const user = one<{ id: string }>(ctx.db, "SELECT id FROM users WHERE email_index = ? AND status = 'active'", emailIndex);
    if (user && allowSend(ctx, emailIndex)) {
      sendLater(ctx, { to: email, ...templates.passwordReset(issueCode(ctx, 'password_reset', emailIndex, null)) });
      audit(ctx, req, 'password.reset_requested', { actorId: user.id });
    }
    res.status(202).json({ ok: true });
  });

  router.post('/password/reset', sensitive, async (req, res) => {
    const body = parse(resetSchema, req.body);
    // Senha fraca é recusada antes de tocar no código, para o erro de digitação não gastar tentativas.
    if (passwordContainsEmail(body.password, body.email)) {
      throw new HttpError(400, 'Confira os campos destacados.', { password: 'A senha não pode conter seu e-mail.' });
    }
    const emailIndex = ctx.vault.index(body.email, 'email');
    checkCode(ctx, 'password_reset', emailIndex, body.code);
    const user = one<{ id: string }>(ctx.db, "SELECT id FROM users WHERE email_index = ? AND status = 'active'", emailIndex);
    if (!user) throw invalidCode();

    const passwordHash = await hashPassword(body.password);
    tx(ctx.db, () => {
      if (!burnCode(ctx, 'password_reset', emailIndex)) throw invalidCode();
      // Quem roubou uma sessão perde o acesso, e o titular recupera o acesso mesmo com a conta bloqueada.
      run(ctx.db, 'UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?', passwordHash, user.id);
      run(ctx.db, 'DELETE FROM sessions WHERE user_id = ?', user.id);
    });
    audit(ctx, req, 'password.reset', { actorId: user.id });
    sendLater(ctx, { to: body.email, ...templates.passwordChanged() });
    // Sem entrar automaticamente: a pessoa usa a senha nova no fluxo normal de login.
    res.json({ ok: true });
  });

  return router;
}
