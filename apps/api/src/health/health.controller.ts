import { Controller, Get } from '@nestjs/common';
import { healthResponseSchema, type HealthResponse } from '@escala/shared';
import { ResponseSchema } from '../validation/zod.js';
import { APP_VERSION } from '../version.js';

@Controller('health')
export class HealthController {
  @Get()
  @ResponseSchema(healthResponseSchema, { description: 'A API está no ar' })
  check(): HealthResponse {
    return { status: 'ok', version: APP_VERSION };
  }
}
