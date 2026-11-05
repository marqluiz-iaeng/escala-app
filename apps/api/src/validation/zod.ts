import {
  applyDecorators,
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
  type PipeTransform,
  UseInterceptors,
} from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { map, type Observable } from 'rxjs';
import { z } from 'zod';

/** Valida a entrada. O erro diz qual campo falhou, sem repetir o valor enviado. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      fields[issue.path.join('.') || '_'] ??= issue.message;
    }
    throw new BadRequestException({ statusCode: 400, message: 'Dados inválidos', fields });
  }
}

class ResponseGuard<T extends z.ZodType> implements NestInterceptor {
  constructor(private readonly schema: T) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<z.infer<T>> {
    return next.handle().pipe(map((value: unknown) => this.schema.parse(value)));
  }
}

export function toOpenApiSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: 'openapi-3.0' });
}

/**
 * Documenta a resposta no OpenAPI e a confere antes de enviar. Um campo a mais em um schema
 * estrito vira erro 500, em vez de vazar um dado que não deveria sair.
 */
export function ResponseSchema(
  schema: z.ZodType,
  options: { status?: number; description: string },
): MethodDecorator {
  return applyDecorators(
    ApiResponse({
      status: options.status ?? 200,
      description: options.description,
      schema: toOpenApiSchema(schema),
    }),
    UseInterceptors(new ResponseGuard(schema)),
  );
}
