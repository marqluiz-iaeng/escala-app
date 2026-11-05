import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import { ROOT, POLICY_VERSION, type Config } from './config.ts';
import { openDb } from './db.ts';
import { CATEGORIES, SEGMENTS, emailSchema } from './domain.ts';
import { csrfGuard, errorHandler, HttpError, parse, sessionLoader, type Ctx } from './http.ts';
import { createMailer } from './mail.ts';
import { CONTROLLER, DATA_MAP } from './privacyMap.ts';
import { applicationRoutes } from './routes/applications.ts';
import { authRoutes } from './routes/auth.ts';
import { gigRoutes } from './routes/gigs.ts';
import { meRoutes } from './routes/me.ts';
import { privacyRoutes } from './routes/privacy.ts';
import { talentRoutes } from './routes/talents.ts';
import { createVault } from './vault.ts';

export const DEMO_EMAILS = { freelancer: 'ana.demo@example.com', company: 'casa.aurora@example.com' };

const DEMO_INBOX_WINDOW_MS = 30 * 60 * 1000;

export function createApp(config: Config) {
  const ctx: Ctx = { config, db: openDb(config.dbPath), vault: createVault(config.encKey, config.hmacKey), mailer: createMailer(config) };
  const demoOutbox = config.demoMode ? ctx.mailer.outbox : undefined;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          manifestSrc: ["'self'"],
          baseUri: ["'none'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      referrerPolicy: { policy: 'no-referrer' },
      strictTransportSecurity: config.secureCookies ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()');
    next();
  });

  const limiter = (windowMs: number, limit: number, message: string) =>
    rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: message } });
  const sensitive = limiter(15 * 60 * 1000, config.limits.authPerWindow, 'Muitas tentativas. Aguarde alguns minutos.');
  const write = limiter(60 * 1000, config.limits.writePerMinute, 'Muitas ações em pouco tempo. Aguarde um instante.');

  const api = Router();
  api.use(limiter(60 * 1000, config.limits.globalPerMinute, 'Muitas requisições. Aguarde um instante.'));
  api.use((_req, res, next) => {
    // Respostas com dados pessoais nunca ficam em cache de navegador ou de proxy.
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  api.use(csrfGuard(config));
  api.use(express.json({ limit: '32kb', type: 'application/json', strict: true }));
  api.use(sessionLoader(ctx));

  api.get('/meta', (_req, res) => {
    res.json({
      policyVersion: POLICY_VERSION,
      controller: CONTROLLER,
      dataMap: DATA_MAP,
      categories: CATEGORIES,
      segments: SEGMENTS,
      // Contas fictícias só existem no modo demonstração, que o servidor recusa em produção.
      demoAccounts: config.demoMode && config.demoPassword
        ? [
            { label: 'Freelancer', hint: 'Ana, bartender', email: DEMO_EMAILS.freelancer, password: config.demoPassword },
            { label: 'Empresa', hint: 'Casa Aurora Bar', email: DEMO_EMAILS.company, password: config.demoPassword },
          ]
        : [],
      demoInbox: !!demoOutbox,
    });
  });

  // Caixa de entrada simulada: esta rota nem existe fora do modo demonstração, que o servidor recusa em produção.
  if (demoOutbox) {
    api.post('/dev/outbox', (req, res) => {
      const { email } = parse(z.strictObject({ email: emailSchema }), req.body);
      const since = Date.now() - DEMO_INBOX_WINDOW_MS;
      const messages = demoOutbox.filter((m) => m.to === email && m.at > since).slice(-5).reverse();
      res.json({ messages: messages.map(({ subject, text, at }) => ({ subject, text, at })) });
    });
  }

  api.use('/auth', authRoutes(ctx, sensitive));
  api.use('/me', meRoutes(ctx, sensitive));
  api.use('/privacy', privacyRoutes(ctx, sensitive));
  api.use('/talents', talentRoutes(ctx, write));
  api.use(applicationRoutes(ctx, write));
  api.use('/gigs', gigRoutes(ctx, write));
  api.use((_req, _res, next) => next(new HttpError(404, 'Não encontrado.')));
  app.use('/api', api);

  const dist = join(ROOT, 'client', 'dist');
  if (existsSync(dist)) {
    app.use(
      express.static(dist, {
        setHeaders(res, path) {
          res.setHeader('Cache-Control', path.includes(`${join('dist', 'assets')}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
        },
      }),
    );
  }

  app.use(errorHandler);
  return { app, ctx };
}
