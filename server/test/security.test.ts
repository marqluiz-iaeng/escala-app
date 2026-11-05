import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { loadConfig } from '../config.ts';
import { checkDigits, isValidCnpj } from '../domain.ts';
import { maskContacts } from '../routes/applications.ts';
import { createVault } from '../vault.ts';
import { randomBytes } from 'node:crypto';
import { Client, companyPayload, completeSignup, freelancerPayload, gigPayload, signUp, startTestApp, STRONG_PASSWORD, type TestApp } from './helpers.ts';

describe('autenticação e sessão', () => {
  let t: TestApp;
  before(async () => { t = await startTestApp(); });
  after(() => t.close());

  it('envia cabeçalhos de segurança e não se identifica', async () => {
    const { headers } = await new Client(t.base).get('/api/meta');
    const csp = headers.get('content-security-policy') ?? '';
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /script-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.equal(headers.get('referrer-policy'), 'no-referrer');
    assert.equal(headers.get('cache-control'), 'no-store');
    assert.equal(headers.get('x-powered-by'), null);
  });

  it('cookie de sessão é HttpOnly e SameSite=Strict', async () => {
    const { res } = await completeSignup(t.base, freelancerPayload());
    const cookie = res.headers.get('set-cookie') ?? '';
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
  });

  it('o banco guarda só o hash do token de sessão', async () => {
    const client = await signUp(t.base, freelancerPayload());
    const token = client.cookie.split('=')[1]!;
    const row = t.ctx.db.prepare('SELECT 1 FROM sessions WHERE token_hash = ?').get(token);
    assert.equal(row, undefined);
  });

  it('exige consentimento e maioridade no cadastro', async () => {
    const client = new Client(t.base);
    const noTerms = await client.post('/api/auth/register', freelancerPayload('Ana Moreira', { consents: { terms: false, adult: true, discovery: false, marketing: false } }));
    assert.equal(noTerms.status, 400);
    assert.ok(noTerms.body.fields['consents.terms']);
    const minor = await client.post('/api/auth/register', freelancerPayload('Ana Moreira', { consents: { terms: true, adult: false, discovery: false, marketing: false } }));
    assert.equal(minor.status, 400);
    assert.ok(minor.body.fields['consents.adult']);
  });

  it('rejeita senha fraca, comum ou que contém o e-mail', async () => {
    const client = new Client(t.base);
    for (const password of ['curta', 'senha12345', '1234567890', 'aaaaaaaaaaaa']) {
      const res = await client.post('/api/auth/register', freelancerPayload('Ana Moreira', { password }));
      assert.equal(res.status, 400, password);
    }
    const withEmail = await client.post('/api/auth/register', freelancerPayload('Ana Moreira', { email: 'marcela@example.com', password: 'marcela-2026-ok' }));
    assert.equal(withEmail.status, 400);
  });

  it('bloqueia mass assignment: campos extras são recusados', async () => {
    const client = new Client(t.base);
    const res = await client.post('/api/auth/register', freelancerPayload('Ana Moreira', { status: 'admin', verified: true }));
    assert.equal(res.status, 400);
    const company = await signUp(t.base, companyPayload());
    const patch = await company.patch('/api/me/profile', { verified: true });
    assert.equal(patch.status, 400);
    const me = await company.get('/api/me');
    assert.equal(me.body.company.verified, false);
  });

  it('login usa o mesmo erro para senha errada e conta inexistente', async () => {
    const payload = freelancerPayload();
    await signUp(t.base, payload);
    const wrong = await new Client(t.base).post('/api/auth/login', { email: payload.email, password: 'senha-errada-qualquer' });
    const missing = await new Client(t.base).post('/api/auth/login', { email: 'ninguem@example.com', password: 'senha-errada-qualquer' });
    assert.equal(wrong.status, 401);
    assert.equal(missing.status, 401);
    assert.deepEqual(wrong.body, missing.body);
  });

  it('bloqueia a conta após 5 falhas, mesmo com a senha certa depois', async () => {
    const payload = freelancerPayload();
    await signUp(t.base, payload);
    const client = new Client(t.base);
    for (let i = 0; i < 5; i++) await client.post('/api/auth/login', { email: payload.email, password: 'senha-errada-qualquer' });
    const res = await client.post('/api/auth/login', { email: payload.email, password: STRONG_PASSWORD });
    assert.equal(res.status, 401);
  });

  it('trocar a senha encerra as outras sessões', async () => {
    const payload = freelancerPayload();
    const phone = await signUp(t.base, payload);
    const laptop = new Client(t.base);
    await laptop.post('/api/auth/login', { email: payload.email, password: STRONG_PASSWORD });
    assert.equal((await phone.post('/api/me/password', { current: STRONG_PASSWORD, next: 'nova-senha-bem-longa-77' })).status, 200);
    assert.equal((await laptop.get('/api/me')).status, 401);
    assert.equal((await phone.get('/api/me')).status, 200);
  });

  it('logout invalida a sessão no servidor', async () => {
    const client = await signUp(t.base, freelancerPayload());
    const stolen = client.cookie;
    await client.post('/api/auth/logout');
    const thief = new Client(t.base);
    thief.cookie = stolen;
    assert.equal((await thief.get('/api/me')).status, 401);
  });

  it('rejeita corpo grande demais e JSON quebrado sem vazar detalhes', async () => {
    const client = new Client(t.base);
    const big = await client.post('/api/auth/login', { email: 'a@b.co', password: 'x'.repeat(40_000) });
    assert.equal(big.status, 413);
    const broken = await fetch(`${t.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-escala-request': '1' },
      body: '{quebrado',
    });
    const body = await broken.json();
    assert.equal(broken.status, 400);
    assert.deepEqual(body, { error: 'Requisição inválida.' });
  });
});

describe('limite de tentativas', () => {
  let t: TestApp;
  before(async () => { t = await startTestApp({ limits: { authPerWindow: 3, writePerMinute: 100, globalPerMinute: 1000 } }); });
  after(() => t.close());

  it('devolve 429 quando o IP excede o limite de login', async () => {
    const client = new Client(t.base);
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await client.post('/api/auth/login', { email: 'x@example.com', password: 'qualquer-coisa' })).status);
    assert.deepEqual(statuses.slice(0, 3), [401, 401, 401]);
    assert.equal(statuses[4], 429);
  });
});

describe('CSRF', () => {
  let t: TestApp;
  before(async () => { t = await startTestApp(); });
  after(() => t.close());

  it('bloqueia escrita sem o cabeçalho próprio', async () => {
    const client = await signUp(t.base, freelancerPayload());
    const res = await fetch(`${t.base}/api/auth/logout`, { method: 'POST', headers: { cookie: client.cookie } });
    assert.equal(res.status, 403);
    assert.equal((await client.get('/api/me')).status, 200);
  });

  it('bloqueia origem de outro site e sec-fetch-site cross-site', async () => {
    const client = await signUp(t.base, freelancerPayload());
    const evil = await client.req('POST', '/api/auth/logout', {}, { origin: 'https://site-malicioso.example' });
    assert.equal(evil.status, 403);
    const cross = await client.req('POST', '/api/auth/logout', {}, { 'sec-fetch-site': 'cross-site' });
    assert.equal(cross.status, 403);
    assert.equal((await client.get('/api/me')).status, 200);
  });

  it('não responde CORS para outras origens', async () => {
    const res = await fetch(`${t.base}/api/meta`, { headers: { origin: 'https://site-malicioso.example' } });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });
});

describe('autorização', () => {
  let t: TestApp;
  let companyA: Client;
  let companyB: Client;
  let ana: Client;
  let caio: Client;
  let gigId: string;
  let appId: string;

  before(async () => {
    t = await startTestApp();
    companyA = await signUp(t.base, companyPayload());
    companyB = await signUp(t.base, companyPayload());
    ana = await signUp(t.base, freelancerPayload('Ana Moreira'));
    caio = await signUp(t.base, freelancerPayload('Caio Ribeiro'));
    gigId = (await companyA.post('/api/gigs', gigPayload({ slots: 2 }))).body.id;
    appId = (await ana.post(`/api/gigs/${gigId}/apply`, { note: 'Tenho experiência' })).body.id;
  });
  after(() => t.close());

  it('sem sessão, nenhuma rota privada responde', async () => {
    const anon = new Client(t.base);
    for (const path of ['/api/me', '/api/gigs', '/api/applications', '/api/talents', '/api/privacy/overview', `/api/applications/${appId}`, `/api/applications/${appId}/messages`]) {
      assert.equal((await anon.get(path)).status, 401, path);
    }
  });

  it('cada tipo de conta só faz o que lhe cabe', async () => {
    assert.equal((await ana.post('/api/gigs', gigPayload())).status, 403);
    assert.equal((await companyA.post(`/api/gigs/${gigId}/apply`)).status, 403);
    assert.equal((await ana.get('/api/talents')).status, 403);
    assert.equal((await companyA.get('/api/gigs')).status, 403);
  });

  it('empresa não vê nem altera vaga de outra empresa (IDOR)', async () => {
    assert.equal((await companyB.get(`/api/gigs/${gigId}`)).status, 404);
    assert.equal((await companyB.get(`/api/gigs/${gigId}/applications`)).status, 404);
    assert.equal((await companyB.post(`/api/gigs/${gigId}/status`, { status: 'cancelled' })).status, 404);
  });

  it('terceiros não leem conversas nem decidem candidaturas alheias (IDOR)', async () => {
    assert.equal((await caio.get(`/api/applications/${appId}`)).status, 404);
    assert.equal((await caio.get(`/api/applications/${appId}/messages`)).status, 404);
    assert.equal((await caio.post(`/api/applications/${appId}/messages`, { body: 'oi' })).status, 404);
    assert.equal((await companyB.post(`/api/applications/${appId}/decide`, { decision: 'accept' })).status, 404);
    assert.equal((await caio.post(`/api/applications/${appId}/withdraw`)).status, 404);
  });

  it('freelancer não pode se aprovar na própria candidatura', async () => {
    assert.equal((await ana.post(`/api/applications/${appId}/decide`, { decision: 'accept' })).status, 409);
  });

  it('IDs malformados e injeção de SQL não quebram nada', async () => {
    assert.equal((await ana.get("/api/applications/' OR 1=1--")).status, 404);
    const res = await ana.get(`/api/gigs?q=${encodeURIComponent("' OR '1'='1' --")}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.gigs.length, 0);
    const wild = await ana.get(`/api/gigs?q=${encodeURIComponent('%')}`);
    assert.equal(wild.body.gigs.length, 0);
    assert.equal((await ana.get('/api/gigs?category=DROP')).status, 400);
    assert.ok((await companyA.get('/api/gigs/mine')).body.gigs.length > 0, 'tabelas seguem intactas');
  });

  it('texto com HTML é devolvido como dado, sem interpretação', async () => {
    const payload = '<img src=x onerror=alert(1)>';
    const res = await ana.post(`/api/applications/${appId}/messages`, { body: payload });
    assert.equal(res.status, 201);
    assert.equal(res.body.body, payload);
    assert.match(res.headers.get('content-type') ?? '', /application\/json/);
  });
});

describe('privacidade por padrão', () => {
  let t: TestApp;
  let company: Client;
  let ana: Client;
  let anaPayload: ReturnType<typeof freelancerPayload>;
  let anaId: string;
  let gigId: string;
  let appId: string;

  before(async () => {
    t = await startTestApp();
    company = await signUp(t.base, companyPayload());
    anaPayload = freelancerPayload('Ana Beatriz Moreira', { phone: '(21) 97777-1234' });
    ana = await signUp(t.base, anaPayload);
    anaId = (await ana.get('/api/me')).body.id;
    gigId = (await company.post('/api/gigs', gigPayload())).body.id;
    appId = (await ana.post(`/api/gigs/${gigId}/apply`, {})).body.id;
  });
  after(() => t.close());

  it('dados pessoais não aparecem em claro no arquivo do banco', async () => {
    await ana.post(`/api/applications/${appId}/messages`, { body: 'mensagem-confidencial-xyz' });
    t.ctx.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    const raw = readFileSync(t.dbPath).toString('latin1');
    for (const secret of [anaPayload.email as string, '21977771234', 'Ana Beatriz Moreira', 'mensagem-confidencial-xyz', 'Rua Secreta']) {
      assert.ok(!raw.includes(secret), `"${secret}" está em claro`);
    }
  });

  it('só o dono do processo lê o banco e seus arquivos auxiliares', () => {
    for (const suffix of ['', '-wal', '-shm']) {
      const path = t.dbPath + suffix;
      if (!existsSync(path)) continue;
      assert.equal(statSync(path).mode & 0o077, 0, `${suffix || 'banco'} acessível a outros usuários`);
    }
    assert.equal(statSync(dirname(t.dbPath)).mode & 0o077, 0);
  });

  it('a senha nunca fica guardada nem é devolvida', async () => {
    const me = await ana.get('/api/me');
    assert.ok(!JSON.stringify(me.body).includes('scrypt'));
    const row = t.ctx.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(anaId) as { password_hash: string };
    assert.match(row.password_hash, /^scrypt\$/);
    assert.ok(!row.password_hash.includes(STRONG_PASSWORD));
  });

  it('o feed de vagas não expõe o endereço exato', async () => {
    const feed = await ana.get('/api/gigs');
    assert.ok(feed.body.gigs.length > 0);
    assert.ok(!JSON.stringify(feed.body).includes('Rua Secreta'));
  });

  it('antes da contratação, a empresa vê só nome abreviado, sem contato', async () => {
    const list = await company.get(`/api/gigs/${gigId}/applications`);
    const text = JSON.stringify(list.body);
    assert.ok(text.includes('Ana M.'));
    for (const secret of ['Ana Beatriz', anaPayload.email as string, '21977771234']) assert.ok(!text.includes(secret));
    const detail = await company.get(`/api/applications/${appId}`);
    assert.equal(detail.body.other.contact, null);
    assert.equal(detail.body.address, null);
  });

  it('contatos digitados no chat são mascarados antes de serem salvos', async () => {
    const res = await ana.post(`/api/applications/${appId}/messages`, { body: 'me chama no (21) 97777-1234 ou ana@example.com' });
    assert.equal(res.body.masked, true);
    assert.ok(!res.body.body.includes('97777'));
    assert.ok(!res.body.body.includes('ana@example.com'));
    const thread = await company.get(`/api/applications/${appId}/messages`);
    assert.ok(!JSON.stringify(thread.body).includes('97777'));
  });

  it('ao aceitar, as duas partes recebem o contato e o acesso fica registrado', async () => {
    assert.equal((await company.post(`/api/applications/${appId}/decide`, { decision: 'accept' })).status, 200);
    const asCompany = await company.get(`/api/applications/${appId}`);
    assert.equal(asCompany.body.other.contact.fullName, 'Ana Beatriz Moreira');
    assert.equal(asCompany.body.other.contact.phone, '21977771234');
    const asAna = await ana.get(`/api/applications/${appId}`);
    assert.equal(asAna.body.address, 'Rua Secreta Fictícia, 99');
    assert.ok(asAna.body.other.contact.phone);
    const overview = await ana.get('/api/privacy/overview');
    assert.ok(overview.body.accessLog.some((e: { action: string }) => e.action === 'contact.view'));
  });

  it('o contato volta a ser ocultado 30 dias depois do turno', async () => {
    const old = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10);
    t.ctx.db.prepare('UPDATE gigs SET date = ? WHERE id = ?').run(old, gigId);
    const res = await company.get(`/api/applications/${appId}`);
    assert.equal(res.body.other.contact, null);
    assert.equal(res.body.address, null);
  });

  it('turno passado pode ser avaliado uma única vez, com nota válida', async () => {
    assert.equal((await ana.post(`/api/applications/${appId}/review`, { stars: 9 })).status, 400);
    assert.equal((await ana.post(`/api/applications/${appId}/review`, { stars: 5 })).status, 201);
    assert.equal((await ana.post(`/api/applications/${appId}/review`, { stars: 1 })).status, 409);
  });

  it('o CNPJ inteiro não circula em respostas de rotina', async () => {
    const payload = companyPayload();
    const client = await signUp(t.base, payload);
    const me = await client.get('/api/me');
    assert.ok(!JSON.stringify(me.body).includes(payload.cnpj as string));
    assert.match(me.body.company.cnpjMasked, /•/);
  });
});

describe('direitos do titular (LGPD)', () => {
  let t: TestApp;
  let company: Client;

  before(async () => {
    t = await startTestApp();
    company = await signUp(t.base, companyPayload());
  });
  after(() => t.close());

  it('aparecer nas buscas vem desligado e revogar tira o perfil na hora', async () => {
    const hidden = await signUp(t.base, freelancerPayload('Lia Prado', { consents: { terms: true, adult: true, discovery: false, marketing: false } }));
    const hiddenId = (await hidden.get('/api/me')).body.id;
    assert.ok(!(await company.get('/api/talents')).body.talents.some((p: { id: string }) => p.id === hiddenId));
    assert.equal((await company.get(`/api/talents/${hiddenId}`)).status, 404);

    await hidden.post('/api/privacy/consents', { purpose: 'discovery', granted: true });
    assert.ok((await company.get('/api/talents')).body.talents.some((p: { id: string }) => p.id === hiddenId));

    await hidden.post('/api/privacy/consents', { purpose: 'discovery', granted: false });
    assert.ok(!(await company.get('/api/talents')).body.talents.some((p: { id: string }) => p.id === hiddenId));
    assert.equal((await company.get(`/api/talents/${hiddenId}`)).status, 404);

    const { body } = await hidden.get('/api/privacy/overview');
    const trail = body.consentHistory.filter((c: { purpose: string }) => c.purpose === 'discovery').map((c: { granted: boolean }) => c.granted);
    assert.deepEqual(trail, [false, true, false], 'histórico guarda cada decisão');
  });

  it('não convida quem não autorizou', async () => {
    const hidden = await signUp(t.base, freelancerPayload('Téo Vasconcelos', { consents: { terms: true, adult: true, discovery: false, marketing: false } }));
    const hiddenId = (await hidden.get('/api/me')).body.id;
    const gigId = (await company.post('/api/gigs', gigPayload())).body.id;
    assert.equal((await company.post(`/api/talents/${hiddenId}/invite`, { gigId })).status, 404);
  });

  it('ver um perfil fica registrado para o titular', async () => {
    const lia = await signUp(t.base, freelancerPayload('Rita Gomes'));
    const id = (await lia.get('/api/me')).body.id;
    await company.get(`/api/talents/${id}`);
    await company.get(`/api/talents/${id}`);
    const { body } = await lia.get('/api/privacy/overview');
    const views = body.accessLog.filter((e: { action: string }) => e.action === 'profile.view');
    assert.equal(views.length, 1);
    assert.ok(views[0].actor.startsWith('Bar de Teste'));
  });

  it('exportar exige a senha e entrega os dados completos', async () => {
    const payload = freelancerPayload('Bia Campos');
    const bia = await signUp(t.base, payload);
    assert.equal((await bia.post('/api/privacy/export', { password: 'errada-errada' })).status, 403);
    const res = await bia.post('/api/privacy/export', { password: STRONG_PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.body.conta.email, payload.email);
    assert.equal(res.body.conta.fullName, 'Bia Campos');
    assert.ok(res.body.consentimentos.length >= 3);
    assert.ok(!JSON.stringify(res.body).includes('scrypt'));
  });

  it('excluir apaga os dados, mata as sessões e libera o e-mail', async () => {
    const payload = freelancerPayload('Davi Nogueira', { phone: '(21) 96666-5555' });
    const davi = await signUp(t.base, payload);
    const id = (await davi.get('/api/me')).body.id;
    const gigId = (await company.post('/api/gigs', gigPayload())).body.id;
    const appId = (await davi.post(`/api/gigs/${gigId}/apply`, { note: 'nota' })).body.id;
    await davi.post(`/api/applications/${appId}/messages`, { body: 'mensagem-do-davi' });

    assert.equal((await davi.post('/api/privacy/delete', { password: STRONG_PASSWORD, confirm: 'nao' })).status, 400);
    assert.equal((await davi.post('/api/privacy/delete', { password: 'errada-errada', confirm: 'EXCLUIR' })).status, 403);
    assert.equal((await davi.post('/api/privacy/delete', { password: STRONG_PASSWORD, confirm: 'EXCLUIR' })).status, 200);

    assert.equal((await davi.get('/api/me')).status, 401);
    assert.equal((await new Client(t.base).post('/api/auth/login', { email: payload.email, password: STRONG_PASSWORD })).status, 401);

    const row = t.ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
    for (const col of ['email_index', 'email_enc', 'password_hash', 'phone_enc', 'full_name_enc', 'city']) assert.equal(row[col], null, col);
    assert.equal(row.display_name, 'Conta removida');
    assert.equal(t.ctx.db.prepare('SELECT 1 FROM freelancer_profiles WHERE user_id = ?').get(id), undefined);
    assert.equal(t.ctx.db.prepare('SELECT 1 FROM sessions WHERE user_id = ?').get(id), undefined);
    const msgs = t.ctx.db.prepare('SELECT body_enc FROM messages WHERE sender_id = ?').all(id) as { body_enc: string | null }[];
    assert.ok(msgs.length > 0 && msgs.every((m) => m.body_enc === null));

    // Mantém só a prova exigida por lei, sem identificação direta.
    assert.ok(t.ctx.db.prepare('SELECT 1 FROM consents WHERE user_id = ?').get(id));
    assert.ok(t.ctx.db.prepare("SELECT 1 FROM audit_log WHERE actor_id = ? AND action = 'data.delete'").get(id));

    // A candidatura saiu da fila da empresa e o e-mail pode ser usado de novo.
    const list = await company.get(`/api/gigs/${gigId}/applications`);
    assert.equal(list.body.applications.length, 0);
    assert.equal((await company.get(`/api/applications/${appId}`)).status, 404);
    assert.ok(await signUp(t.base, { ...payload, fullName: 'Outra Pessoa' }));
  });

  it('excluir empresa cancela as vagas e apaga o endereço', async () => {
    const other = await signUp(t.base, companyPayload());
    const id = (await other.get('/api/me')).body.id;
    const gigId = (await other.post('/api/gigs', gigPayload())).body.id;
    const worker = await signUp(t.base, freelancerPayload('Nina Alves'));
    const workerId = (await worker.get('/api/me')).body.id;
    const inviteId = (await other.post(`/api/talents/${workerId}/invite`, { gigId, note: 'Convite pessoal' })).body.id;
    assert.equal((await other.post('/api/privacy/delete', { password: STRONG_PASSWORD, confirm: 'EXCLUIR' })).status, 200);
    const invite = t.ctx.db.prepare('SELECT status, note_enc FROM applications WHERE id = ?').get(inviteId) as { status: string; note_enc: string | null };
    assert.equal(invite.status, 'cancelled');
    assert.equal(invite.note_enc, null);
    const gig = t.ctx.db.prepare('SELECT status, address_enc FROM gigs WHERE company_id = ?').get(id) as { status: string; address_enc: string | null };
    assert.equal(gig.status, 'cancelled');
    assert.equal(gig.address_enc, null);
    const profile = t.ctx.db.prepare('SELECT cnpj_enc, cnpj_index FROM company_profiles WHERE user_id = ?').get(id) as { cnpj_enc: string | null; cnpj_index: string | null };
    assert.equal(profile.cnpj_enc, null);
    assert.equal(profile.cnpj_index, null);
  });
});

describe('regras do negócio', () => {
  let t: TestApp;
  before(async () => { t = await startTestApp(); });
  after(() => t.close());

  it('não aceita mais pessoas do que as vagas abertas e fecha a vaga cheia', async () => {
    const company = await signUp(t.base, companyPayload());
    const a = await signUp(t.base, freelancerPayload('Ana Moreira'));
    const b = await signUp(t.base, freelancerPayload('Caio Ribeiro'));
    const gigId = (await company.post('/api/gigs', gigPayload({ slots: 1 }))).body.id;
    const appA = (await a.post(`/api/gigs/${gigId}/apply`)).body.id;
    const appB = (await b.post(`/api/gigs/${gigId}/apply`)).body.id;
    assert.equal((await company.post(`/api/applications/${appA}/decide`, { decision: 'accept' })).status, 200);
    assert.equal((await company.post(`/api/applications/${appB}/decide`, { decision: 'accept' })).status, 409);
    assert.equal((await b.get(`/api/applications/${appB}`)).body.status, 'rejected');
    assert.equal((await company.get(`/api/gigs/${gigId}`)).body.status, 'filled');
    assert.equal((await a.post(`/api/applications/${appA}/withdraw`)).status, 200);
    assert.equal((await company.get(`/api/gigs/${gigId}`)).body.status, 'open');
  });

  it('quem retira a candidatura some para a empresa, inclusive se não aparece nas buscas', async () => {
    const company = await signUp(t.base, companyPayload());
    const a = await signUp(t.base, freelancerPayload('Rita Gomes', { consents: { terms: true, adult: true, discovery: false, marketing: false } }));
    const id = (await a.get('/api/me')).body.id;
    const gigId = (await company.post('/api/gigs', gigPayload())).body.id;
    const appId = (await a.post(`/api/gigs/${gigId}/apply`)).body.id;
    assert.equal((await company.get(`/api/talents/${id}`)).status, 200);
    await a.post(`/api/applications/${appId}/withdraw`);
    assert.equal((await company.get(`/api/talents/${id}`)).status, 404);
    assert.equal((await company.get(`/api/gigs/${gigId}/applications`)).body.applications.length, 0);
    assert.equal((await company.get(`/api/applications/${appId}`)).status, 404);
    assert.equal((await a.get(`/api/applications/${appId}`)).body.status, 'withdrawn');
  });

  it('não aceita vaga no passado nem candidatura duplicada', async () => {
    const company = await signUp(t.base, companyPayload());
    const past = await company.post('/api/gigs', gigPayload({ date: '2020-01-01' }));
    assert.equal(past.status, 400);
    assert.ok(past.body.fields.date);
    const a = await signUp(t.base, freelancerPayload());
    const gigId = (await company.post('/api/gigs', gigPayload())).body.id;
    await a.post(`/api/gigs/${gigId}/apply`);
    assert.equal((await a.post(`/api/gigs/${gigId}/apply`)).status, 409);
  });

  it('convite só é aceito pelo freelancer convidado', async () => {
    const company = await signUp(t.base, companyPayload());
    const a = await signUp(t.base, freelancerPayload('Lia Prado'));
    const id = (await a.get('/api/me')).body.id;
    const gigId = (await company.post('/api/gigs', gigPayload())).body.id;
    const invite = await company.post(`/api/talents/${id}/invite`, { gigId, note: 'Vem com a gente!' });
    assert.equal(invite.status, 201);
    assert.equal((await company.post(`/api/applications/${invite.body.id}/decide`, { decision: 'accept' })).status, 409);
    assert.equal((await a.post(`/api/applications/${invite.body.id}/decide`, { decision: 'accept' })).status, 200);
  });
});

describe('peças isoladas', () => {
  it('cifra amarrada ao campo: não pode ser movida para outra coluna', () => {
    const vault = createVault(randomBytes(32), randomBytes(32));
    const payload = vault.encrypt('segredo', 'user.email');
    assert.equal(vault.decrypt(payload, 'user.email'), 'segredo');
    assert.throws(() => vault.decrypt(payload, 'user.phone'));
    const [v, iv, tag, body] = payload.split('.');
    const tampered = [v, iv, tag, Buffer.from(`${body}x`).toString('base64url')].join('.');
    assert.throws(() => vault.decrypt(tampered, 'user.email'));
  });

  it('o mesmo texto gera cifras diferentes a cada vez', () => {
    const vault = createVault(randomBytes(32), randomBytes(32));
    assert.notEqual(vault.encrypt('x', 'c'), vault.encrypt('x', 'c'));
  });

  it('valida CNPJ numérico e alfanumérico', () => {
    assert.equal(isValidCnpj('11222333000181'), true);
    assert.equal(isValidCnpj('11222333000182'), false);
    assert.equal(isValidCnpj('11111111111111'), false);
    assert.equal(isValidCnpj('12ABC34501DE35'), true);
    const base = 'ABCD12345678';
    assert.equal(isValidCnpj(base + checkDigits(base)), true);
  });

  it('mascara telefones, e-mails e links de contato, mas preserva o resto', () => {
    assert.equal(maskContacts('Chego às 18h30 no dia 12').masked, false);
    assert.equal(maskContacts('Pago R$ 220 pela diária').masked, false);
    assert.equal(maskContacts('me liga 21 98888-7777').masked, true);
    assert.equal(maskContacts('+55 (21) 98888 7777').masked, true);
    assert.equal(maskContacts('fala em wa.me/5521988887777').masked, true);
    assert.equal(maskContacts('escreve para ana.m@exemplo.com.br').masked, true);
  });

  it('o servidor recusa modo demonstração e falta de chaves em produção', () => {
    const saved = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.ESCALA_DEMO = 'true';
      assert.throws(() => loadConfig(), /demonstração/);
      delete process.env.ESCALA_DEMO;
      process.env.APP_ORIGIN = 'https://app.exemplo.com.br';
      process.env.SMTP_URL = 'smtps://usuario:senha@smtp.exemplo.com.br:465';
      process.env.MAIL_FROM = 'Escala <nao-responda@exemplo.com.br>';
      delete process.env.ESCALA_ENC_KEY;
      assert.throws(() => loadConfig(), /ESCALA_ENC_KEY/);
      process.env.ESCALA_ENC_KEY = randomBytes(32).toString('base64');
      process.env.ESCALA_HMAC_KEY = randomBytes(32).toString('base64');
      delete process.env.SMTP_URL;
      assert.throws(() => loadConfig(), /SMTP_URL/);
      process.env.SMTP_URL = 'smtps://usuario:senha@smtp.exemplo.com.br:465';
      const config = loadConfig();
      assert.equal(config.secureCookies, true);
      assert.equal(config.demoMode, false);
      assert.deepEqual(config.allowedOrigins, ['https://app.exemplo.com.br']);
    } finally {
      process.env = saved;
    }
  });

  it('com HTTPS, o cookie usa __Host- e Secure e o HSTS é enviado', async () => {
    const t = await startTestApp({ secureCookies: true });
    const { res } = await completeSignup(t.base, freelancerPayload());
    const cookie = res.headers.get('set-cookie') ?? '';
    assert.match(cookie, /^__Host-escala_sid=/);
    assert.match(cookie, /Secure/i);
    assert.match(res.headers.get('strict-transport-security') ?? '', /max-age=31536000/);
    await t.close();
  });

  it('não expõe contas de demonstração fora do modo demonstração', async () => {
    const t = await startTestApp();
    const res = await new Client(t.base).get('/api/meta');
    assert.deepEqual(res.body.demoAccounts, []);
    await t.close();
  });
});
