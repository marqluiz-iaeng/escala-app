-- Up Migration

CREATE TYPE ticket_category AS ENUM ('combinado_pagamento', 'conta', 'seguranca', 'disputa');
CREATE TYPE ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE ticket_status AS ENUM ('open', 'pending_user', 'pending_support', 'resolved', 'closed');
CREATE TYPE dispute_reason AS ENUM (
  'no_show', 'cancelamento', 'pagamento_nao_confirmado', 'conduta', 'check_in'
);
CREATE TYPE dispute_status AS ENUM (
  'opened', 'collecting_evidence', 'under_review', 'decided', 'applied', 'closed', 'withdrawn'
);
CREATE TYPE dispute_decision AS ENUM ('favor_company', 'favor_freelancer', 'partial', 'no_action');
CREATE TYPE safety_alert_status AS ENUM ('open', 'handling', 'closed');

CREATE TABLE help_articles (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  slug          text NOT NULL UNIQUE,
  title         text NOT NULL,
  body          text NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese'::regconfig, title || ' ' || body)
  ) STORED,
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES users (id)
);
CREATE INDEX help_articles_search_idx ON help_articles USING gin (search_vector);
COMMENT ON TABLE help_articles IS 'Central de ajuda pesquisável.';

CREATE TABLE support_tickets (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  requester_user_id  uuid NOT NULL REFERENCES users (id),
  contract_id        uuid REFERENCES contracts (id),
  category           ticket_category NOT NULL,
  priority           ticket_priority NOT NULL DEFAULT 'normal',
  status             ticket_status NOT NULL DEFAULT 'open',
  assignee_user_id   uuid REFERENCES users (id),
  sla_due_at         timestamptz,
  satisfaction_score smallint CHECK (satisfaction_score BETWEEN 1 AND 5),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES users (id)
);
CREATE INDEX support_tickets_requester_idx ON support_tickets (requester_user_id, created_at DESC);
CREATE INDEX support_tickets_contract_idx ON support_tickets (contract_id);
CREATE INDEX support_tickets_assignee_idx ON support_tickets (assignee_user_id);
CREATE INDEX support_tickets_queue_idx ON support_tickets (status, priority, sla_due_at);
COMMENT ON TABLE support_tickets IS 'Chamados de suporte.';

CREATE TABLE ticket_messages (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  ticket_id      uuid NOT NULL REFERENCES support_tickets (id),
  author_user_id uuid REFERENCES users (id),
  body_enc       text,
  file_id        uuid REFERENCES files (id),
  internal_note  boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES users (id)
);
CREATE INDEX ticket_messages_ticket_idx ON ticket_messages (ticket_id, created_at);
CREATE INDEX ticket_messages_author_idx ON ticket_messages (author_user_id);
CREATE INDEX ticket_messages_file_idx ON ticket_messages (file_id);
COMMENT ON TABLE ticket_messages IS 'Mensagens do chamado. Notas internas nunca aparecem para quem abriu.';
COMMENT ON COLUMN ticket_messages.body_enc IS 'Texto cifrado.';

CREATE TABLE disputes (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  contract_id     uuid NOT NULL REFERENCES contracts (id),
  ticket_id       uuid UNIQUE REFERENCES support_tickets (id),
  opened_by       uuid NOT NULL REFERENCES users (id),
  reason          dispute_reason NOT NULL,
  status          dispute_status NOT NULL DEFAULT 'opened',
  evidence_due_at timestamptz,
  decision        dispute_decision,
  decision_notes  text,
  decided_by      uuid REFERENCES users (id),
  applied_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES users (id),
  CONSTRAINT disputes_decision_consistent CHECK (
    status NOT IN ('decided', 'applied', 'closed') OR decision IS NOT NULL OR status = 'closed'
  )
);
-- Só uma disputa aberta por contrato.
CREATE UNIQUE INDEX disputes_one_open_idx ON disputes (contract_id)
  WHERE status NOT IN ('closed', 'withdrawn');
CREATE INDEX disputes_contract_idx ON disputes (contract_id);
CREATE INDEX disputes_opened_by_idx ON disputes (opened_by);
CREATE INDEX disputes_decided_by_idx ON disputes (decided_by);
CREATE INDEX disputes_queue_idx ON disputes (status, evidence_due_at);
COMMENT ON TABLE disputes IS 'Contestação de um contrato. A decisão afeta o contrato e a reputação, nunca dinheiro.';

CREATE TABLE dispute_evidences (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  dispute_id   uuid NOT NULL REFERENCES disputes (id),
  submitted_by uuid NOT NULL REFERENCES users (id),
  file_id      uuid REFERENCES files (id),
  note_enc     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES users (id),
  CONSTRAINT dispute_evidences_has_content CHECK (num_nonnulls(file_id, note_enc) >= 1)
);
CREATE INDEX dispute_evidences_dispute_idx ON dispute_evidences (dispute_id);
CREATE INDEX dispute_evidences_submitter_idx ON dispute_evidences (submitted_by);
CREATE INDEX dispute_evidences_file_idx ON dispute_evidences (file_id);
COMMENT ON TABLE dispute_evidences IS 'Evidências de cada parte. Só quem enviou e o suporte veem.';
COMMENT ON COLUMN dispute_evidences.note_enc IS 'Relato cifrado.';

CREATE TABLE dispute_status_history (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  dispute_id    uuid NOT NULL REFERENCES disputes (id),
  from_status   dispute_status,
  to_status     dispute_status NOT NULL,
  actor_user_id uuid REFERENCES users (id),
  reason        text,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dispute_status_history_dispute_idx ON dispute_status_history (dispute_id, occurred_at);
CREATE INDEX dispute_status_history_actor_idx ON dispute_status_history (actor_user_id);
COMMENT ON TABLE dispute_status_history IS 'Histórico de status da disputa. Somente inclusão.';

CREATE TABLE ticket_status_history (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  ticket_id     uuid NOT NULL REFERENCES support_tickets (id),
  from_status   ticket_status,
  to_status     ticket_status NOT NULL,
  actor_user_id uuid REFERENCES users (id),
  reason        text,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_status_history_ticket_idx ON ticket_status_history (ticket_id, occurred_at);
CREATE INDEX ticket_status_history_actor_idx ON ticket_status_history (actor_user_id);
COMMENT ON TABLE ticket_status_history IS 'Histórico de status do chamado. Somente inclusão.';

CREATE TRIGGER dispute_status_history_append_only BEFORE UPDATE OR DELETE ON dispute_status_history
  FOR EACH ROW EXECUTE FUNCTION app.forbid_mutation();
CREATE TRIGGER ticket_status_history_append_only BEFORE UPDATE OR DELETE ON ticket_status_history
  FOR EACH ROW EXECUTE FUNCTION app.forbid_mutation();

CREATE TABLE safety_alerts (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id    uuid NOT NULL REFERENCES users (id),
  shift_id   uuid REFERENCES shifts (id),
  location   extensions.geography(Point, 4326),
  status     safety_alert_status NOT NULL DEFAULT 'open',
  handled_by uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users (id)
);
CREATE INDEX safety_alerts_user_idx ON safety_alerts (user_id);
CREATE INDEX safety_alerts_shift_idx ON safety_alerts (shift_id);
CREATE INDEX safety_alerts_handled_idx ON safety_alerts (handled_by);
CREATE INDEX safety_alerts_queue_idx ON safety_alerts (status, created_at);
COMMENT ON TABLE safety_alerts IS 'Acionamentos do botão de emergência.';
COMMENT ON COLUMN safety_alerts.location IS 'Enviada só quando a pessoa toca no botão.';

-- Down Migration

DROP TABLE safety_alerts;
DROP TABLE ticket_status_history;
DROP TABLE dispute_status_history;
DROP TABLE dispute_evidences;
DROP TABLE disputes;
DROP TABLE ticket_messages;
DROP TABLE support_tickets;
DROP TABLE help_articles;
DROP TYPE safety_alert_status;
DROP TYPE dispute_decision;
DROP TYPE dispute_status;
DROP TYPE dispute_reason;
DROP TYPE ticket_status;
DROP TYPE ticket_priority;
DROP TYPE ticket_category;
