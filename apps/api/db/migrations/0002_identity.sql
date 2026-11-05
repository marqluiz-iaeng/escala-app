-- Up Migration

CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'banned', 'deleted');
CREATE TYPE platform_role AS ENUM ('none', 'support', 'admin');
CREATE TYPE auth_provider AS ENUM ('google', 'apple', 'linkedin', 'email');
CREATE TYPE otp_purpose AS ENUM ('login', 'email_change', 'step_up');
CREATE TYPE mfa_kind AS ENUM ('totp', 'recovery_code');
CREATE TYPE device_platform AS ENUM ('ios', 'android', 'web');

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  email_index    text UNIQUE,
  email_enc      text,
  phone_enc      text,
  legal_name_enc text,
  cpf_index      text UNIQUE,
  cpf_enc        text,
  birth_date_enc text,
  status         user_status NOT NULL DEFAULT 'pending',
  platform_role  platform_role NOT NULL DEFAULT 'none',
  last_active_at timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES users (id),
  CONSTRAINT users_email_pair CHECK ((email_index IS NULL) = (email_enc IS NULL)),
  CONSTRAINT users_cpf_pair CHECK ((cpf_index IS NULL) = (cpf_enc IS NULL)),
  CONSTRAINT users_deleted_consistent CHECK ((status = 'deleted') = (deleted_at IS NOT NULL)),
  CONSTRAINT users_email_required CHECK (status = 'deleted' OR email_index IS NOT NULL),
  CONSTRAINT users_deleted_has_no_pii CHECK (
    status <> 'deleted'
    OR num_nonnulls(email_enc, phone_enc, legal_name_enc, cpf_enc, birth_date_enc) = 0
  )
);
COMMENT ON TABLE users IS 'Conta de uma pessoa. Só o próprio titular lê a linha. Pessoal e cifrado.';
COMMENT ON COLUMN users.email_index IS 'HMAC do e-mail, para busca exata e unicidade.';
COMMENT ON COLUMN users.email_enc IS 'E-mail cifrado na aplicação.';
COMMENT ON COLUMN users.phone_enc IS 'Telefone cifrado. Liberado à outra parte só em contrato vigente.';
COMMENT ON COLUMN users.legal_name_enc IS 'Nome legal cifrado. Liberado à outra parte só em contrato vigente.';
COMMENT ON COLUMN users.cpf_index IS 'HMAC do CPF. Impede que alguém banido volte com outra conta.';
COMMENT ON COLUMN users.cpf_enc IS 'CPF cifrado.';
COMMENT ON COLUMN users.birth_date_enc IS 'Data de nascimento cifrada, para confirmar a maioridade.';
COMMENT ON COLUMN users.platform_role IS 'Papel interno. O app não consegue alterar esta coluna.';

CREATE TABLE auth_identities (
  id                      uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id                 uuid NOT NULL REFERENCES users (id),
  provider                auth_provider NOT NULL,
  provider_subject        text NOT NULL,
  email_enc               text,
  email_verified          boolean NOT NULL DEFAULT false,
  is_private_relay        boolean NOT NULL DEFAULT false,
  apple_refresh_token_enc text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid REFERENCES users (id),
  UNIQUE (provider, provider_subject),
  CONSTRAINT auth_identities_apple_token CHECK (provider = 'apple' OR apple_refresh_token_enc IS NULL)
);
CREATE INDEX auth_identities_user_idx ON auth_identities (user_id);
COMMENT ON TABLE auth_identities IS 'Formas de entrar em uma conta. Uma pessoa pode ter várias. Pessoal.';
COMMENT ON COLUMN auth_identities.provider_subject IS 'HMAC do identificador do provedor.';
COMMENT ON COLUMN auth_identities.email_enc IS 'E-mail informado pelo provedor, cifrado.';
COMMENT ON COLUMN auth_identities.is_private_relay IS 'Verdadeiro para o Hide My Email da Apple.';
COMMENT ON COLUMN auth_identities.apple_refresh_token_enc IS 'Token da Apple, só para revogar o acesso quando a conta é excluída.';

CREATE TABLE otp_codes (
  purpose     otp_purpose NOT NULL,
  subject     text NOT NULL,
  code_hash   text NOT NULL,
  payload_enc text,
  attempts    integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (purpose, subject)
);
CREATE INDEX otp_codes_expiry_idx ON otp_codes (expires_at);
COMMENT ON TABLE otp_codes IS 'Códigos de uso único por e-mail. Apagados ao expirar.';
COMMENT ON COLUMN otp_codes.subject IS 'A quem o código pertence: HMAC do e-mail ou ID do usuário.';
COMMENT ON COLUMN otp_codes.code_hash IS 'HMAC com chave, amarrado à finalidade e ao titular.';
COMMENT ON COLUMN otp_codes.payload_enc IS 'Dados do pedido, como o novo e-mail, cifrados.';

CREATE TABLE mfa_factors (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id      uuid NOT NULL REFERENCES users (id),
  kind         mfa_kind NOT NULL,
  secret_enc   text NOT NULL,
  verified_at  timestamptz,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES users (id)
);
CREATE INDEX mfa_factors_user_idx ON mfa_factors (user_id);
COMMENT ON TABLE mfa_factors IS 'Segundo fator: TOTP e códigos de recuperação.';
COMMENT ON COLUMN mfa_factors.secret_enc IS 'Segredo TOTP cifrado ou hash do código de recuperação.';

CREATE TABLE devices (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id        uuid NOT NULL REFERENCES users (id),
  platform       device_platform NOT NULL,
  label          text NOT NULL CHECK (char_length(label) <= 60),
  push_token_enc text,
  app_version    text,
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES users (id)
);
CREATE INDEX devices_user_idx ON devices (user_id);
COMMENT ON TABLE devices IS 'Aparelhos da pessoa. Só etiqueta genérica, sem identificador de hardware.';
COMMENT ON COLUMN devices.push_token_enc IS 'Token de push cifrado.';

CREATE TABLE sessions (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id        uuid NOT NULL REFERENCES users (id),
  device_id      uuid REFERENCES devices (id) ON DELETE SET NULL,
  expires_at     timestamptz NOT NULL,
  revoked_at     timestamptz,
  revoked_reason text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES users (id)
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_device_idx ON sessions (device_id);
CREATE INDEX sessions_expiry_idx ON sessions (expires_at);
COMMENT ON TABLE sessions IS 'Sessões abertas. Podem ser revogadas pelo titular.';

CREATE TABLE refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  session_id uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  used_at    timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users (id)
);
CREATE INDEX refresh_tokens_session_idx ON refresh_tokens (session_id);
CREATE INDEX refresh_tokens_expiry_idx ON refresh_tokens (expires_at);
COMMENT ON TABLE refresh_tokens IS 'Tokens de renovação, só como hash. Reutilizar um token já usado revoga a sessão.';
COMMENT ON COLUMN refresh_tokens.used_at IS 'Preenchido na rotação. Uso posterior indica roubo.';

-- Down Migration

DROP TABLE refresh_tokens;
DROP TABLE sessions;
DROP TABLE devices;
DROP TABLE mfa_factors;
DROP TABLE otp_codes;
DROP TABLE auth_identities;
DROP TABLE users;
DROP TYPE device_platform;
DROP TYPE mfa_kind;
DROP TYPE otp_purpose;
DROP TYPE auth_provider;
DROP TYPE platform_role;
DROP TYPE user_status;
