import { chmodSync, closeSync, existsSync, mkdirSync, openSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

export type DB = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('freelancer','company')),
  email_index   TEXT UNIQUE,
  email_enc     TEXT,
  password_hash TEXT,
  phone_enc     TEXT,
  full_name_enc TEXT,
  display_name  TEXT NOT NULL,
  city          TEXT,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  INTEGER,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER,
  deleted_at    INTEGER
);

CREATE TABLE IF NOT EXISTS freelancer_profiles (
  user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  categories       TEXT NOT NULL,
  bio              TEXT NOT NULL DEFAULT '',
  experience_years INTEGER NOT NULL DEFAULT 0,
  day_rate_cents   INTEGER,
  available        INTEGER NOT NULL DEFAULT 1,
  discoverable     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS company_profiles (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  segment    TEXT NOT NULL,
  about      TEXT NOT NULL DEFAULT '',
  cnpj_index TEXT UNIQUE,
  cnpj_enc   TEXT,
  verified   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gigs (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES users(id),
  title         TEXT NOT NULL,
  category      TEXT NOT NULL,
  description   TEXT NOT NULL,
  city          TEXT NOT NULL,
  neighbourhood TEXT NOT NULL,
  address_enc   TEXT,
  date          TEXT NOT NULL,
  start_time    TEXT NOT NULL,
  end_time      TEXT NOT NULL,
  pay_cents     INTEGER NOT NULL,
  pay_type      TEXT NOT NULL,
  slots         INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','filled','closed','cancelled')),
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS gigs_feed ON gigs (status, date);
CREATE INDEX IF NOT EXISTS gigs_company ON gigs (company_id);

CREATE TABLE IF NOT EXISTS applications (
  id                 TEXT PRIMARY KEY,
  gig_id             TEXT NOT NULL REFERENCES gigs(id),
  freelancer_id      TEXT NOT NULL REFERENCES users(id),
  status             TEXT NOT NULL CHECK (status IN ('invited','pending','accepted','rejected','withdrawn','cancelled')),
  note_enc           TEXT,
  created_at         INTEGER NOT NULL,
  decided_at         INTEGER,
  freelancer_read_at INTEGER NOT NULL DEFAULT 0,
  company_read_at    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (gig_id, freelancer_id)
);
CREATE INDEX IF NOT EXISTS applications_freelancer ON applications (freelancer_id);

CREATE TABLE IF NOT EXISTS messages (
  id             TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  sender_id      TEXT NOT NULL REFERENCES users(id),
  body_enc       TEXT,
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_thread ON messages (application_id, created_at);

CREATE TABLE IF NOT EXISTS reviews (
  id             TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  from_user      TEXT NOT NULL REFERENCES users(id),
  to_user        TEXT NOT NULL REFERENCES users(id),
  stars          INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at     INTEGER NOT NULL,
  UNIQUE (application_id, from_user)
);
CREATE INDEX IF NOT EXISTS reviews_to ON reviews (to_user);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device       TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

-- Códigos de confirmação, sempre como HMAC. No cadastro, payload_enc guarda os dados cifrados
-- até o e-mail ser confirmado: a conta só nasce em users depois disso.
CREATE TABLE IF NOT EXISTS otp_codes (
  purpose     TEXT NOT NULL CHECK (purpose IN ('signup','password_reset','email_change')),
  subject     TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  payload_enc TEXT,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  PRIMARY KEY (purpose, subject)
);

CREATE TABLE IF NOT EXISTS email_throttle (
  email_index  TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);

-- Registro somente de inclusão: prova o que foi aceito, em qual versão e quando.
CREATE TABLE IF NOT EXISTS consents (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  purpose    TEXT NOT NULL,
  version    TEXT NOT NULL,
  granted    INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS consents_user ON consents (user_id, purpose, created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id             TEXT PRIMARY KEY,
  at             INTEGER NOT NULL,
  actor_id       TEXT,
  action         TEXT NOT NULL,
  target_user_id TEXT,
  ip_enc         TEXT
);
CREATE INDEX IF NOT EXISTS audit_target ON audit_log (target_user_id, at);
CREATE INDEX IF NOT EXISTS audit_actor ON audit_log (actor_id, at);
`;

export function openDb(path: string): DB {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  // A permissão vem antes de abrir: o SQLite copia a do banco para os arquivos -wal e -shm.
  closeSync(openSync(path, 'a', 0o600));
  chmodSync(path, 0o600);
  // Nunca apague um -wal existente: ele pode guardar transações ainda não aplicadas ao banco.
  for (const suffix of ['-wal', '-shm']) {
    if (existsSync(path + suffix)) chmodSync(path + suffix, 0o600);
  }
  const db = new DatabaseSync(path);
  // secure_delete sobrescreve com zeros o que for apagado: excluir é excluir de verdade.
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON; PRAGMA busy_timeout=3000;');
  db.exec(SCHEMA);
  return db;
}

export function one<T>(db: DB, sql: string, ...params: SQLInputValue[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function all<T>(db: DB, sql: string, ...params: SQLInputValue[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function run(db: DB, sql: string, ...params: SQLInputValue[]) {
  return db.prepare(sql).run(...params);
}

/** Transações são síncronas de propósito: nunca use await dentro de `fn`. */
export function tx<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
