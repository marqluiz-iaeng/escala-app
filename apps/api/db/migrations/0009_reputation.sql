-- Up Migration

CREATE TYPE review_side AS ENUM ('company', 'freelancer');
CREATE TYPE review_status AS ENUM ('submitted', 'published', 'hidden');
CREATE TYPE review_criterion AS ENUM (
  'pontualidade', 'qualidade', 'comunicacao', 'postura',
  'clareza_vaga', 'ambiente', 'pagamento_em_dia', 'respeito'
);
CREATE TYPE reply_status AS ENUM ('published', 'hidden');
CREATE TYPE penalty_status AS ENUM ('active', 'appealed', 'reversed', 'expired');
CREATE TYPE appeal_status AS ENUM ('open', 'upheld', 'rejected');

CREATE TABLE reviews (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  contract_id        uuid NOT NULL REFERENCES contracts (id),
  reviewer_user_id   uuid NOT NULL REFERENCES users (id),
  reviewer_side      review_side NOT NULL,
  subject_user_id    uuid REFERENCES users (id),
  subject_company_id uuid REFERENCES companies (id),
  comment            text CHECK (char_length(comment) <= 1000),
  status             review_status NOT NULL DEFAULT 'submitted',
  revealed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES users (id),
  UNIQUE (contract_id, reviewer_side),
  CONSTRAINT reviews_one_subject CHECK (num_nonnulls(subject_user_id, subject_company_id) = 1),
  CONSTRAINT reviews_published_is_revealed CHECK (status <> 'published' OR revealed_at IS NOT NULL)
);
CREATE INDEX reviews_reviewer_idx ON reviews (reviewer_user_id);
CREATE INDEX reviews_subject_user_idx ON reviews (subject_user_id, revealed_at);
CREATE INDEX reviews_subject_company_idx ON reviews (subject_company_id, revealed_at);
CREATE INDEX reviews_pending_reveal_idx ON reviews (created_at) WHERE revealed_at IS NULL;
COMMENT ON TABLE reviews IS 'Avaliação de um contrato concluído. Dupla-cega até as duas partes avaliarem ou a janela de 7 dias fechar.';
COMMENT ON COLUMN reviews.subject_user_id IS 'Quem foi avaliado, definido pelo banco a partir do contrato.';
COMMENT ON COLUMN reviews.comment IS 'Comentário opcional e público depois de revelado. Passa por moderação.';
COMMENT ON COLUMN reviews.revealed_at IS 'Enquanto for nulo, só quem avaliou lê a avaliação.';

CREATE TABLE review_criteria_scores (
  review_id  uuid NOT NULL REFERENCES reviews (id),
  criterion  review_criterion NOT NULL,
  score      smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users (id),
  PRIMARY KEY (review_id, criterion)
);
COMMENT ON TABLE review_criteria_scores IS 'Nota de 1 a 5 por critério.';

CREATE TABLE review_replies (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  review_id      uuid NOT NULL UNIQUE REFERENCES reviews (id),
  author_user_id uuid NOT NULL REFERENCES users (id),
  body           text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  status         reply_status NOT NULL DEFAULT 'published',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES users (id)
);
CREATE INDEX review_replies_author_idx ON review_replies (author_user_id);
COMMENT ON TABLE review_replies IS 'Direito de resposta a uma avaliação.';

CREATE TABLE reputation_snapshots (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  subject_user_id    uuid REFERENCES users (id),
  subject_company_id uuid REFERENCES companies (id),
  bayesian_score     numeric(4, 3),
  review_count       integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  metrics            jsonb NOT NULL DEFAULT '{}',
  computed_at        timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES users (id),
  CONSTRAINT reputation_snapshots_one_subject CHECK (num_nonnulls(subject_user_id, subject_company_id) = 1)
);
CREATE INDEX reputation_snapshots_user_idx ON reputation_snapshots (subject_user_id, computed_at DESC);
CREATE INDEX reputation_snapshots_company_idx ON reputation_snapshots (subject_company_id, computed_at DESC);
COMMENT ON TABLE reputation_snapshots IS 'Reputação calculada periodicamente, com média bayesiana.';

CREATE TABLE badges (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL,
  criteria   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users (id)
);
COMMENT ON TABLE badges IS 'Selos concedidos por mérito, nunca comprados.';

CREATE TABLE user_badges (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  badge_id           uuid NOT NULL REFERENCES badges (id),
  subject_user_id    uuid REFERENCES users (id),
  subject_company_id uuid REFERENCES companies (id),
  awarded_at         timestamptz NOT NULL DEFAULT now(),
  revoked_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES users (id),
  CONSTRAINT user_badges_one_subject CHECK (num_nonnulls(subject_user_id, subject_company_id) = 1)
);
CREATE INDEX user_badges_badge_idx ON user_badges (badge_id);
CREATE INDEX user_badges_user_idx ON user_badges (subject_user_id);
CREATE INDEX user_badges_company_idx ON user_badges (subject_company_id);
COMMENT ON TABLE user_badges IS 'Selos de cada pessoa ou empresa.';

CREATE TABLE reputation_rules (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  code            text NOT NULL UNIQUE,
  points          integer NOT NULL DEFAULT 0,
  suspension_days integer NOT NULL DEFAULT 0 CHECK (suspension_days >= 0),
  active          boolean NOT NULL DEFAULT true,
  version         integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES users (id)
);
COMMENT ON TABLE reputation_rules IS 'Regras configuráveis de reputação. Recusar vaga nunca gera penalidade.';

CREATE TABLE penalties (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  rule_id            uuid NOT NULL REFERENCES reputation_rules (id),
  subject_user_id    uuid REFERENCES users (id),
  subject_company_id uuid REFERENCES companies (id),
  contract_id        uuid REFERENCES contracts (id),
  status             penalty_status NOT NULL DEFAULT 'active',
  starts_at          timestamptz NOT NULL DEFAULT now(),
  ends_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES users (id),
  CONSTRAINT penalties_one_subject CHECK (num_nonnulls(subject_user_id, subject_company_id) = 1),
  CONSTRAINT penalties_valid_range CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX penalties_rule_idx ON penalties (rule_id);
CREATE INDEX penalties_user_idx ON penalties (subject_user_id, status);
CREATE INDEX penalties_company_idx ON penalties (subject_company_id, status);
CREATE INDEX penalties_contract_idx ON penalties (contract_id);
COMMENT ON TABLE penalties IS 'Penalidades aplicadas, sempre com direito a recurso.';

CREATE TABLE penalty_appeals (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  penalty_id   uuid NOT NULL REFERENCES penalties (id),
  submitted_by uuid NOT NULL REFERENCES users (id),
  body         text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  status       appeal_status NOT NULL DEFAULT 'open',
  decided_by   uuid REFERENCES users (id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES users (id)
);
CREATE INDEX penalty_appeals_penalty_idx ON penalty_appeals (penalty_id);
CREATE INDEX penalty_appeals_submitter_idx ON penalty_appeals (submitted_by);
CREATE INDEX penalty_appeals_decider_idx ON penalty_appeals (decided_by);
COMMENT ON TABLE penalty_appeals IS 'Recursos contra penalidades.';

-- Down Migration

DROP TABLE penalty_appeals;
DROP TABLE penalties;
DROP TABLE reputation_rules;
DROP TABLE user_badges;
DROP TABLE badges;
DROP TABLE reputation_snapshots;
DROP TABLE review_replies;
DROP TABLE review_criteria_scores;
DROP TABLE reviews;
DROP TYPE appeal_status;
DROP TYPE penalty_status;
DROP TYPE reply_status;
DROP TYPE review_criterion;
DROP TYPE review_status;
DROP TYPE review_side;
