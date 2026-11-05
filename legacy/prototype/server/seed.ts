import { randomUUID } from 'node:crypto';
import { DEMO_EMAILS } from './app.ts';
import { POLICY_VERSION } from './config.ts';
import { one, run, tx } from './db.ts';
import { addDays, checkDigits, publicName, today } from './domain.ts';
import type { Ctx } from './http.ts';
import { hashPassword } from './vault.ts';

// Tudo aqui é fictício: pessoas, empresas, telefones e CNPJs de demonstração.
const COMPANIES = [
  { key: 'aurora', name: 'Casa Aurora Bar', contact: 'Marina Duarte', email: DEMO_EMAILS.company, city: 'Rio de Janeiro', segment: 'bar_restaurante', verified: 1, about: 'Bar de coquetelaria autoral em Botafogo, com música ao vivo de quinta a sábado.' },
  { key: 'selo', name: 'Selo Noturno Produções', contact: 'Otávio Lima', email: 'selo.noturno@example.com', city: 'São Paulo', segment: 'producao_musical', verified: 1, about: 'Produtora de shows e festivais independentes.' },
  { key: 'mare', name: 'Hostel Maré Alta', contact: 'Sofia Beck', email: 'mare.alta@example.com', city: 'Florianópolis', segment: 'hospedagem', verified: 1, about: 'Hostel de frente para o mar, com bar e eventos na alta temporada.' },
  { key: 'lume', name: 'Arena Lume Eventos', contact: 'Paulo Reis', email: 'arena.lume@example.com', city: 'Belo Horizonte', segment: 'festas_eventos', verified: 0, about: 'Casamentos, formaturas e eventos corporativos.' },
  { key: 'ventos', name: 'Pousada Sete Ventos', contact: 'Iara Santos', email: 'sete.ventos@example.com', city: 'Salvador', segment: 'hospedagem', verified: 1, about: 'Pousada boutique no Santo Antônio Além do Carmo.' },
  { key: 'praca', name: 'Bistrô da Praça', contact: 'Hugo Mello', email: 'bistro.praca@example.com', city: 'Rio de Janeiro', segment: 'bar_restaurante', verified: 1, about: 'Cozinha de bistrô com jantares harmonizados no Leblon.' },
] as const;

const FREELANCERS = [
  { key: 'ana', name: 'Ana Moreira', email: DEMO_EMAILS.freelancer, city: 'Rio de Janeiro', categories: ['bartender', 'atendente'], years: 6, rate: 22000, discoverable: 1, available: 1, bio: 'Bartender com foco em coquetelaria clássica. Trabalho bem em casa cheia e gosto de montar carta sazonal.' },
  { key: 'caio', name: 'Caio Ribeiro', email: 'caio.demo@example.com', city: 'Rio de Janeiro', categories: ['garcom'], years: 3, rate: 16000, discoverable: 1, available: 1, bio: 'Garçom de salão e eventos. Experiência em serviço à francesa.' },
  { key: 'julia', name: 'Júlia Tavares', email: 'julia.demo@example.com', city: 'Salvador', categories: ['musico'], years: 8, rate: 45000, discoverable: 1, available: 1, bio: 'Voz e violão: MPB, samba de roda e bossa. Levo equipamento próprio.' },
  { key: 'davi', name: 'Davi Nogueira', email: 'davi.demo@example.com', city: 'São Paulo', categories: ['producao'], years: 5, rate: 25000, discoverable: 1, available: 0, bio: 'Roadie e produção de palco para festivais de médio porte.' },
  { key: 'lia', name: 'Lia Prado', email: 'lia.demo@example.com', city: 'Florianópolis', categories: ['recepcao', 'atendente'], years: 2, rate: 15000, discoverable: 1, available: 1, bio: 'Recepção em português, inglês e espanhol. Experiência com check-in em hostels.' },
  { key: 'rafa', name: 'Rafael Souza', email: 'rafael.demo@example.com', city: 'Rio de Janeiro', categories: ['musico'], years: 4, rate: 60000, discoverable: 1, available: 1, bio: 'DJ de house e música brasileira para festas e aberturas de casa.' },
  { key: 'bia', name: 'Bia Campos', email: 'bia.demo@example.com', city: 'Rio de Janeiro', categories: ['garcom', 'bartender'], years: 1, rate: 13000, discoverable: 0, available: 1, bio: 'Em início de carreira, com curso de bar e muita vontade de aprender.' },
  { key: 'teo', name: 'Téo Vasconcelos', email: 'teo.demo@example.com', city: 'Belo Horizonte', categories: ['cozinha'], years: 7, rate: 20000, discoverable: 1, available: 1, bio: 'Auxiliar de cozinha e copa para buffets e eventos corporativos.' },
] as const;

type CompanyKey = (typeof COMPANIES)[number]['key'];

const UPCOMING: { key: string; company: CompanyKey; title: string; category: string; description: string; hood: string; address: string; offset: number; weekday?: number; start: string; end: string; pay: number; payType: string; slots: number }[] = [
  { key: 'g1', company: 'aurora', title: 'Bartender para sexta de coquetelaria', category: 'bartender', description: 'Casa cheia, carta de 12 drinques. Precisamos de alguém com agilidade em clássicos e boa conversa no balcão.', hood: 'Botafogo', address: 'Rua das Palmeiras Fictícia, 120, Botafogo', offset: 2, weekday: 5, start: '18:00', end: '02:00', pay: 22000, payType: 'diaria', slots: 2 },
  { key: 'g2', company: 'aurora', title: 'Garçom para jantar harmonizado', category: 'garcom', description: 'Jantar de 5 tempos para 40 pessoas. Serviço atento e conhecimento básico de vinhos.', hood: 'Botafogo', address: 'Rua das Palmeiras Fictícia, 120, Botafogo', offset: 5, start: '19:00', end: '00:00', pay: 18000, payType: 'diaria', slots: 3 },
  { key: 'g3', company: 'aurora', title: 'Voz e violão no happy hour', category: 'musico', description: 'Repertório de MPB e bossa em volume ambiente, três blocos de 40 minutos. A casa tem som.', hood: 'Botafogo', address: 'Rua das Palmeiras Fictícia, 120, Botafogo', offset: 9, start: '18:30', end: '21:30', pay: 40000, payType: 'cache', slots: 1 },
  { key: 'g4', company: 'selo', title: 'Roadie para festival independente', category: 'producao', description: 'Montagem e troca de palco em festival com 6 bandas. Experiência com backline é essencial.', hood: 'Barra Funda', address: 'Av. dos Festivais Fictícia, 900, Barra Funda', offset: 4, start: '10:00', end: '23:00', pay: 28000, payType: 'diaria', slots: 4 },
  { key: 'g5', company: 'selo', title: 'Bartender para festa de lançamento', category: 'bartender', description: 'Lançamento de disco para 200 convidados. Bar com carta enxuta e operação rápida.', hood: 'Pinheiros', address: 'Rua do Disco Fictícia, 45, Pinheiros', offset: 11, start: '20:00', end: '03:00', pay: 25000, payType: 'diaria', slots: 2 },
  { key: 'g6', company: 'mare', title: 'Recepcionista para alta temporada', category: 'recepcao', description: 'Check-in e atendimento de hóspedes internacionais. Inglês intermediário é necessário.', hood: 'Barra da Lagoa', address: 'Servidão da Maré Fictícia, 12, Barra da Lagoa', offset: 3, start: '14:00', end: '22:00', pay: 17000, payType: 'diaria', slots: 1 },
  { key: 'g7', company: 'mare', title: 'DJ para luau de sábado', category: 'musico', description: 'Set de 3 horas no deck. Equipamento por conta da casa.', hood: 'Barra da Lagoa', address: 'Servidão da Maré Fictícia, 12, Barra da Lagoa', offset: 6, weekday: 6, start: '20:00', end: '23:00', pay: 50000, payType: 'cache', slots: 1 },
  { key: 'g8', company: 'lume', title: 'Equipe de salão para casamento', category: 'garcom', description: 'Casamento para 180 pessoas. Traje social preto, alimentação inclusa.', hood: 'Pampulha', address: 'Alameda dos Noivos Fictícia, 300, Pampulha', offset: 7, start: '16:00', end: '01:00', pay: 20000, payType: 'diaria', slots: 8 },
  { key: 'g9', company: 'lume', title: 'Auxiliar de cozinha para buffet', category: 'cozinha', description: 'Apoio em finalização e reposição para evento corporativo de 300 pessoas.', hood: 'Savassi', address: 'Rua do Buffet Fictícia, 77, Savassi', offset: 13, start: '08:00', end: '17:00', pay: 19000, payType: 'diaria', slots: 3 },
  { key: 'g10', company: 'ventos', title: 'Atendente de café da manhã', category: 'atendente', description: 'Atendimento às mesas no café da manhã da pousada, durante o feriado prolongado.', hood: 'Santo Antônio', address: 'Ladeira dos Ventos Fictícia, 7, Santo Antônio', offset: 8, start: '06:30', end: '11:30', pay: 2800, payType: 'hora', slots: 2 },
  { key: 'g11', company: 'ventos', title: 'Samba de roda no pátio', category: 'musico', description: 'Grupo ou solo para roda de samba com hóspedes no fim de tarde.', hood: 'Santo Antônio', address: 'Ladeira dos Ventos Fictícia, 7, Santo Antônio', offset: 10, start: '16:00', end: '19:00', pay: 60000, payType: 'cache', slots: 1 },
  { key: 'g12', company: 'praca', title: 'Hostess para noite de inauguração', category: 'recepcao', description: 'Recepção de convidados e controle de lista na inauguração do novo salão.', hood: 'Leblon', address: 'Praça da Inauguração Fictícia, 15, Leblon', offset: 1, start: '18:00', end: '23:30', pay: 21000, payType: 'diaria', slots: 1 },
  { key: 'g13', company: 'praca', title: 'Bartender para brunch de domingo', category: 'bartender', description: 'Carta de mimosas e bloody marys. Turno curto e tranquilo.', hood: 'Leblon', address: 'Praça da Inauguração Fictícia, 15, Leblon', offset: 6, weekday: 0, start: '10:00', end: '16:00', pay: 16000, payType: 'diaria', slots: 1 },
];

/** [empresa, freelancer, dias atrás, nota para o freelancer, nota para a empresa (null = ainda não avaliou)] */
const HISTORY: [CompanyKey, string, number, number, number | null][] = [
  ['aurora', 'ana', 6, 5, null],
  ['praca', 'ana', 24, 5, 5],
  ['selo', 'ana', 48, 4, 4],
  ['aurora', 'caio', 15, 5, 5],
  ['praca', 'caio', 40, 4, 4],
  ['ventos', 'julia', 12, 5, 5],
  ['aurora', 'julia', 33, 5, 4],
  ['selo', 'davi', 20, 5, 5],
  ['mare', 'lia', 18, 5, 5],
  ['mare', 'rafa', 25, 4, 5],
  ['lume', 'teo', 30, 5, 3],
];

/** Próxima ocorrência do dia da semana (0 = domingo), sempre a partir de amanhã. */
function nextWeekday(from: string, weekday: number): string {
  const current = new Date(`${from}T12:00:00Z`).getUTCDay();
  return addDays(from, ((weekday - current + 6) % 7) + 1);
}

function phone(i: number): string {
  return `2199000${String(1000 + i).padStart(4, '0')}`;
}

export async function seedDemo(ctx: Ctx, password: string) {
  if (one(ctx.db, 'SELECT 1 FROM users LIMIT 1')) return;
  const passwordHash = await hashPassword(password);
  const now = Date.now();
  const date = today();
  const { db, vault } = ctx;

  tx(db, () => {
    const ids: Record<string, string> = {};
    const addUser = (key: string, role: string, email: string, displayName: string, fullName: string, city: string, i: number) => {
      const id = randomUUID();
      ids[key] = id;
      run(
        db,
        `INSERT INTO users (id, role, email_index, email_enc, password_hash, phone_enc, full_name_enc, display_name, city, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        id, role, vault.index(email, 'email'), vault.encrypt(email, 'user.email'), passwordHash,
        vault.encrypt(phone(i), 'user.phone'), vault.encrypt(fullName, 'user.fullName'), displayName, city, now - 90 * 86_400_000,
      );
      for (const [purpose, granted] of [['terms', 1], ['adult_declaration', 1], ['marketing', 0]] as const) {
        run(db, 'INSERT INTO consents (id, user_id, purpose, version, granted, created_at) VALUES (?,?,?,?,?,?)', randomUUID(), id, purpose, POLICY_VERSION, granted, now - 90 * 86_400_000);
      }
      return id;
    };

    COMPANIES.forEach((c, i) => {
      const id = addUser(c.key, 'company', c.email, c.name, c.contact, c.city, i + 1);
      const base = `DEMO${String(i + 1).padStart(8, '0')}`;
      const cnpj = base + checkDigits(base);
      run(
        db,
        'INSERT INTO company_profiles (user_id, segment, about, cnpj_index, cnpj_enc, verified) VALUES (?,?,?,?,?,?)',
        id, c.segment, c.about, vault.index(cnpj, 'cnpj'), vault.encrypt(cnpj, 'company.cnpj'), c.verified,
      );
    });

    FREELANCERS.forEach((f, i) => {
      const id = addUser(f.key, 'freelancer', f.email, publicName(f.name), f.name, f.city, i + 20);
      run(
        db,
        'INSERT INTO freelancer_profiles (user_id, categories, bio, experience_years, day_rate_cents, available, discoverable) VALUES (?,?,?,?,?,?,?)',
        id, JSON.stringify(f.categories), f.bio, f.years, f.rate, f.available, f.discoverable,
      );
      run(db, 'INSERT INTO consents (id, user_id, purpose, version, granted, created_at) VALUES (?,?,?,?,?,?)', randomUUID(), id, 'discovery', POLICY_VERSION, f.discoverable, now - 90 * 86_400_000);
    });

    const cityOf = Object.fromEntries(COMPANIES.map((c) => [c.key, c.city]));
    const gigIds: Record<string, string> = {};
    for (const g of UPCOMING) {
      const id = randomUUID();
      gigIds[g.key] = id;
      run(
        db,
        `INSERT INTO gigs (id, company_id, title, category, description, city, neighbourhood, address_enc, date, start_time, end_time, pay_cents, pay_type, slots, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, ids[g.company]!, g.title, g.category, g.description, cityOf[g.company]!, g.hood, vault.encrypt(g.address, 'gig.address'),
        g.weekday === undefined ? addDays(date, g.offset) : nextWeekday(date, g.weekday), g.start, g.end, g.pay, g.payType, g.slots, now - 2 * 86_400_000,
      );
    }

    const addApplication = (gig: string, who: string, status: string, note: string | null, ago = 86_400_000) => {
      const id = randomUUID();
      run(
        db,
        'INSERT INTO applications (id, gig_id, freelancer_id, status, note_enc, created_at, decided_at) VALUES (?,?,?,?,?,?,?)',
        id, gigIds[gig]!, ids[who]!, status, note ? vault.encrypt(note, 'application.note') : null, now - ago,
        status === 'accepted' ? now - ago / 2 : null,
      );
      return id;
    };
    const addMessage = (application: string, sender: string, body: string, ago: number) => {
      run(
        db,
        'INSERT INTO messages (id, application_id, sender_id, body_enc, created_at) VALUES (?,?,?,?,?)',
        randomUUID(), application, ids[sender]!, vault.encrypt(body, 'message.body'), now - ago,
      );
    };

    // Estado inicial que permite demonstrar todos os fluxos da Ana e da Casa Aurora.
    const confirmed = addApplication('g1', 'ana', 'accepted', 'Trabalhei três anos com coquetelaria clássica e conheço a casa.', 2 * 86_400_000);
    addMessage(confirmed, 'aurora', 'Oi, Ana! Fechado para sexta. Você consegue chegar às 17h30 para o mise en place?', 5 * 3_600_000);
    addMessage(confirmed, 'ana', 'Consigo sim! Preciso levar kit próprio ou a casa fornece?', 4 * 3_600_000);
    addMessage(confirmed, 'aurora', 'A casa fornece tudo. Só traz o avental. Até lá!', 40 * 60_000);
    addApplication('g5', 'ana', 'pending', 'Tenho experiência com operação rápida em festas de até 300 pessoas.');
    const invite = addApplication('g13', 'ana', 'invited', 'Vimos seu perfil e adoraríamos ter você no nosso brunch.', 8 * 3_600_000);
    addMessage(invite, 'praca', 'Oi, Ana! O turno é tranquilo e termina às 16h. Topa?', 7 * 3_600_000);

    addApplication('g1', 'bia', 'pending', 'Tenho curso de bar e já fiz dois eventos como apoio.', 30 * 3_600_000);
    addApplication('g2', 'caio', 'pending', 'Já trabalhei em jantares harmonizados no Leblon.', 20 * 3_600_000);
    addApplication('g2', 'bia', 'pending', null, 10 * 3_600_000);
    addApplication('g3', 'julia', 'pending', 'Repertório completo de bossa. Posso enviar vídeos.', 26 * 3_600_000);
    addApplication('g3', 'rafa', 'invited', null, 6 * 3_600_000);
    addApplication('g6', 'lia', 'pending', 'Falo inglês e espanhol e já trabalhei com check-in.');

    for (const [company, freelancer, daysAgo, toFreelancer, toCompany] of HISTORY) {
      const gigId = randomUUID();
      const c = COMPANIES.find((x) => x.key === company)!;
      const f = FREELANCERS.find((x) => x.key === freelancer)!;
      run(
        db,
        `INSERT INTO gigs (id, company_id, title, category, description, city, neighbourhood, address_enc, date, start_time, end_time, pay_cents, pay_type, slots, status, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,'filled',?)`,
        gigId, ids[company]!, 'Turno extra na casa', f.categories[0], 'Turno realizado (histórico de demonstração).', c.city, 'Centro',
        vault.encrypt('Endereço fictício do histórico, 100', 'gig.address'), addDays(date, -daysAgo), '19:00', '01:00', f.rate, 'diaria', now - (daysAgo + 7) * 86_400_000,
      );
      const appId = randomUUID();
      run(
        db,
        "INSERT INTO applications (id, gig_id, freelancer_id, status, created_at, decided_at, freelancer_read_at, company_read_at) VALUES (?,?,?,'accepted',?,?,?,?)",
        appId, gigId, ids[freelancer]!, now - (daysAgo + 5) * 86_400_000, now - (daysAgo + 3) * 86_400_000, now, now,
      );
      run(db, 'INSERT INTO reviews (id, application_id, from_user, to_user, stars, created_at) VALUES (?,?,?,?,?,?)', randomUUID(), appId, ids[company]!, ids[freelancer]!, toFreelancer, now - daysAgo * 86_400_000);
      if (toCompany !== null) {
        run(db, 'INSERT INTO reviews (id, application_id, from_user, to_user, stars, created_at) VALUES (?,?,?,?,?,?)', randomUUID(), appId, ids[freelancer]!, ids[company]!, toCompany, now - daysAgo * 86_400_000);
      }
    }

    // Histórico de acesso para que "Quem viu seus dados" já tenha conteúdo na demonstração.
    const seen: [string, string, string, number][] = [
      ['aurora', 'ana', 'profile.view', 3 * 86_400_000],
      ['aurora', 'ana', 'contact.view', 2 * 86_400_000],
      ['praca', 'ana', 'profile.view', 9 * 3_600_000],
      ['selo', 'ana', 'profile.view', 26 * 3_600_000],
    ];
    for (const [actor, target, action, ago] of seen) {
      run(db, 'INSERT INTO audit_log (id, at, actor_id, action, target_user_id) VALUES (?,?,?,?,?)', randomUUID(), now - ago, ids[actor]!, action, ids[target]!);
    }
  });
}
