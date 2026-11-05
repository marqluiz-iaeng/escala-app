-- Up Migration

CREATE TYPE conversation_status AS ENUM ('open', 'closed');
CREATE TYPE message_kind AS ENUM ('text', 'image', 'file', 'audio', 'system');
CREATE TYPE message_status AS ENUM ('visible', 'hidden', 'removed');
CREATE TYPE report_reason AS ENUM ('assedio', 'golpe', 'ofensa', 'dados_pessoais', 'outro');
CREATE TYPE report_status AS ENUM ('open', 'upheld', 'dismissed');

CREATE TABLE conversations (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  application_id  uuid NOT NULL UNIQUE REFERENCES applications (id),
  status          conversation_status NOT NULL DEFAULT 'open',
  last_message_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES users (id)
);
COMMENT ON TABLE conversations IS 'Conversa ligada a uma candidatura e a um eventual contrato.';

CREATE TABLE conversation_participants (
  conversation_id           uuid NOT NULL REFERENCES conversations (id),
  user_id                   uuid NOT NULL REFERENCES users (id),
  last_delivered_message_id uuid,
  last_read_message_id      uuid,
  muted_until               timestamptz,
  left_at                   timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  created_by                uuid REFERENCES users (id),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX conversation_participants_user_idx ON conversation_participants (user_id);
COMMENT ON TABLE conversation_participants IS 'Quem participa da conversa e até onde recebeu e leu.';

CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  conversation_id uuid NOT NULL REFERENCES conversations (id),
  sender_user_id  uuid REFERENCES users (id),
  kind            message_kind NOT NULL DEFAULT 'text',
  body_enc        text,
  contact_masked  boolean NOT NULL DEFAULT false,
  status          message_status NOT NULL DEFAULT 'visible',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES users (id),
  CONSTRAINT messages_system_has_no_sender CHECK ((kind = 'system') = (sender_user_id IS NULL))
);
CREATE INDEX messages_conversation_idx ON messages (conversation_id, id DESC);
CREATE INDEX messages_sender_idx ON messages (sender_user_id);
COMMENT ON TABLE messages IS 'Mensagens da conversa. O UUID v7 mantém a ordem de envio.';
COMMENT ON COLUMN messages.body_enc IS 'Texto cifrado, nulo quando removido. Contatos são mascarados antes do contrato.';
COMMENT ON COLUMN messages.contact_masked IS 'Verdadeiro se o servidor ocultou um contato nesta mensagem.';

CREATE TABLE message_attachments (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  message_id       uuid NOT NULL REFERENCES messages (id),
  file_id          uuid NOT NULL REFERENCES files (id),
  duration_seconds integer CHECK (duration_seconds BETWEEN 1 AND 300),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES users (id)
);
CREATE INDEX message_attachments_message_idx ON message_attachments (message_id);
CREATE INDEX message_attachments_file_idx ON message_attachments (file_id);
COMMENT ON TABLE message_attachments IS 'Imagens, arquivos e áudios curtos enviados no chat.';

CREATE TABLE message_reports (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  message_id       uuid NOT NULL REFERENCES messages (id),
  reporter_user_id uuid NOT NULL REFERENCES users (id),
  reason           report_reason NOT NULL,
  status           report_status NOT NULL DEFAULT 'open',
  resolved_by      uuid REFERENCES users (id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES users (id),
  UNIQUE (message_id, reporter_user_id)
);
CREATE INDEX message_reports_reporter_idx ON message_reports (reporter_user_id);
CREATE INDEX message_reports_resolved_idx ON message_reports (resolved_by);
CREATE INDEX message_reports_queue_idx ON message_reports (status, created_at);
COMMENT ON TABLE message_reports IS 'Denúncias de mensagens.';

CREATE TABLE user_blocks (
  blocker_user_id uuid NOT NULL REFERENCES users (id),
  blocked_user_id uuid NOT NULL REFERENCES users (id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES users (id),
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CONSTRAINT user_blocks_not_self CHECK (blocker_user_id <> blocked_user_id)
);
CREATE INDEX user_blocks_blocked_idx ON user_blocks (blocked_user_id);
COMMENT ON TABLE user_blocks IS 'Bloqueios entre pessoas. Impede novas mensagens nos dois sentidos.';

-- Down Migration

DROP TABLE user_blocks;
DROP TABLE message_reports;
DROP TABLE message_attachments;
DROP TABLE messages;
DROP TABLE conversation_participants;
DROP TABLE conversations;
DROP TYPE report_status;
DROP TYPE report_reason;
DROP TYPE message_status;
DROP TYPE message_kind;
DROP TYPE conversation_status;
