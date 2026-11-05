-- Up Migration

CREATE TYPE job_status AS ENUM ('draft', 'published', 'filled', 'closed', 'cancelled', 'expired');
CREATE TYPE pay_unit AS ENUM ('diaria', 'hora', 'cache');
CREATE TYPE application_origin AS ENUM ('applied', 'invited');
CREATE TYPE application_status AS ENUM (
  'invited', 'applied', 'shortlisted', 'selected', 'rejected', 'withdrawn', 'expired'
);
CREATE TYPE contract_status AS ENUM (
  'proposed', 'accepted', 'declined', 'expired', 'in_progress', 'awaiting_confirmation',
  'completed', 'cancelled', 'no_show', 'disputed'
);
CREATE TYPE contract_party AS ENUM ('company', 'freelancer', 'platform');
CREATE TYPE shift_status AS ENUM ('scheduled', 'in_progress', 'done', 'no_show', 'cancelled');
CREATE TYPE check_in_kind AS ENUM ('in', 'out');
CREATE TYPE check_in_source AS ENUM ('device', 'manual');

CREATE TABLE jobs (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  company_id       uuid NOT NULL REFERENCES companies (id),
  title            text NOT NULL CHECK (char_length(title) BETWEEN 4 AND 120),
  description      text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 2000),
  primary_skill_id uuid NOT NULL REFERENCES skills (id),
  city             text NOT NULL,
  neighbourhood    text NOT NULL,
  public_location  extensions.geography(Point, 4326) NOT NULL,
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  slots            integer NOT NULL DEFAULT 1 CHECK (slots BETWEEN 1 AND 50),
  pay_amount_cents money_cents NOT NULL,
  currency         currency_code NOT NULL,
  pay_unit         pay_unit NOT NULL,
  status           job_status NOT NULL DEFAULT 'draft',
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES users (id),
  UNIQUE (id, company_id),
  CONSTRAINT jobs_valid_range CHECK (ends_at > starts_at)
);
CREATE INDEX jobs_company_idx ON jobs (company_id, starts_at DESC);
CREATE INDEX jobs_skill_idx ON jobs (primary_skill_id);
CREATE INDEX jobs_status_date_idx ON jobs (status, starts_at);
CREATE INDEX jobs_location_idx ON jobs USING gist (public_location) WHERE status = 'published';
COMMENT ON TABLE jobs IS 'Vaga ou turno publicado. Público para quem está logado. O endereço fica em job_private_details.';
COMMENT ON COLUMN jobs.public_location IS 'Localização aproximada do bairro, nunca o endereço exato.';
COMMENT ON COLUMN jobs.pay_amount_cents IS 'Valor oferecido, informativo. O app não cobra nem repassa dinheiro.';

CREATE TABLE job_private_details (
  job_id           uuid PRIMARY KEY REFERENCES jobs (id),
  address_enc      text,
  site_location    extensions.geography(Point, 4326),
  checkin_radius_m integer NOT NULL DEFAULT 200 CHECK (checkin_radius_m BETWEEN 50 AND 2000),
  access_notes_enc text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES users (id)
);
COMMENT ON TABLE job_private_details IS 'Endereço e local exatos. Só a empresa e quem tem contrato vigente leem.';
COMMENT ON COLUMN job_private_details.address_enc IS 'Endereço cifrado. Pode ser a casa de alguém, em festas.';
COMMENT ON COLUMN job_private_details.site_location IS 'Local exato, usado só na geocerca do check-in.';
COMMENT ON COLUMN job_private_details.access_notes_enc IS 'Instruções de acesso cifradas.';

CREATE TABLE job_requirements (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  job_id     uuid NOT NULL REFERENCES jobs (id),
  skill_id   uuid NOT NULL REFERENCES skills (id),
  min_level  skill_level,
  note       text CHECK (char_length(note) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users (id),
  UNIQUE (job_id, skill_id)
);
CREATE INDEX job_requirements_skill_idx ON job_requirements (skill_id);
COMMENT ON TABLE job_requirements IS 'Requisitos da vaga.';

CREATE TABLE applications (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  job_id        uuid NOT NULL REFERENCES jobs (id),
  freelancer_id uuid NOT NULL REFERENCES freelancer_profiles (user_id),
  origin        application_origin NOT NULL,
  status        application_status NOT NULL,
  note_enc      text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES users (id),
  UNIQUE (job_id, freelancer_id),
  UNIQUE (id, job_id, freelancer_id)
);
CREATE INDEX applications_job_status_idx ON applications (job_id, status);
CREATE INDEX applications_freelancer_idx ON applications (freelancer_id, created_at DESC);
COMMENT ON TABLE applications IS 'Candidatura ou convite. Quem retira a candidatura some para a empresa.';
COMMENT ON COLUMN applications.note_enc IS 'Mensagem inicial cifrada, com contatos mascarados.';

CREATE TABLE contracts (
  id                           uuid PRIMARY KEY DEFAULT uuidv7(),
  application_id               uuid NOT NULL UNIQUE,
  job_id                       uuid NOT NULL,
  company_id                   uuid NOT NULL,
  freelancer_id                uuid NOT NULL,
  company_contact_user_id      uuid NOT NULL REFERENCES users (id),
  terms_document_id            uuid NOT NULL REFERENCES legal_documents (id),
  agreed_amount_cents          money_cents NOT NULL,
  currency                     currency_code NOT NULL,
  pay_unit                     pay_unit NOT NULL,
  status                       contract_status NOT NULL DEFAULT 'proposed',
  cancelled_by                 contract_party,
  no_show_party                contract_party,
  accepted_at                  timestamptz,
  contact_visible_until        timestamptz,
  payment_due_on               date,
  company_marked_paid_at       timestamptz,
  freelancer_confirmed_paid_at timestamptz,
  company_confirmed_at         timestamptz,
  freelancer_confirmed_at      timestamptz,
  completed_at                 timestamptz,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  created_by                   uuid REFERENCES users (id),
  -- O contrato sempre aponta para a candidatura, a vaga e a empresa certas.
  FOREIGN KEY (application_id, job_id, freelancer_id)
    REFERENCES applications (id, job_id, freelancer_id),
  FOREIGN KEY (job_id, company_id) REFERENCES jobs (id, company_id),
  CONSTRAINT contracts_cancel_consistent CHECK (cancelled_by IS NULL OR status IN ('cancelled', 'disputed')),
  CONSTRAINT contracts_no_show_consistent CHECK (no_show_party IS NULL OR status IN ('no_show', 'disputed'))
);
CREATE INDEX contracts_job_idx ON contracts (job_id, freelancer_id);
CREATE INDEX contracts_company_idx ON contracts (company_id, status);
CREATE INDEX contracts_freelancer_idx ON contracts (freelancer_id, status);
CREATE INDEX contracts_contact_user_idx ON contracts (company_contact_user_id);
CREATE INDEX contracts_terms_idx ON contracts (terms_document_id);
CREATE INDEX contracts_awaiting_idx ON contracts (updated_at) WHERE status = 'awaiting_confirmation';
COMMENT ON TABLE contracts IS 'Registro do que foi combinado. O Escala não processa nem garante o pagamento.';
COMMENT ON COLUMN contracts.company_contact_user_id IS 'Quem responde pela empresa neste contrato.';
COMMENT ON COLUMN contracts.agreed_amount_cents IS 'Valor combinado, só registro. Nada é cobrado pelo app.';
COMMENT ON COLUMN contracts.contact_visible_until IS 'Fim da liberação do contato: 30 dias depois do último turno.';
COMMENT ON COLUMN contracts.company_marked_paid_at IS 'Declaração da empresa de que pagou fora do app.';
COMMENT ON COLUMN contracts.freelancer_confirmed_paid_at IS 'Confirmação do freelancer. É o que conta para "pagamentos em dia".';

CREATE TABLE shifts (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  contract_id uuid NOT NULL REFERENCES contracts (id),
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  status      shift_status NOT NULL DEFAULT 'scheduled',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES users (id),
  CONSTRAINT shifts_valid_range CHECK (ends_at > starts_at)
);
CREATE INDEX shifts_contract_idx ON shifts (contract_id, starts_at);
COMMENT ON TABLE shifts IS 'Turnos de um contrato.';

CREATE TABLE check_ins (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  shift_id        uuid NOT NULL REFERENCES shifts (id),
  kind            check_in_kind NOT NULL,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  location        extensions.geography(Point, 4326),
  accuracy_m      integer CHECK (accuracy_m >= 0),
  within_geofence boolean NOT NULL DEFAULT false,
  source          check_in_source NOT NULL DEFAULT 'device',
  contested       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES users (id),
  UNIQUE (shift_id, kind)
);
COMMENT ON TABLE check_ins IS 'Chegada e saída de um turno. Nunca há rastreamento contínuo.';
COMMENT ON COLUMN check_ins.location IS 'Local no momento do registro. Apagado 90 dias depois do turno, salvo disputa aberta.';
COMMENT ON COLUMN check_ins.within_geofence IS 'Calculado pelo banco a partir do local do turno. O app não informa este valor.';

-- O histórico de cada máquina de estado é somente de inclusão.
CREATE TABLE job_status_history (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  job_id        uuid NOT NULL REFERENCES jobs (id),
  from_status   job_status,
  to_status     job_status NOT NULL,
  actor_user_id uuid REFERENCES users (id),
  reason        text,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_status_history_job_idx ON job_status_history (job_id, occurred_at);
CREATE INDEX job_status_history_actor_idx ON job_status_history (actor_user_id);
COMMENT ON TABLE job_status_history IS 'Histórico de status da vaga. Somente inclusão.';

CREATE TABLE application_status_history (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  application_id uuid NOT NULL REFERENCES applications (id),
  from_status    application_status,
  to_status      application_status NOT NULL,
  actor_user_id  uuid REFERENCES users (id),
  reason         text,
  occurred_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX application_status_history_app_idx ON application_status_history (application_id, occurred_at);
CREATE INDEX application_status_history_actor_idx ON application_status_history (actor_user_id);
COMMENT ON TABLE application_status_history IS 'Histórico de status da candidatura. Somente inclusão.';

CREATE TABLE contract_status_history (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  contract_id   uuid NOT NULL REFERENCES contracts (id),
  from_status   contract_status,
  to_status     contract_status NOT NULL,
  actor_user_id uuid REFERENCES users (id),
  reason        text,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contract_status_history_contract_idx ON contract_status_history (contract_id, occurred_at);
CREATE INDEX contract_status_history_actor_idx ON contract_status_history (actor_user_id);
COMMENT ON TABLE contract_status_history IS 'Histórico de status do contrato. Somente inclusão.';

CREATE TABLE shift_status_history (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  shift_id      uuid NOT NULL REFERENCES shifts (id),
  from_status   shift_status,
  to_status     shift_status NOT NULL,
  actor_user_id uuid REFERENCES users (id),
  reason        text,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shift_status_history_shift_idx ON shift_status_history (shift_id, occurred_at);
CREATE INDEX shift_status_history_actor_idx ON shift_status_history (actor_user_id);
COMMENT ON TABLE shift_status_history IS 'Histórico de status do turno. Somente inclusão.';

CREATE TRIGGER job_status_history_append_only BEFORE UPDATE OR DELETE ON job_status_history
  FOR EACH ROW EXECUTE FUNCTION app.forbid_mutation();
CREATE TRIGGER application_status_history_append_only BEFORE UPDATE OR DELETE ON application_status_history
  FOR EACH ROW EXECUTE FUNCTION app.forbid_mutation();
CREATE TRIGGER contract_status_history_append_only BEFORE UPDATE OR DELETE ON contract_status_history
  FOR EACH ROW EXECUTE FUNCTION app.forbid_mutation();
CREATE TRIGGER shift_status_history_append_only BEFORE UPDATE OR DELETE ON shift_status_history
  FOR EACH ROW EXECUTE FUNCTION app.forbid_mutation();

-- Down Migration

DROP TABLE shift_status_history;
DROP TABLE contract_status_history;
DROP TABLE application_status_history;
DROP TABLE job_status_history;
DROP TABLE check_ins;
DROP TABLE shifts;
DROP TABLE contracts;
DROP TABLE applications;
DROP TABLE job_requirements;
DROP TABLE job_private_details;
DROP TABLE jobs;
DROP TYPE check_in_source;
DROP TYPE check_in_kind;
DROP TYPE shift_status;
DROP TYPE contract_party;
DROP TYPE contract_status;
DROP TYPE application_status;
DROP TYPE application_origin;
DROP TYPE pay_unit;
DROP TYPE job_status;
