import { STATE_MACHINES } from '@escala/shared';
import { afterAll, describe, expect, it } from 'vitest';
import {
  appRows,
  as,
  CHECK_FAILED,
  checkIn,
  closePools,
  contractStatus,
  DENIED,
  makeApplication,
  makeCompany,
  makeCompleted,
  makeFreelancer,
  makeHired,
  makeJob,
  makeProposal,
  makeUser,
  pool,
  setApplicationStatus,
  system,
} from './helpers.js';

afterAll(closePools);

describe('tabela de transições', () => {
  it('o banco e o código compartilhado têm exatamente as mesmas regras', async () => {
    const rows = await system<{
      entity: string;
      from_status: string | null;
      to_status: string;
      actors: string[];
    }>(`SELECT entity, from_status, to_status, actors FROM app.status_transitions`);
    const normalize = (
      entity: string,
      from: string | null,
      to: string,
      actors: readonly string[],
    ) => `${entity}|${from ?? ''}|${to}|${[...actors].sort().join(',')}`;

    const database = rows
      .map((row) => normalize(row.entity, row.from_status, row.to_status, row.actors))
      .sort();
    const shared = Object.entries(STATE_MACHINES)
      .flatMap(([entity, transitions]) =>
        transitions.map((transition) =>
          normalize(entity, transition.from, transition.to, transition.actors),
        ),
      )
      .sort();
    expect(database).toEqual(shared);
  });

  it('todo status do banco aparece nas regras, para nenhum virar beco sem saída por engano', async () => {
    const enums: Record<string, string> = {
      job: 'job_status',
      application: 'application_status',
      contract: 'contract_status',
      shift: 'shift_status',
      dispute: 'dispute_status',
      ticket: 'ticket_status',
    };
    for (const [entity, enumName] of Object.entries(enums)) {
      const rows = await system<{ label: string }>(
        `SELECT e.enumlabel AS label FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = $1`,
        [enumName],
      );
      const known = new Set(
        STATE_MACHINES[entity as keyof typeof STATE_MACHINES].flatMap((transition) => [
          transition.from,
          transition.to,
        ]),
      );
      for (const { label } of rows) expect(known.has(label), `${entity}.${label}`).toBe(true);
    }
  });
});

describe('quem faz cada transição', () => {
  it('freelancer não se seleciona', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const job = await makeJob(owner, company);
    const ana = await makeFreelancer();
    const application = await makeApplication(job, ana);
    await expect(setApplicationStatus(ana, application, 'selected')).rejects.toMatchObject(DENIED);
    await expect(setApplicationStatus(ana, application, 'shortlisted')).rejects.toMatchObject(
      DENIED,
    );
  });

  it('empresa não retira a candidatura de outra pessoa', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const job = await makeJob(owner, company);
    const ana = await makeFreelancer();
    const application = await makeApplication(job, ana);
    await expect(setApplicationStatus(owner, application, 'withdrawn')).rejects.toMatchObject(
      DENIED,
    );
  });

  it('empresa não aceita o contrato no lugar do freelancer', async () => {
    const hired = await makeProposal();
    await expect(
      appRows(hired.ownerId, `UPDATE contracts SET status = 'accepted' WHERE id = $1`, [
        hired.contractId,
      ]),
    ).rejects.toMatchObject(DENIED);
    expect(await contractStatus(hired.contractId)).toBe('proposed');
  });

  it('recusar não exige motivo nem deixa rastro de penalidade', async () => {
    const hired = await makeProposal();
    await appRows(hired.freelancerId, `UPDATE contracts SET status = 'declined' WHERE id = $1`, [
      hired.contractId,
    ]);
    expect(await contractStatus(hired.contractId)).toBe('declined');
    const [row] = await system(
      `SELECT count(*)::int AS total FROM penalties WHERE contract_id = $1`,
      [hired.contractId],
    );
    expect(row).toEqual({ total: 0 });
  });

  it.each(['in_progress', 'awaiting_confirmation', 'completed'])(
    'ninguém move o contrato direto para %s',
    async (status) => {
      const hired = await makeHired();
      for (const actor of [hired.freelancerId, hired.ownerId]) {
        await expect(
          appRows(actor, `UPDATE contracts SET status = $2::contract_status WHERE id = $1`, [
            hired.contractId,
            status,
          ]),
        ).rejects.toMatchObject(status === 'in_progress' ? DENIED : CHECK_FAILED);
      }
      expect(await contractStatus(hired.contractId)).toBe('accepted');
    },
  );

  it('não existe voltar de concluído', async () => {
    const hired = await makeCompleted();
    await expect(
      appRows(hired.ownerId, `UPDATE contracts SET status = 'cancelled' WHERE id = $1`, [
        hired.contractId,
      ]),
    ).rejects.toMatchObject(CHECK_FAILED);
  });

  it('o contrato não nasce adiantado', async () => {
    const hired = await makeProposal();
    const before = await system(`SELECT * FROM contracts WHERE id = $1`, [hired.contractId]);
    expect(before[0]).toMatchObject({ status: 'proposed', accepted_at: null });
    await expect(
      appRows(
        hired.ownerId,
        `INSERT INTO contracts (application_id, status) VALUES ($1, 'accepted')`,
        [hired.applicationId],
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it('o suporte não decide por conta própria o que é do sistema', async () => {
    const hired = await makeHired();
    const agent = await makeUser('support');
    await expect(
      as('support', agent, (client) =>
        client.query(`UPDATE contracts SET status = 'completed' WHERE id = $1`, [hired.contractId]),
      ),
    ).rejects.toMatchObject(CHECK_FAILED);
  });

  it('só o suporte decide uma disputa', async () => {
    const hired = await makeHired();
    await checkIn(hired, 'in');
    const [dispute] = await appRows<{ id: string }>(
      hired.ownerId,
      `INSERT INTO disputes (contract_id, reason) VALUES ($1, 'conduta') RETURNING id`,
      [hired.contractId],
    );
    const agent = await makeUser('support');
    const move = (status: string) =>
      as('support', agent, (client) =>
        client.query(
          `UPDATE disputes SET status = $2::dispute_status, decision = 'partial' WHERE id = $1`,
          [dispute?.id, status],
        ),
      );
    await move('collecting_evidence');
    await move('under_review');
    await expect(
      appRows(hired.ownerId, `UPDATE disputes SET status = 'decided' WHERE id = $1`, [dispute?.id]),
    ).rejects.toMatchObject(DENIED);
    await move('decided');
    const [row] = await system(`SELECT status FROM disputes WHERE id = $1`, [dispute?.id]);
    expect(row).toEqual({ status: 'decided' });
  });
});

describe('histórico', () => {
  it('toda transição é registrada, com quem fez', async () => {
    const hired = await makeCompleted();
    const rows = await system<{
      from_status: string | null;
      to_status: string;
      actor_user_id: string | null;
    }>(
      `SELECT from_status, to_status, actor_user_id FROM contract_status_history
       WHERE contract_id = $1 ORDER BY id`,
      [hired.contractId],
    );
    expect(rows.map((row) => [row.from_status, row.to_status])).toEqual([
      [null, 'proposed'],
      ['proposed', 'accepted'],
      ['accepted', 'in_progress'],
      ['in_progress', 'awaiting_confirmation'],
      ['awaiting_confirmation', 'completed'],
    ]);
    expect(rows[0]?.actor_user_id).toBe(hired.ownerId);
    expect(rows[1]?.actor_user_id).toBe(hired.freelancerId);
  });

  it('não se altera nem pelo dono das tabelas', async () => {
    const hired = await makeHired();
    await expect(
      system(`UPDATE contract_status_history SET reason = 'x' WHERE contract_id = $1`, [
        hired.contractId,
      ]),
    ).rejects.toMatchObject(DENIED);
    await expect(
      system(`DELETE FROM contract_status_history WHERE contract_id = $1`, [hired.contractId]),
    ).rejects.toMatchObject(DENIED);
  });

  it('não dá para forjar uma linha', async () => {
    const hired = await makeHired();
    await expect(
      appRows(
        hired.ownerId,
        `INSERT INTO contract_status_history (contract_id, to_status) VALUES ($1, 'completed')`,
        [hired.contractId],
      ),
    ).rejects.toMatchObject(DENIED);
    await expect(
      appRows(
        hired.ownerId,
        `SELECT app.record_transition('contract', 'contract_status_history', 'contract_id', 'contract_status', $1, 'accepted', 'completed', 'system')`,
        [hired.contractId],
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it('o motivo informado na transação fica registrado', async () => {
    const hired = await makeHired();
    const agent = await makeUser('support');
    await as('support', agent, async (client) => {
      await client.query(`SELECT set_config('app.transition_reason', 'Evento cancelado', true)`);
      await client.query(`UPDATE contracts SET status = 'cancelled' WHERE id = $1`, [
        hired.contractId,
      ]);
    });
    const [row] = await system(
      `SELECT reason, actor_user_id FROM contract_status_history WHERE contract_id = $1 AND to_status = 'cancelled'`,
      [hired.contractId],
    );
    expect(row).toEqual({ reason: 'Evento cancelado', actor_user_id: agent });
    const [contract] = await system(`SELECT cancelled_by FROM contracts WHERE id = $1`, [
      hired.contractId,
    ]);
    expect(contract).toEqual({ cancelled_by: 'platform' });
  });
});

describe('fluxo do turno', () => {
  it('a chegada e a saída movem o turno e o contrato', async () => {
    const hired = await makeHired();
    const status = async () => {
      const [row] = await system<{ contract: string; shift: string }>(
        `SELECT c.status AS contract, s.status AS shift FROM contracts c
         JOIN shifts s ON s.contract_id = c.id WHERE c.id = $1`,
        [hired.contractId],
      );
      return row;
    };
    expect(await status()).toEqual({ contract: 'accepted', shift: 'scheduled' });
    await checkIn(hired, 'in');
    expect(await status()).toEqual({ contract: 'in_progress', shift: 'in_progress' });
    await checkIn(hired, 'out');
    expect(await status()).toEqual({ contract: 'awaiting_confirmation', shift: 'done' });
  });

  it('com mais de um turno, o contrato só termina no último', async () => {
    const hired = await makeHired();
    await system(
      `INSERT INTO shifts (contract_id, starts_at, ends_at) VALUES ($1, now() + interval '2 days', now() + interval '2 days 8 hours')`,
      [hired.contractId],
    );
    await checkIn(hired, 'in');
    await checkIn(hired, 'out');
    expect(await contractStatus(hired.contractId)).toBe('in_progress');
  });

  it('não há saída sem chegada, nem registro duplicado', async () => {
    const hired = await makeHired();
    await expect(checkIn(hired, 'out')).rejects.toMatchObject(CHECK_FAILED);
    await checkIn(hired, 'in');
    await expect(checkIn(hired, 'in')).rejects.toMatchObject({ code: '23505' });
  });

  it('o contrato só é concluído com a confirmação das duas partes', async () => {
    const hired = await makeHired();
    await checkIn(hired, 'in');
    await checkIn(hired, 'out');
    await appRows(hired.freelancerId, `SELECT app.confirm_contract_completion($1)`, [
      hired.contractId,
    ]);
    expect(await contractStatus(hired.contractId)).toBe('awaiting_confirmation');
    await appRows(hired.ownerId, `SELECT app.confirm_contract_completion($1)`, [hired.contractId]);
    expect(await contractStatus(hired.contractId)).toBe('completed');
    const [row] = await system<{ completed_at: Date }>(
      `SELECT completed_at FROM contracts WHERE id = $1`,
      [hired.contractId],
    );
    expect(row?.completed_at).toBeInstanceOf(Date);
  });

  it('terceiros não confirmam', async () => {
    const hired = await makeHired();
    await checkIn(hired, 'in');
    await checkIn(hired, 'out');
    const stranger = await makeUser();
    await expect(
      appRows(stranger, `SELECT app.confirm_contract_completion($1)`, [hired.contractId]),
    ).rejects.toMatchObject({ code: 'P0002' });
  });
});

describe('disputa', () => {
  it('coloca o contrato em disputa e, se retirada, ele volta ao que era', async () => {
    const hired = await makeHired();
    await checkIn(hired, 'in');
    const [dispute] = await appRows<{ id: string }>(
      hired.freelancerId,
      `INSERT INTO disputes (contract_id, reason) VALUES ($1, 'conduta') RETURNING id`,
      [hired.contractId],
    );
    expect(await contractStatus(hired.contractId)).toBe('disputed');

    await appRows(hired.freelancerId, `UPDATE disputes SET status = 'withdrawn' WHERE id = $1`, [
      dispute?.id,
    ]);
    expect(await contractStatus(hired.contractId)).toBe('in_progress');
  });

  it('o autor vem da sessão, e terceiros não abrem', async () => {
    const hired = await makeHired();
    await checkIn(hired, 'in');
    const stranger = await makeUser();
    await expect(
      appRows(stranger, `INSERT INTO disputes (contract_id, reason) VALUES ($1, 'conduta')`, [
        hired.contractId,
      ]),
    ).rejects.toMatchObject(DENIED);
    await expect(
      appRows(
        hired.ownerId,
        `INSERT INTO disputes (contract_id, reason, opened_by) VALUES ($1, 'conduta', $2)`,
        [hired.contractId, hired.freelancerId],
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it('só uma disputa aberta por contrato', async () => {
    const hired = await makeHired();
    await checkIn(hired, 'in');
    await appRows(
      hired.freelancerId,
      `INSERT INTO disputes (contract_id, reason) VALUES ($1, 'conduta')`,
      [hired.contractId],
    );
    await expect(
      appRows(hired.ownerId, `INSERT INTO disputes (contract_id, reason) VALUES ($1, 'conduta')`, [
        hired.contractId,
      ]),
    ).rejects.toMatchObject(CHECK_FAILED);
  });

  it('o contrato que ainda não começou não tem o que contestar', async () => {
    const hired = await makeHired();
    await expect(
      appRows(
        hired.freelancerId,
        `INSERT INTO disputes (contract_id, reason) VALUES ($1, 'conduta')`,
        [hired.contractId],
      ),
    ).rejects.toMatchObject(CHECK_FAILED);
  });
});

describe('o que o sistema faz sozinho', () => {
  it('o worker move o que vence', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const job = await makeJob(owner, company);
    await pool('worker').query(`UPDATE jobs SET status = 'expired' WHERE id = $1`, [job]);
    const [row] = await system(`SELECT status FROM jobs WHERE id = $1`, [job]);
    expect(row).toEqual({ status: 'expired' });
  });

  it('e o que a empresa decide continua sendo só dela', async () => {
    const owner = await makeUser();
    const company = await makeCompany(owner);
    const job = await makeJob(owner, company);
    const ana = await makeFreelancer();
    const application = await makeApplication(job, ana);
    await expect(
      pool('worker').query(`UPDATE applications SET status = 'selected' WHERE id = $1`, [
        application,
      ]),
    ).rejects.toMatchObject(DENIED);
  });
});
