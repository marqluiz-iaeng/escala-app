import { z } from 'zod';

/** Contrato do endpoint de saúde. O mesmo schema valida a resposta na API e no app. */
export const healthResponseSchema = z.strictObject({
  status: z.literal('ok'),
  version: z.string().min(1),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
