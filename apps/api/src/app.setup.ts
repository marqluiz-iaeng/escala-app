import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { Env } from './config/env.js';
import { APP_VERSION } from './version.js';

const BODY_LIMIT = '64kb';

/** Configuração de segurança compartilhada entre a execução real e os testes. */
export function configureApp(app: NestExpressApplication, env: Env): void {
  app.disable('x-powered-by');
  app.use(
    helmet({
      // A API só devolve JSON. Nenhum navegador deveria carregar nada a partir dela.
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"] },
      },
      referrerPolicy: { policy: 'no-referrer' },
      strictTransportSecurity:
        env.NODE_ENV === 'production' ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );
  app.useBodyParser('json', { limit: BODY_LIMIT });
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: false });
  app.enableShutdownHooks();

  // A documentação da API não fica exposta em produção.
  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder().setTitle('API do Escala').setVersion(APP_VERSION).build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      ui: false,
      raw: ['json'],
      jsonDocumentUrl: 'openapi.json',
    });
  }
}
