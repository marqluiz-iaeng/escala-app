import { z } from 'zod';

z.config(z.locales.pt());

export const CATEGORIES = ['bartender', 'garcom', 'atendente', 'musico', 'recepcao', 'producao', 'cozinha', 'outros'] as const;
export const SEGMENTS = ['producao_musical', 'festas_eventos', 'entretenimento', 'bar_restaurante', 'hospedagem', 'outros'] as const;
export const PAY_TYPES = ['diaria', 'hora', 'cache'] as const;
export const TIME_ZONE = 'America/Sao_Paulo';
/** Por quanto tempo o contato continua visível depois do turno (limitação de finalidade). */
export const CONTACT_WINDOW_DAYS = 30;

export function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function publicName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first;
}

/** Valida CNPJ numérico e alfanumérico (Receita Federal, IN 2.229/2024): caractere vale ASCII - 48. */
export function isValidCnpj(value: string): boolean {
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(value) || /^(.)\1+$/.test(value)) return false;
  return checkDigits(value.slice(0, 12)) === value.slice(12);
}

export function checkDigits(base: string): string {
  const digit = (chars: string) => {
    let weight = 2;
    let sum = 0;
    for (let i = chars.length - 1; i >= 0; i--) {
      sum += (chars.charCodeAt(i) - 48) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = digit(base);
  return `${first}${digit(base + first)}`;
}

const NO_CONTROL_CHARS = /^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]*$/;

export const text = (min: number, max: number, label: string) =>
  z
    .string({ error: `Informe ${label}.` })
    .trim()
    .min(min, min <= 1 ? `Informe ${label}.` : `${label[0]!.toUpperCase()}${label.slice(1)} precisa de pelo menos ${min} caracteres.`)
    .max(max, `Use no máximo ${max} caracteres.`)
    .regex(NO_CONTROL_CHARS, 'Contém caracteres inválidos.');

const COMMON_PASSWORDS = new Set([
  '0123456789', '1234567890', '12345678910', '1q2w3e4r5t', 'abcdefghij', 'admin12345', 'brasil1234',
  'iloveyou12', 'mudar12345', 'password123', 'qwertyuiop', 'senha12345', 'senha123456', 'escala1234',
]);

export const passwordSchema = z
  .string({ error: 'Crie uma senha.' })
  .min(10, 'Use pelo menos 10 caracteres.')
  .max(128, 'Use no máximo 128 caracteres.')
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()) && !/^(.)\1+$/.test(p), 'Essa senha é muito comum. Escolha outra.');

export const emailSchema = z
  .string({ error: 'Informe seu e-mail.' })
  .trim()
  .toLowerCase()
  .pipe(z.email('E-mail inválido.').max(160, 'E-mail muito longo.'));

export const phoneSchema = z
  .string({ error: 'Informe seu telefone.' })
  .transform((v) => v.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''))
  .refine((v) => /^[1-9]\d(9\d{8}|[2-8]\d{7})$/.test(v), 'Telefone inválido. Use DDD + número.');

export const citySchema = text(2, 60, 'a cidade');
export const nameSchema = text(2, 80, 'o nome').refine((v) => v.includes(' '), 'Informe nome e sobrenome.');

export const uuid = z.uuid();
