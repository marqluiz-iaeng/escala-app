-- Up Migration

CREATE TYPE profile_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE skill_level AS ENUM ('iniciante', 'intermediario', 'avancado');
CREATE TYPE document_kind AS ENUM ('identidade', 'certificado', 'outro');
CREATE TYPE document_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
CREATE TYPE kyc_kind AS ENUM ('cpf_birthdate', 'identity_document');

CREATE TABLE freelancer_profiles (
  user_id              uuid PRIMARY KEY REFERENCES users (id),
  display_name         text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 60),
  photo_file_id        uuid REFERENCES files (id),
  bio                  text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 1000),
  experience_years     integer NOT NULL DEFAULT 0 CHECK (experience_years BETWEEN 0 AND 60),
  reference_rate_cents money_cents,
  currency             currency_code NOT NULL,
  base_location        extensions.geography(Point, 4326),
  service_radius_km    integer NOT NULL DEFAULT 25 CHECK (service_radius_km BETWEEN 1 AND 500),
  available_now        boolean NOT NULL DEFAULT false,
  discoverable         boolean NOT NULL DEFAULT false,
  status               profile_status NOT NULL DEFAULT 'active',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid REFERENCES users (id)
);
CREATE INDEX freelancer_profiles_photo_idx ON freelancer_profiles (photo_file_id);
CREATE INDEX freelancer_profiles_location_idx ON freelancer_profiles USING gist (base_location)
  WHERE discoverable AND status = 'active';
COMMENT ON TABLE freelancer_profiles IS 'Perfil profissional. Empresas veem se houver candidatura ativa ou se discoverable estiver ligado.';
COMMENT ON COLUMN freelancer_profiles.display_name IS 'Nome abreviado, como "Ana M.". O nome legal fica em users.';
COMMENT ON COLUMN freelancer_profiles.photo_file_id IS 'Foto opcional. Empresas só acessam o arquivo depois da pré-seleção.';
COMMENT ON COLUMN freelancer_profiles.base_location IS 'Localização aproximada, nunca o endereço de casa.';
COMMENT ON COLUMN freelancer_profiles.discoverable IS 'Consentimento para aparecer nas buscas. Começa desligado.';

CREATE TABLE skills (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL,
  category   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users (id)
);
COMMENT ON TABLE skills IS 'Catálogo de funções e habilidades.';

CREATE TABLE freelancer_skills (
  freelancer_id uuid NOT NULL REFERENCES freelancer_profiles (user_id),
  skill_id      uuid NOT NULL REFERENCES skills (id),
  level         skill_level NOT NULL DEFAULT 'iniciante',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES users (id),
  PRIMARY KEY (freelancer_id, skill_id)
);
CREATE INDEX freelancer_skills_skill_idx ON freelancer_skills (skill_id);
COMMENT ON TABLE freelancer_skills IS 'Habilidades de cada freelancer, com nível.';

CREATE TABLE portfolio_items (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  freelancer_id uuid NOT NULL REFERENCES freelancer_profiles (user_id),
  title         text NOT NULL CHECK (char_length(title) <= 120),
  file_id       uuid REFERENCES files (id),
  external_url  text CHECK (external_url IS NULL OR external_url ~ '^https://'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES users (id),
  CONSTRAINT portfolio_has_content CHECK (num_nonnulls(file_id, external_url) >= 1)
);
CREATE INDEX portfolio_items_freelancer_idx ON portfolio_items (freelancer_id);
CREATE INDEX portfolio_items_file_idx ON portfolio_items (file_id);
COMMENT ON TABLE portfolio_items IS 'Trabalhos mostrados no perfil.';

CREATE TABLE availability_slots (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  freelancer_id   uuid NOT NULL REFERENCES freelancer_profiles (user_id),
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  recurrence_rule text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES users (id),
  CONSTRAINT availability_valid_range CHECK (ends_at > starts_at)
);
CREATE INDEX availability_slots_freelancer_idx ON availability_slots (freelancer_id, starts_at);
COMMENT ON TABLE availability_slots IS 'Horários em que o freelancer diz estar disponível. É informação dele, nunca uma escala imposta.';

CREATE TABLE favorites (
  company_id    uuid NOT NULL REFERENCES companies (id),
  freelancer_id uuid NOT NULL REFERENCES freelancer_profiles (user_id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES users (id),
  PRIMARY KEY (company_id, freelancer_id)
);
CREATE INDEX favorites_freelancer_idx ON favorites (freelancer_id);
COMMENT ON TABLE favorites IS 'Freelancers salvos por uma empresa para recontratar.';

CREATE TABLE documents (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id    uuid NOT NULL REFERENCES users (id),
  kind       document_kind NOT NULL,
  file_id    uuid NOT NULL REFERENCES files (id),
  status     document_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users (id)
);
CREATE INDEX documents_user_idx ON documents (user_id);
CREATE INDEX documents_file_idx ON documents (file_id);
COMMENT ON TABLE documents IS 'Documentos enviados pela pessoa. Só ela e o suporte acessam.';

CREATE TABLE kyc_verifications (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id      uuid NOT NULL REFERENCES users (id),
  kind         kyc_kind NOT NULL,
  provider     text NOT NULL,
  provider_ref text,
  status       verification_status NOT NULL DEFAULT 'pending',
  checked_at   timestamptz,
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES users (id)
);
CREATE INDEX kyc_verifications_user_idx ON kyc_verifications (user_id, kind, created_at DESC);
COMMENT ON TABLE kyc_verifications IS 'Resultado das verificações. Selfie e documento ficam no provedor, nunca aqui.';
COMMENT ON COLUMN kyc_verifications.provider_ref IS 'Referência no provedor, sem imagem nem dado biométrico.';

-- Down Migration

DROP TABLE kyc_verifications;
DROP TABLE documents;
DROP TABLE favorites;
DROP TABLE availability_slots;
DROP TABLE portfolio_items;
DROP TABLE freelancer_skills;
DROP TABLE skills;
DROP TABLE freelancer_profiles;
DROP TYPE kyc_kind;
DROP TYPE document_status;
DROP TYPE document_kind;
DROP TYPE skill_level;
DROP TYPE profile_status;
