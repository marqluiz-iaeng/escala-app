import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { sha256 } from '../vault.ts';
import { purgeExpired } from '../routes/privacy.ts';
import { Client, companyPayload, freelancerPayload, lastCode, mailsTo, signUp, startTestApp, STRONG_PASSWORD, type TestApp } from './helpers.ts';

const NEW_PASSWORD = 'lampada-sereno-tapete-81';

function wrongCode(right: string): string {
  return right === '000000' ? '000001' : '000000';
}

describe('confirmação de e-mail no cadastro', () => {
  let t: TestApp;
  before(async () => { t = await startTestApp(); });
  after(() => t.close());

  const countUsers = () => (t.ctx.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;

  it('cadastrar não cria conta nem sessão antes de confirmar', async () => {
    const payload = freelancerPayload('Nina Alves');
    const before = countUsers();
    const client = new Client(t.base);
    const res = await client.post('/api/auth/register', payload);
    assert.equal(res.status, 202);
    assert.equal(res.headers.get('set-cookie'), null);
    assert.equal(countUsers(), before);
    assert.equal((await client.get('/api/me')).status, 401);
    assert.equal(mailsTo(t.ctx, payload.email as string).length, 1);
  });

  it('confirmar cria a conta, abre a sessão e guarda os consentimentos', async () => {
    const payload = freelancerPayload('Rui Pontes');
    const client = new Client(t.base);
    await client.post('/api/auth/register', payload);
    const res = await client.post('/api/auth/verify', { email: payload.email, code: lastCode(t.ctx, payload.email as string), password: STRONG_PASSWORD });
    assert.equal(res.status, 201);
    const me = await client.get('/api/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.email, payload.email);
    const { body } = await client.get('/api/privacy/overview');
    assert.equal(body.consents.terms.granted, true);
    assert.equal(body.consents.discovery.granted, true);
  });

  it('o código é de uso único', async () => {
    const payload = freelancerPayload('Ivo Lemos');
    const client = await signUp(t.base, payload);
    await client.post('/api/auth/logout');
    const again = await new Client(t.base).post('/api/auth/verify', { email: payload.email, code: lastCode(t.ctx, payload.email as string), password: STRONG_PASSWORD });
    assert.equal(again.status, 400);
  });

  it('e-mail novo e e-mail já cadastrado recebem exatamente a mesma resposta', async () => {
    const existing = freelancerPayload('Ana Moreira');
    await signUp(t.base, existing);
    const hashBefore = t.ctx.db.prepare('SELECT password_hash FROM users WHERE email_index = ?').get(t.ctx.vault.index(existing.email as string, 'email'));
    const repeated = await new Client(t.base).post('/api/auth/register', { ...existing, password: NEW_PASSWORD });
    const fresh = await new Client(t.base).post('/api/auth/register', freelancerPayload('Caio Ribeiro'));
    assert.equal(repeated.status, fresh.status);
    assert.deepEqual(repeated.body, fresh.body);
    assert.equal(repeated.headers.get('set-cookie'), fresh.headers.get('set-cookie'));

    // Quem tem a conta é avisado, sem código e sem nenhuma mudança na senha.
    const notice = mailsTo(t.ctx, existing.email as string).at(-1)!;
    assert.match(notice.subject, /Tentativa de cadastro/);
    assert.doesNotMatch(notice.text, /\b\d{6}\b/);
    const hashAfter = t.ctx.db.prepare('SELECT password_hash FROM users WHERE email_index = ?').get(t.ctx.vault.index(existing.email as string, 'email'));
    assert.deepEqual(hashAfter, hashBefore);
  });

  it('o código da vítima não entrega a conta a quem iniciou o cadastro (pré-sequestro)', async () => {
    const victim = 'vitima@example.com';
    const attacker = new Client(t.base);
    await attacker.post('/api/auth/register', freelancerPayload('Ata Cante', { email: victim, password: NEW_PASSWORD }));
    // A vítima tenta usar o código com a própria senha: nada é criado.
    const res = await new Client(t.base).post('/api/auth/verify', { email: victim, code: lastCode(t.ctx, victim), password: STRONG_PASSWORD });
    assert.equal(res.status, 400);
    assert.equal(t.ctx.db.prepare('SELECT 1 FROM users WHERE email_index = ?').get(t.ctx.vault.index(victim, 'email')), undefined);
    // E o atacante, sem acesso à caixa de entrada, não tem o código.
    const guess = await attacker.post('/api/auth/verify', { email: victim, code: wrongCode(lastCode(t.ctx, victim)), password: NEW_PASSWORD });
    assert.equal(guess.status, 400);
  });

  it('cinco tentativas erradas destroem o código, mesmo que a sexta acerte', async () => {
    const payload = freelancerPayload('Lia Prado');
    const client = new Client(t.base);
    await client.post('/api/auth/register', payload);
    const email = payload.email as string;
    const right = lastCode(t.ctx, email);
    for (let i = 0; i < 5; i++) {
      assert.equal((await client.post('/api/auth/verify', { email, code: wrongCode(right), password: STRONG_PASSWORD })).status, 400);
    }
    assert.equal((await client.post('/api/auth/verify', { email, code: right, password: STRONG_PASSWORD })).status, 400);
  });

  it('o código expira e os dados não confirmados são apagados', async () => {
    const payload = freelancerPayload('Téo Vasconcelos');
    const client = new Client(t.base);
    await client.post('/api/auth/register', payload);
    const email = payload.email as string;
    const subject = t.ctx.vault.index(email, 'email');
    t.ctx.db.prepare('UPDATE otp_codes SET expires_at = ? WHERE subject = ?').run(Date.now() - 1000, subject);
    assert.equal((await client.post('/api/auth/verify', { email, code: lastCode(t.ctx, email), password: STRONG_PASSWORD })).status, 400);
    purgeExpired(t.ctx);
    assert.equal(t.ctx.db.prepare('SELECT 1 FROM otp_codes WHERE subject = ?').get(subject), undefined);
  });

  it('um cadastro sem confirmar não vive além de 24 horas, mesmo reenviando o código', async () => {
    const payload = freelancerPayload('Olga Dias');
    const client = new Client(t.base);
    await client.post('/api/auth/register', payload);
    const subject = t.ctx.vault.index(payload.email as string, 'email');
    const created = Date.now() - 23.5 * 3_600_000;
    t.ctx.db.prepare('UPDATE otp_codes SET created_at = ? WHERE subject = ?').run(created, subject);
    await client.post('/api/auth/verify/resend', { email: payload.email });
    const row = t.ctx.db.prepare('SELECT expires_at FROM otp_codes WHERE subject = ?').get(subject) as { expires_at: number };
    assert.ok(row.expires_at <= created + 24 * 3_600_000);
  });

  it('reenviar invalida o código anterior', async () => {
    const payload = freelancerPayload('Ciro Mota');
    const client = new Client(t.base);
    await client.post('/api/auth/register', payload);
    const email = payload.email as string;
    const first = lastCode(t.ctx, email);
    await client.post('/api/auth/verify/resend', { email });
    const second = lastCode(t.ctx, email);
    if (first !== second) {
      assert.equal((await client.post('/api/auth/verify', { email, code: first, password: STRONG_PASSWORD })).status, 400);
    }
    assert.equal((await client.post('/api/auth/verify', { email, code: second, password: STRONG_PASSWORD })).status, 201);
  });

  it('login antes de confirmar só dá pista a quem sabe a senha', async () => {
    const payload = freelancerPayload('Eva Campos');
    await new Client(t.base).post('/api/auth/register', payload);
    const wrong = await new Client(t.base).post('/api/auth/login', { email: payload.email, password: 'senha-errada-qualquer' });
    const missing = await new Client(t.base).post('/api/auth/login', { email: 'ninguem@example.com', password: 'senha-errada-qualquer' });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.body, missing.body);
    const right = await new Client(t.base).post('/api/auth/login', { email: payload.email, password: STRONG_PASSWORD });
    assert.equal(right.status, 403);
    assert.equal(right.body.code, 'email_unverified');
    assert.equal(right.headers.get('set-cookie'), null);
    assert.equal(mailsTo(t.ctx, payload.email as string).length, 2, 'um novo código foi enviado');
  });

  it('dados do cadastro pendente e os códigos não ficam legíveis no banco', async () => {
    const payload = freelancerPayload('Beatriz Sigilosa', { phone: '(21) 95555-1234' });
    await new Client(t.base).post('/api/auth/register', payload);
    const email = payload.email as string;
    const row = t.ctx.db.prepare('SELECT code_hash FROM otp_codes WHERE subject = ?').get(t.ctx.vault.index(email, 'email')) as { code_hash: string };
    const code = lastCode(t.ctx, email);
    // HMAC com chave: não dá para testar o milhão de combinações só com o banco roubado.
    assert.notEqual(row.code_hash, code);
    assert.notEqual(row.code_hash, sha256(code));
    t.ctx.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    const raw = readFileSync(t.dbPath).toString('latin1');
    for (const secret of [email, 'Beatriz Sigilosa', '21955551234']) assert.ok(!raw.includes(secret), `"${secret}" está em claro`);
  });

  it('dois cadastros com o mesmo CNPJ não passam, nem em paralelo', async () => {
    const first = companyPayload();
    const second = { ...companyPayload(), cnpj: first.cnpj };
    const a = new Client(t.base);
    const b = new Client(t.base);
    assert.equal((await a.post('/api/auth/register', first)).status, 202);
    assert.equal((await b.post('/api/auth/register', second)).status, 202);
    const emailA = first.email as string;
    const emailB = second.email as string;
    assert.equal((await a.post('/api/auth/verify', { email: emailA, code: lastCode(t.ctx, emailA), password: STRONG_PASSWORD })).status, 201);
    assert.equal((await b.post('/api/auth/verify', { email: emailB, code: lastCode(t.ctx, emailB), password: STRONG_PASSWORD })).status, 409);
    assert.equal((await new Client(t.base).post('/api/auth/register', { ...companyPayload(), cnpj: first.cnpj })).status, 409);
  });
});

describe('limite de e-mails por endereço', () => {
  let t: TestApp;
  before(async () => { t = await startTestApp(); });
  after(() => t.close());

  it('não serve para bombardear a caixa de alguém e a resposta não muda', async () => {
    const payload = freelancerPayload('Ana Moreira');
    const email = payload.email as string;
    await signUp(t.base, payload);
    const sent = mailsTo(t.ctx, email).length;
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await new Client(t.base).post('/api/auth/password/forgot', { email })).status);
    assert.ok(statuses.every((s) => s === 202));
    assert.equal(mailsTo(t.ctx, email).length, 5, `foram ${sent} antes e o limite por hora é 5`);
  });

  it('atacante não troca o código nem os dados quando o limite já estourou', async () => {
    const payload = freelancerPayload('Rita Gomes');
    const email = payload.email as string;
    const client = new Client(t.base);
    await client.post('/api/auth/register', payload);
    const code = lastCode(t.ctx, email);
    t.ctx.db.prepare('UPDATE email_throttle SET count = 99 WHERE email_index = ?').run(t.ctx.vault.index(email, 'email'));
    await new Client(t.base).post('/api/auth/register', { ...payload, password: NEW_PASSWORD });
    // Continua valendo o cadastro original, com a senha original.
    assert.equal((await client.post('/api/auth/verify', { email, code, password: NEW_PASSWORD })).status, 400);
    assert.equal((await client.post('/api/auth/verify', { email, code, password: STRONG_PASSWORD })).status, 201);
  });
});

describe('recuperação de senha', () => {
  let t: TestApp;
  before(async () => { t = await startTestApp(); });
  after(() => t.close());

  async function account(name = 'Ana Moreira') {
    const payload = freelancerPayload(name);
    const client = await signUp(t.base, payload);
    return { client, email: payload.email as string };
  }

  it('responde igual para quem tem e quem não tem conta, e só envia para quem tem', async () => {
    const { email } = await account();
    const known = await new Client(t.base).post('/api/auth/password/forgot', { email });
    const unknown = await new Client(t.base).post('/api/auth/password/forgot', { email: 'ninguem@example.com' });
    assert.equal(known.status, unknown.status);
    assert.deepEqual(known.body, unknown.body);
    assert.equal(mailsTo(t.ctx, 'ninguem@example.com').length, 0);
    assert.match(mailsTo(t.ctx, email).at(-1)!.subject, /Recuperação/);
  });

  it('o código troca a senha, derruba as sessões e avisa o titular', async () => {
    const { client, email } = await account();
    await new Client(t.base).post('/api/auth/password/forgot', { email });
    const res = await new Client(t.base).post('/api/auth/password/reset', { email, code: lastCode(t.ctx, email), password: NEW_PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('set-cookie'), null, 'não entra automaticamente');
    assert.equal((await client.get('/api/me')).status, 401, 'sessão antiga caiu');
    assert.equal((await new Client(t.base).post('/api/auth/login', { email, password: STRONG_PASSWORD })).status, 401);
    assert.equal((await new Client(t.base).post('/api/auth/login', { email, password: NEW_PASSWORD })).status, 200);
    assert.match(mailsTo(t.ctx, email).at(-1)!.subject, /senha.*alterada/);
  });

  it('o código é de uso único', async () => {
    const { email } = await account();
    await new Client(t.base).post('/api/auth/password/forgot', { email });
    const code = lastCode(t.ctx, email);
    assert.equal((await new Client(t.base).post('/api/auth/password/reset', { email, code, password: NEW_PASSWORD })).status, 200);
    assert.equal((await new Client(t.base).post('/api/auth/password/reset', { email, code, password: 'mais-uma-senha-longa-55' })).status, 400);
  });

  it('senha fraca é recusada sem gastar o código', async () => {
    const { email } = await account();
    await new Client(t.base).post('/api/auth/password/forgot', { email });
    const code = lastCode(t.ctx, email);
    for (const password of ['curta', 'senha12345']) {
      assert.equal((await new Client(t.base).post('/api/auth/password/reset', { email, code, password })).status, 400);
    }
    const row = t.ctx.db.prepare("SELECT attempts FROM otp_codes WHERE purpose = 'password_reset' AND subject = ?").get(t.ctx.vault.index(email, 'email')) as { attempts: number };
    assert.equal(row.attempts, 0);
    assert.equal((await new Client(t.base).post('/api/auth/password/reset', { email, code, password: NEW_PASSWORD })).status, 200);
  });

  it('cinco erros destroem o código', async () => {
    const { email } = await account();
    await new Client(t.base).post('/api/auth/password/forgot', { email });
    const code = lastCode(t.ctx, email);
    for (let i = 0; i < 5; i++) {
      assert.equal((await new Client(t.base).post('/api/auth/password/reset', { email, code: wrongCode(code), password: NEW_PASSWORD })).status, 400);
    }
    assert.equal((await new Client(t.base).post('/api/auth/password/reset', { email, code, password: NEW_PASSWORD })).status, 400);
    assert.equal((await new Client(t.base).post('/api/auth/login', { email, password: STRONG_PASSWORD })).status, 200, 'senha original segue valendo');
  });

  it('código expirado não funciona', async () => {
    const { email } = await account();
    await new Client(t.base).post('/api/auth/password/forgot', { email });
    t.ctx.db.prepare("UPDATE otp_codes SET expires_at = ? WHERE purpose = 'password_reset' AND subject = ?").run(Date.now() - 1000, t.ctx.vault.index(email, 'email'));
    assert.equal((await new Client(t.base).post('/api/auth/password/reset', { email, code: lastCode(t.ctx, email), password: NEW_PASSWORD })).status, 400);
  });

  it('o código de uma pessoa não serve para outra, nem para outro fluxo', async () => {
    const a = await account('Ana Moreira');
    const b = await account('Caio Ribeiro');
    await new Client(t.base).post('/api/auth/password/forgot', { email: a.email });
    const code = lastCode(t.ctx, a.email);
    assert.equal((await new Client(t.base).post('/api/auth/password/reset', { email: b.email, code, password: NEW_PASSWORD })).status, 400);
    assert.equal((await new Client(t.base).post('/api/auth/verify', { email: a.email, code, password: STRONG_PASSWORD })).status, 400);

    // O mesmo número sorteado também não coincidiria: a finalidade e o titular entram no HMAC.
    t.ctx.db.prepare("UPDATE otp_codes SET subject = ? WHERE purpose = 'password_reset' AND subject = ?").run(t.ctx.vault.index(b.email, 'email'), t.ctx.vault.index(a.email, 'email'));
    assert.equal((await new Client(t.base).post('/api/auth/password/reset', { email: b.email, code, password: NEW_PASSWORD })).status, 400);
  });

  it('libera a conta bloqueada, e o bloqueio avisa o titular', async () => {
    const { email } = await account();
    const attacker = new Client(t.base);
    for (let i = 0; i < 5; i++) await attacker.post('/api/auth/login', { email, password: 'senha-errada-qualquer' });
    assert.match(mailsTo(t.ctx, email).at(-1)!.subject, /Tentativas de acesso/);
    assert.equal((await new Client(t.base).post('/api/auth/login', { email, password: STRONG_PASSWORD })).status, 401);
    await new Client(t.base).post('/api/auth/password/forgot', { email });
    await new Client(t.base).post('/api/auth/password/reset', { email, code: lastCode(t.ctx, email), password: NEW_PASSWORD });
    assert.equal((await new Client(t.base).post('/api/auth/login', { email, password: NEW_PASSWORD })).status, 200);
  });

  it('conta excluída não recebe código e não pode ser reativada', async () => {
    const { client, email } = await account();
    await new Client(t.base).post('/api/auth/password/forgot', { email });
    const code = lastCode(t.ctx, email);
    await client.post('/api/privacy/delete', { password: STRONG_PASSWORD, confirm: 'EXCLUIR' });
    assert.match(mailsTo(t.ctx, email).at(-1)!.subject, /excluída/);
    assert.equal((await new Client(t.base).post('/api/auth/password/reset', { email, code, password: NEW_PASSWORD })).status, 400);
    const before = mailsTo(t.ctx, email).length;
    await new Client(t.base).post('/api/auth/password/forgot', { email });
    assert.equal(mailsTo(t.ctx, email).length, before);
  });

  it('trocar a senha e exportar os dados avisam o titular por e-mail', async () => {
    const { client, email } = await account();
    await client.post('/api/privacy/export', { password: STRONG_PASSWORD });
    assert.match(mailsTo(t.ctx, email).at(-1)!.subject, /cópia dos seus dados/);
    await client.post('/api/me/password', { current: STRONG_PASSWORD, next: NEW_PASSWORD });
    assert.match(mailsTo(t.ctx, email).at(-1)!.subject, /senha.*alterada/);
  });
});

describe('troca de e-mail', () => {
  let t: TestApp;
  before(async () => { t = await startTestApp(); });
  after(() => t.close());

  it('exige a senha, confirma pelo endereço novo e avisa o antigo', async () => {
    const payload = freelancerPayload('Ana Moreira');
    const oldEmail = payload.email as string;
    const client = await signUp(t.base, payload);
    const laptop = new Client(t.base);
    await laptop.post('/api/auth/login', { email: oldEmail, password: STRONG_PASSWORD });
    const newEmail = 'ana.nova@example.com';

    assert.equal((await client.post('/api/me/email', { email: newEmail, password: 'senha-errada-qualquer' })).status, 403);
    assert.equal(mailsTo(t.ctx, newEmail).length, 0);
    assert.equal((await client.post('/api/me/email', { email: oldEmail, password: STRONG_PASSWORD })).status, 400);

    assert.equal((await client.post('/api/me/email', { email: newEmail, password: STRONG_PASSWORD })).status, 202);
    assert.equal((await client.get('/api/me')).body.email, oldEmail, 'nada muda antes de confirmar');

    const code = lastCode(t.ctx, newEmail);
    assert.equal((await client.post('/api/me/email/confirm', { code: wrongCode(code) })).status, 400);
    const confirmed = await client.post('/api/me/email/confirm', { code });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.email, newEmail);

    assert.match(mailsTo(t.ctx, oldEmail).at(-1)!.text, /a•••@example\.com/);
    assert.equal((await laptop.get('/api/me')).status, 401, 'outros aparelhos desconectados');
    assert.equal((await client.get('/api/me')).status, 200, 'este aparelho continua');
    assert.equal((await new Client(t.base).post('/api/auth/login', { email: oldEmail, password: STRONG_PASSWORD })).status, 401);
    assert.equal((await new Client(t.base).post('/api/auth/login', { email: newEmail, password: STRONG_PASSWORD })).status, 200);
  });

  it('e-mail de outra pessoa dá a mesma resposta e não gera código', async () => {
    const owner = freelancerPayload('Dona Conta');
    await signUp(t.base, owner);
    const taken = owner.email as string;
    const client = await signUp(t.base, freelancerPayload('Outra Pessoa'));
    const inUse = await client.post('/api/me/email', { email: taken, password: STRONG_PASSWORD });
    const free = await client.post('/api/me/email', { email: 'livre@example.com', password: STRONG_PASSWORD });
    assert.equal(inUse.status, free.status);
    assert.deepEqual(inUse.body, free.body);
    assert.match(mailsTo(t.ctx, taken).at(-1)!.subject, /Tentativa de usar/);
    assert.doesNotMatch(mailsTo(t.ctx, taken).at(-1)!.text, /\b\d{6}\b/);
  });

  it('o código de uma conta não serve para outra', async () => {
    const a = await signUp(t.base, freelancerPayload('Ana Moreira'));
    const b = await signUp(t.base, freelancerPayload('Caio Ribeiro'));
    await a.post('/api/me/email', { email: 'destino@example.com', password: STRONG_PASSWORD });
    assert.equal((await b.post('/api/me/email/confirm', { code: lastCode(t.ctx, 'destino@example.com') })).status, 400);
  });

  it('não dá para confirmar sem sessão', async () => {
    assert.equal((await new Client(t.base).post('/api/me/email/confirm', { code: '123456' })).status, 401);
  });

  it('endereço ocupado depois do envio do código não é aceito', async () => {
    const a = await signUp(t.base, freelancerPayload('Ana Moreira'));
    const target = 'disputado@example.com';
    await a.post('/api/me/email', { email: target, password: STRONG_PASSWORD });
    const code = lastCode(t.ctx, target);
    await signUp(t.base, freelancerPayload('Caio Ribeiro', { email: target }));
    assert.equal((await a.post('/api/me/email/confirm', { code })).status, 400);
  });
});

describe('caixa de entrada de demonstração', () => {
  it('não existe fora do modo demonstração', async () => {
    const t = await startTestApp({ demoMode: false });
    const payload = freelancerPayload('Ana Moreira');
    const client = await signUp(t.base, payload);
    // Nem com uma sessão válida a rota responde.
    assert.equal((await client.post('/api/dev/outbox', { email: payload.email })).status, 404);
    assert.notEqual((await new Client(t.base).post('/api/dev/outbox', { email: payload.email })).status, 200);
    assert.equal((await new Client(t.base).get('/api/meta')).body.demoInbox, false);
    await t.close();
  });

  it('com provedor real configurado, também não existe', async () => {
    const t = await startTestApp({ demoMode: true, smtpUrl: 'smtp://127.0.0.1:1' });
    assert.notEqual((await new Client(t.base).post('/api/dev/outbox', { email: 'a@example.com' })).status, 200);
    assert.equal(t.ctx.mailer.outbox, undefined);
    assert.equal((await new Client(t.base).get('/api/meta')).body.demoInbox, false);
    await t.close();
  });

  it('no modo demonstração, mostra só as mensagens do endereço pedido', async () => {
    const t = await startTestApp({ demoMode: true });
    const payload = freelancerPayload('Ana Moreira');
    await new Client(t.base).post('/api/auth/register', payload);
    await new Client(t.base).post('/api/auth/register', freelancerPayload('Caio Ribeiro'));
    const res = await new Client(t.base).post('/api/dev/outbox', { email: payload.email });
    assert.equal(res.body.messages.length, 1);
    assert.equal((await new Client(t.base).get('/api/meta')).body.demoInbox, true);
    await t.close();
  });
});

describe('conteúdo e envio dos e-mails', () => {
  it('não leva código no assunto, dados pessoais nem links', async () => {
    const t = await startTestApp();
    const payload = freelancerPayload('Ana Sigilosa', { phone: '(21) 94444-3210' });
    const email = payload.email as string;
    const client = await signUp(t.base, payload);
    await new Client(t.base).post('/api/auth/password/forgot', { email });
    await client.post('/api/privacy/export', { password: STRONG_PASSWORD });
    const mails = mailsTo(t.ctx, email);
    assert.ok(mails.length >= 3);
    for (const mail of mails) {
      assert.doesNotMatch(mail.subject, /\d{6}/);
      assert.doesNotMatch(mail.text, /https?:\/\//);
      assert.doesNotMatch(mail.text, /Sigilosa|94444/);
    }
    await t.close();
  });

  it('com SMTP configurado, a mensagem é entregue pelo protocolo real', async () => {
    const received: string[] = [];
    const sockets: Socket[] = [];
    const smtp = createServer((socket) => {
      sockets.push(socket);
      let inData = false;
      let buffer = '';
      socket.write('220 servidor de teste\r\n');
      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        if (inData) {
          if (buffer.includes('\r\n.\r\n')) {
            received.push(buffer);
            buffer = '';
            inData = false;
            socket.write('250 recebido\r\n');
          }
          return;
        }
        let end = buffer.indexOf('\r\n');
        while (end >= 0) {
          const command = buffer.slice(0, 4).toUpperCase();
          buffer = buffer.slice(end + 2);
          if (command === 'DATA') {
            inData = true;
            socket.write('354 pode enviar\r\n');
            return;
          }
          if (command === 'QUIT') {
            socket.end('221 tchau\r\n');
            return;
          }
          socket.write('250 ok\r\n');
          end = buffer.indexOf('\r\n');
        }
      });
    });
    await new Promise<void>((resolve) => smtp.listen(0, '127.0.0.1', resolve));
    const { port } = smtp.address() as AddressInfo;

    const t = await startTestApp({ smtpUrl: `smtp://127.0.0.1:${port}`, mailFrom: 'Escala <nao-responda@example.com>' });
    const payload = freelancerPayload('Ana Moreira');
    const res = await new Client(t.base).post('/api/auth/register', payload);
    assert.equal(res.status, 202);
    for (let i = 0; i < 50 && received.length === 0; i++) await new Promise((r) => setTimeout(r, 40));

    assert.equal(received.length, 1);
    assert.match(received[0]!, new RegExp(`To: ${(payload.email as string).replace('.', '\\.')}`));
    assert.match(received[0]!, /From: Escala <nao-responda@example\.com>/);
    assert.match(received[0]!, /\b\d{6}\b/);
    await t.close();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => smtp.close(resolve));
  });

  it('falha no provedor não derruba o cadastro nem revela nada', async () => {
    const t = await startTestApp({ smtpUrl: 'smtp://127.0.0.1:1' });
    const res = await new Client(t.base).post('/api/auth/register', freelancerPayload('Ana Moreira'));
    assert.equal(res.status, 202);
    assert.deepEqual(res.body, { ok: true });
    await t.close();
  });
});
