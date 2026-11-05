-- Up Migration

CREATE TYPE file_scan_status AS ENUM ('pending', 'clean', 'infected', 'failed');
CREATE TYPE legal_document_kind AS ENUM ('terms', 'privacy', 'contract_template');
CREATE TYPE data_request_kind AS ENUM ('export', 'deletion');
CREATE TYPE data_request_status AS ENUM ('pending', 'done', 'rejected');
CREATE TYPE notification_channel AS ENUM ('push', 'email');

CREATE TABLE files (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_user_id uuid NOT NULL REFERENCES users (id),
  storage_key   text NOT NULL UNIQUE,
  mime_type     text NOT NULL,
  size_bytes    bigint NOT NULL CHECK (size_bytes > 0),
  sha256        text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  scan_status   file_scan_status NOT NULL DEFAULT 'pending',
  deleted_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES users (id)
);
CREATE INDEX files_owner_idx ON files (owner_user_id);
COMMENT ON TABLE files IS 'Arquivos enviados. Só são liberados com scan_status = clean e por URL assinada.';
COMMENT ON COLUMN files.storage_key IS 'Caminho no armazenamento. Sem nome original nem dado pessoal.';

CREATE TABLE legal_documents (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  kind           legal_document_kind NOT NULL,
  version        text NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  published_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES users (id),
  UNIQUE (kind, version)
);
COMMENT ON TABLE legal_documents IS 'Versões de termos, política e modelo de contrato. O hash prova o texto aceito.';

CREATE TABLE consents (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id     uuid NOT NULL REFERENCES users (id),
  purpose     text NOT NULL,
  document_id uuid REFERENCES legal_documents (id),
  granted     boolean NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES users (id)
);
CREATE INDEX consents_user_idx ON consents (user_id, purpose, occurred_at DESC);
CREATE INDEX consents_document_idx ON consents (document_id);
CREATE TRIGGER consents_append_only BEFORE UPDATE OR DELETE ON consents
  FOR EACH ROW EXECUTE FUNCTION app.forbid_mutation();
COMMENT ON TABLE consents IS 'Comprovante de cada decisão do titular. Somente inclusão (LGPD, art. 8º, § 2º).';

CREATE TABLE data_requests (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id      uuid NOT NULL REFERENCES users (id),
  kind         data_request_kind NOT NULL,
  status       data_request_status NOT NULL DEFAULT 'pending',
  file_id      uuid REFERENCES files (id),
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES users (id)
);
CREATE INDEX data_requests_user_idx ON data_requests (user_id);
CREATE INDEX data_requests_file_idx ON data_requests (file_id);
COMMENT ON TABLE data_requests IS 'Pedidos de exportação e exclusão (LGPD, art. 18).';

CREATE TABLE audit_logs (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  actor_user_id  uuid REFERENCES users (id),
  target_user_id uuid REFERENCES users (id),
  action         text NOT NULL,
  entity_type    text,
  entity_id      uuid,
  ip_enc         text,
  request_id     uuid,
  occurred_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_target_idx ON audit_logs (target_user_id, occurred_at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_user_id, occurred_at DESC);
CREATE INDEX audit_logs_time_idx ON audit_logs (occurred_at);
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION app.forbid_mutation('occurred_at', '6 months');
COMMENT ON TABLE audit_logs IS 'Trilha de ações sensíveis. Somente inclusão. Só o que passou de 6 meses pode ser apagado (Marco Civil, art. 15).';
COMMENT ON COLUMN audit_logs.ip_enc IS 'Endereço IP cifrado.';

CREATE TABLE idempotency_keys (
  scope          text NOT NULL,
  key            text NOT NULL,
  user_id        uuid REFERENCES users (id),
  request_sha256 text NOT NULL,
  response_enc   text,
  expires_at     timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);
CREATE INDEX idempotency_keys_user_idx ON idempotency_keys (user_id);
CREATE INDEX idempotency_keys_expiry_idx ON idempotency_keys (expires_at);
COMMENT ON TABLE idempotency_keys IS 'Evita repetir uma ação quando a conexão ruim faz o app reenviar o pedido.';
COMMENT ON COLUMN idempotency_keys.response_enc IS 'Resposta original cifrada, devolvida na repetição.';

CREATE TABLE feature_flags (
  key        text PRIMARY KEY,
  enabled    boolean NOT NULL DEFAULT false,
  rules      jsonb NOT NULL DEFAULT '{}',
  updated_by uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feature_flags_updated_by_idx ON feature_flags (updated_by);
COMMENT ON TABLE feature_flags IS 'Ativa recursos aos poucos. Sem dados pessoais.';

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id    uuid NOT NULL REFERENCES users (id),
  type       text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}',
  sent_at    timestamptz,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users (id)
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;
COMMENT ON TABLE notifications IS 'Avisos do app. Sem dados sensíveis no conteúdo.';
COMMENT ON COLUMN notifications.payload IS 'Só identificadores e tipo. O conteúdo é buscado no app, com autorização.';

CREATE TABLE notification_preferences (
  user_id     uuid NOT NULL REFERENCES users (id),
  type        text NOT NULL,
  channel     notification_channel NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  quiet_start time,
  quiet_end   time,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES users (id),
  PRIMARY KEY (user_id, type, channel)
);
COMMENT ON TABLE notification_preferences IS 'Preferências por tipo de aviso e horário de silêncio.';

-- Down Migration

DROP TABLE notification_preferences;
DROP TABLE notifications;
DROP TABLE feature_flags;
DROP TABLE idempotency_keys;
DROP TABLE audit_logs;
DROP TABLE data_requests;
DROP TABLE consents;
DROP TABLE legal_documents;
DROP TABLE files;
DROP TYPE notification_channel;
DROP TYPE data_request_status;
DROP TYPE data_request_kind;
DROP TYPE legal_document_kind;
DROP TYPE file_scan_status;
