import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { normalizeEmail, type FieldVault } from '../../src/crypto/vault.js';
import { withUser } from '../../src/db/with-user.js';

// Tudo aqui é fictício: pessoas, empresas, telefones e endereços de demonstração.
// .invalid é um domínio reservado: nenhum e-mail sai daqui para uma caixa real.

const SKILLS = [
  ['bartender', 'Bartender', 'bar'],
  ['garcom', 'Garçom', 'salao'],
  ['atendente', 'Atendente', 'salao'],
  ['musico', 'Músico', 'musica'],
  ['dj', 'DJ', 'musica'],
  ['recepcao', 'Recepção', 'recepcao'],
  ['producao', 'Produção de eventos', 'producao'],
  ['roadie', 'Roadie', 'producao'],
  ['cozinha', 'Auxiliar de cozinha', 'cozinha'],
] as const;

const LEGAL_DOCUMENTS = [
  ['terms', '0.1-rascunho'],
  ['privacy', '0.1-rascunho'],
  ['contract_template', '0.1-rascunho'],
] as const;

const FEATURE_FLAGS = [
  ['login_social', true],
  ['chat_audio', false],
  ['verificacao_selfie', false],
] as const;

const REPUTATION_RULES = [
  ['falta_sem_aviso', -20, 7],
  ['cancelamento_tardio', -10, 0],
  ['pagamento_nao_confirmado', -15, 0],
  ['recusa_de_vaga', 0, 0],
] as const;

const BADGES = [
  ['empresa_verificada', 'Empresa verificada', { cnpj: 'ativo' }],
  ['pagadora_rapida', 'Pagadora rápida', { confirmacoes_do_freelancer: 10 }],
  ['pontual', 'Pontual', { check_ins_no_horario: 10 }],
] as const;

const HELP_ARTICLES = [
  [
    'como-funciona-o-pagamento',
    'Como funciona o pagamento',
    'O Escala não cobra, não retém nem repassa dinheiro. A empresa paga o freelancer diretamente, fora do app, na forma combinada entre as partes.',
  ],
  [
    'quando-meu-contato-aparece',
    'Quando meu contato aparece para a outra parte',
    'Nome e telefone só aparecem depois que o contrato é aceito, e ficam visíveis até 30 dias depois do último turno.',
  ],
  [
    'como-excluir-minha-conta',
    'Como excluir minha conta',
    'Em Privacidade, escolha excluir a conta. Seus dados pessoais são apagados na hora. Registros exigidos por lei ficam guardados sem nome ou contato pelo prazo legal.',
  ],
] as const;

const PEOPLE = [
  {
    key: 'marina',
    email: 'marina.demo@escala.invalid',
    name: 'Marina Duarte',
    phone: '+5521900000001',
  },
  {
    key: 'otavio',
    email: 'otavio.demo@escala.invalid',
    name: 'Otávio Lima',
    phone: '+5511900000002',
  },
  { key: 'ana', email: 'ana.demo@escala.invalid', name: 'Ana Moreira', phone: '+5521900000003' },
  { key: 'caio', email: 'caio.demo@escala.invalid', name: 'Caio Ribeiro', phone: '+5521900000004' },
  {
    key: 'julia',
    email: 'julia.demo@escala.invalid',
    name: 'Júlia Tavares',
    phone: '+5571900000005',
  },
  { key: 'bia', email: 'bia.demo@escala.invalid', name: 'Bia Campos', phone: '+5521900000006' },
  {
    key: 'suporte',
    email: 'suporte.demo@escala.invalid',
    name: 'Equipe de Suporte',
    phone: '+5511900000007',
  },
] as const;

type PersonKey = (typeof PEOPLE)[number]['key'];

const PROFILES: {
  key: PersonKey;
  display: string;
  bio: string;
  years: number;
  rate: number;
  point: string;
  discoverable: boolean;
  skills: string[];
}[] = [
  {
    key: 'ana',
    display: 'Ana M.',
    bio: 'Bartender com foco em coquetelaria clássica. Trabalho bem em casa cheia e gosto de montar carta sazonal.',
    years: 6,
    rate: 22000,
    point: 'POINT(-43.18 -22.95)',
    discoverable: true,
    skills: ['bartender', 'atendente'],
  },
  {
    key: 'caio',
    display: 'Caio R.',
    bio: 'Garçom de salão e eventos. Experiência em serviço à francesa.',
    years: 3,
    rate: 16000,
    point: 'POINT(-43.20 -22.97)',
    discoverable: true,
    skills: ['garcom'],
  },
  {
    key: 'julia',
    display: 'Júlia T.',
    bio: 'Voz e violão: MPB, samba de roda e bossa. Levo equipamento próprio.',
    years: 8,
    rate: 45000,
    point: 'POINT(-38.50 -12.97)',
    discoverable: true,
    skills: ['musico'],
  },
  {
    key: 'bia',
    display: 'Bia C.',
    bio: 'Em início de carreira, com curso de bar e muita vontade de aprender.',
    years: 1,
    rate: 13000,
    point: 'POINT(-43.19 -22.91)',
    discoverable: false,
    skills: ['garcom', 'bartender'],
  },
];

export const SEED_MARKER_EMAIL = 'marina.demo@escala.invalid';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

async function seedCatalogs(pool: Pool): Promise<void> {
  for (const [slug, name, category] of SKILLS) {
    await pool.query(
      `INSERT INTO skills (slug, name, category) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING`,
      [slug, name, category],
    );
  }
  for (const [kind, version] of LEGAL_DOCUMENTS) {
    await pool.query(
      `INSERT INTO legal_documents (kind, version, content_sha256) VALUES ($1::legal_document_kind, $2, $3)
       ON CONFLICT (kind, version) DO NOTHING`,
      [kind, version, sha256(`${kind}:${version}`)],
    );
  }
  for (const [key, enabled] of FEATURE_FLAGS) {
    await pool.query(
      `INSERT INTO feature_flags (key, enabled) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [key, enabled],
    );
  }
  for (const [code, points, days] of REPUTATION_RULES) {
    await pool.query(
      `INSERT INTO reputation_rules (code, points, suspension_days) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING`,
      [code, points, days],
    );
  }
  for (const [slug, name, criteria] of BADGES) {
    await pool.query(
      `INSERT INTO badges (slug, name, criteria) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING`,
      [slug, name, JSON.stringify(criteria)],
    );
  }
  for (const [slug, title, body] of HELP_ARTICLES) {
    await pool.query(
      `INSERT INTO help_articles (slug, title, body, published_at) VALUES ($1, $2, $3, now()) ON CONFLICT (slug) DO NOTHING`,
      [slug, title, body],
    );
  }
}

/**
 * Popula o banco de desenvolvimento. Roda mais de uma vez sem duplicar.
 * Depois das contas, tudo passa pelo papel real da aplicação, com RLS e gatilhos ligados:
 * se o seed consegue, o app também consegue. E o que o app não pode, o seed também não faz.
 */
export async function seedDev(input: {
  migratorUrl: string;
  appUrl: string;
  vault: FieldVault;
}): Promise<{ created: boolean }> {
  const migrator = new Pool({ connectionString: input.migratorUrl, max: 2 });
  const app = new Pool({ connectionString: input.appUrl, max: 2 });
  const { vault } = input;

  try {
    await seedCatalogs(migrator);

    const marker = await migrator.query(`SELECT 1 FROM users WHERE email_index = $1`, [
      vault.blindIndex(normalizeEmail(SEED_MARKER_EMAIL), 'users.email'),
    ]);
    if (marker.rowCount) return { created: false };

    const ids = {} as Record<PersonKey, string>;
    for (const person of PEOPLE) {
      const { rows } = await migrator.query<{ id: string }>(
        `INSERT INTO users (email_index, email_enc, phone_enc, legal_name_enc, status, platform_role)
         VALUES ($1, $2, $3, $4, 'active', $5::platform_role) RETURNING id`,
        [
          vault.blindIndex(normalizeEmail(person.email), 'users.email'),
          vault.encrypt(normalizeEmail(person.email), 'users.email'),
          vault.encrypt(person.phone, 'users.phone'),
          vault.encrypt(person.name, 'users.legal_name'),
          person.key === 'suporte' ? 'support' : 'none',
        ],
      );
      ids[person.key] = (rows[0] as { id: string }).id;
    }

    const skills = new Map(
      (await migrator.query<{ slug: string; id: string }>(`SELECT slug, id FROM skills`)).rows.map(
        (row) => [row.slug, row.id],
      ),
    );
    const skillId = (slug: string) => skills.get(slug) as string;

    for (const profile of PROFILES) {
      await withUser(app, ids[profile.key], async (client) => {
        await client.query(
          `INSERT INTO freelancer_profiles (user_id, display_name, bio, experience_years, reference_rate_cents,
             base_location, available_now, discoverable)
           VALUES ($1, $2, $3, $4, $5, ST_GeogFromText($6), true, $7)`,
          [
            ids[profile.key],
            profile.display,
            profile.bio,
            profile.years,
            profile.rate,
            profile.point,
            profile.discoverable,
          ],
        );
        for (const slug of profile.skills) {
          await client.query(
            `INSERT INTO freelancer_skills (freelancer_id, skill_id, level) VALUES ($1, $2, 'avancado')`,
            [ids[profile.key], skillId(slug)],
          );
        }
      });
    }

    const makeCompany = async (
      owner: PersonKey,
      name: string,
      segment: string,
      city: string,
      about: string,
    ): Promise<string> => {
      const id = await withUser(app, ids[owner], async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO companies (trade_name, segment, city, about) VALUES ($1, $2::company_segment, $3, $4) RETURNING id`,
          [name, segment, city, about],
        );
        return (rows[0] as { id: string }).id;
      });
      // Ativar e verificar é do sistema: o app não consegue fazer por conta própria.
      await migrator.query(
        `UPDATE companies SET status = 'active', verified_at = now() WHERE id = $1`,
        [id],
      );
      return id;
    };

    const aurora = await makeCompany(
      'marina',
      'Casa Aurora Bar',
      'bar_restaurante',
      'Rio de Janeiro',
      'Bar de coquetelaria autoral em Botafogo, com música ao vivo de quinta a sábado.',
    );
    const selo = await makeCompany(
      'otavio',
      'Selo Noturno Produções',
      'producao_musical',
      'São Paulo',
      'Produtora de shows e festivais independentes.',
    );

    const makeJob = (
      owner: PersonKey,
      companyId: string,
      job: {
        title: string;
        description: string;
        skill: string;
        city: string;
        hood: string;
        point: string;
        site: string;
        address: string;
        days: number;
        hours: number;
        pay: number;
        unit: string;
        slots: number;
      },
    ): Promise<string> =>
      withUser(app, ids[owner], async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO jobs (company_id, title, description, primary_skill_id, city, neighbourhood, public_location,
             starts_at, ends_at, slots, pay_amount_cents, pay_unit, status)
           VALUES ($1, $2, $3, $4, $5, $6, ST_GeogFromText($7),
             now() + make_interval(days => $8), now() + make_interval(days => $8, hours => $9),
             $10, $11, $12::pay_unit, 'published')
           RETURNING id`,
          [
            companyId,
            job.title,
            job.description,
            skillId(job.skill),
            job.city,
            job.hood,
            job.point,
            job.days,
            job.hours,
            job.slots,
            job.pay,
            job.unit,
          ],
        );
        const id = (rows[0] as { id: string }).id;
        await client.query(
          `INSERT INTO job_private_details (job_id, address_enc, site_location) VALUES ($1, $2, ST_GeogFromText($3))`,
          [id, vault.encrypt(job.address, 'job_private_details.address'), job.site],
        );
        return id;
      });

    const coquetelaria = await makeJob('marina', aurora, {
      title: 'Bartender para sexta de coquetelaria',
      description:
        'Casa cheia, carta de 12 drinques. Precisamos de alguém com agilidade em clássicos e boa conversa no balcão.',
      skill: 'bartender',
      city: 'Rio de Janeiro',
      hood: 'Botafogo',
      point: 'POINT(-43.18 -22.95)',
      site: 'POINT(-43.1822 -22.9519)',
      address: 'Rua das Palmeiras Fictícia, 120, Botafogo',
      days: 3,
      hours: 8,
      pay: 22000,
      unit: 'diaria',
      slots: 2,
    });
    const jantar = await makeJob('marina', aurora, {
      title: 'Garçom para jantar harmonizado',
      description:
        'Jantar de 5 tempos para 40 pessoas. Serviço atento e conhecimento básico de vinhos.',
      skill: 'garcom',
      city: 'Rio de Janeiro',
      hood: 'Botafogo',
      point: 'POINT(-43.18 -22.95)',
      site: 'POINT(-43.1822 -22.9519)',
      address: 'Rua das Palmeiras Fictícia, 120, Botafogo',
      days: 5,
      hours: 5,
      pay: 18000,
      unit: 'diaria',
      slots: 3,
    });
    await makeJob('otavio', selo, {
      title: 'Roadie para festival independente',
      description:
        'Montagem e troca de palco em festival com 6 bandas. Experiência com backline é essencial.',
      skill: 'roadie',
      city: 'São Paulo',
      hood: 'Barra Funda',
      point: 'POINT(-46.67 -23.52)',
      site: 'POINT(-46.6677 -23.5255)',
      address: 'Av. dos Festivais Fictícia, 900, Barra Funda',
      days: 7,
      hours: 13,
      pay: 28000,
      unit: 'diaria',
      slots: 4,
    });

    const apply = (freelancer: PersonKey, job: string, note: string): Promise<string> =>
      withUser(app, ids[freelancer], async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO applications (job_id, freelancer_id, origin, status, note_enc)
           VALUES ($1, $2, 'applied', 'applied', $3) RETURNING id`,
          [job, ids[freelancer], vault.encrypt(note, 'applications.note')],
        );
        return (rows[0] as { id: string }).id;
      });

    await apply('caio', jantar, 'Tenho experiência com serviço de vinhos.');
    const anaApplication = await apply('ana', coquetelaria, 'Conheço bem a carta clássica.');

    // Um contrato percorrendo o fluxo inteiro: seleção, aceite, turno, confirmação e avaliações.
    const contractId = await hire({
      app,
      company: ids.marina,
      freelancer: ids.ana,
      applicationId: anaApplication,
      jobId: coquetelaria,
      companyId: aurora,
      amount: 22000,
    });
    await withUser(app, ids.ana, async (client) => {
      await client.query(`UPDATE contracts SET status = 'accepted' WHERE id = $1`, [contractId]);
      const { rows } = await client.query<{ id: string }>(
        `SELECT id FROM shifts WHERE contract_id = $1`,
        [contractId],
      );
      const shift = (rows[0] as { id: string }).id;
      await client.query(
        `INSERT INTO check_ins (shift_id, kind, location) VALUES ($1, 'in', ST_GeogFromText('POINT(-43.1822 -22.9519)'))`,
        [shift],
      );
      await client.query(
        `INSERT INTO check_ins (shift_id, kind, location) VALUES ($1, 'out', ST_GeogFromText('POINT(-43.1822 -22.9519)'))`,
        [shift],
      );
      await client.query(`SELECT app.confirm_contract_completion($1)`, [contractId]);
    });
    await withUser(app, ids.marina, async (client) => {
      await client.query(`SELECT app.mark_contract_paid($1)`, [contractId]);
      await client.query(`SELECT app.confirm_contract_completion($1)`, [contractId]);
    });
    await withUser(app, ids.ana, (client) =>
      client.query(`SELECT app.confirm_contract_paid($1)`, [contractId]),
    );

    await review(app, ids.marina, contractId, 'Pontual e muito atenciosa com o público.', {
      pontualidade: 5,
      qualidade: 5,
      comunicacao: 4,
      postura: 5,
    });
    await review(app, ids.ana, contractId, 'Vaga bem descrita e equipe acolhedora.', {
      clareza_vaga: 5,
      ambiente: 5,
      pagamento_em_dia: 5,
      respeito: 5,
    });

    const conversation = await withUser(app, ids.ana, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `SELECT app.ensure_conversation($1) AS id`,
        [anaApplication],
      );
      const id = (rows[0] as { id: string }).id;
      await client.query(
        `INSERT INTO messages (conversation_id, sender_user_id, kind, body_enc) VALUES ($1, $2, 'text', $3)`,
        [
          id,
          ids.ana,
          vault.encrypt('Oi, Marina! Vou chegar às 17h para montar o bar.', 'messages.body'),
        ],
      );
      return id;
    });
    await withUser(app, ids.marina, (client) =>
      client.query(
        `INSERT INTO messages (conversation_id, sender_user_id, kind, body_enc) VALUES ($1, $2, 'text', $3)`,
        [conversation, ids.marina, vault.encrypt('Combinado, até lá!', 'messages.body')],
      ),
    );

    return { created: true };
  } finally {
    await Promise.all([migrator.end(), app.end()]);
  }
}

async function hire(input: {
  app: Pool;
  company: string;
  freelancer: string;
  applicationId: string;
  jobId: string;
  companyId: string;
  amount: number;
}): Promise<string> {
  return withUser(input.app, input.company, async (client: PoolClient) => {
    await client.query(`UPDATE applications SET status = 'selected' WHERE id = $1`, [
      input.applicationId,
    ]);
    const terms = await client.query<{ id: string }>(
      `SELECT id FROM legal_documents WHERE kind = 'contract_template' ORDER BY published_at DESC LIMIT 1`,
    );
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO contracts (application_id, job_id, company_id, freelancer_id, company_contact_user_id,
         terms_document_id, agreed_amount_cents, pay_unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'diaria') RETURNING id`,
      [
        input.applicationId,
        input.jobId,
        input.companyId,
        input.freelancer,
        input.company,
        (terms.rows[0] as { id: string }).id,
        input.amount,
      ],
    );
    const id = (rows[0] as { id: string }).id;
    await client.query(
      `INSERT INTO shifts (contract_id, starts_at, ends_at)
       SELECT $1::uuid, starts_at, ends_at FROM jobs WHERE id = $2`,
      [id, input.jobId],
    );
    return id;
  });
}

async function review(
  app: Pool,
  actor: string,
  contractId: string,
  comment: string,
  scores: Record<string, number>,
): Promise<void> {
  await withUser(app, actor, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO reviews (contract_id, comment) VALUES ($1, $2) RETURNING id`,
      [contractId, comment],
    );
    const id = (rows[0] as { id: string }).id;
    for (const [criterion, score] of Object.entries(scores)) {
      await client.query(
        `INSERT INTO review_criteria_scores (review_id, criterion, score) VALUES ($1, $2::review_criterion, $3)`,
        [id, criterion, score],
      );
    }
  });
}
