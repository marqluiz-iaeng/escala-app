-- Up Migration

CREATE TYPE company_status AS ENUM ('pending', 'active', 'suspended', 'deleted');
CREATE TYPE company_member_role AS ENUM ('owner', 'admin', 'recruiter');
CREATE TYPE company_segment AS ENUM (
  'producao_musical', 'festas_eventos', 'entretenimento', 'bar_restaurante', 'hospedagem', 'outros'
);
CREATE TYPE verification_method AS ENUM ('cnpj_lookup', 'manual');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected', 'expired');

CREATE TABLE companies (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  trade_name      text NOT NULL CHECK (char_length(trade_name) BETWEEN 2 AND 80),
  segment         company_segment NOT NULL,
  about           text NOT NULL DEFAULT '' CHECK (char_length(about) <= 1000),
  logo_file_id    uuid REFERENCES files (id),
  city            text,
  public_location extensions.geography(Point, 4326),
  status          company_status NOT NULL DEFAULT 'pending',
  verified_at     timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES users (id)
);
CREATE INDEX companies_logo_idx ON companies (logo_file_id);
CREATE INDEX companies_location_idx ON companies USING gist (public_location);
COMMENT ON TABLE companies IS 'Perfil público da empresa. Dados internos ficam em company_private_details.';
COMMENT ON COLUMN companies.public_location IS 'Localização aproximada, pública.';

-- RLS atua por linha: o que não é público fica em uma tabela só para os membros.
CREATE TABLE company_private_details (
  company_id     uuid PRIMARY KEY REFERENCES companies (id),
  legal_name_enc text,
  cnpj_index     text UNIQUE,
  cnpj_enc       text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES users (id),
  CONSTRAINT company_private_cnpj_pair CHECK ((cnpj_index IS NULL) = (cnpj_enc IS NULL))
);
COMMENT ON TABLE company_private_details IS 'Dados internos da empresa. Só os membros leem.';
COMMENT ON COLUMN company_private_details.legal_name_enc IS 'Razão social cifrada.';
COMMENT ON COLUMN company_private_details.cnpj_index IS 'HMAC do CNPJ, para unicidade.';
COMMENT ON COLUMN company_private_details.cnpj_enc IS 'CNPJ cifrado. MEI pode revelar a pessoa física.';

CREATE TABLE company_members (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  company_id  uuid NOT NULL REFERENCES companies (id),
  user_id     uuid NOT NULL REFERENCES users (id),
  role        company_member_role NOT NULL,
  invited_by  uuid REFERENCES users (id),
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES users (id),
  UNIQUE (company_id, user_id)
);
CREATE INDEX company_members_user_idx ON company_members (user_id);
CREATE INDEX company_members_invited_by_idx ON company_members (invited_by);
COMMENT ON TABLE company_members IS 'Quem atua pela empresa e com qual papel.';
COMMENT ON COLUMN company_members.accepted_at IS 'Sem aceite, o convite ainda não dá acesso.';

CREATE TABLE company_verifications (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  company_id   uuid NOT NULL REFERENCES companies (id),
  method       verification_method NOT NULL,
  status       verification_status NOT NULL DEFAULT 'pending',
  provider_ref text,
  checked_at   timestamptz,
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES users (id)
);
CREATE INDEX company_verifications_company_idx ON company_verifications (company_id, created_at DESC);
COMMENT ON TABLE company_verifications IS 'Histórico das consultas que sustentam o selo de empresa verificada.';

-- Down Migration

DROP TABLE company_verifications;
DROP TABLE company_members;
DROP TABLE company_private_details;
DROP TABLE companies;
DROP TYPE verification_status;
DROP TYPE verification_method;
DROP TYPE company_segment;
DROP TYPE company_member_role;
DROP TYPE company_status;
