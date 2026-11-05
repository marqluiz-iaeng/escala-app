> **Cópia do prompt recebido em 04/11/2026, com alteração de escopo.**
> Por decisão do responsável pelo produto, pagamentos pelo app foram removidos. Ignore a seção 4, a Fase 5 e demais menções a pagamento abaixo.
> O que vale está em [PLAN.md](PLAN.md) (seção 2) e em [ADR-0001](adr/0001-sem-pagamentos-no-app.md).

---

# Prompt — Escala: fundação completa (dados, integrações, produto e design)

> Cole este prompt no Claude Code na raiz do projeto, ou salve como `docs/PROMPT_ESCALA.md` e peça: "Execute o plano em docs/PROMPT_ESCALA.md".

---

## 0. Seu papel e como trabalhar

Você vai atuar ao mesmo tempo como:

- **Staff Database Engineer**: modelagem, integridade, performance, segurança e auditoria dos dados.
- **Staff Full-Stack Engineer (iOS/Android + backend)**: app mobile, API, integrações e infraestrutura.
- **Senior Product Manager**: regras de negócio, casos extremos, métricas, riscos legais e operacionais.
- **Senior UX/UI Designer**: fluxos, design system e interface no padrão visual de 2026.

**O que é o Escala:** um marketplace mobile que conecta **empresas contratantes** a **profissionais freelancers** para trabalhos e turnos avulsos. Inclui contratação, pagamento seguro, comunicação direta, suporte e um sistema de reputação nos dois sentidos.

### Regras de execução
1. **Primeiro leia o repositório inteiro** (estrutura, stack, dependências, padrões, `README`, `CLAUDE.md`). Adapte-se ao que já existe; não reescreva o que funciona sem justificar.
2. Antes de codar, entregue um **plano em `docs/PLAN.md`** com: stack escolhida, arquitetura, modelo de dados (diagrama ER em Mermaid), lista de fases e decisões em aberto. **Pare e peça minha aprovação.**
3. Execute **fase por fase** (seção 9). Ao fim de cada fase: rode lint, type-check e testes, faça commit com mensagem convencional (`feat:`, `fix:`, `chore:`) e me mostre um resumo do que foi feito e o que falta.
4. Registre cada decisão técnica relevante em `docs/adr/NNNN-titulo.md` (Architecture Decision Records).
5. **Nunca** coloque segredos no código. Use `.env` + `.env.example` documentado. Se faltar uma credencial, crie o ponto de integração com mock e me avise.
6. Quando houver ambiguidade de produto, escolha a opção mais segura para o usuário, registre a suposição em `docs/ASSUMPTIONS.md` e siga.

---

## 1. Stack recomendada (use se o projeto ainda não tiver uma)

| Camada | Escolha padrão | Motivo |
|---|---|---|
| Mobile | **React Native + Expo (SDK atual) + TypeScript**, Expo Router | Um código para iOS/Android, OTA updates, EAS Build |
| Estado/dados | TanStack Query + Zustand | Cache de servidor + estado local simples |
| Backend | **Node.js + NestJS + TypeScript** (ou Supabase, se já estiver no projeto) | Modular, testável, DI |
| Banco | **PostgreSQL 16+** | Transações, RLS, JSONB, extensões |
| ORM/migrations | Prisma ou Drizzle, com **migrations versionadas** | Schema como código |
| Cache/filas | Redis + BullMQ | Webhooks, notificações, jobs agendados |
| Tempo real | WebSocket (Socket.IO) ou Supabase Realtime | Chat e status de trabalhos |
| Arquivos | S3-compatível com URLs assinadas | Documentos, fotos, anexos |
| Push | Expo Notifications (APNs/FCM) | |
| Observabilidade | Sentry + logs estruturados (pino) + OpenTelemetry | |
| CI/CD | GitHub Actions + EAS | |

Monorepo sugerido: `apps/mobile`, `apps/api`, `packages/ui` (design system), `packages/shared` (tipos, schemas Zod, constantes).

---

## 2. Estrutura de dados (Staff DB Engineer)

### 2.1 Princípios obrigatórios
- **IDs**: UUID v7 (ordenável por tempo) em todas as tabelas; nunca expor IDs sequenciais.
- **Dinheiro**: sempre `bigint` em **centavos** + coluna `currency` (`BRL`). Nunca `float`.
- **Datas**: `timestamptz` em UTC; fuso do usuário só na apresentação.
- **Auditoria**: `created_at`, `updated_at`, `created_by` em todas as tabelas; tabela `audit_logs` (append-only) para ações sensíveis.
- **Soft delete** (`deleted_at`) onde houver valor histórico; exclusão real para atender pedidos da LGPD.
- **Integridade no banco**, não só na aplicação: `FOREIGN KEY`, `CHECK`, `UNIQUE`, `NOT NULL`, enums nativos ou tabelas de domínio.
- **Máquinas de estado** explícitas (status de trabalho, pagamento, disputa) com transições validadas e registradas em tabela de histórico.
- **Índices** pensados por consulta real (busca de vagas por geolocalização, ranking, chat por conversa). Use PostGIS para localização.
- **Ledger financeiro em partidas dobradas** (`ledger_entries` imutável): todo centavo que entra, fica retido, é repassado ou estornado tem lançamento. Saldos são derivados, nunca editados à mão.
- **Idempotência**: tabela `idempotency_keys` para criação de pagamentos e processamento de webhooks.

### 2.2 Segurança de dados
- **Row Level Security (RLS)** no Postgres: cada usuário só lê o que é dele ou de trabalhos em que participa.
- **Criptografia em repouso por coluna** para dados sensíveis (CPF, CNPJ, dados bancários, documentos) com `pgcrypto` ou envelope encryption via KMS. Guarde também um hash para busca/unicidade.
- **Mínimo privilégio**: usuários de banco separados para app, migrations e leitura analítica.
- **Nunca armazenar dados de cartão** (PAN/CVV). Somente tokens/IDs do Pagar.me (escopo PCI DSS reduzido).
- **LGPD**: tabela de consentimentos (`consents` com versão dos termos e data), exportação dos dados do usuário, exclusão/anonimização, política de retenção documentada.
- Backups automáticos com **PITR** e teste de restauração documentado.

### 2.3 Entidades mínimas (detalhe e ajuste no `PLAN.md`)
- `users`, `auth_identities` (provider: google/apple/linkedin/email), `sessions`, `devices`
- `companies`, `company_members` (papéis: owner, admin, recrutador), `company_verifications`
- `freelancer_profiles`, `skills`, `freelancer_skills`, `portfolio_items`, `documents`, `kyc_verifications`, `availability_slots`
- `jobs` (vaga/turno), `job_requirements`, `applications`, `contracts` (aceite com termos versionados), `shifts`, `check_ins` (geolocalização + horário)
- `payments`, `payment_splits`, `payouts`, `refunds`, `ledger_entries`, `payment_webhook_events`, `recipients` (recebedores Pagar.me)
- `conversations`, `conversation_participants`, `messages`, `message_attachments`, `message_reports`
- `support_tickets`, `ticket_messages`, `disputes`, `dispute_evidences`
- `reviews`, `review_criteria_scores`, `review_replies`, `reputation_snapshots`, `badges`, `user_badges`, `penalties`
- `notifications`, `notification_preferences`
- `consents`, `audit_logs`, `idempotency_keys`, `feature_flags`

Entregue: migrations, seeds realistas para desenvolvimento, diagrama ER em Mermaid e `docs/DATA_DICTIONARY.md`.

---

## 3. Autenticação

- **Login social**: Google (OAuth 2.0/OIDC), **Sign in with Apple** e **LinkedIn (OpenID Connect)**, além de e-mail + código (magic link/OTP) como alternativa.
  - Atenção: a App Store **exige Sign in with Apple** quando o app oferece outros logins sociais. Trate o caso de e-mail oculto da Apple ("Hide My Email").
  - Use fluxo **PKCE**; valide o `id_token` no backend (assinatura, `aud`, `iss`, `exp`, `nonce`).
  - Permita **vincular várias identidades** à mesma conta sem duplicar usuários.
- **Tokens**: access token curto (15 min) + refresh token rotativo com detecção de reuso; armazenar no **SecureStore/Keychain/Keystore**, nunca em AsyncStorage.
- **Biometria** (Face ID / digital) para reabrir o app e para confirmar pagamentos.
- **Papéis e permissões (RBAC)**: freelancer, membro de empresa (com subpapéis), suporte, admin. Autorização checada no backend em todo endpoint.
- **Proteções**: rate limiting por IP e por usuário, bloqueio progressivo, alerta de novo dispositivo, 2FA opcional (obrigatório para admins e donos de empresa).
- **Onboarding com verificação**: CPF para freelancer, CNPJ para empresa (consulta de validade), selfie + documento (KYC) antes de receber pagamentos.

---

## 4. Pagamentos com Pagar.me (ambiente seguro)

Use a **API v5 do Pagar.me** com o modelo de marketplace:

- **Recebedores (recipients)**: cada freelancer verificado vira um recebedor com conta bancária validada.
- **Métodos**: Pix (prioritário no Brasil), cartão de crédito (tokenizado no client com a lib/checkout do Pagar.me) e boleto para empresas.
- **Fluxo de custódia**: a empresa paga ao confirmar a contratação → valor fica **retido** → liberado ao freelancer após conclusão confirmada (ou automaticamente após X horas sem contestação) → **split** automático entre freelancer e taxa da plataforma.
- **Webhooks**: endpoint dedicado, validação de assinatura/autenticação, **processamento idempotente** via fila, armazenamento do evento bruto, reprocessamento seguro e reconciliação diária com a API.
- **Estornos e disputas**: reembolso total/parcial, chargeback, congelamento do repasse enquanto houver disputa aberta.
- **Nota fiscal e taxas**: deixe a taxa da plataforma configurável por feature flag/tabela; preveja integração futura com emissão de NFS-e.
- **Segurança**: chaves somente no backend, segregação sandbox/produção, logs sem dados sensíveis, antifraude do Pagar.me ativado, limites de valor por conta nova.
- Tudo testável em **sandbox** com testes automatizados do fluxo completo (pagar → reter → liberar → split → estornar).

---

## 5. Funcionalidades de produto (visão de PM)

### 5.1 Comunicação direta empresa ↔ freelancer
- Chat em tempo real por contrato/candidatura: texto, imagens, arquivos, áudio curto, status de entrega e leitura, digitando.
- **Anti-desintermediação**: detectar e alertar sobre troca de telefone/e-mail/links de pagamento externo antes do contrato fechado; explicar que pagamentos fora do app perdem proteção.
- Moderação: denúncia de mensagem, bloqueio de usuário, filtro de conteúdo ofensivo, retenção para auditoria em disputas.
- Mensagens automáticas do sistema no chat (contrato aceito, check-in feito, pagamento liberado).
- Push com preferências por tipo e horário de silêncio.

### 5.2 Suporte dentro do app
- Central de ajuda com FAQ pesquisável.
- Abertura de ticket por categoria (pagamento, conta, segurança, disputa), com anexos e vínculo ao trabalho em questão.
- **Fluxo de disputa** com prazos: abertura → evidências das duas partes → análise → decisão → execução financeira (liberar, estornar total ou parcial).
- SLA por prioridade, status visível para o usuário e avaliação do atendimento.
- Painel interno (web simples) para o time de suporte e moderação, com trilha de auditoria.
- Botão de **emergência/segurança** em trabalhos presenciais.

### 5.3 Perfis interativos e ranqueados
- **Freelancer**: foto, bio, habilidades com nível, portfólio, disponibilidade, raio de atuação, selos de verificação, estatísticas (trabalhos concluídos, taxa de comparecimento, pontualidade, tempo de resposta).
- **Empresa**: logo, descrição, local, selos (CNPJ verificado, pagadora rápida), estatísticas (pagamentos em dia, cancelamentos, taxa de recontratação).
- **Ranking e busca**: ordenação por relevância combinando reputação, proximidade, habilidade e disponibilidade; filtros; favoritos e "recontratar".
- Gamificação discreta: níveis e selos por mérito real (ex.: "100% pontual em 20 trabalhos"), nunca comprados.

### 5.4 Avaliações e reputação
- **Avaliação nos dois sentidos**: empresa avalia o freelancer após o trabalho; freelancer avalia a empresa após o serviço.
- **Só quem concluiu um contrato pago pode avaliar** (evita fraude).
- **Revelação dupla-cega**: as notas só aparecem quando ambos avaliam ou quando a janela de 7 dias fecha (evita retaliação).
- Critérios por tipo de usuário (ex.: freelancer — pontualidade, qualidade, comunicação, postura; empresa — clareza da vaga, ambiente, pagamento em dia, respeito) + comentário opcional.
- **Direito de resposta** pública a cada avaliação.
- **Cálculo de reputação**: média bayesiana (não deixa 1 avaliação 5★ superar 50 avaliações 4,8★), peso maior para avaliações recentes, mínimo de avaliações para exibir nota, snapshot periódico em `reputation_snapshots`.
- **Regras de reputação e penalidades** (configuráveis): faltas sem aviso, cancelamentos em cima da hora, atraso no pagamento → perda de pontos, suspensão temporária, ou banimento com direito a recurso. Documentar tudo em `docs/REPUTATION_RULES.md`.
- Moderação de avaliações (ofensas, dados pessoais) e contestação via suporte.

### 5.5 Pontos que um PM experiente não pode esquecer
- **Risco trabalhista**: evitar características de vínculo empregatício (subordinação, habitualidade). Termos de uso claros e revisão jurídica sinalizada em `docs/LEGAL_TODO.md`.
- Cancelamentos e no-show dos dois lados com política de compensação.
- Check-in/check-out por geolocalização com tolerância e contestação.
- Acessibilidade (WCAG 2.2 AA), modo offline básico, conexões ruins.
- **Métricas** (eventos de analytics definidos em `docs/METRICS.md`): ativação, tempo até a primeira contratação, taxa de preenchimento de vagas, recontratação, NPS, GMV, take rate, taxa de disputas.
- Feature flags para lançamentos graduais; deep links; versão mínima forçada do app.
- Termos de uso, política de privacidade e textos de consentimento versionados.

---

## 6. Design e UX (tendências 2026)

- **Linguagem visual**: alinhada às plataformas atuais — materiais translúcidos/vidro (estilo Liquid Glass do iOS) e Material 3 Expressive no Android — sem perder legibilidade e contraste.
- **Design system próprio** em `packages/ui`: tokens (cores, tipografia, espaçamento, raios, sombras, motion), modo claro/escuro, componentes documentados.
- **Layout**: bento grids para dashboards, cartões grandes e escaneáveis, hierarquia tipográfica forte (tipografia variável), muito espaço em branco.
- **Microinterações e motion** com propósito (feedback de ação, transições contínuas, haptics), respeitando "reduzir movimento".
- **Fluxos de poucos toques**: candidatar-se em 1 toque, pagar com Pix/biometria, avaliar em segundos.
- **Confiança visível**: selos de verificação, indicação de "pagamento protegido", status claros de cada etapa.
- **Estados completos** em toda tela: carregando (skeleton), vazio (com ação sugerida), erro (com recuperação), sucesso.
- Ilustrações e ícones consistentes; personalização por papel (o app muda de ênfase para empresa ou freelancer).
- Entregue os fluxos principais em `docs/UX_FLOWS.md` (Mermaid) antes das telas: onboarding, publicar vaga, candidatura, contratação+pagamento, execução (check-in), conclusão+avaliação, disputa, suporte.

---

## 7. Segurança da aplicação (transversal)

- Seguir **OWASP ASVS** e **OWASP Mobile Top 10**.
- Validação de toda entrada com schemas (Zod) compartilhados entre app e API.
- HTTPS/TLS 1.2+ obrigatório, headers de segurança, CORS restrito.
- Upload: validação de tipo/tamanho, varredura de malware, URLs assinadas e expiráveis.
- Detecção de root/jailbreak e ofuscação no build de produção.
- Dependências verificadas no CI (audit/Dependabot), secret scanning.
- Logs sem PII; mascaramento de CPF, e-mail e telefone.
- Documentar o modelo de ameaças em `docs/SECURITY.md`.

---

## 8. Qualidade e testes

- Testes unitários (regras de reputação, ledger, máquinas de estado), integração (API + banco real em container), E2E mobile (Maestro ou Detox) para os fluxos críticos.
- Testes de **autorização**: garantir que um usuário não acessa dados de outro (inclusive via RLS).
- Cobertura mínima de 80% nos módulos de pagamento, ledger, auth e reputação.
- Documentação da API em OpenAPI gerada automaticamente.

---

## 9. Fases de execução

| Fase | Entrega | Critério de pronto |
|---|---|---|
| 0 | Leitura do repo + `docs/PLAN.md` + ER + ADRs iniciais | **Aguardar minha aprovação** |
| 1 | Monorepo, CI, lint, ambientes, `.env.example` | CI verde |
| 2 | Banco: migrations, RLS, criptografia, seeds, dicionário de dados | Migrations sobem e descem; testes de RLS passam |
| 3 | Autenticação (Google, Apple, LinkedIn, OTP), RBAC, onboarding e KYC | Login nos 3 provedores em dev |
| 4 | Perfis, vagas, busca, candidatura e contratos | Fluxo publicar → contratar ponta a ponta |
| 5 | Pagar.me: recebedores, cobrança, custódia, split, webhooks, estorno, ledger | Fluxo completo em sandbox com testes |
| 6 | Chat em tempo real, notificações push, moderação | Mensagens em tempo real entre 2 dispositivos |
| 7 | Avaliações, reputação, ranking, penalidades | Testes das regras de reputação passando |
| 8 | Suporte, disputas, painel interno | Disputa resolvida movimenta o ledger corretamente |
| 9 | Design system aplicado em todas as telas, acessibilidade, polimento | Revisão de todos os estados de tela |
| 10 | Hardening de segurança, observabilidade, build de produção (EAS) | Checklist de `docs/SECURITY.md` completo |

Comece agora pela **Fase 0**.
