import { z } from 'zod';

const NODE_ENVS = ['development', 'test', 'production'] as const;
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const envSchema = z
  .object({
    NODE_ENV: z.enum(NODE_ENVS).default('development'),
    API_HOST: z.string().min(1).default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(0).max(65535).default(3000),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
  })
  .superRefine((env, ctx) => {
    for (const origin of env.CORS_ORIGINS) {
      const valid = URL.canParse(origin) && new URL(origin).origin === origin;
      if (!valid)
        ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'origem inválida' });
      if (env.NODE_ENV === 'production' && !origin.startsWith('https://')) {
        ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'produção exige https' });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Falha logo na subida. A mensagem cita só as variáveis, nunca os valores, que podem ser segredos. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Configuração inválida: ${problems.join('; ')}`);
}

export const ENV = Symbol('ENV');
