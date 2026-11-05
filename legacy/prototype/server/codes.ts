import { randomInt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { one, run } from './db.ts';
import { HttpError, type Ctx } from './http.ts';
import type { Mail } from './mail.ts';

export type CodePurpose = 'signup' | 'password_reset' | 'email_change';

export type CodeRow = {
  purpose: CodePurpose; subject: string; code_hash: string; payload_enc: string | null; attempts: number; created_at: number; expires_at: number;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const TTL: Record<CodePurpose, number> = { signup: HOUR, password_reset: 15 * MINUTE, email_change: 15 * MINUTE };
/** Reenviar renova o código, mas um cadastro nunca confirmado não vive além deste prazo. */
const MAX_LIFETIME = 24 * HOUR;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;

export const codeSchema = z.string({ error: 'Digite o código.' }).regex(/^\d{6}$/, 'Digite os 6 números do código.');

export const invalidCode = () => new HttpError(400, 'Confira o código.', { code: 'Código incorreto ou expirado.' });

// HMAC com chave, e não um hash simples: com só 1 milhão de códigos possíveis,
// quem roubasse o banco testaria todos em segundos se não tivesse também a chave.
// Finalidade e titular entram no cálculo: um código nunca serve em outro fluxo ou para outra conta.
function hashCode(ctx: Ctx, purpose: CodePurpose, subject: string, code: string): string {
  return ctx.vault.index(`${purpose}:${subject}:${code}`, 'otp');
}

/** Cria um código novo e invalida o anterior da mesma finalidade e titular. */
export function issueCode(ctx: Ctx, purpose: CodePurpose, subject: string, payloadEnc: string | null, createdAt = Date.now()): string {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresAt = Math.min(Date.now() + TTL[purpose], createdAt + MAX_LIFETIME);
  run(
    ctx.db,
    `INSERT OR REPLACE INTO otp_codes (purpose, subject, code_hash, payload_enc, attempts, created_at, expires_at)
     VALUES (?,?,?,?,0,?,?)`,
    purpose, subject, hashCode(ctx, purpose, subject, code), payloadEnc, createdAt, expiresAt,
  );
  return code;
}

export function loadCode(ctx: Ctx, purpose: CodePurpose, subject: string): CodeRow | null {
  const row = one<CodeRow>(ctx.db, 'SELECT * FROM otp_codes WHERE purpose = ? AND subject = ?', purpose, subject);
  return row && row.expires_at > Date.now() ? row : null;
}

/** Conta uma tentativa errada. Na quinta, o código é destruído e é preciso pedir outro. */
export function recordFailure(ctx: Ctx, purpose: CodePurpose, subject: string) {
  const row = one<{ attempts: number }>(ctx.db, 'SELECT attempts FROM otp_codes WHERE purpose = ? AND subject = ?', purpose, subject);
  if (!row) return;
  if (row.attempts + 1 >= MAX_ATTEMPTS) burnCode(ctx, purpose, subject);
  else run(ctx.db, 'UPDATE otp_codes SET attempts = attempts + 1 WHERE purpose = ? AND subject = ?', purpose, subject);
}

/** Confere o código sem consumi-lo. Código errado, expirado ou inexistente geram o mesmo erro. */
export function checkCode(ctx: Ctx, purpose: CodePurpose, subject: string, code: string): CodeRow {
  const row = loadCode(ctx, purpose, subject);
  if (!row) throw invalidCode();
  const expected = Buffer.from(row.code_hash);
  const actual = Buffer.from(hashCode(ctx, purpose, subject, code));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    recordFailure(ctx, purpose, subject);
    throw invalidCode();
  }
  return row;
}

/** Devolve false se o código já foi usado: duas requisições simultâneas não podem aproveitar o mesmo. */
export function burnCode(ctx: Ctx, purpose: CodePurpose, subject: string): boolean {
  return Number(run(ctx.db, 'DELETE FROM otp_codes WHERE purpose = ? AND subject = ?', purpose, subject).changes) === 1;
}

/**
 * Limita os e-mails para cada endereço. Impede usar o app para bombardear a caixa de alguém
 * e reduz as tentativas de adivinhar códigos. Passou do limite, nada é enviado, mas a resposta é a mesma.
 */
export function allowSend(ctx: Ctx, emailIndex: string): boolean {
  const now = Date.now();
  const row = one<{ window_start: number; count: number }>(ctx.db, 'SELECT window_start, count FROM email_throttle WHERE email_index = ?', emailIndex);
  if (!row || row.window_start + HOUR < now) {
    run(ctx.db, 'INSERT OR REPLACE INTO email_throttle (email_index, window_start, count) VALUES (?,?,1)', emailIndex, now);
    return true;
  }
  if (row.count >= MAX_SENDS_PER_HOUR) return false;
  run(ctx.db, 'UPDATE email_throttle SET count = count + 1 WHERE email_index = ?', emailIndex);
  return true;
}

/** Sem esperar o envio: o tempo de resposta não revela se o endereço tem conta. */
export function sendLater(ctx: Ctx, mail: Mail) {
  ctx.mailer.send(mail).catch((err: { code?: string }) => {
    console.error('[e-mail] falha no envio:', err.code ?? 'erro desconhecido');
  });
}

export function purgeCodes(ctx: Ctx) {
  const now = Date.now();
  run(ctx.db, 'DELETE FROM otp_codes WHERE expires_at < ?', now);
  run(ctx.db, 'DELETE FROM email_throttle WHERE window_start < ?', now - HOUR);
}
