# Dicionário de dados

> Gerado a partir do banco por `pnpm --filter @escala/api db:dictionary`. Não edite à mão. Um teste falha se este arquivo ficar desatualizado.

São 62 tabelas. Todas têm `FORCE ROW LEVEL SECURITY`. Colunas `_enc` guardam dados cifrados na aplicação, e colunas `_index` guardam um HMAC para busca exata ([ADR-0006](adr/0006-criptografia-por-campo.md)).

## Tabelas

### application_status_history

Histórico de status da candidatura. Somente inclusão.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `application_id` | `uuid` | Sim |  |  |
| `from_status` | `application_status` | Não |  |  |
| `to_status` | `application_status` | Sim |  |  |
| `actor_user_id` | `uuid` | Não |  |  |
| `reason` | `text` | Não |  |  |
| `occurred_at` | `timestamp with time zone` | Sim, com padrão |  |  |

### applications

Candidatura ou convite. Quem retira a candidatura some para a empresa.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `job_id` | `uuid` | Sim |  |  |
| `freelancer_id` | `uuid` | Sim |  |  |
| `origin` | `application_origin` | Sim |  |  |
| `status` | `application_status` | Sim |  |  |
| `note_enc` | `text` | Não | Pessoal, cifrado | Mensagem inicial cifrada, com contatos mascarados. |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### audit_logs

Trilha de ações sensíveis. Somente inclusão. Só o que passou de 6 meses pode ser apagado (Marco Civil, art. 15).

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `actor_user_id` | `uuid` | Não |  |  |
| `target_user_id` | `uuid` | Não |  |  |
| `action` | `text` | Sim |  |  |
| `entity_type` | `text` | Não |  |  |
| `entity_id` | `uuid` | Não |  |  |
| `ip_enc` | `text` | Não | Pessoal, cifrado | Endereço IP cifrado. |
| `request_id` | `uuid` | Não |  |  |
| `occurred_at` | `timestamp with time zone` | Sim, com padrão |  |  |

### auth_identities

Formas de entrar em uma conta. Uma pessoa pode ter várias. Pessoal.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `user_id` | `uuid` | Sim |  |  |
| `provider` | `auth_provider` | Sim |  |  |
| `provider_subject` | `text` | Sim |  | HMAC do identificador do provedor. |
| `email_enc` | `text` | Não | Pessoal, cifrado | E-mail informado pelo provedor, cifrado. |
| `email_verified` | `boolean` | Sim, com padrão |  |  |
| `is_private_relay` | `boolean` | Sim, com padrão |  | Verdadeiro para o Hide My Email da Apple. |
| `apple_refresh_token_enc` | `text` | Não | Pessoal, cifrado | Token da Apple, só para revogar o acesso quando a conta é excluída. |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### availability_slots

Horários em que o freelancer diz estar disponível. É informação dele, nunca uma escala imposta.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `freelancer_id` | `uuid` | Sim |  |  |
| `starts_at` | `timestamp with time zone` | Sim |  |  |
| `ends_at` | `timestamp with time zone` | Sim |  |  |
| `recurrence_rule` | `text` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### badges

Selos concedidos por mérito, nunca comprados.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `slug` | `text` | Sim |  |  |
| `name` | `text` | Sim |  |  |
| `criteria` | `jsonb` | Sim, com padrão |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### check_ins

Chegada e saída de um turno. Nunca há rastreamento contínuo.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `shift_id` | `uuid` | Sim |  |  |
| `kind` | `check_in_kind` | Sim |  |  |
| `occurred_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `location` | `geography(Point,4326)` | Não | Localização | Local no momento do registro. Apagado 90 dias depois do turno, salvo disputa aberta. |
| `accuracy_m` | `integer` | Não |  |  |
| `within_geofence` | `boolean` | Sim, com padrão |  | Calculado pelo banco a partir do local do turno. O app não informa este valor. |
| `source` | `check_in_source` | Sim, com padrão |  |  |
| `contested` | `boolean` | Sim, com padrão |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### companies

Perfil público da empresa. Dados internos ficam em company_private_details.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `trade_name` | `text` | Sim |  |  |
| `segment` | `company_segment` | Sim |  |  |
| `about` | `text` | Sim, com padrão |  |  |
| `logo_file_id` | `uuid` | Não |  |  |
| `city` | `text` | Não |  |  |
| `public_location` | `geography(Point,4326)` | Não | Aproximado | Localização aproximada, pública. |
| `status` | `company_status` | Sim, com padrão |  |  |
| `verified_at` | `timestamp with time zone` | Não |  |  |
| `deleted_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### company_members

Quem atua pela empresa e com qual papel.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `company_id` | `uuid` | Sim |  |  |
| `user_id` | `uuid` | Sim |  |  |
| `role` | `company_member_role` | Sim |  |  |
| `invited_by` | `uuid` | Não |  |  |
| `accepted_at` | `timestamp with time zone` | Não |  | Sem aceite, o convite ainda não dá acesso. |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### company_private_details

Dados internos da empresa. Só os membros leem.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `company_id` | `uuid` | Sim |  |  |
| `legal_name_enc` | `text` | Não | Pessoal, cifrado | Razão social cifrada. |
| `cnpj_index` | `text` | Não | Índice cego | HMAC do CNPJ, para unicidade. |
| `cnpj_enc` | `text` | Não | Pessoal, cifrado | CNPJ cifrado. MEI pode revelar a pessoa física. |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### company_verifications

Histórico das consultas que sustentam o selo de empresa verificada.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `company_id` | `uuid` | Sim |  |  |
| `method` | `verification_method` | Sim |  |  |
| `status` | `verification_status` | Sim, com padrão |  |  |
| `provider_ref` | `text` | Não |  |  |
| `checked_at` | `timestamp with time zone` | Não |  |  |
| `expires_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### consents

Comprovante de cada decisão do titular. Somente inclusão (LGPD, art. 8º, § 2º).

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `user_id` | `uuid` | Sim |  |  |
| `purpose` | `text` | Sim |  |  |
| `document_id` | `uuid` | Não |  |  |
| `granted` | `boolean` | Sim |  |  |
| `occurred_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### contract_status_history

Histórico de status do contrato. Somente inclusão.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `contract_id` | `uuid` | Sim |  |  |
| `from_status` | `contract_status` | Não |  |  |
| `to_status` | `contract_status` | Sim |  |  |
| `actor_user_id` | `uuid` | Não |  |  |
| `reason` | `text` | Não |  |  |
| `occurred_at` | `timestamp with time zone` | Sim, com padrão |  |  |

### contracts

Registro do que foi combinado. O Escala não processa nem garante o pagamento.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `application_id` | `uuid` | Sim |  |  |
| `job_id` | `uuid` | Sim |  |  |
| `company_id` | `uuid` | Sim |  |  |
| `freelancer_id` | `uuid` | Sim |  |  |
| `company_contact_user_id` | `uuid` | Sim |  | Quem responde pela empresa neste contrato. |
| `terms_document_id` | `uuid` | Sim |  |  |
| `agreed_amount_cents` | `money_cents` | Sim |  | Valor combinado, só registro. Nada é cobrado pelo app. |
| `currency` | `currency_code` | Sim |  |  |
| `pay_unit` | `pay_unit` | Sim |  |  |
| `status` | `contract_status` | Sim, com padrão |  |  |
| `cancelled_by` | `contract_party` | Não |  |  |
| `no_show_party` | `contract_party` | Não |  |  |
| `accepted_at` | `timestamp with time zone` | Não |  |  |
| `contact_visible_until` | `timestamp with time zone` | Não |  | Fim da liberação do contato: 30 dias depois do último turno. |
| `payment_due_on` | `date` | Não |  |  |
| `company_marked_paid_at` | `timestamp with time zone` | Não |  | Declaração da empresa de que pagou fora do app. |
| `freelancer_confirmed_paid_at` | `timestamp with time zone` | Não |  | Confirmação do freelancer. É o que conta para "pagamentos em dia". |
| `company_confirmed_at` | `timestamp with time zone` | Não |  |  |
| `freelancer_confirmed_at` | `timestamp with time zone` | Não |  |  |
| `completed_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### conversation_participants

Quem participa da conversa e até onde recebeu e leu.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `conversation_id` | `uuid` | Sim |  |  |
| `user_id` | `uuid` | Sim |  |  |
| `last_delivered_message_id` | `uuid` | Não |  |  |
| `last_read_message_id` | `uuid` | Não |  |  |
| `muted_until` | `timestamp with time zone` | Não |  |  |
| `left_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### conversations

Conversa ligada a uma candidatura e a um eventual contrato.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `application_id` | `uuid` | Sim |  |  |
| `status` | `conversation_status` | Sim, com padrão |  |  |
| `last_message_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### data_requests

Pedidos de exportação e exclusão (LGPD, art. 18).

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `user_id` | `uuid` | Sim |  |  |
| `kind` | `data_request_kind` | Sim |  |  |
| `status` | `data_request_status` | Sim, com padrão |  |  |
| `file_id` | `uuid` | Não |  |  |
| `completed_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### devices

Aparelhos da pessoa. Só etiqueta genérica, sem identificador de hardware.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `user_id` | `uuid` | Sim |  |  |
| `platform` | `device_platform` | Sim |  |  |
| `label` | `text` | Sim |  |  |
| `push_token_enc` | `text` | Não | Pessoal, cifrado | Token de push cifrado. |
| `app_version` | `text` | Não |  |  |
| `last_seen_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### dispute_evidences

Evidências de cada parte. Só quem enviou e o suporte veem.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `dispute_id` | `uuid` | Sim |  |  |
| `submitted_by` | `uuid` | Sim |  |  |
| `file_id` | `uuid` | Não |  |  |
| `note_enc` | `text` | Não | Pessoal, cifrado | Relato cifrado. |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### dispute_status_history

Histórico de status da disputa. Somente inclusão.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `dispute_id` | `uuid` | Sim |  |  |
| `from_status` | `dispute_status` | Não |  |  |
| `to_status` | `dispute_status` | Sim |  |  |
| `actor_user_id` | `uuid` | Não |  |  |
| `reason` | `text` | Não |  |  |
| `occurred_at` | `timestamp with time zone` | Sim, com padrão |  |  |

### disputes

Contestação de um contrato. A decisão afeta o contrato e a reputação, nunca dinheiro.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `contract_id` | `uuid` | Sim |  |  |
| `ticket_id` | `uuid` | Não |  |  |
| `opened_by` | `uuid` | Sim |  |  |
| `reason` | `dispute_reason` | Sim |  |  |
| `status` | `dispute_status` | Sim, com padrão |  |  |
| `evidence_due_at` | `timestamp with time zone` | Não |  |  |
| `decision` | `dispute_decision` | Não |  |  |
| `decision_notes` | `text` | Não |  |  |
| `decided_by` | `uuid` | Não |  |  |
| `applied_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### documents

Documentos enviados pela pessoa. Só ela e o suporte acessam.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `user_id` | `uuid` | Sim |  |  |
| `kind` | `document_kind` | Sim |  |  |
| `file_id` | `uuid` | Sim |  |  |
| `status` | `document_status` | Sim, com padrão |  |  |
| `expires_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### favorites

Freelancers salvos por uma empresa para recontratar.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `company_id` | `uuid` | Sim |  |  |
| `freelancer_id` | `uuid` | Sim |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### feature_flags

Ativa recursos aos poucos. Sem dados pessoais.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `key` | `text` | Sim |  |  |
| `enabled` | `boolean` | Sim, com padrão |  |  |
| `rules` | `jsonb` | Sim, com padrão |  |  |
| `updated_by` | `uuid` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |

### files

Arquivos enviados. Só são liberados com scan_status = clean e por URL assinada.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `owner_user_id` | `uuid` | Sim |  |  |
| `storage_key` | `text` | Sim |  | Caminho no armazenamento. Sem nome original nem dado pessoal. |
| `mime_type` | `text` | Sim |  |  |
| `size_bytes` | `bigint` | Sim |  |  |
| `sha256` | `text` | Sim | Hash |  |
| `scan_status` | `file_scan_status` | Sim, com padrão |  |  |
| `deleted_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### freelancer_profiles

Perfil profissional. Empresas veem se houver candidatura ativa ou se discoverable estiver ligado.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `user_id` | `uuid` | Sim |  |  |
| `display_name` | `text` | Sim |  | Nome abreviado, como "Ana M.". O nome legal fica em users. |
| `photo_file_id` | `uuid` | Não |  | Foto opcional. Empresas só acessam o arquivo depois da pré-seleção. |
| `bio` | `text` | Sim, com padrão |  |  |
| `experience_years` | `integer` | Sim, com padrão |  |  |
| `reference_rate_cents` | `money_cents` | Não |  |  |
| `currency` | `currency_code` | Sim |  |  |
| `base_location` | `geography(Point,4326)` | Não | Aproximado | Localização aproximada, nunca o endereço de casa. |
| `service_radius_km` | `integer` | Sim, com padrão |  |  |
| `available_now` | `boolean` | Sim, com padrão |  |  |
| `discoverable` | `boolean` | Sim, com padrão |  | Consentimento para aparecer nas buscas. Começa desligado. |
| `status` | `profile_status` | Sim, com padrão |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### freelancer_skills

Habilidades de cada freelancer, com nível.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `freelancer_id` | `uuid` | Sim |  |  |
| `skill_id` | `uuid` | Sim |  |  |
| `level` | `skill_level` | Sim, com padrão |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### help_articles

Central de ajuda pesquisável.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `slug` | `text` | Sim |  |  |
| `title` | `text` | Sim |  |  |
| `body` | `text` | Sim |  |  |
| `search_vector` | `tsvector` | Não |  |  |
| `published_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### idempotency_keys

Evita repetir uma ação quando a conexão ruim faz o app reenviar o pedido.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `scope` | `text` | Sim |  |  |
| `key` | `text` | Sim |  |  |
| `user_id` | `uuid` | Não |  |  |
| `request_sha256` | `text` | Sim | Hash |  |
| `response_enc` | `text` | Não | Pessoal, cifrado | Resposta original cifrada, devolvida na repetição. |
| `expires_at` | `timestamp with time zone` | Sim |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |

### job_private_details

Endereço e local exatos. Só a empresa e quem tem contrato vigente leem.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `job_id` | `uuid` | Sim |  |  |
| `address_enc` | `text` | Não | Pessoal, cifrado | Endereço cifrado. Pode ser a casa de alguém, em festas. |
| `site_location` | `geography(Point,4326)` | Não | Localização | Local exato, usado só na geocerca do check-in. |
| `checkin_radius_m` | `integer` | Sim, com padrão |  |  |
| `access_notes_enc` | `text` | Não | Pessoal, cifrado | Instruções de acesso cifradas. |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### job_requirements

Requisitos da vaga.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `job_id` | `uuid` | Sim |  |  |
| `skill_id` | `uuid` | Sim |  |  |
| `min_level` | `skill_level` | Não |  |  |
| `note` | `text` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### job_status_history

Histórico de status da vaga. Somente inclusão.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `job_id` | `uuid` | Sim |  |  |
| `from_status` | `job_status` | Não |  |  |
| `to_status` | `job_status` | Sim |  |  |
| `actor_user_id` | `uuid` | Não |  |  |
| `reason` | `text` | Não |  |  |
| `occurred_at` | `timestamp with time zone` | Sim, com padrão |  |  |

### jobs

Vaga ou turno publicado. Público para quem está logado. O endereço fica em job_private_details.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `company_id` | `uuid` | Sim |  |  |
| `title` | `text` | Sim |  |  |
| `description` | `text` | Sim |  |  |
| `primary_skill_id` | `uuid` | Sim |  |  |
| `city` | `text` | Sim |  |  |
| `neighbourhood` | `text` | Sim |  |  |
| `public_location` | `geography(Point,4326)` | Sim | Aproximado | Localização aproximada do bairro, nunca o endereço exato. |
| `starts_at` | `timestamp with time zone` | Sim |  |  |
| `ends_at` | `timestamp with time zone` | Sim |  |  |
| `slots` | `integer` | Sim, com padrão |  |  |
| `pay_amount_cents` | `money_cents` | Sim |  | Valor oferecido, informativo. O app não cobra nem repassa dinheiro. |
| `currency` | `currency_code` | Sim |  |  |
| `pay_unit` | `pay_unit` | Sim |  |  |
| `status` | `job_status` | Sim, com padrão |  |  |
| `deleted_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### kyc_verifications

Resultado das verificações. Selfie e documento ficam no provedor, nunca aqui.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `user_id` | `uuid` | Sim |  |  |
| `kind` | `kyc_kind` | Sim |  |  |
| `provider` | `text` | Sim |  |  |
| `provider_ref` | `text` | Não |  | Referência no provedor, sem imagem nem dado biométrico. |
| `status` | `verification_status` | Sim, com padrão |  |  |
| `checked_at` | `timestamp with time zone` | Não |  |  |
| `expires_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### legal_documents

Versões de termos, política e modelo de contrato. O hash prova o texto aceito.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `kind` | `legal_document_kind` | Sim |  |  |
| `version` | `text` | Sim |  |  |
| `content_sha256` | `text` | Sim | Hash |  |
| `published_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### message_attachments

Imagens, arquivos e áudios curtos enviados no chat.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `message_id` | `uuid` | Sim |  |  |
| `file_id` | `uuid` | Sim |  |  |
| `duration_seconds` | `integer` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### message_reports

Denúncias de mensagens.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `message_id` | `uuid` | Sim |  |  |
| `reporter_user_id` | `uuid` | Sim |  |  |
| `reason` | `report_reason` | Sim |  |  |
| `status` | `report_status` | Sim, com padrão |  |  |
| `resolved_by` | `uuid` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### messages

Mensagens da conversa. O UUID v7 mantém a ordem de envio.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `conversation_id` | `uuid` | Sim |  |  |
| `sender_user_id` | `uuid` | Não |  |  |
| `kind` | `message_kind` | Sim, com padrão |  |  |
| `body_enc` | `text` | Não | Pessoal, cifrado | Texto cifrado, nulo quando removido. Contatos são mascarados antes do contrato. |
| `contact_masked` | `boolean` | Sim, com padrão |  | Verdadeiro se o servidor ocultou um contato nesta mensagem. |
| `status` | `message_status` | Sim, com padrão |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### mfa_factors

Segundo fator: TOTP e códigos de recuperação.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `user_id` | `uuid` | Sim |  |  |
| `kind` | `mfa_kind` | Sim |  |  |
| `secret_enc` | `text` | Sim | Pessoal, cifrado | Segredo TOTP cifrado ou hash do código de recuperação. |
| `verified_at` | `timestamp with time zone` | Não |  |  |
| `last_used_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### notification_preferences

Preferências por tipo de aviso e horário de silêncio.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `user_id` | `uuid` | Sim |  |  |
| `type` | `text` | Sim |  |  |
| `channel` | `notification_channel` | Sim |  |  |
| `enabled` | `boolean` | Sim, com padrão |  |  |
| `quiet_start` | `time without time zone` | Não |  |  |
| `quiet_end` | `time without time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### notifications

Avisos do app. Sem dados sensíveis no conteúdo.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `user_id` | `uuid` | Sim |  |  |
| `type` | `text` | Sim |  |  |
| `payload` | `jsonb` | Sim, com padrão |  | Só identificadores e tipo. O conteúdo é buscado no app, com autorização. |
| `sent_at` | `timestamp with time zone` | Não |  |  |
| `read_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### otp_codes

Códigos de uso único por e-mail. Apagados ao expirar.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `purpose` | `otp_purpose` | Sim |  |  |
| `subject` | `text` | Sim |  | A quem o código pertence: HMAC do e-mail ou ID do usuário. |
| `code_hash` | `text` | Sim | Hash | HMAC com chave, amarrado à finalidade e ao titular. |
| `payload_enc` | `text` | Não | Pessoal, cifrado | Dados do pedido, como o novo e-mail, cifrados. |
| `attempts` | `integer` | Sim, com padrão |  |  |
| `expires_at` | `timestamp with time zone` | Sim |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |

### penalties

Penalidades aplicadas, sempre com direito a recurso.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `rule_id` | `uuid` | Sim |  |  |
| `subject_user_id` | `uuid` | Não |  |  |
| `subject_company_id` | `uuid` | Não |  |  |
| `contract_id` | `uuid` | Não |  |  |
| `status` | `penalty_status` | Sim, com padrão |  |  |
| `starts_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `ends_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### penalty_appeals

Recursos contra penalidades.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `penalty_id` | `uuid` | Sim |  |  |
| `submitted_by` | `uuid` | Sim |  |  |
| `body` | `text` | Sim |  |  |
| `status` | `appeal_status` | Sim, com padrão |  |  |
| `decided_by` | `uuid` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### portfolio_items

Trabalhos mostrados no perfil.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `freelancer_id` | `uuid` | Sim |  |  |
| `title` | `text` | Sim |  |  |
| `file_id` | `uuid` | Não |  |  |
| `external_url` | `text` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### refresh_tokens

Tokens de renovação, só como hash. Reutilizar um token já usado revoga a sessão.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `session_id` | `uuid` | Sim |  |  |
| `token_hash` | `text` | Sim | Hash |  |
| `used_at` | `timestamp with time zone` | Não |  | Preenchido na rotação. Uso posterior indica roubo. |
| `expires_at` | `timestamp with time zone` | Sim |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### reputation_rules

Regras configuráveis de reputação. Recusar vaga nunca gera penalidade.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `code` | `text` | Sim |  |  |
| `points` | `integer` | Sim, com padrão |  |  |
| `suspension_days` | `integer` | Sim, com padrão |  |  |
| `active` | `boolean` | Sim, com padrão |  |  |
| `version` | `integer` | Sim, com padrão |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### reputation_snapshots

Reputação calculada periodicamente, com média bayesiana.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `subject_user_id` | `uuid` | Não |  |  |
| `subject_company_id` | `uuid` | Não |  |  |
| `bayesian_score` | `numeric(4,3)` | Não |  |  |
| `review_count` | `integer` | Sim, com padrão |  |  |
| `metrics` | `jsonb` | Sim, com padrão |  |  |
| `computed_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### review_criteria_scores

Nota de 1 a 5 por critério.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `review_id` | `uuid` | Sim |  |  |
| `criterion` | `review_criterion` | Sim |  |  |
| `score` | `smallint` | Sim |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### review_replies

Direito de resposta a uma avaliação.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `review_id` | `uuid` | Sim |  |  |
| `author_user_id` | `uuid` | Sim |  |  |
| `body` | `text` | Sim |  |  |
| `status` | `reply_status` | Sim, com padrão |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### reviews

Avaliação de um contrato concluído. Dupla-cega até as duas partes avaliarem ou a janela de 7 dias fechar.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `contract_id` | `uuid` | Sim |  |  |
| `reviewer_user_id` | `uuid` | Sim |  |  |
| `reviewer_side` | `review_side` | Sim |  |  |
| `subject_user_id` | `uuid` | Não |  | Quem foi avaliado, definido pelo banco a partir do contrato. |
| `subject_company_id` | `uuid` | Não |  |  |
| `comment` | `text` | Não |  | Comentário opcional e público depois de revelado. Passa por moderação. |
| `status` | `review_status` | Sim, com padrão |  |  |
| `revealed_at` | `timestamp with time zone` | Não |  | Enquanto for nulo, só quem avaliou lê a avaliação. |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### safety_alerts

Acionamentos do botão de emergência.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `user_id` | `uuid` | Sim |  |  |
| `shift_id` | `uuid` | Não |  |  |
| `location` | `geography(Point,4326)` | Não | Localização | Enviada só quando a pessoa toca no botão. |
| `status` | `safety_alert_status` | Sim, com padrão |  |  |
| `handled_by` | `uuid` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### sessions

Sessões abertas. Podem ser revogadas pelo titular.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `user_id` | `uuid` | Sim |  |  |
| `device_id` | `uuid` | Não |  |  |
| `expires_at` | `timestamp with time zone` | Sim |  |  |
| `revoked_at` | `timestamp with time zone` | Não |  |  |
| `revoked_reason` | `text` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### shift_status_history

Histórico de status do turno. Somente inclusão.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `shift_id` | `uuid` | Sim |  |  |
| `from_status` | `shift_status` | Não |  |  |
| `to_status` | `shift_status` | Sim |  |  |
| `actor_user_id` | `uuid` | Não |  |  |
| `reason` | `text` | Não |  |  |
| `occurred_at` | `timestamp with time zone` | Sim, com padrão |  |  |

### shifts

Turnos de um contrato.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `contract_id` | `uuid` | Sim |  |  |
| `starts_at` | `timestamp with time zone` | Sim |  |  |
| `ends_at` | `timestamp with time zone` | Sim |  |  |
| `status` | `shift_status` | Sim, com padrão |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### skills

Catálogo de funções e habilidades.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `slug` | `text` | Sim |  |  |
| `name` | `text` | Sim |  |  |
| `category` | `text` | Sim |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### support_tickets

Chamados de suporte.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `requester_user_id` | `uuid` | Sim |  |  |
| `contract_id` | `uuid` | Não |  |  |
| `category` | `ticket_category` | Sim |  |  |
| `priority` | `ticket_priority` | Sim, com padrão |  |  |
| `status` | `ticket_status` | Sim, com padrão |  |  |
| `assignee_user_id` | `uuid` | Não |  |  |
| `sla_due_at` | `timestamp with time zone` | Não |  |  |
| `satisfaction_score` | `smallint` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### ticket_messages

Mensagens do chamado. Notas internas nunca aparecem para quem abriu.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `ticket_id` | `uuid` | Sim |  |  |
| `author_user_id` | `uuid` | Não |  |  |
| `body_enc` | `text` | Não | Pessoal, cifrado | Texto cifrado. |
| `file_id` | `uuid` | Não |  |  |
| `internal_note` | `boolean` | Sim, com padrão |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### ticket_status_history

Histórico de status do chamado. Somente inclusão.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `ticket_id` | `uuid` | Sim |  |  |
| `from_status` | `ticket_status` | Não |  |  |
| `to_status` | `ticket_status` | Sim |  |  |
| `actor_user_id` | `uuid` | Não |  |  |
| `reason` | `text` | Não |  |  |
| `occurred_at` | `timestamp with time zone` | Sim, com padrão |  |  |

### user_badges

Selos de cada pessoa ou empresa.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `badge_id` | `uuid` | Sim |  |  |
| `subject_user_id` | `uuid` | Não |  |  |
| `subject_company_id` | `uuid` | Não |  |  |
| `awarded_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `revoked_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### user_blocks

Bloqueios entre pessoas. Impede novas mensagens nos dois sentidos.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `blocker_user_id` | `uuid` | Sim |  |  |
| `blocked_user_id` | `uuid` | Sim |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

### users

Conta de uma pessoa. Só o próprio titular lê a linha. Pessoal e cifrado.

| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sim, com padrão |  |  |
| `email_index` | `text` | Não | Índice cego | HMAC do e-mail, para busca exata e unicidade. |
| `email_enc` | `text` | Não | Pessoal, cifrado | E-mail cifrado na aplicação. |
| `phone_enc` | `text` | Não | Pessoal, cifrado | Telefone cifrado. Liberado à outra parte só em contrato vigente. |
| `legal_name_enc` | `text` | Não | Pessoal, cifrado | Nome legal cifrado. Liberado à outra parte só em contrato vigente. |
| `cpf_index` | `text` | Não | Índice cego | HMAC do CPF. Impede que alguém banido volte com outra conta. |
| `cpf_enc` | `text` | Não | Pessoal, cifrado | CPF cifrado. |
| `birth_date_enc` | `text` | Não | Pessoal, cifrado | Data de nascimento cifrada, para confirmar a maioridade. |
| `status` | `user_status` | Sim, com padrão |  |  |
| `platform_role` | `platform_role` | Sim, com padrão |  | Papel interno. O app não consegue alterar esta coluna. |
| `last_active_at` | `timestamp with time zone` | Não |  |  |
| `deleted_at` | `timestamp with time zone` | Não |  |  |
| `created_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `updated_at` | `timestamp with time zone` | Sim, com padrão |  |  |
| `created_by` | `uuid` | Não |  |  |

## Visões de análise

O papel `escala_analytics` só enxerga estas visões, sem dados de pessoas.

- `analytics.contract_facts`: Contratos sem identificar as partes.
- `analytics.job_facts`: Vagas sem dados de pessoas ou endereço.
- `analytics.signup_facts`: Cadastros agregados por dia.

## Tipos enumerados

| Tipo | Valores |
| --- | --- |
| `appeal_status` | open, upheld, rejected |
| `application_origin` | applied, invited |
| `application_status` | invited, applied, shortlisted, selected, rejected, withdrawn, expired |
| `auth_provider` | google, apple, linkedin, email |
| `check_in_kind` | in, out |
| `check_in_source` | device, manual |
| `company_member_role` | owner, admin, recruiter |
| `company_segment` | producao_musical, festas_eventos, entretenimento, bar_restaurante, hospedagem, outros |
| `company_status` | pending, active, suspended, deleted |
| `contract_party` | company, freelancer, platform |
| `contract_status` | proposed, accepted, declined, expired, in_progress, awaiting_confirmation, completed, cancelled, no_show, disputed |
| `conversation_status` | open, closed |
| `data_request_kind` | export, deletion |
| `data_request_status` | pending, done, rejected |
| `device_platform` | ios, android, web |
| `dispute_decision` | favor_company, favor_freelancer, partial, no_action |
| `dispute_reason` | no_show, cancelamento, pagamento_nao_confirmado, conduta, check_in |
| `dispute_status` | opened, collecting_evidence, under_review, decided, applied, closed, withdrawn |
| `document_kind` | identidade, certificado, outro |
| `document_status` | pending, approved, rejected, expired |
| `file_scan_status` | pending, clean, infected, failed |
| `job_status` | draft, published, filled, closed, cancelled, expired |
| `kyc_kind` | cpf_birthdate, identity_document |
| `legal_document_kind` | terms, privacy, contract_template |
| `message_kind` | text, image, file, audio, system |
| `message_status` | visible, hidden, removed |
| `mfa_kind` | totp, recovery_code |
| `notification_channel` | push, email |
| `otp_purpose` | login, email_change, step_up |
| `pay_unit` | diaria, hora, cache |
| `penalty_status` | active, appealed, reversed, expired |
| `platform_role` | none, support, admin |
| `profile_status` | active, suspended, deleted |
| `reply_status` | published, hidden |
| `report_reason` | assedio, golpe, ofensa, dados_pessoais, outro |
| `report_status` | open, upheld, dismissed |
| `review_criterion` | pontualidade, qualidade, comunicacao, postura, clareza_vaga, ambiente, pagamento_em_dia, respeito |
| `review_side` | company, freelancer |
| `review_status` | submitted, published, hidden |
| `safety_alert_status` | open, handling, closed |
| `shift_status` | scheduled, in_progress, done, no_show, cancelled |
| `skill_level` | iniciante, intermediario, avancado |
| `ticket_category` | combinado_pagamento, conta, seguranca, disputa |
| `ticket_priority` | low, normal, high, urgent |
| `ticket_status` | open, pending_user, pending_support, resolved, closed |
| `user_status` | pending, active, suspended, banned, deleted |
| `verification_method` | cnpj_lookup, manual |
| `verification_status` | pending, approved, rejected, expired |
