import { Body, Controller, Get, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ResponseSchema, ZodPipe } from './zod.js';

const inputSchema = z.strictObject({ name: z.string().min(2) });
const publicSchema = z.strictObject({ name: z.string() });

@Controller('exemplo')
class ExampleController {
  @Post()
  @ResponseSchema(publicSchema, { status: 201, description: 'Criado' })
  create(@Body(new ZodPipe(inputSchema)) body: z.infer<typeof inputSchema>) {
    return { name: body.name };
  }

  @Get('vazando')
  @ResponseSchema(publicSchema, { description: 'Resposta com campo a mais' })
  leak() {
    return { name: 'Ana', cpf: '12345678909' };
  }
}

describe('validação com Zod', () => {
  let app: NestExpressApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ExampleController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('aceita entrada válida', async () => {
    const res = await http().post('/exemplo').send({ name: 'Ana' }).expect(201);
    expect(res.body).toEqual({ name: 'Ana' });
  });

  it('recusa entrada inválida apontando o campo, sem repetir o valor', async () => {
    const res = await http().post('/exemplo').send({ name: 'x' }).expect(400);
    expect(res.body.fields.name).toBeDefined();
    expect(JSON.stringify(res.body)).not.toContain('"x"');
  });

  it('recusa campos extras: impede mass assignment', async () => {
    const res = await http().post('/exemplo').send({ name: 'Ana', role: 'admin' }).expect(400);
    expect(JSON.stringify(res.body)).not.toContain('admin"');
  });

  it('resposta com campo a mais vira erro 500 e o dado não sai', async () => {
    const res = await http().get('/exemplo/vazando').expect(500);
    expect(JSON.stringify(res.body)).not.toContain('12345678909');
  });
});
