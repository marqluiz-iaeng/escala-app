import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..');
export const POLICY_VERSION = '2026-11-04-2';

export type Config = {
  production: boolean;
  host: string;
  port: number;
  dbPath: string;
  encKey: Buffer;
  hmacKey: Buffer;
  demoMode: boolean;
  demoPassword: string | null;
  allowedOrigins: string[];
  trustProxy: number;
  secureCookies: boolean;
  smtpUrl: string | null;
  mailFrom: string;
  limits: { authPerWindow: number; writePerMinute: number; globalPerMinute: number };
};

function key(name: string): Buffer {
  const raw = process.env[name];
  if (!raw) throw new Error(`Variável obrigatória ausente: ${name}`);
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error(`${name} precisa ter 32 bytes em base64.`);
  return buf;
}

/**
 * Em desenvolvimento, gera um .env local com chaves aleatórias na primeira execução.
 * Em produção nunca gera nada: sem as chaves corretas o servidor se recusa a subir.
 */
function ensureLocalEnv(path: string) {
  if (existsSync(path)) return;
  const secret = () => randomBytes(32).toString('base64');
  const body = [
    '# Gerado automaticamente para desenvolvimento local. Nunca versione este arquivo.',
    `ESCALA_ENC_KEY=${secret()}`,
    `ESCALA_HMAC_KEY=${secret()}`,
    `ESCALA_DEMO_PASSWORD=${randomBytes(12).toString('base64url')}`,
    'ESCALA_DEMO=true',
    '',
  ].join('\n');
  writeFileSync(path, body, { mode: 0o600 });
}

export function loadConfig(): Config {
  const production = process.env.NODE_ENV === 'production';
  if (!production) {
    const envPath = join(ROOT, '.env');
    ensureLocalEnv(envPath);
    process.loadEnvFile(envPath);
  }

  const demoMode = process.env.ESCALA_DEMO === 'true';
  if (production && demoMode) throw new Error('O modo demonstração não pode ser usado em produção.');

  const port = Number(process.env.PORT ?? 4173);
  const origins = (process.env.APP_ORIGIN ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (production && origins.length === 0) throw new Error('Defina APP_ORIGIN em produção.');

  // Sem provedor de e-mail ninguém conseguiria confirmar a conta nem recuperar a senha.
  const smtpUrl = process.env.SMTP_URL || null;
  const mailFrom = process.env.MAIL_FROM || (production ? '' : 'Escala <nao-responda@escala.example>');
  if (production && (!smtpUrl || !mailFrom)) throw new Error('Defina SMTP_URL e MAIL_FROM em produção.');

  return {
    production,
    host: process.env.HOST ?? '127.0.0.1',
    port,
    dbPath: process.env.ESCALA_DB ?? join(ROOT, 'data', 'escala.db'),
    encKey: key('ESCALA_ENC_KEY'),
    hmacKey: key('ESCALA_HMAC_KEY'),
    demoMode,
    demoPassword: demoMode ? (process.env.ESCALA_DEMO_PASSWORD ?? null) : null,
    allowedOrigins: production
      ? origins
      : [...origins, `http://localhost:${port}`, `http://127.0.0.1:${port}`, 'http://localhost:5173'],
    trustProxy: Number(process.env.TRUST_PROXY ?? 0),
    secureCookies: production,
    smtpUrl,
    mailFrom,
    limits: { authPerWindow: 20, writePerMinute: 60, globalPerMinute: 300 },
  };
}
