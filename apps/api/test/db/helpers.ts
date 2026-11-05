import { randomBytes, randomUUID } from 'node:crypto';
import { Client, Pool, type PoolClient, type QueryResultRow } from 'pg';
import { inject } from 'vitest';
import { connectionUrl } from '../../db/config.js';
import { DB_ROLES, type DbRoleKey } from '../../db/roles.js';
import { withUser } from '../../src/db/with-user.js';

const pools = new Map<DbRoleKey, Pool>();

export function roleUrl(key: DbRoleKey, database?: string): string {
  const ctx = inject('db');
  return connectionUrl({
    host: ctx.host,
    port: ctx.port,
    database: database ?? ctx.database,
    user: DB_ROLES[key],
    password: ctx.passwords[key],
  });
}

export function adminConnectionUrl(database?: string): string {
  const ctx = inject('db');
  return connectionUrl({
    host: ctx.host,
    port: ctx.port,
    database: database ?? ctx.database,
    ...ctx.admin,
  });
}

export function pool(key: DbRoleKey): Pool {
  let existing = pools.get(key);
  if (!existing) {
    existing = new Pool({ connectionString: roleUrl(key), max: 4 });
    pools.set(key, existing);
  }
  return existing;
}

export async function closePools(): Promise<void> {
  await Promise.all([...pools.values()].map((item) => item.end()));
  pools.clear();
}

/** Age como um papel real de banco e, se houver, como uma pessoa logada. Nunca como dono das tabelas. */
export function as<T>(
  key: DbRoleKey,
  userId: string | null,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withUser(pool(key), userId, work);
}

export const asApp = <T>(userId: string | null, work: (client: PoolClient) => Promise<T>) =>
  as('app', userId, work);

/** Consulta com o papel da aplicação e devolve as linhas. */
export async function appRows<R extends QueryResultRow = QueryResultRow>(
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<R[]> {
  return asApp(userId, async (client) => (await client.query<R>(sql, params)).rows);
}

/** Dono das tabelas. Só para preparar o cenário e conferir o resultado no banco. */
export async function system<R extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<R[]> {
  return (await pool('migrator').query<R>(sql, params)).rows;
}

/** Sem políticas no caminho: lê o catálogo como administrador, em uma conexão própria. */
export async function withAdmin<T>(
  database: string | undefined,
  work: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: adminConnectionUrl(database) });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

export const DENIED = { code: '42501' };
export const CHECK_FAILED = { code: '23514' };

const fake = (label: string) => `v1.k1.${label}.${randomBytes(6).toString('hex')}.x`;

export async function makeUser(
  platformRole: 'none' | 'support' | 'admin' = 'none',
): Promise<string> {
  const [row] = await system<{ id: string }>(
    `INSERT INTO users (email_index, email_enc, phone_enc, legal_name_enc, status, platform_role)
     VALUES ($1, $2, $3, $4, 'active', $5) RETURNING id`,
    [randomBytes(16).toString('hex'), fake('email'), fake('phone'), fake('name'), platformRole],
  );
  return (row as { id: string }).id;
}

export async function makeFreelancer(options: { discoverable?: boolean } = {}): Promise<string> {
  const id = await makeUser();
  await system(
    `INSERT INTO freelancer_profiles (user_id, display_name, discoverable) VALUES ($1, 'Ana M.', $2)`,
    [id, options.discoverable ?? false],
  );
  return id;
}

/** Cria a empresa pelo caminho real. Quem cria vira dono. Só a ativação vem do sistema. */
export async function makeCompany(ownerId: string): Promise<string> {
  const [row] = await appRows<{ id: string }>(
    ownerId,
    `INSERT INTO companies (trade_name, segment) VALUES ('Bar de Teste', 'bar_restaurante') RETURNING id`,
  );
  const id = (row as { id: string }).id;
  await system(`UPDATE companies SET status = 'active' WHERE id = $1`, [id]);
  return id;
}

export async function skillId(): Promise<string> {
  const [row] = await system<{ id: string }>(
    `INSERT INTO skills (slug, name, category) VALUES ('teste-bartender', 'Bartender', 'bar')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
  );
  return (row as { id: string }).id;
}

export async function termsId(): Promise<string> {
  const [row] = await system<{ id: string }>(
    `INSERT INTO legal_documents (kind, version, content_sha256)
     VALUES ('contract_template', 'teste', repeat('a', 64))
     ON CONFLICT (kind, version) DO UPDATE SET version = EXCLUDED.version RETURNING id`,
  );
  return (row as { id: string }).id;
}

// Avenida Paulista, 1000. O ponto do turno nos testes de geocerca.
export const SITE = 'POINT(-46.6523 -23.5650)';

export async function makeJob(
  ownerId: string,
  companyId: string,
  options: { status?: 'draft' | 'published' } = {},
): Promise<string> {
  const skill = await skillId();
  return asApp(ownerId, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO jobs (company_id, title, description, primary_skill_id, city, neighbourhood,
         public_location, starts_at, ends_at, pay_amount_cents, pay_unit, status)
       VALUES ($1, 'Bartender para sexta', 'Atendimento no bar durante o evento.', $2, 'São Paulo', 'Bela Vista',
         ST_GeogFromText('POINT(-46.65 -23.56)'), now() + interval '1 day', now() + interval '1 day 8 hours',
         20000, 'diaria', $3::job_status)
       RETURNING id`,
      [companyId, skill, options.status ?? 'published'],
    );
    const id = (rows[0] as { id: string }).id;
    await client.query(
      `INSERT INTO job_private_details (job_id, address_enc, site_location, access_notes_enc)
       VALUES ($1, $2, ST_GeogFromText($3), $4)`,
      [id, fake('address'), SITE, fake('notes')],
    );
    return id;
  });
}

export async function makeApplication(jobId: string, freelancerId: string): Promise<string> {
  const [row] = await appRows<{ id: string }>(
    freelancerId,
    `INSERT INTO applications (job_id, freelancer_id, origin, status)
     VALUES ($1, $2, 'applied', 'applied') RETURNING id`,
    [jobId, freelancerId],
  );
  return (row as { id: string }).id;
}

export type Hired = {
  ownerId: string;
  companyId: string;
  jobId: string;
  freelancerId: string;
  applicationId: string;
  contractId: string;
  shiftId: string;
};

export async function setApplicationStatus(
  actorId: string,
  applicationId: string,
  status: string,
): Promise<void> {
  await appRows(actorId, `UPDATE applications SET status = $2::application_status WHERE id = $1`, [
    applicationId,
    status,
  ]);
}

/** Contrato proposto pela empresa, ainda sem o aceite do freelancer. */
export async function makeProposal(): Promise<Hired> {
  const ownerId = await makeUser();
  const companyId = await makeCompany(ownerId);
  const jobId = await makeJob(ownerId, companyId);
  const freelancerId = await makeFreelancer();
  const applicationId = await makeApplication(jobId, freelancerId);
  await setApplicationStatus(ownerId, applicationId, 'selected');
  const terms = await termsId();
  const { contractId, shiftId } = await asApp(ownerId, async (client) => {
    const contract = await client.query<{ id: string }>(
      `INSERT INTO contracts (application_id, job_id, company_id, freelancer_id, company_contact_user_id,
         terms_document_id, agreed_amount_cents, pay_unit)
       VALUES ($1, $2, $3, $4, $5, $6, 20000, 'diaria') RETURNING id`,
      [applicationId, jobId, companyId, freelancerId, ownerId, terms],
    );
    const id = (contract.rows[0] as { id: string }).id;
    const shift = await client.query<{ id: string }>(
      `INSERT INTO shifts (contract_id, starts_at, ends_at)
       VALUES ($1, now() + interval '1 day', now() + interval '1 day 8 hours') RETURNING id`,
      [id],
    );
    return { contractId: id, shiftId: (shift.rows[0] as { id: string }).id };
  });
  return { ownerId, companyId, jobId, freelancerId, applicationId, contractId, shiftId };
}

/** Contrato aceito: contato e endereço já estão liberados. */
export async function makeHired(): Promise<Hired> {
  const hired = await makeProposal();
  await appRows(hired.freelancerId, `UPDATE contracts SET status = 'accepted' WHERE id = $1`, [
    hired.contractId,
  ]);
  return hired;
}

export async function checkIn(hired: Hired, kind: 'in' | 'out', point: string = SITE) {
  await appRows(
    hired.freelancerId,
    `INSERT INTO check_ins (shift_id, kind, location) VALUES ($1, $2::check_in_kind, ST_GeogFromText($3))`,
    [hired.shiftId, kind, point],
  );
}

/** Turno feito, com as duas partes confirmando. As avaliações já podem ser escritas. */
export async function makeCompleted(): Promise<Hired> {
  const hired = await makeHired();
  await checkIn(hired, 'in');
  await checkIn(hired, 'out');
  await appRows(hired.freelancerId, `SELECT app.confirm_contract_completion($1)`, [
    hired.contractId,
  ]);
  await appRows(hired.ownerId, `SELECT app.confirm_contract_completion($1)`, [hired.contractId]);
  return hired;
}

export async function contractStatus(contractId: string): Promise<string> {
  const [row] = await system<{ status: string }>(`SELECT status FROM contracts WHERE id = $1`, [
    contractId,
  ]);
  return (row as { status: string }).status;
}

export async function makeConversation(hired: Hired): Promise<string> {
  const [row] = await appRows<{ id: string }>(
    hired.freelancerId,
    `SELECT app.ensure_conversation($1) AS id`,
    [hired.applicationId],
  );
  return (row as { id: string }).id;
}

export async function makeFile(ownerId: string): Promise<string> {
  const [row] = await appRows<{ id: string }>(
    ownerId,
    `INSERT INTO files (owner_user_id, storage_key, mime_type, size_bytes, sha256)
     VALUES ($1, $2, 'image/jpeg', 10, repeat('b', 64)) RETURNING id`,
    [ownerId, `teste/${randomUUID()}`],
  );
  return (row as { id: string }).id;
}
