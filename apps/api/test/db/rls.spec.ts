import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withUser } from '../../src/db/with-user.js';
import {
  appRows,
  as,
  asApp,
  CHECK_FAILED,
  checkIn,
  closePools,
  DENIED,
  makeApplication,
  makeCompany,
  makeCompleted,
  makeConversation,
  makeFile,
  makeFreelancer,
  makeHired,
  makeJob,
  makeProposal,
  makeUser,
  roleUrl,
  setApplicationStatus,
  system,
  type Hired,
} from './helpers.js';

afterAll(closePools);

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

describe('sem pessoa logada', () => {
  // Catálogos sem dados de pessoas, que a tela de ajuda e o login usam.
  const PUBLIC_CATALOGS = new Set([
    'skills',
    'legal_documents',
    'help_articles',
    'feature_flags',
    'badges',
    'reputation_rules',
  ]);

  it('o app não enxerga nenhuma linha de dados de pessoas', async () => {
    await makeCompleted();
    const tables = await system<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'pgmigrations'`,
    );
    const leaked: string[] = [];
    for (const { tablename } of tables) {
      if (PUBLIC_CATALOGS.has(tablename)) continue;
      const [privilege] = await system<{ can: boolean }>(
        `SELECT has_table_privilege('escala_app', $1::regclass, 'SELECT') AS can`,
        [`public.${tablename}`],
      );
      if (!privilege?.can) continue;
      const rows = await appRows(null, `SELECT 1 FROM public.${tablename} LIMIT 1`);
      if (rows.length > 0) leaked.push(tablename);
    }
    expect(leaked).toEqual([]);
  });
});

describe('users', () => {
  it('cada pessoa só lê a própria linha', async () => {
    const ana = await makeUser();
    const bia = await makeUser();
    expect(ids(await appRows(ana, `SELECT id FROM users`))).toEqual([ana]);
    expect(await appRows(ana, `SELECT id FROM users WHERE id = $1`, [bia])).toEqual([]);
  });

  it('não altera a linha de outra pessoa', async () => {
    const ana = await makeUser();
    const bia = await makeUser();
    await appRows(ana, `UPDATE users SET phone_enc = 'x' WHERE id = $1`, [bia]);
    const [row] = await system<{ phone_enc: string }>(`SELECT phone_enc FROM users WHERE id = $1`, [
      bia,
    ]);
    expect(row?.phone_enc).not.toBe('x');
  });

  it.each(['platform_role', 'status', 'email_enc', 'email_index', 'deleted_at'])(
    'não altera a própria coluna protegida %s',
    async (column) => {
      const ana = await makeUser();
      await expect(
        appRows(ana, `UPDATE users SET ${column} = NULL WHERE id = $1`, [ana]),
      ).rejects.toMatchObject(DENIED);
    },
  );

  it('não cria contas nem apaga a própria linha pelo app', async () => {
    const ana = await makeUser();
    await expect(
      appRows(ana, `INSERT INTO users (email_index, email_enc) VALUES ('a', 'b')`),
    ).rejects.toMatchObject(DENIED);
    await expect(appRows(ana, `DELETE FROM users WHERE id = $1`, [ana])).rejects.toMatchObject(
      DENIED,
    );
  });

  it('o contexto de uma requisição não vaza para a seguinte na mesma conexão', async () => {
    const ana = await makeUser();
    // Uma conexão só: a consulta seguinte usa obrigatoriamente a mesma.
    const single = new Pool({ connectionString: roleUrl('app'), max: 1 });
    try {
      await withUser(single, ana, (client) => client.query('SELECT 1'));
      const { rows } = await single.query(`SELECT app.current_user_id() AS id`);
      expect(rows).toEqual([{ id: null }]);
    } finally {
      await single.end();
    }
  });

  it('um erro na transação também não deixa o contexto para trás', async () => {
    const ana = await makeUser();
    const single = new Pool({ connectionString: roleUrl('app'), max: 1 });
    try {
      await expect(
        withUser(single, ana, (client) => client.query('SELECT 1 / 0')),
      ).rejects.toMatchObject({ code: '22012' });
      const { rows } = await single.query(`SELECT app.current_user_id() AS id`);
      expect(rows).toEqual([{ id: null }]);
    } finally {
      await single.end();
    }
  });
});

describe('sessões e credenciais', () => {
  it('cada pessoa vê as próprias sessões e encerra só as dela', async () => {
    const ana = await makeUser();
    const bia = await makeUser();
    const [session] = await system<{ id: string }>(
      `INSERT INTO sessions (user_id, expires_at) VALUES ($1, now() + interval '1 day') RETURNING id`,
      [ana],
    );
    expect(await appRows(bia, `SELECT id FROM sessions WHERE user_id = $1`, [ana])).toEqual([]);
    await appRows(bia, `UPDATE sessions SET revoked_at = now() WHERE id = $1`, [session?.id]);
    const [still] = await system(`SELECT revoked_at FROM sessions WHERE id = $1`, [session?.id]);
    expect(still).toEqual({ revoked_at: null });
    await appRows(ana, `UPDATE sessions SET revoked_at = now() WHERE id = $1`, [session?.id]);
    const [done] = await system<{ revoked_at: Date }>(
      `SELECT revoked_at FROM sessions WHERE id = $1`,
      [session?.id],
    );
    expect(done?.revoked_at).toBeInstanceOf(Date);
  });

  it('o app não prolonga a própria sessão', async () => {
    const ana = await makeUser();
    await expect(
      appRows(ana, `UPDATE sessions SET expires_at = now() + interval '10 years'`),
    ).rejects.toMatchObject(DENIED);
  });

  it('códigos, tokens e segundo fator são inacessíveis para o app', async () => {
    const ana = await makeUser();
    for (const table of ['otp_codes', 'refresh_tokens', 'mfa_factors']) {
      await expect(appRows(ana, `SELECT * FROM ${table}`)).rejects.toMatchObject(DENIED);
    }
  });

  it('o papel de login só cria conta com papel padrão', async () => {
    const [row] = await as('auth', null, async (client) => {
      const { rows } = await client.query<{ platform_role: string }>(
        `INSERT INTO users (email_index, email_enc, status) VALUES ($1, 'v1.k1.a.b.c', 'active')
         RETURNING platform_role`,
        [randomBytes(16).toString('hex')],
      );
      return rows;
    });
    expect(row).toEqual({ platform_role: 'none' });
    await expect(
      as('auth', null, (client) =>
        client.query(
          `INSERT INTO users (email_index, email_enc, platform_role) VALUES ($1, 'x', 'admin')`,
          [randomBytes(16).toString('hex')],
        ),
      ),
    ).rejects.toMatchObject(DENIED);
  });
});

describe('perfil do freelancer', () => {
  it('fica oculto para empresas sem relação, até a pessoa aceitar aparecer na busca', async () => {
    const hidden = await makeFreelancer({ discoverable: false });
    const visible = await makeFreelancer({ discoverable: true });
    const owner = await makeUser();
    await makeCompany(owner);

    expect(
      await appRows(owner, `SELECT user_id FROM freelancer_profiles WHERE user_id = $1`, [hidden]),
    ).toEqual([]);
    expect(
      await appRows(owner, `SELECT user_id FROM freelancer_profiles WHERE user_id = $1`, [visible]),
    ).toEqual([{ user_id: visible }]);
  });

  it('outro freelancer não navega pelos perfis', async () => {
    const visible = await makeFreelancer({ discoverable: true });
    const other = await makeFreelancer();
    expect(
      await appRows(other, `SELECT user_id FROM freelancer_profiles WHERE user_id = $1`, [visible]),
    ).toEqual([]);
  });

  it('a empresa vê quem se candidatou, e deixa de ver quando a candidatura é retirada', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const job = await makeJob(owner, company);
    const freelancer = await makeFreelancer();
    const application = await makeApplication(job, freelancer);
    const query = `SELECT user_id FROM freelancer_profiles WHERE user_id = $1`;

    expect(await appRows(owner, query, [freelancer])).toHaveLength(1);
    expect(
      await appRows(owner, `SELECT id FROM applications WHERE id = $1`, [application]),
    ).toHaveLength(1);

    await setApplicationStatus(freelancer, application, 'withdrawn');

    expect(await appRows(owner, query, [freelancer])).toEqual([]);
    expect(
      await appRows(owner, `SELECT id FROM applications WHERE id = $1`, [application]),
    ).toEqual([]);
  });

  it('quem foi recusado volta à privacidade, e a empresa guarda só o histórico', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const job = await makeJob(owner, company);
    const freelancer = await makeFreelancer();
    const application = await makeApplication(job, freelancer);
    await setApplicationStatus(owner, application, 'rejected');

    expect(
      await appRows(owner, `SELECT user_id FROM freelancer_profiles WHERE user_id = $1`, [
        freelancer,
      ]),
    ).toEqual([]);
    expect(
      await appRows(owner, `SELECT status FROM applications WHERE id = $1`, [application]),
    ).toEqual([{ status: 'rejected' }]);
  });

  it('ninguém altera o perfil de outra pessoa nem o próprio status', async () => {
    const ana = await makeFreelancer();
    const bia = await makeFreelancer();
    await appRows(bia, `UPDATE freelancer_profiles SET bio = 'invadido' WHERE user_id = $1`, [ana]);
    const [row] = await system(`SELECT bio FROM freelancer_profiles WHERE user_id = $1`, [ana]);
    expect(row).toEqual({ bio: '' });
    await expect(
      appRows(ana, `UPDATE freelancer_profiles SET status = 'suspended' WHERE user_id = $1`, [ana]),
    ).rejects.toMatchObject(DENIED);
  });
});

describe('empresa', () => {
  it('não nasce ativa nem verificada por conta própria', async () => {
    const owner = await makeUser();
    await expect(
      appRows(
        owner,
        `INSERT INTO companies (trade_name, segment, status) VALUES ('Golpe', 'outros', 'active')`,
      ),
    ).rejects.toMatchObject(DENIED);
    await expect(
      appRows(
        owner,
        `INSERT INTO companies (trade_name, segment, verified_at) VALUES ('Golpe', 'outros', now())`,
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it('mudar o nome derruba o selo de verificada', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    await system(`UPDATE companies SET verified_at = now() WHERE id = $1`, [company]);
    await appRows(owner, `UPDATE companies SET trade_name = 'Outro Nome' WHERE id = $1`, [company]);
    const [row] = await system(`SELECT verified_at FROM companies WHERE id = $1`, [company]);
    expect(row).toEqual({ verified_at: null });
  });

  it('dados internos só para os membros', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const stranger = await makeUser();
    await appRows(
      owner,
      `INSERT INTO company_private_details (company_id, legal_name_enc) VALUES ($1, 'v1.k1.a.b.c')`,
      [company],
    );
    const query = `SELECT company_id FROM company_private_details WHERE company_id = $1`;
    expect(await appRows(owner, query, [company])).toHaveLength(1);
    expect(await appRows(stranger, query, [company])).toEqual([]);
  });

  it('um convite sem aceite não dá acesso', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    await appRows(owner, `INSERT INTO company_private_details (company_id) VALUES ($1)`, [company]);
    const invited = await makeUser();
    await appRows(
      owner,
      `INSERT INTO company_members (company_id, user_id, role, invited_by) VALUES ($1, $2, 'admin', $3)`,
      [company, invited, owner],
    );
    const query = `SELECT company_id FROM company_private_details WHERE company_id = $1`;
    expect(await appRows(invited, query, [company])).toEqual([]);

    await appRows(invited, `UPDATE company_members SET accepted_at = now() WHERE user_id = $1`, [
      invited,
    ]);
    expect(await appRows(invited, query, [company])).toHaveLength(1);
  });

  it('não dá para colocar alguém na empresa já com o convite aceito', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const invited = await makeUser();
    await expect(
      appRows(
        owner,
        `INSERT INTO company_members (company_id, user_id, role, accepted_at) VALUES ($1, $2, 'admin', now())`,
        [company, invited],
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it('só quem é dono altera papéis, e estranhos não entram sozinhos', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const recruiter = await makeUser();
    await appRows(
      owner,
      `INSERT INTO company_members (company_id, user_id, role) VALUES ($1, $2, 'recruiter')`,
      [company, recruiter],
    );
    await appRows(recruiter, `UPDATE company_members SET accepted_at = now() WHERE user_id = $1`, [
      recruiter,
    ]);

    await expect(
      appRows(recruiter, `UPDATE company_members SET role = 'owner' WHERE user_id = $1`, [
        recruiter,
      ]),
    ).rejects.toMatchObject(DENIED);

    const stranger = await makeUser();
    await expect(
      appRows(
        stranger,
        `INSERT INTO company_members (company_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [company, stranger],
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it('a empresa não fica sem dono', async () => {
    const owner = await makeUser();
    await makeCompany(owner);
    await expect(
      appRows(owner, `DELETE FROM company_members WHERE user_id = $1`, [owner]),
    ).rejects.toMatchObject(CHECK_FAILED);
    await expect(
      appRows(owner, `UPDATE company_members SET role = 'admin' WHERE user_id = $1`, [owner]),
    ).rejects.toMatchObject(CHECK_FAILED);
  });

  it('um recrutador não altera a empresa', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const recruiter = await makeUser();
    await appRows(
      owner,
      `INSERT INTO company_members (company_id, user_id, role) VALUES ($1, $2, 'recruiter')`,
      [company, recruiter],
    );
    await appRows(recruiter, `UPDATE company_members SET accepted_at = now() WHERE user_id = $1`, [
      recruiter,
    ]);
    await appRows(recruiter, `UPDATE companies SET about = 'invadido' WHERE id = $1`, [company]);
    const [row] = await system(`SELECT about FROM companies WHERE id = $1`, [company]);
    expect(row).toEqual({ about: '' });
  });
});

describe('vagas', () => {
  it('rascunho só para a empresa, publicada para quem está logado', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const draft = await makeJob(owner, company, { status: 'draft' });
    const published = await makeJob(owner, company);
    const stranger = await makeFreelancer();
    const query = `SELECT id FROM jobs WHERE id = ANY($1::uuid[])`;

    expect(ids(await appRows(owner, query, [[draft, published]])).sort()).toEqual(
      [draft, published].sort(),
    );
    expect(ids(await appRows(stranger, query, [[draft, published]]))).toEqual([published]);
  });

  it('só a própria empresa cria e altera vagas', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const job = await makeJob(owner, company);
    const rival = await makeUser();
    await makeCompany(rival);

    await expect(makeJob(rival, company)).rejects.toMatchObject(DENIED);
    await appRows(rival, `UPDATE jobs SET title = 'Invadida' WHERE id = $1`, [job]);
    const [row] = await system<{ title: string }>(`SELECT title FROM jobs WHERE id = $1`, [job]);
    expect(row?.title).not.toBe('Invadida');
  });

  it('o endereço exato segue fechado para candidatos, até o aceite do contrato', async () => {
    const hired = await makeProposal();
    const query = `SELECT job_id, address_enc FROM job_private_details WHERE job_id = $1`;
    const stranger = await makeFreelancer();

    expect(await appRows(hired.ownerId, query, [hired.jobId])).toHaveLength(1);
    expect(await appRows(stranger, query, [hired.jobId])).toEqual([]);
    expect(await appRows(hired.freelancerId, query, [hired.jobId])).toEqual([]);

    await appRows(hired.freelancerId, `UPDATE contracts SET status = 'accepted' WHERE id = $1`, [
      hired.contractId,
    ]);
    expect(await appRows(hired.freelancerId, query, [hired.jobId])).toHaveLength(1);
    expect(await appRows(stranger, query, [hired.jobId])).toEqual([]);
  });

  it('o endereço volta a fechar 30 dias depois do último turno', async () => {
    const hired = await makeHired();
    const query = `SELECT job_id FROM job_private_details WHERE job_id = $1`;
    await system(
      `UPDATE contracts SET contact_visible_until = now() - interval '1 second' WHERE id = $1`,
      [hired.contractId],
    );
    expect(await appRows(hired.freelancerId, query, [hired.jobId])).toEqual([]);
    expect(await appRows(hired.ownerId, query, [hired.jobId])).toHaveLength(1);
  });

  it('o prazo do contato acompanha o último turno', async () => {
    const hired = await makeHired();
    const [row] = await system<{ days: number }>(
      `SELECT extract(day FROM c.contact_visible_until - s.ends_at)::int AS days
       FROM contracts c JOIN shifts s ON s.contract_id = c.id WHERE c.id = $1`,
      [hired.contractId],
    );
    expect(row?.days).toBe(30);
  });
});

describe('candidaturas', () => {
  it('cada parte só vê o que é dela', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const job = await makeJob(owner, company);
    const ana = await makeFreelancer();
    const bia = await makeFreelancer();
    const anaApplication = await makeApplication(job, ana);
    const rival = await makeUser();
    await makeCompany(rival);
    const query = `SELECT id FROM applications WHERE id = $1`;

    expect(await appRows(ana, query, [anaApplication])).toHaveLength(1);
    expect(await appRows(owner, query, [anaApplication])).toHaveLength(1);
    expect(await appRows(bia, query, [anaApplication])).toEqual([]);
    expect(await appRows(rival, query, [anaApplication])).toEqual([]);
  });

  it('ninguém se candidata em nome de outra pessoa', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const job = await makeJob(owner, company);
    const ana = await makeFreelancer();
    const bia = await makeFreelancer();
    await expect(makeApplicationAs(bia, job, ana)).rejects.toMatchObject(DENIED);
  });

  it('ninguém se candidata à vaga da própria empresa', async () => {
    const owner = await makeFreelancer();
    const company = await makeCompany(owner);
    const job = await makeJob(owner, company);
    await expect(makeApplication(job, owner)).rejects.toMatchObject(CHECK_FAILED);
  });

  it('não há candidatura em vaga fechada', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const draft = await makeJob(owner, company, { status: 'draft' });
    const ana = await makeFreelancer();
    await expect(makeApplication(draft, ana)).rejects.toMatchObject(CHECK_FAILED);
  });

  it('convite só para quem aceitou aparecer na busca', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const job = await makeJob(owner, company);
    const hidden = await makeFreelancer({ discoverable: false });
    const visible = await makeFreelancer({ discoverable: true });
    const invite = `INSERT INTO applications (job_id, freelancer_id, origin, status) VALUES ($1, $2, 'invited', 'invited')`;

    await expect(appRows(owner, invite, [job, hidden])).rejects.toMatchObject(DENIED);
    await expect(appRows(owner, invite, [job, visible])).resolves.toEqual([]);
  });

  it('a candidatura retirada some da conversa com a empresa', async () => {
    const hired = await makeProposal();
    const conversation = await makeConversation(hired);
    await setApplicationStatus(hired.freelancerId, hired.applicationId, 'withdrawn');
    // A empresa já participava, e o histórico da conversa continua dela.
    expect(
      await appRows(hired.ownerId, `SELECT id FROM conversations WHERE id = $1`, [conversation]),
    ).toHaveLength(1);
    expect(
      await appRows(hired.ownerId, `SELECT id FROM applications WHERE id = $1`, [
        hired.applicationId,
      ]),
    ).toEqual([]);
  });
});

async function makeApplicationAs(actor: string, job: string, freelancer: string) {
  return appRows(
    actor,
    `INSERT INTO applications (job_id, freelancer_id, origin, status) VALUES ($1, $2, 'applied', 'applied')`,
    [job, freelancer],
  );
}

describe('contratos', () => {
  it('só as partes leem', async () => {
    const hired = await makeHired();
    const stranger = await makeUser();
    const query = `SELECT id FROM contracts WHERE id = $1`;
    expect(await appRows(hired.freelancerId, query, [hired.contractId])).toHaveLength(1);
    expect(await appRows(hired.ownerId, query, [hired.contractId])).toHaveLength(1);
    expect(await appRows(stranger, query, [hired.contractId])).toEqual([]);
  });

  it('não nasce sem candidatura selecionada', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const job = await makeJob(owner, company);
    const ana = await makeFreelancer();
    const application = await makeApplication(job, ana);
    const [terms] = await system<{ id: string }>(`SELECT id FROM legal_documents LIMIT 1`);
    await expect(
      appRows(
        owner,
        `INSERT INTO contracts (application_id, job_id, company_id, freelancer_id, company_contact_user_id,
           terms_document_id, agreed_amount_cents, pay_unit)
         VALUES ($1, $2, $3, $4, $5, $6, 1000, 'diaria')`,
        [application, job, company, ana, owner, terms?.id],
      ),
    ).rejects.toMatchObject(CHECK_FAILED);
  });

  it('uma empresa não contrata em nome de outra', async () => {
    const hired = await makeProposal();
    const rival = await makeUser();
    await makeCompany(rival);
    await expect(
      appRows(
        rival,
        `INSERT INTO shifts (contract_id, starts_at, ends_at) VALUES ($1, now(), now() + interval '1 hour')`,
        [hired.contractId],
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it.each([
    ['completed_at', 'now()'],
    ['accepted_at', 'now()'],
    ['contact_visible_until', `now() + interval '10 years'`],
    ['company_marked_paid_at', 'now()'],
    ['freelancer_confirmed_paid_at', 'now()'],
    ['company_confirmed_at', 'now()'],
    ['freelancer_confirmed_at', 'now()'],
    ['agreed_amount_cents', '1'],
    ['freelancer_id', 'freelancer_id'],
    ['cancelled_by', `'platform'`],
    ['no_show_party', `'company'`],
  ])('a coluna %s não é alterada diretamente', async (column, value) => {
    const hired = await makeHired();
    for (const actor of [hired.freelancerId, hired.ownerId]) {
      await expect(
        appRows(actor, `UPDATE contracts SET ${column} = ${value} WHERE id = $1`, [
          hired.contractId,
        ]),
      ).rejects.toMatchObject(DENIED);
    }
  });

  it('quem cancela fica registrado pelo banco, sem poder apontar outro', async () => {
    const hired = await makeHired();
    await appRows(hired.freelancerId, `UPDATE contracts SET status = 'cancelled' WHERE id = $1`, [
      hired.contractId,
    ]);
    const [row] = await system(`SELECT cancelled_by FROM contracts WHERE id = $1`, [
      hired.contractId,
    ]);
    expect(row).toEqual({ cancelled_by: 'freelancer' });
  });

  it('quem registra a falta aponta a outra parte', async () => {
    const hired = await makeHired();
    await appRows(hired.ownerId, `UPDATE contracts SET status = 'no_show' WHERE id = $1`, [
      hired.contractId,
    ]);
    const [row] = await system(`SELECT no_show_party FROM contracts WHERE id = $1`, [
      hired.contractId,
    ]);
    expect(row).toEqual({ no_show_party: 'freelancer' });
  });

  it('depois do aceite, os horários do turno não mudam', async () => {
    const hired = await makeHired();
    for (const actor of [hired.freelancerId, hired.ownerId]) {
      await expect(
        appRows(actor, `UPDATE shifts SET ends_at = ends_at + interval '10 years' WHERE id = $1`, [
          hired.shiftId,
        ]),
      ).rejects.toMatchObject(DENIED);
    }
  });
});

describe('check-in', () => {
  it('só o freelancer do contrato registra', async () => {
    const hired = await makeHired();
    const stranger = await makeFreelancer();
    await expect(
      appRows(stranger, `INSERT INTO check_ins (shift_id, kind) VALUES ($1, 'in')`, [
        hired.shiftId,
      ]),
    ).rejects.toMatchObject(DENIED);
    await expect(
      appRows(hired.ownerId, `INSERT INTO check_ins (shift_id, kind) VALUES ($1, 'in')`, [
        hired.shiftId,
      ]),
    ).rejects.toMatchObject(DENIED);
  });

  it('o app não declara estar dentro da geocerca nem escolhe o horário', async () => {
    const hired = await makeHired();
    for (const assignment of ['within_geofence', 'occurred_at', 'source']) {
      const value = { within_geofence: 'true', occurred_at: 'now()', source: `'manual'` }[
        assignment
      ];
      await expect(
        appRows(
          hired.freelancerId,
          `INSERT INTO check_ins (shift_id, kind, ${assignment}) VALUES ($1, 'in', ${value})`,
          [hired.shiftId],
        ),
      ).rejects.toMatchObject(DENIED);
    }
  });

  it('as partes veem, e terceiros não', async () => {
    const hired = await makeHired();
    await checkIn(hired, 'in');
    const stranger = await makeUser();
    const query = `SELECT kind FROM check_ins WHERE shift_id = $1`;
    expect(await appRows(hired.freelancerId, query, [hired.shiftId])).toHaveLength(1);
    expect(await appRows(hired.ownerId, query, [hired.shiftId])).toHaveLength(1);
    expect(await appRows(stranger, query, [hired.shiftId])).toEqual([]);
  });
});

describe('conversas', () => {
  let hired: Hired;
  let conversation: string;
  let stranger: string;

  beforeAll(async () => {
    hired = await makeHired();
    conversation = await makeConversation(hired);
    stranger = await makeUser();
  });

  const send = (actor: string, conversationId: string, sender = actor) =>
    appRows<{ id: string }>(
      actor,
      `INSERT INTO messages (conversation_id, sender_user_id, kind, body_enc) VALUES ($1, $2, 'text', 'v1.k1.a.b.c') RETURNING id`,
      [conversationId, sender],
    );

  it('participantes leem e escrevem, terceiros não', async () => {
    const [message] = await send(hired.freelancerId, conversation);
    const query = `SELECT id FROM messages WHERE id = $1`;
    expect(await appRows(hired.ownerId, query, [message?.id])).toHaveLength(1);
    expect(await appRows(stranger, query, [message?.id])).toEqual([]);
    expect(
      await appRows(stranger, `SELECT id FROM conversations WHERE id = $1`, [conversation]),
    ).toEqual([]);
    await expect(send(stranger, conversation)).rejects.toMatchObject(DENIED);
  });

  it('ninguém escreve em nome de outra pessoa nem como sistema', async () => {
    await expect(send(hired.freelancerId, conversation, hired.ownerId)).rejects.toMatchObject(
      DENIED,
    );
    await expect(
      appRows(
        hired.freelancerId,
        `INSERT INTO messages (conversation_id, sender_user_id, kind, body_enc) VALUES ($1, $2, 'system', 'x')`,
        [conversation, hired.freelancerId],
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it('ninguém entra sozinho em uma conversa', async () => {
    await expect(
      appRows(
        stranger,
        `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)`,
        [conversation, stranger],
      ),
    ).rejects.toMatchObject(DENIED);
    await expect(
      appRows(stranger, `SELECT app.ensure_conversation($1)`, [hired.applicationId]),
    ).rejects.toMatchObject({ code: 'P0002' });
  });

  it('mensagem não se edita, só se remove', async () => {
    const [message] = await send(hired.freelancerId, conversation);
    await expect(
      appRows(hired.freelancerId, `UPDATE messages SET body_enc = 'trocado' WHERE id = $1`, [
        message?.id,
      ]),
    ).rejects.toMatchObject(DENIED);
    await appRows(
      hired.freelancerId,
      `UPDATE messages SET status = 'removed', body_enc = NULL WHERE id = $1`,
      [message?.id],
    );
    expect(
      await appRows(hired.ownerId, `SELECT id FROM messages WHERE id = $1`, [message?.id]),
    ).toEqual([]);
  });

  it('a mensagem de outra pessoa não é removida', async () => {
    const [message] = await send(hired.ownerId, conversation);
    await appRows(
      hired.freelancerId,
      `UPDATE messages SET status = 'removed', body_enc = NULL WHERE id = $1`,
      [message?.id],
    );
    const [row] = await system(`SELECT status FROM messages WHERE id = $1`, [message?.id]);
    expect(row).toEqual({ status: 'visible' });
  });

  it('mensagem denunciada não pode ser apagada por quem enviou', async () => {
    const [message] = await send(hired.ownerId, conversation);
    await appRows(
      hired.freelancerId,
      `INSERT INTO message_reports (message_id, reporter_user_id, reason) VALUES ($1, $2, 'ofensa')`,
      [message?.id, hired.freelancerId],
    );
    await expect(
      appRows(
        hired.ownerId,
        `UPDATE messages SET status = 'removed', body_enc = NULL WHERE id = $1`,
        [message?.id],
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it('o bloqueio impede novas mensagens nos dois sentidos', async () => {
    const other = await makeHired();
    const otherConversation = await makeConversation(other);
    await appRows(
      other.freelancerId,
      `INSERT INTO user_blocks (blocker_user_id, blocked_user_id) VALUES ($1, $2)`,
      [other.freelancerId, other.ownerId],
    );
    await expect(send(other.ownerId, otherConversation)).rejects.toMatchObject(DENIED);
    await expect(send(other.freelancerId, otherConversation)).rejects.toMatchObject(DENIED);
  });

  it('bloqueios são privados', async () => {
    const other = await makeHired();
    await appRows(
      other.freelancerId,
      `INSERT INTO user_blocks (blocker_user_id, blocked_user_id) VALUES ($1, $2)`,
      [other.freelancerId, other.ownerId],
    );
    expect(
      await appRows(other.ownerId, `SELECT * FROM user_blocks WHERE blocked_user_id = $1`, [
        other.ownerId,
      ]),
    ).toEqual([]);
  });
});

describe('arquivos', () => {
  it('só o dono acessa um arquivo sem vínculo', async () => {
    const ana = await makeUser();
    const bia = await makeUser();
    const file = await makeFile(ana);
    const query = `SELECT id FROM files WHERE id = $1`;
    expect(await appRows(ana, query, [file])).toHaveLength(1);
    expect(await appRows(bia, query, [file])).toEqual([]);
  });

  it('quem envia não declara o arquivo como limpo', async () => {
    const ana = await makeUser();
    await expect(
      appRows(
        ana,
        `INSERT INTO files (owner_user_id, storage_key, mime_type, size_bytes, sha256, scan_status)
        VALUES ($1, 'x', 'image/png', 1, repeat('a', 64), 'clean')`,
        [ana],
      ),
    ).rejects.toMatchObject(DENIED);
    await expect(appRows(ana, `UPDATE files SET scan_status = 'clean'`)).rejects.toMatchObject(
      DENIED,
    );
  });

  it('não dá para enviar um arquivo em nome de outra pessoa', async () => {
    const ana = await makeUser();
    const bia = await makeUser();
    await expect(makeFileFor(ana, bia)).rejects.toMatchObject(DENIED);
  });

  // Apontar para o arquivo de outra pessoa abriria o acesso, porque a leitura depende de onde ele é usado.
  it('não dá para ganhar acesso apontando para o arquivo de outra pessoa', async () => {
    const victim = await makeUser();
    const secret = await makeFile(victim);
    const attacker = await makeFreelancer({ discoverable: true });
    const notFound = { code: '23503' };

    await expect(
      appRows(attacker, `UPDATE freelancer_profiles SET photo_file_id = $1 WHERE user_id = $2`, [
        secret,
        attacker,
      ]),
    ).rejects.toMatchObject(notFound);
    await expect(
      appRows(
        attacker,
        `INSERT INTO portfolio_items (freelancer_id, title, file_id) VALUES ($1, 't', $2)`,
        [attacker, secret],
      ),
    ).rejects.toMatchObject(notFound);
    await expect(
      appRows(attacker, `INSERT INTO documents (user_id, kind, file_id) VALUES ($1, 'outro', $2)`, [
        attacker,
        secret,
      ]),
    ).rejects.toMatchObject(notFound);

    const owner = await makeUser();
    const company = await makeCompany(owner);
    await expect(
      appRows(owner, `UPDATE companies SET logo_file_id = $1 WHERE id = $2`, [secret, company]),
    ).rejects.toMatchObject(notFound);

    const hired = await makeHired();
    const conversation = await makeConversation(hired);
    const [message] = await appRows<{ id: string }>(
      hired.freelancerId,
      `INSERT INTO messages (conversation_id, sender_user_id, kind) VALUES ($1, $2, 'file') RETURNING id`,
      [conversation, hired.freelancerId],
    );
    await expect(
      appRows(
        hired.freelancerId,
        `INSERT INTO message_attachments (message_id, file_id) VALUES ($1, $2)`,
        [message?.id, secret],
      ),
    ).rejects.toMatchObject(notFound);

    expect(await appRows(attacker, `SELECT id FROM files WHERE id = $1`, [secret])).toEqual([]);
  });

  it('a foto só é liberada para a empresa depois da pré-seleção', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const job = await makeJob(owner, company);
    const ana = await makeFreelancer();
    const photo = await makeFile(ana);
    await appRows(ana, `UPDATE freelancer_profiles SET photo_file_id = $1 WHERE user_id = $2`, [
      photo,
      ana,
    ]);
    const application = await makeApplication(job, ana);
    const query = `SELECT id FROM files WHERE id = $1`;

    expect(await appRows(owner, query, [photo])).toEqual([]);
    await setApplicationStatus(owner, application, 'shortlisted');
    expect(await appRows(owner, query, [photo])).toHaveLength(1);
  });

  it('o logo é público para quem está logado, e só para quem está logado', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const logo = await makeFile(owner);
    await appRows(owner, `UPDATE companies SET logo_file_id = $1 WHERE id = $2`, [logo, company]);
    const stranger = await makeUser();
    const query = `SELECT id FROM files WHERE id = $1`;
    expect(await appRows(stranger, query, [logo])).toHaveLength(1);
    expect(await appRows(null, query, [logo])).toEqual([]);
  });

  it('o anexo é visto por quem participa da conversa', async () => {
    const hired = await makeHired();
    const conversation = await makeConversation(hired);
    const file = await makeFile(hired.freelancerId);
    const [message] = await appRows<{ id: string }>(
      hired.freelancerId,
      `INSERT INTO messages (conversation_id, sender_user_id, kind) VALUES ($1, $2, 'file') RETURNING id`,
      [conversation, hired.freelancerId],
    );
    await appRows(
      hired.freelancerId,
      `INSERT INTO message_attachments (message_id, file_id) VALUES ($1, $2)`,
      [message?.id, file],
    );
    const stranger = await makeUser();
    const query = `SELECT id FROM files WHERE id = $1`;
    expect(await appRows(hired.ownerId, query, [file])).toHaveLength(1);
    expect(await appRows(stranger, query, [file])).toEqual([]);
  });
});

async function makeFileFor(actor: string, owner: string) {
  return appRows(
    actor,
    `INSERT INTO files (owner_user_id, storage_key, mime_type, size_bytes, sha256)
     VALUES ($1, $2, 'image/png', 1, repeat('c', 64))`,
    [owner, `teste/${randomBytes(6).toString('hex')}`],
  );
}

describe('avaliações', () => {
  const review = (actor: string, contract: string) =>
    appRows<{ id: string }>(
      actor,
      `INSERT INTO reviews (contract_id, comment) VALUES ($1, 'Ótimo') RETURNING id`,
      [contract],
    );

  it('dupla-cega: só aparece depois que as duas partes avaliam', async () => {
    const hired = await makeCompleted();
    const stranger = await makeUser();
    const [first] = await review(hired.freelancerId, hired.contractId);
    const query = `SELECT id FROM reviews WHERE id = $1`;

    expect(await appRows(hired.freelancerId, query, [first?.id])).toHaveLength(1);
    expect(await appRows(hired.ownerId, query, [first?.id])).toEqual([]);
    expect(await appRows(stranger, query, [first?.id])).toEqual([]);

    await review(hired.ownerId, hired.contractId);

    expect(await appRows(hired.ownerId, query, [first?.id])).toHaveLength(1);
    expect(await appRows(stranger, query, [first?.id])).toHaveLength(1);
  });

  it('o banco define quem avalia quem', async () => {
    const hired = await makeCompleted();
    await review(hired.freelancerId, hired.contractId);
    await review(hired.ownerId, hired.contractId);
    const rows = await system<Record<string, string | null>>(
      `SELECT reviewer_side, reviewer_user_id, subject_user_id, subject_company_id FROM reviews
       WHERE contract_id = $1 ORDER BY reviewer_side`,
      [hired.contractId],
    );
    expect(rows).toEqual([
      {
        reviewer_side: 'company',
        reviewer_user_id: hired.ownerId,
        subject_user_id: hired.freelancerId,
        subject_company_id: null,
      },
      {
        reviewer_side: 'freelancer',
        reviewer_user_id: hired.freelancerId,
        subject_user_id: null,
        subject_company_id: hired.companyId,
      },
    ]);
  });

  it('quem avalia não escolhe o alvo nem revela a própria avaliação', async () => {
    const hired = await makeCompleted();
    for (const column of ['subject_user_id', 'reviewer_user_id', 'revealed_at', 'status']) {
      const value = {
        subject_user_id: `'${hired.freelancerId}'`,
        reviewer_user_id: `'${hired.ownerId}'`,
        revealed_at: 'now()',
        status: `'published'`,
      }[column];
      await expect(
        appRows(
          hired.freelancerId,
          `INSERT INTO reviews (contract_id, ${column}) VALUES ($1, ${value})`,
          [hired.contractId],
        ),
      ).rejects.toMatchObject(DENIED);
    }
  });

  it('só as partes avaliam, uma vez, e só contrato concluído', async () => {
    const hired = await makeCompleted();
    const stranger = await makeUser();
    await expect(review(stranger, hired.contractId)).rejects.toMatchObject(DENIED);
    await review(hired.freelancerId, hired.contractId);
    await expect(review(hired.freelancerId, hired.contractId)).rejects.toMatchObject({
      code: '23505',
    });

    const running = await makeHired();
    await expect(review(running.freelancerId, running.contractId)).rejects.toMatchObject(
      CHECK_FAILED,
    );
  });

  it('a janela de avaliação fecha em 7 dias', async () => {
    const hired = await makeCompleted();
    await system(`UPDATE contracts SET completed_at = now() - interval '8 days' WHERE id = $1`, [
      hired.contractId,
    ]);
    await expect(review(hired.freelancerId, hired.contractId)).rejects.toMatchObject(CHECK_FAILED);
  });

  it('as notas vão com a avaliação, e não dá para completar depois de ler a da outra parte', async () => {
    const hired = await makeCompleted();
    await review(hired.ownerId, hired.contractId);
    // A segunda avaliação revela as duas na hora. Na mesma transação, as notas ainda entram.
    const reviewId = await asApp(hired.freelancerId, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO reviews (contract_id) VALUES ($1) RETURNING id`,
        [hired.contractId],
      );
      const id = (rows[0] as { id: string }).id;
      await client.query(
        `INSERT INTO review_criteria_scores (review_id, criterion, score) VALUES ($1, 'respeito', 5)`,
        [id],
      );
      return id;
    });
    await expect(
      appRows(
        hired.freelancerId,
        `INSERT INTO review_criteria_scores (review_id, criterion, score) VALUES ($1, 'ambiente', 1)`,
        [reviewId],
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it('só a parte avaliada responde, depois da revelação', async () => {
    const hired = await makeCompleted();
    const [fromFreelancer] = await review(hired.freelancerId, hired.contractId);
    const reply = (actor: string) =>
      appRows(
        actor,
        `INSERT INTO review_replies (review_id, author_user_id, body) VALUES ($1, $2, 'Resposta')`,
        [fromFreelancer?.id, actor],
      );
    await expect(reply(hired.ownerId)).rejects.toMatchObject(DENIED);

    await review(hired.ownerId, hired.contractId);
    const stranger = await makeUser();
    await expect(reply(stranger)).rejects.toMatchObject(DENIED);
    await expect(reply(hired.ownerId)).resolves.toEqual([]);
  });
});

describe('consentimentos e auditoria', () => {
  it('ninguém registra consentimento por outra pessoa nem escolhe a data', async () => {
    const ana = await makeUser();
    const bia = await makeUser();
    await expect(
      appRows(
        ana,
        `INSERT INTO consents (user_id, purpose, granted) VALUES ($1, 'marketing', true)`,
        [bia],
      ),
    ).rejects.toMatchObject(DENIED);
    await expect(
      appRows(
        ana,
        `INSERT INTO consents (user_id, purpose, granted, occurred_at) VALUES ($1, 'marketing', true, now())`,
        [ana],
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it('o comprovante de consentimento não se altera nem pelo dono das tabelas', async () => {
    const ana = await makeUser();
    await appRows(
      ana,
      `INSERT INTO consents (user_id, purpose, granted) VALUES ($1, 'marketing', true)`,
      [ana],
    );
    await expect(appRows(ana, `UPDATE consents SET granted = false`)).rejects.toMatchObject(DENIED);
    await expect(appRows(ana, `DELETE FROM consents`)).rejects.toMatchObject(DENIED);
    await expect(
      system(`UPDATE consents SET granted = false WHERE user_id = $1`, [ana]),
    ).rejects.toMatchObject(DENIED);
    await expect(system(`DELETE FROM consents WHERE user_id = $1`, [ana])).rejects.toMatchObject(
      DENIED,
    );
  });

  it('o registro de auditoria não se altera, e só o vencido pode ser apagado', async () => {
    const ana = await makeUser();
    await appRows(ana, `INSERT INTO audit_logs (actor_user_id, action) VALUES ($1, 'teste')`, [
      ana,
    ]);
    await expect(
      appRows(ana, `UPDATE audit_logs SET action = 'x' WHERE actor_user_id = $1`, [ana]),
    ).rejects.toMatchObject(DENIED);
    await expect(
      appRows(ana, `DELETE FROM audit_logs WHERE actor_user_id = $1`, [ana]),
    ).rejects.toMatchObject(DENIED);
    await expect(
      system(`UPDATE audit_logs SET action = 'x' WHERE actor_user_id = $1`, [ana]),
    ).rejects.toMatchObject(DENIED);
    await expect(
      system(`DELETE FROM audit_logs WHERE actor_user_id = $1`, [ana]),
    ).rejects.toMatchObject(DENIED);
  });

  it('ninguém forja registro em nome de outra pessoa', async () => {
    const ana = await makeUser();
    const bia = await makeUser();
    await expect(
      appRows(ana, `INSERT INTO audit_logs (actor_user_id, action) VALUES ($1, 'teste')`, [bia]),
    ).rejects.toMatchObject(DENIED);
    await expect(
      appRows(
        ana,
        `INSERT INTO audit_logs (actor_user_id, action, occurred_at) VALUES ($1, 'teste', now())`,
        [ana],
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it('cada pessoa vê os acessos aos próprios dados, e os de ninguém mais', async () => {
    const hired = await makeHired();
    await appRows(hired.ownerId, `SELECT * FROM app.reveal_contract_contact($1)`, [
      hired.contractId,
    ]);
    const stranger = await makeUser();
    const query = `SELECT action FROM audit_logs WHERE target_user_id = $1`;
    expect(await appRows(hired.freelancerId, query, [hired.freelancerId])).toEqual([
      { action: 'contact.view' },
    ]);
    expect(await appRows(stranger, query, [hired.freelancerId])).toEqual([]);
  });
});

describe('notificações e preferências', () => {
  it('cada pessoa só vê as próprias', async () => {
    const ana = await makeUser();
    const bia = await makeUser();
    await system(`INSERT INTO notifications (user_id, type) VALUES ($1, 'teste')`, [ana]);
    await appRows(
      ana,
      `INSERT INTO notification_preferences (user_id, type, channel) VALUES ($1, 'teste', 'push')`,
      [ana],
    );
    expect(await appRows(ana, `SELECT type FROM notifications`)).toEqual([{ type: 'teste' }]);
    expect(await appRows(bia, `SELECT type FROM notifications`)).toEqual([]);
    expect(await appRows(bia, `SELECT type FROM notification_preferences`)).toEqual([]);
  });

  it('o app só marca como lida', async () => {
    const ana = await makeUser();
    await expect(appRows(ana, `UPDATE notifications SET payload = '{}'`)).rejects.toMatchObject(
      DENIED,
    );
    await expect(
      appRows(ana, `INSERT INTO notifications (user_id, type) VALUES ($1, 'teste')`, [ana]),
    ).rejects.toMatchObject(DENIED);
  });
});

describe('suporte', () => {
  it('nota interna nunca aparece para quem abriu o chamado', async () => {
    const ana = await makeUser();
    const agent = await makeUser('support');
    const [ticket] = await appRows<{ id: string }>(
      ana,
      `INSERT INTO support_tickets (requester_user_id, category) VALUES ($1, 'conta') RETURNING id`,
      [ana],
    );
    await as('support', agent, (client) =>
      client.query(
        `INSERT INTO ticket_messages (ticket_id, author_user_id, body_enc, internal_note) VALUES ($1, $2, 'v1.k1.a.b.c', true)`,
        [ticket?.id, agent],
      ),
    );
    expect(
      await appRows(ana, `SELECT id FROM ticket_messages WHERE ticket_id = $1`, [ticket?.id]),
    ).toEqual([]);
    await expect(
      appRows(
        ana,
        `INSERT INTO ticket_messages (ticket_id, author_user_id, body_enc, internal_note) VALUES ($1, $2, 'v1.k1.a.b.c', true)`,
        [ticket?.id, ana],
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it('ninguém lê o chamado de outra pessoa', async () => {
    const ana = await makeUser();
    const bia = await makeUser();
    await appRows(
      ana,
      `INSERT INTO support_tickets (requester_user_id, category) VALUES ($1, 'conta')`,
      [ana],
    );
    expect(
      await appRows(bia, `SELECT id FROM support_tickets WHERE requester_user_id = $1`, [ana]),
    ).toEqual([]);
  });

  it('quem abre não define prioridade nem responsável', async () => {
    const ana = await makeUser();
    await expect(
      appRows(
        ana,
        `INSERT INTO support_tickets (requester_user_id, category, priority) VALUES ($1, 'conta', 'urgent')`,
        [ana],
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it('entrar com o papel de suporte não basta: a pessoa precisa ser do suporte', async () => {
    const ana = await makeUser();
    const [ticket] = await appRows<{ id: string }>(
      ana,
      `INSERT INTO support_tickets (requester_user_id, category) VALUES ($1, 'conta') RETURNING id`,
      [ana],
    );
    const query = (client: {
      query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }>;
    }) => client.query(`SELECT id FROM support_tickets WHERE id = $1`, [ticket?.id]);

    const agent = await makeUser('support');
    expect((await as('support', agent, query)).rows).toHaveLength(1);
    expect((await as('support', ana, query)).rows).toEqual([]);
    expect((await as('support', null, query)).rows).toEqual([]);
  });

  it('só o admin lê a auditoria', async () => {
    const agent = await makeUser('support');
    const admin = await makeUser('admin');
    const ana = await makeUser();
    await appRows(ana, `INSERT INTO audit_logs (actor_user_id, action) VALUES ($1, 'teste')`, [
      ana,
    ]);
    const query = `SELECT action FROM audit_logs WHERE actor_user_id = '${ana}'`;
    expect((await as('support', agent, (client) => client.query(query))).rows).toEqual([]);
    expect((await as('support', admin, (client) => client.query(query))).rows).toHaveLength(1);
  });

  it('evidência de disputa só para quem enviou e o suporte', async () => {
    const hired = await makeHired();
    await checkIn(hired, 'in');
    const [dispute] = await appRows<{ id: string }>(
      hired.ownerId,
      `INSERT INTO disputes (contract_id, reason) VALUES ($1, 'conduta') RETURNING id`,
      [hired.contractId],
    );
    const [evidence] = await appRows<{ id: string }>(
      hired.ownerId,
      `INSERT INTO dispute_evidences (dispute_id, submitted_by, note_enc) VALUES ($1, $2, 'v1.k1.a.b.c') RETURNING id`,
      [dispute?.id, hired.ownerId],
    );
    const query = `SELECT id FROM dispute_evidences WHERE id = $1`;
    expect(await appRows(hired.ownerId, query, [evidence?.id])).toHaveLength(1);
    expect(await appRows(hired.freelancerId, query, [evidence?.id])).toEqual([]);
    const agent = await makeUser('support');
    const seen = await as('support', agent, (client) => client.query(query, [evidence?.id]));
    expect(seen.rows).toHaveLength(1);
  });
});

describe('análise', () => {
  it('lê as visões e nada mais', async () => {
    await makeCompleted();
    const facts = await as('analytics', null, (client) =>
      client.query(`SELECT * FROM analytics.contract_facts LIMIT 1`),
    );
    expect(facts.rows).toHaveLength(1);
    expect(Object.keys(facts.rows[0] as object)).not.toContain('freelancer_id');
    await expect(
      as('analytics', null, (client) => client.query(`SELECT * FROM public.users`)),
    ).rejects.toMatchObject(DENIED);
    await expect(
      as('analytics', null, (client) => client.query(`SELECT * FROM public.contracts`)),
    ).rejects.toMatchObject(DENIED);
  });
});
