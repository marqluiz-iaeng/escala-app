import { afterAll, describe, expect, it } from 'vitest';
import {
  appRows,
  as,
  CHECK_FAILED,
  checkIn,
  closePools,
  contractStatus,
  DENIED,
  makeCompany,
  makeCompleted,
  makeConversation,
  makeFile,
  makeFreelancer,
  makeHired,
  makeProposal,
  makeUser,
  pool,
  SITE,
  skillId,
  system,
} from './helpers.js';

afterAll(closePools);

const reveal = (actor: string, contract: string) =>
  appRows(actor, `SELECT * FROM app.reveal_contract_contact($1)`, [contract]);

describe('liberação de contato', () => {
  it('cada parte recebe só o contato da outra', async () => {
    const hired = await makeHired();
    const [freelancerData] = await system(
      `SELECT legal_name_enc, phone_enc FROM users WHERE id = $1`,
      [hired.freelancerId],
    );
    const [ownerData] = await system(`SELECT legal_name_enc, phone_enc FROM users WHERE id = $1`, [
      hired.ownerId,
    ]);
    expect(await reveal(hired.ownerId, hired.contractId)).toEqual([freelancerData]);
    expect(await reveal(hired.freelancerId, hired.contractId)).toEqual([ownerData]);
  });

  it('antes do aceite, não libera', async () => {
    const hired = await makeProposal();
    await expect(reveal(hired.ownerId, hired.contractId)).rejects.toMatchObject(DENIED);
    await expect(reveal(hired.freelancerId, hired.contractId)).rejects.toMatchObject(DENIED);
  });

  it('terceiros não sabem nem que o contrato existe', async () => {
    const hired = await makeHired();
    const stranger = await makeUser();
    await expect(reveal(stranger, hired.contractId)).rejects.toMatchObject({ code: 'P0002' });
  });

  it('fecha 30 dias depois do último turno', async () => {
    const hired = await makeHired();
    await system(
      `UPDATE contracts SET contact_visible_until = now() - interval '1 second' WHERE id = $1`,
      [hired.contractId],
    );
    await expect(reveal(hired.ownerId, hired.contractId)).rejects.toMatchObject(DENIED);
  });

  it.each(['cancelled', 'declined'])('fecha em contrato %s', async (status) => {
    const hired = status === 'declined' ? await makeProposal() : await makeHired();
    await appRows(
      hired.freelancerId,
      `UPDATE contracts SET status = $2::contract_status WHERE id = $1`,
      [hired.contractId, status],
    );
    await expect(reveal(hired.ownerId, hired.contractId)).rejects.toMatchObject(DENIED);
  });

  it('todo acesso fica registrado, no máximo uma vez por hora', async () => {
    const hired = await makeHired();
    await reveal(hired.ownerId, hired.contractId);
    await reveal(hired.ownerId, hired.contractId);
    const rows = await system(
      `SELECT actor_user_id, target_user_id, action, entity_id FROM audit_logs
       WHERE action = 'contact.view' AND entity_id = $1`,
      [hired.contractId],
    );
    expect(rows).toEqual([
      {
        actor_user_id: hired.ownerId,
        target_user_id: hired.freelancerId,
        action: 'contact.view',
        entity_id: hired.contractId,
      },
    ]);
  });
});

describe('pagamento declarado', () => {
  it('cada parte declara só o que é dela', async () => {
    const hired = await makeHired();
    await checkIn(hired, 'in');
    await expect(
      appRows(hired.freelancerId, `SELECT app.mark_contract_paid($1)`, [hired.contractId]),
    ).rejects.toMatchObject(DENIED);
    await expect(
      appRows(hired.ownerId, `SELECT app.confirm_contract_paid($1)`, [hired.contractId]),
    ).rejects.toMatchObject(DENIED);

    await appRows(hired.ownerId, `SELECT app.mark_contract_paid($1)`, [hired.contractId]);
    await appRows(hired.freelancerId, `SELECT app.confirm_contract_paid($1)`, [hired.contractId]);
    const [row] = await system<Record<string, Date | null>>(
      `SELECT company_marked_paid_at, freelancer_confirmed_paid_at FROM contracts WHERE id = $1`,
      [hired.contractId],
    );
    expect(row?.company_marked_paid_at).toBeInstanceOf(Date);
    expect(row?.freelancer_confirmed_paid_at).toBeInstanceOf(Date);
  });

  it('antes do turno começar, não há o que declarar', async () => {
    const hired = await makeHired();
    await expect(
      appRows(hired.ownerId, `SELECT app.mark_contract_paid($1)`, [hired.contractId]),
    ).rejects.toMatchObject(DENIED);
  });

  it('terceiros não declaram', async () => {
    const hired = await makeHired();
    await checkIn(hired, 'in');
    const stranger = await makeUser();
    await expect(
      appRows(stranger, `SELECT app.mark_contract_paid($1)`, [hired.contractId]),
    ).rejects.toMatchObject(DENIED);
  });
});

describe('conversa', () => {
  it('é criada uma vez só, com as partes', async () => {
    const hired = await makeHired();
    const first = await makeConversation(hired);
    const second = await makeConversation(hired);
    expect(second).toBe(first);
    const rows = await system<{ user_id: string }>(
      `SELECT user_id FROM conversation_participants WHERE conversation_id = $1`,
      [first],
    );
    expect(rows.map((row) => row.user_id).sort()).toEqual(
      [hired.freelancerId, hired.ownerId].sort(),
    );
  });
});

describe('leituras do suporte', () => {
  async function agentAndMessage() {
    const agent = await makeUser('support');
    const hired = await makeHired();
    const conversation = await makeConversation(hired);
    const [message] = await appRows<{ id: string }>(
      hired.freelancerId,
      `INSERT INTO messages (conversation_id, sender_user_id, kind, body_enc) VALUES ($1, $2, 'text', 'v1.k1.a.b.c') RETURNING id`,
      [conversation, hired.freelancerId],
    );
    return { agent, hired, conversation, messageId: message?.id };
  }

  it('dados da conta só com motivo, e o acesso fica registrado', async () => {
    const agent = await makeUser('support');
    const ana = await makeUser();
    const read = (reason: string | null) =>
      as('support', agent, (client) =>
        client.query(`SELECT * FROM app.support_read_user($1, $2)`, [ana, reason]),
      );

    await expect(read(null)).rejects.toMatchObject(CHECK_FAILED);
    await expect(read('  ')).rejects.toMatchObject(CHECK_FAILED);
    const { rows } = await read('Chamado sobre acesso à conta');
    expect(rows[0]).toMatchObject({ id: ana });

    const logs = await system(
      `SELECT actor_user_id, action FROM audit_logs WHERE target_user_id = $1 AND action = 'support.user.read'`,
      [ana],
    );
    expect(logs).toEqual([{ actor_user_id: agent, action: 'support.user.read' }]);
  });

  it('o suporte não lê conversas sem disputa nem denúncia', async () => {
    const { agent, conversation } = await agentAndMessage();
    await expect(
      as('support', agent, (client) =>
        client.query(`SELECT * FROM app.support_read_messages($1, 'Curiosidade')`, [conversation]),
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it('com denúncia aberta, lê e registra', async () => {
    const { agent, hired, conversation, messageId } = await agentAndMessage();
    await appRows(
      hired.ownerId,
      `INSERT INTO message_reports (message_id, reporter_user_id, reason) VALUES ($1, $2, 'ofensa')`,
      [messageId, hired.ownerId],
    );
    const { rows } = await as('support', agent, (client) =>
      client.query(`SELECT * FROM app.support_read_messages($1, 'Análise de denúncia')`, [
        conversation,
      ]),
    );
    expect(rows).toHaveLength(1);
    const logs = await system(`SELECT action FROM audit_logs WHERE entity_id = $1`, [conversation]);
    expect(logs).toEqual([{ action: 'support.messages.read' }]);
  });

  it('com disputa aberta, lê as conversas e o check-in', async () => {
    const { agent, hired, conversation } = await agentAndMessage();
    await checkIn(hired, 'in');
    await expect(
      as('support', agent, (client) =>
        client.query(`SELECT * FROM app.support_read_check_ins($1, 'Sem disputa aberta')`, [
          hired.shiftId,
        ]),
      ),
    ).rejects.toMatchObject(DENIED);

    await appRows(
      hired.ownerId,
      `INSERT INTO disputes (contract_id, reason) VALUES ($1, 'check_in')`,
      [hired.contractId],
    );
    const messages = await as('support', agent, (client) =>
      client.query(`SELECT * FROM app.support_read_messages($1, 'Análise da disputa')`, [
        conversation,
      ]),
    );
    expect(messages.rows).toHaveLength(1);
    const checkIns = await as('support', agent, (client) =>
      client.query(`SELECT * FROM app.support_read_check_ins($1, 'Análise da disputa')`, [
        hired.shiftId,
      ]),
    );
    expect(checkIns.rows[0]).toMatchObject({ kind: 'in', within_geofence: true });
    expect(Object.keys(checkIns.rows[0] as object)).not.toContain('location');
  });

  it('candidaturas só por função, com registro e sem a mensagem de quem se candidatou', async () => {
    const agent = await makeUser('support');
    const hired = await makeHired();
    const { rows } = await as('support', agent, (client) =>
      client.query(`SELECT * FROM app.support_read_applications($1, 'Análise de chamado')`, [
        hired.jobId,
      ]),
    );
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0] as object)).not.toContain('note_enc');
    const logs = await system(`SELECT action FROM audit_logs WHERE entity_id = $1`, [hired.jobId]);
    expect(logs).toEqual([{ action: 'support.applications.read' }]);
    await expect(
      as('support', agent, (client) => client.query(`SELECT * FROM applications`)),
    ).rejects.toMatchObject(DENIED);
  });

  it('endereço só por função, com registro', async () => {
    const agent = await makeUser('support');
    const hired = await makeHired();
    const { rows } = await as('support', agent, (client) =>
      client.query(`SELECT * FROM app.support_read_job_private($1, 'Verificação de denúncia')`, [
        hired.jobId,
      ]),
    );
    expect(rows).toHaveLength(1);
    const logs = await system(`SELECT action FROM audit_logs WHERE entity_id = $1`, [hired.jobId]);
    expect(logs).toEqual([{ action: 'support.job_private.read' }]);
  });

  it('quem não é do suporte não usa essas funções, mesmo com o papel de banco', async () => {
    const ana = await makeUser();
    const bia = await makeUser();
    await expect(
      as('support', ana, (client) =>
        client.query(`SELECT * FROM app.support_read_user($1, 'Motivo qualquer')`, [bia]),
      ),
    ).rejects.toMatchObject(DENIED);
    await expect(
      as('support', null, (client) =>
        client.query(`SELECT * FROM app.support_read_user($1, 'Motivo qualquer')`, [bia]),
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it('o app nem consegue chamar essas funções', async () => {
    const agent = await makeUser('support');
    const ana = await makeUser();
    await expect(
      appRows(agent, `SELECT * FROM app.support_read_user($1, 'Motivo qualquer')`, [ana]),
    ).rejects.toMatchObject(DENIED);
  });
});

describe('exclusão de conta', () => {
  const PERSONAL = `
    SELECT email_index, email_enc, phone_enc, legal_name_enc, cpf_index, cpf_enc, birth_date_enc,
           status, platform_role
    FROM users WHERE id = $1`;

  it('apaga os dados pessoais e encerra o que está aberto', async () => {
    const hired = await makeHired();
    const conversation = await makeConversation(hired);
    const ana = hired.freelancerId;
    const file = await makeFile(ana);
    await appRows(
      ana,
      `UPDATE freelancer_profiles SET photo_file_id = $1, bio = 'Minha bio', base_location = ST_GeogFromText($3) WHERE user_id = $2`,
      [file, ana, SITE],
    );
    await appRows(
      ana,
      `INSERT INTO messages (conversation_id, sender_user_id, kind, body_enc) VALUES ($1, $2, 'text', 'v1.k1.a.b.c')`,
      [conversation, ana],
    );
    await appRows(
      ana,
      `INSERT INTO consents (user_id, purpose, granted) VALUES ($1, 'marketing', true)`,
      [ana],
    );
    await appRows(
      ana,
      `INSERT INTO devices (user_id, platform, label) VALUES ($1, 'ios', 'iPhone')`,
      [ana],
    );
    await system(
      `INSERT INTO sessions (user_id, expires_at) VALUES ($1, now() + interval '1 day')`,
      [ana],
    );

    await appRows(ana, `SELECT app.erase_my_account()`);

    const [user] = await system(PERSONAL, [ana]);
    expect(user).toEqual({
      email_index: null,
      email_enc: null,
      phone_enc: null,
      legal_name_enc: null,
      cpf_index: null,
      cpf_enc: null,
      birth_date_enc: null,
      status: 'deleted',
      platform_role: 'none',
    });
    const [profile] = await system(
      `SELECT display_name, bio, photo_file_id, base_location, discoverable, status FROM freelancer_profiles WHERE user_id = $1`,
      [ana],
    );
    expect(profile).toEqual({
      display_name: 'Conta removida',
      bio: '',
      photo_file_id: null,
      base_location: null,
      discoverable: false,
      status: 'deleted',
    });
    expect(
      await system(`SELECT body_enc, status FROM messages WHERE sender_user_id = $1`, [ana]),
    ).toEqual([{ body_enc: null, status: 'removed' }]);
    expect(await system(`SELECT 1 FROM sessions WHERE user_id = $1`, [ana])).toEqual([]);
    expect(await system(`SELECT 1 FROM devices WHERE user_id = $1`, [ana])).toEqual([]);
    expect(await contractStatus(hired.contractId)).toBe('cancelled');
    const [shift] = await system(`SELECT status FROM shifts WHERE id = $1`, [hired.shiftId]);
    expect(shift).toEqual({ status: 'cancelled' });
    const [storage] = await system<{ deleted_at: Date }>(
      `SELECT deleted_at FROM files WHERE id = $1`,
      [file],
    );
    expect(storage?.deleted_at).toBeInstanceOf(Date);
  });

  it('mantém o comprovante de consentimento e a auditoria, sem nome nem contato', async () => {
    const ana = await makeUser();
    await appRows(
      ana,
      `INSERT INTO consents (user_id, purpose, granted) VALUES ($1, 'marketing', true)`,
      [ana],
    );
    await appRows(ana, `SELECT app.erase_my_account()`);
    expect(await system(`SELECT purpose FROM consents WHERE user_id = $1`, [ana])).toEqual([
      { purpose: 'marketing' },
    ]);
    expect(await system(`SELECT action FROM audit_logs WHERE target_user_id = $1`, [ana])).toEqual([
      { action: 'account.erased' },
    ]);
  });

  it('o e-mail pode ser usado de novo', async () => {
    const ana = await makeUser();
    const [before] = await system<{ email_index: string }>(
      `SELECT email_index FROM users WHERE id = $1`,
      [ana],
    );
    await appRows(ana, `SELECT app.erase_my_account()`);
    await expect(
      system(`INSERT INTO users (email_index, email_enc) VALUES ($1, 'v1.k1.a.b.c')`, [
        before?.email_index,
      ]),
    ).resolves.toEqual([]);
  });

  it('o dono único fecha a empresa, e quem dependia dela é avisado pelo status', async () => {
    const hired = await makeProposal();
    await appRows(hired.ownerId, `SELECT app.erase_my_account()`);
    const [company] = await system(
      `SELECT status, trade_name, about FROM companies WHERE id = $1`,
      [hired.companyId],
    );
    expect(company).toEqual({ status: 'deleted', trade_name: 'Conta removida', about: '' });
    const [job] = await system(`SELECT status FROM jobs WHERE id = $1`, [hired.jobId]);
    expect(job).toEqual({ status: 'cancelled' });
    const [details] = await system(
      `SELECT address_enc, access_notes_enc, site_location FROM job_private_details WHERE job_id = $1`,
      [hired.jobId],
    );
    expect(details).toEqual({ address_enc: null, access_notes_enc: null, site_location: null });
    expect(await contractStatus(hired.contractId)).toBe('cancelled');
    const [contract] = await system(`SELECT cancelled_by FROM contracts WHERE id = $1`, [
      hired.contractId,
    ]);
    expect(contract).toEqual({ cancelled_by: 'platform' });
  });

  it('com outros membros, a pessoa precisa transferir a empresa antes', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const other = await makeUser();
    await appRows(
      owner,
      `INSERT INTO company_members (company_id, user_id, role) VALUES ($1, $2, 'recruiter')`,
      [company, other],
    );
    await expect(appRows(owner, `SELECT app.erase_my_account()`)).rejects.toMatchObject(
      CHECK_FAILED,
    );
    const [row] = await system(`SELECT status FROM users WHERE id = $1`, [owner]);
    expect(row).toEqual({ status: 'active' });
  });

  it('sem sessão, nada acontece', async () => {
    await expect(appRows(null, `SELECT app.erase_my_account()`)).rejects.toMatchObject(DENIED);
  });

  it('não dá para excluir a conta de outra pessoa', async () => {
    const ana = await makeUser();
    const bia = await makeUser();
    await expect(appRows(ana, `SELECT app.erase_user($1)`, [bia])).rejects.toMatchObject(DENIED);
  });
});

describe('retenção', () => {
  const purge = async () => {
    const { rows } = await pool('worker').query<{ purge_expired_data: Record<string, number> }>(
      `SELECT app.purge_expired_data()`,
    );
    return rows[0]?.purge_expired_data;
  };

  it('só o worker roda a limpeza', async () => {
    const ana = await makeUser();
    await expect(appRows(ana, `SELECT app.purge_expired_data()`)).rejects.toMatchObject(DENIED);
  });

  it('apaga códigos, chaves e sessões vencidos, e mantém os válidos', async () => {
    const ana = await makeUser();
    await system(
      `INSERT INTO otp_codes (purpose, subject, code_hash, expires_at) VALUES
         ('login', 'vencido', 'h', now() - interval '1 minute'), ('login', 'valido', 'h', now() + interval '1 minute')`,
    );
    await system(
      `INSERT INTO sessions (user_id, expires_at) VALUES ($1, now() - interval '1 day'), ($1, now() + interval '1 day')`,
      [ana],
    );
    await purge();
    expect(
      await system(`SELECT subject FROM otp_codes WHERE subject IN ('vencido', 'valido')`),
    ).toEqual([{ subject: 'valido' }]);
    expect(await system(`SELECT 1 FROM sessions WHERE user_id = $1`, [ana])).toHaveLength(1);
  });

  async function oldShift() {
    const hired = await makeHired();
    await checkIn(hired, 'in');
    await checkIn(hired, 'out');
    await system(
      `UPDATE shifts SET starts_at = now() - interval '91 days', ends_at = now() - interval '90 days 1 hour' WHERE id = $1`,
      [hired.shiftId],
    );
    return hired;
  }

  it('o local do check-in some depois de 90 dias, e fica só o resultado', async () => {
    const hired = await oldShift();
    await purge();
    const rows = await system(
      `SELECT location, within_geofence FROM check_ins WHERE shift_id = $1`,
      [hired.shiftId],
    );
    expect(rows).toEqual([
      { location: null, within_geofence: true },
      { location: null, within_geofence: true },
    ]);
  });

  it('com disputa aberta, o local continua', async () => {
    const hired = await oldShift();
    await appRows(
      hired.ownerId,
      `INSERT INTO disputes (contract_id, reason) VALUES ($1, 'check_in')`,
      [hired.contractId],
    );
    await purge();
    const rows = await system<{ location: string | null }>(
      `SELECT location FROM check_ins WHERE shift_id = $1`,
      [hired.shiftId],
    );
    expect(rows.every((row) => row.location !== null)).toBe(true);
  });

  it('mensagens somem 12 meses depois do último turno, salvo disputa aberta', async () => {
    const write = async () => {
      const hired = await oldShift();
      const conversation = await makeConversation(hired);
      await appRows(
        hired.freelancerId,
        `INSERT INTO messages (conversation_id, sender_user_id, kind, body_enc) VALUES ($1, $2, 'text', 'v1.k1.a.b.c')`,
        [conversation, hired.freelancerId],
      );
      await system(
        `UPDATE contracts SET contact_visible_until = now() - interval '13 months' WHERE id = $1`,
        [hired.contractId],
      );
      return { hired, conversation };
    };
    const expired = await write();
    const disputed = await write();
    await appRows(
      disputed.hired.ownerId,
      `INSERT INTO disputes (contract_id, reason) VALUES ($1, 'conduta')`,
      [disputed.hired.contractId],
    );
    await purge();
    const body = (conversation: string) =>
      system(`SELECT body_enc, status FROM messages WHERE conversation_id = $1`, [conversation]);
    expect(await body(expired.conversation)).toEqual([{ body_enc: null, status: 'removed' }]);
    expect(await body(disputed.conversation)).toEqual([
      { body_enc: 'v1.k1.a.b.c', status: 'visible' },
    ]);
  });

  it('registros de acesso só somem depois de 6 meses', async () => {
    const ana = await makeUser();
    await system(
      `INSERT INTO audit_logs (actor_user_id, action, occurred_at) VALUES
         ($1, 'antigo', now() - interval '7 months'), ($1, 'recente', now() - interval '5 months')`,
      [ana],
    );
    await purge();
    const rows = await system(`SELECT action FROM audit_logs WHERE actor_user_id = $1`, [ana]);
    expect(rows).toEqual([{ action: 'recente' }]);
  });

  it('comprovantes de consentimento não são tocados', async () => {
    const ana = await makeUser();
    await appRows(
      ana,
      `INSERT INTO consents (user_id, purpose, granted) VALUES ($1, 'teste', true)`,
      [ana],
    );
    await purge();
    expect(await system(`SELECT 1 FROM consents WHERE user_id = $1`, [ana])).toHaveLength(1);
  });

  it('avaliação sem resposta é revelada quando a janela fecha', async () => {
    const hired = await makeCompleted();
    const [review] = await appRows<{ id: string }>(
      hired.freelancerId,
      `INSERT INTO reviews (contract_id) VALUES ($1) RETURNING id`,
      [hired.contractId],
    );
    await pool('worker').query(`SELECT app.reveal_due_reviews()`);
    let [row] = await system(`SELECT status FROM reviews WHERE id = $1`, [review?.id]);
    expect(row).toEqual({ status: 'submitted' });

    await system(`UPDATE contracts SET completed_at = now() - interval '8 days' WHERE id = $1`, [
      hired.contractId,
    ]);
    await pool('worker').query(`SELECT app.reveal_due_reviews()`);
    [row] = await system(`SELECT status FROM reviews WHERE id = $1`, [review?.id]);
    expect(row).toEqual({ status: 'published' });
  });
});

describe('geolocalização', () => {
  it('calcula a geocerca no banco', async () => {
    const inside = await makeHired();
    await checkIn(inside, 'in');
    const outside = await makeHired();
    await checkIn(outside, 'in', 'POINT(-46.70 -23.60)');
    const result = async (shift: string) =>
      system(`SELECT within_geofence FROM check_ins WHERE shift_id = $1`, [shift]);
    expect(await result(inside.shiftId)).toEqual([{ within_geofence: true }]);
    expect(await result(outside.shiftId)).toEqual([{ within_geofence: false }]);
  });

  it('sem localização, não conta como dentro', async () => {
    const hired = await makeHired();
    await appRows(hired.freelancerId, `INSERT INTO check_ins (shift_id, kind) VALUES ($1, 'in')`, [
      hired.shiftId,
    ]);
    expect(
      await system(`SELECT within_geofence FROM check_ins WHERE shift_id = $1`, [hired.shiftId]),
    ).toEqual([{ within_geofence: false }]);
  });

  it('com volume real, a busca por proximidade usa o índice GiST', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const skill = await skillId();
    const client = await pool('migrator').connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO jobs (company_id, title, description, primary_skill_id, city, neighbourhood,
           public_location, starts_at, ends_at, pay_amount_cents, pay_unit, status)
         SELECT $1, 'Vaga de teste', 'Descrição de teste da vaga.', $2, 'Cidade', 'Bairro',
           ST_SetSRID(ST_MakePoint(-60 + random() * 25, -30 + random() * 25), 4326)::geography,
           now() + interval '1 day', now() + interval '2 days', 10000, 'diaria', 'published'
         FROM generate_series(1, 5000)`,
        [company, skill],
      );
      await client.query('ANALYZE jobs');
      const { rows } = await client.query<{ 'QUERY PLAN': string }>(`
        EXPLAIN SELECT id FROM jobs
        WHERE status = 'published'
          AND ST_DWithin(public_location, ST_GeogFromText('POINT(-46.65 -23.56)'), 5000)`);
      expect(rows.map((row) => row['QUERY PLAN']).join('\n')).toContain('jobs_location_idx');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('o endereço e o ponto exato nunca ficam na tabela pública de vagas', async () => {
    const [columns] = await system<{ total: number }>(
      `SELECT count(*)::int AS total FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'jobs'
         AND column_name IN ('address', 'address_enc', 'site_location')`,
    );
    expect(columns).toEqual({ total: 0 });
  });

  it('a busca de talentos também usa o índice, só com quem aceitou aparecer', async () => {
    const client = await pool('migrator').connect();
    await makeFreelancer({ discoverable: true });
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL enable_seqscan = off');
      const { rows } = await client.query<{ 'QUERY PLAN': string }>(`
        EXPLAIN SELECT user_id FROM freelancer_profiles
        WHERE discoverable AND status = 'active'
          AND ST_DWithin(base_location, ST_GeogFromText('POINT(-46.65 -23.56)'), 5000)`);
      expect(rows.map((row) => row['QUERY PLAN']).join('\n')).toContain(
        'freelancer_profiles_location_idx',
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
