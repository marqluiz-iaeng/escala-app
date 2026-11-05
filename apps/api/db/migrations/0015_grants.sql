-- Up Migration

-- Permissões por tabela e, nas colunas sensíveis, por coluna. A RLS decide quais linhas; aqui se decide o que cada papel pode fazer.

GRANT USAGE ON SCHEMA app TO escala_app, escala_auth, escala_worker, escala_support;
GRANT USAGE ON SCHEMA analytics TO escala_analytics;

-- Só com permissão explícita. Vale também para as funções criadas em migrações futuras.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
-- Precisa ser global: o padrão por esquema só acrescenta permissões, não retira.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Funções usadas por políticas e gatilhos, no contexto de quem faz a requisição.
GRANT EXECUTE ON FUNCTION
  app.current_user_id(), app.set_updated_at(), app.set_created_by(), app.forbid_mutation(),
  app.party_kind(text, jsonb),
  app.record_transition(text, text, text, text, uuid, text, text, text),
  app.track_status(), app.contract_status_effects(), app.reset_verification_on_rename(),
  app.is_support(), app.is_admin(), app.is_company_member(uuid),
  app.has_company_role(uuid, public.company_member_role[]), app.is_member_of_any_company(),
  app.job_company(uuid), app.company_has_application_from(uuid), app.can_view_freelancer(uuid),
  app.can_view_photo(uuid), app.can_invite(uuid, uuid), app.has_application_for_job(uuid),
  app.can_read_job(uuid), app.is_application_party(uuid), app.is_contract_party(uuid),
  app.is_shift_party(uuid), app.is_shift_freelancer(uuid), app.has_visible_contract_for_job(uuid),
  app.is_conversation_participant(uuid), app.is_message_participant(uuid), app.can_post_message(uuid),
  app.can_review(uuid), app.can_read_review(uuid), app.is_review_subject(uuid),
  app.is_penalty_subject(uuid), app.is_ticket_requester(uuid), app.is_dispute_party(uuid),
  app.can_read_file(uuid), app.message_under_review(uuid, uuid)
TO escala_app, escala_auth, escala_worker, escala_support;

GRANT SELECT ON app.status_transitions TO escala_app, escala_worker, escala_support;

-- Operações controladas, por função.
GRANT EXECUTE ON FUNCTION
  app.reveal_contract_contact(uuid), app.ensure_conversation(uuid), app.mark_contract_paid(uuid),
  app.confirm_contract_paid(uuid), app.confirm_contract_completion(uuid), app.erase_my_account()
TO escala_app;
GRANT EXECUTE ON FUNCTION
  app.support_read_user(uuid, text), app.support_read_applications(uuid, text),
  app.support_read_messages(uuid, text),
  app.support_read_job_private(uuid, text), app.support_read_check_ins(uuid, text)
TO escala_support;
GRANT EXECUTE ON FUNCTION app.purge_expired_data(), app.reveal_due_reviews() TO escala_worker;

-- escala_app: requisições de pessoas logadas ------------------------------------------------
GRANT SELECT ON users TO escala_app;
-- Status, papel interno e e-mail ficam de fora: o app não consegue se promover nem se reativar.
GRANT UPDATE (phone_enc, legal_name_enc, cpf_index, cpf_enc, birth_date_enc, last_active_at) ON users TO escala_app;
GRANT SELECT ON auth_identities TO escala_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON devices TO escala_app;
GRANT SELECT ON sessions TO escala_app;
GRANT UPDATE (revoked_at, revoked_reason) ON sessions TO escala_app;

GRANT SELECT ON files TO escala_app;
-- scan_status fica de fora: quem envia não pode declarar o arquivo limpo.
GRANT INSERT (owner_user_id, storage_key, mime_type, size_bytes, sha256) ON files TO escala_app;
GRANT UPDATE (deleted_at) ON files TO escala_app;
GRANT SELECT ON legal_documents TO escala_app;
GRANT SELECT ON consents TO escala_app;
-- occurred_at fica de fora: a data do consentimento é a do banco.
GRANT INSERT (user_id, purpose, document_id, granted) ON consents TO escala_app;
GRANT SELECT ON data_requests TO escala_app;
GRANT INSERT (user_id, kind) ON data_requests TO escala_app;
GRANT SELECT ON audit_logs TO escala_app;
GRANT INSERT (actor_user_id, target_user_id, action, entity_type, entity_id, ip_enc, request_id) ON audit_logs TO escala_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_keys TO escala_app;
GRANT SELECT ON feature_flags TO escala_app;
GRANT SELECT ON notifications TO escala_app;
GRANT UPDATE (read_at) ON notifications TO escala_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_preferences TO escala_app;

GRANT SELECT ON companies TO escala_app;
-- Status e selo de verificação ficam de fora, na criação e na alteração.
GRANT INSERT (trade_name, segment, about, logo_file_id, city, public_location) ON companies TO escala_app;
GRANT UPDATE (trade_name, segment, about, logo_file_id, city, public_location) ON companies TO escala_app;
GRANT SELECT, INSERT, UPDATE ON company_private_details TO escala_app;
GRANT SELECT, DELETE ON company_members TO escala_app;
-- O aceite fica de fora na criação: ninguém entra em uma empresa sem aceitar.
GRANT INSERT (company_id, user_id, role, invited_by) ON company_members TO escala_app;
GRANT UPDATE (role, accepted_at) ON company_members TO escala_app;
GRANT SELECT ON company_verifications TO escala_app;

GRANT SELECT ON freelancer_profiles TO escala_app;
GRANT INSERT (user_id, display_name, photo_file_id, bio, experience_years, reference_rate_cents, currency,
  base_location, service_radius_km, available_now, discoverable) ON freelancer_profiles TO escala_app;
GRANT UPDATE (display_name, photo_file_id, bio, experience_years, reference_rate_cents, currency,
  base_location, service_radius_km, available_now, discoverable) ON freelancer_profiles TO escala_app;
GRANT SELECT ON skills TO escala_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON freelancer_skills TO escala_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON portfolio_items TO escala_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON availability_slots TO escala_app;
GRANT SELECT, INSERT, DELETE ON favorites TO escala_app;
GRANT SELECT, DELETE ON documents TO escala_app;
GRANT INSERT (user_id, kind, file_id) ON documents TO escala_app;
GRANT SELECT ON kyc_verifications TO escala_app;

GRANT SELECT ON jobs TO escala_app;
GRANT INSERT (company_id, title, description, primary_skill_id, city, neighbourhood, public_location, starts_at,
  ends_at, slots, pay_amount_cents, currency, pay_unit, status) ON jobs TO escala_app;
GRANT UPDATE (title, description, primary_skill_id, city, neighbourhood, public_location, starts_at,
  ends_at, slots, pay_amount_cents, currency, pay_unit, status, deleted_at) ON jobs TO escala_app;
GRANT SELECT, INSERT, UPDATE ON job_private_details TO escala_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON job_requirements TO escala_app;
GRANT SELECT ON applications TO escala_app;
GRANT INSERT (job_id, freelancer_id, origin, status, note_enc) ON applications TO escala_app;
GRANT UPDATE (status) ON applications TO escala_app;
-- Datas, valores e declarações de pagamento só mudam por gatilho ou função.
GRANT SELECT ON contracts TO escala_app;
GRANT INSERT (application_id, job_id, company_id, freelancer_id, company_contact_user_id, terms_document_id,
  agreed_amount_cents, currency, pay_unit, payment_due_on) ON contracts TO escala_app;
-- Quem cancelou ou faltou é definido pelo banco, a partir de quem agiu.
GRANT UPDATE (status) ON contracts TO escala_app;
GRANT SELECT ON shifts TO escala_app;
GRANT INSERT (contract_id, starts_at, ends_at) ON shifts TO escala_app;
GRANT UPDATE (starts_at, ends_at, status) ON shifts TO escala_app;
GRANT SELECT ON check_ins TO escala_app;
-- within_geofence e occurred_at ficam de fora: quem define é o banco.
GRANT INSERT (shift_id, kind, location, accuracy_m) ON check_ins TO escala_app;
GRANT UPDATE (contested) ON check_ins TO escala_app;
GRANT SELECT ON job_status_history, application_status_history, contract_status_history,
  shift_status_history, dispute_status_history, ticket_status_history TO escala_app;

GRANT SELECT ON conversations TO escala_app;
GRANT SELECT ON conversation_participants TO escala_app;
GRANT UPDATE (last_delivered_message_id, last_read_message_id, muted_until) ON conversation_participants TO escala_app;
GRANT SELECT ON messages TO escala_app;
GRANT INSERT (conversation_id, sender_user_id, kind, body_enc, contact_masked) ON messages TO escala_app;
GRANT UPDATE (status, body_enc) ON messages TO escala_app;
GRANT SELECT ON message_attachments TO escala_app;
GRANT INSERT (message_id, file_id, duration_seconds) ON message_attachments TO escala_app;
GRANT SELECT ON message_reports TO escala_app;
GRANT INSERT (message_id, reporter_user_id, reason) ON message_reports TO escala_app;
GRANT SELECT, INSERT, DELETE ON user_blocks TO escala_app;

GRANT SELECT ON help_articles TO escala_app;
GRANT SELECT ON support_tickets TO escala_app;
GRANT INSERT (requester_user_id, contract_id, category) ON support_tickets TO escala_app;
GRANT UPDATE (status, satisfaction_score) ON support_tickets TO escala_app;
GRANT SELECT ON ticket_messages TO escala_app;
GRANT INSERT (ticket_id, author_user_id, body_enc, file_id) ON ticket_messages TO escala_app;
GRANT SELECT ON disputes TO escala_app;
GRANT INSERT (contract_id, reason) ON disputes TO escala_app;
GRANT UPDATE (status) ON disputes TO escala_app;
GRANT SELECT ON dispute_evidences TO escala_app;
GRANT INSERT (dispute_id, submitted_by, file_id, note_enc) ON dispute_evidences TO escala_app;
GRANT SELECT ON safety_alerts TO escala_app;
GRANT INSERT (user_id, shift_id, location) ON safety_alerts TO escala_app;

GRANT SELECT ON reviews TO escala_app;
-- Avaliador, avaliado e revelação ficam de fora: quem define é o banco.
GRANT INSERT (contract_id, comment) ON reviews TO escala_app;
GRANT SELECT ON review_criteria_scores TO escala_app;
GRANT INSERT (review_id, criterion, score) ON review_criteria_scores TO escala_app;
GRANT SELECT ON review_replies TO escala_app;
GRANT INSERT (review_id, author_user_id, body) ON review_replies TO escala_app;
GRANT SELECT ON reputation_snapshots, badges, user_badges, reputation_rules, penalties TO escala_app;
GRANT SELECT ON penalty_appeals TO escala_app;
GRANT INSERT (penalty_id, submitted_by, body) ON penalty_appeals TO escala_app;

-- escala_auth: login, antes de haver usuário na requisição ---------------------------------
-- Papel interno fica de fora: o login nunca promove ninguém.
GRANT SELECT ON users TO escala_auth;
GRANT INSERT (email_index, email_enc, legal_name_enc, phone_enc, status) ON users TO escala_auth;
GRANT UPDATE (email_index, email_enc, status, last_active_at) ON users TO escala_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_identities, otp_codes, mfa_factors, devices, sessions, refresh_tokens TO escala_auth;
GRANT SELECT, INSERT ON consents TO escala_auth;
GRANT INSERT ON audit_logs TO escala_auth;
GRANT SELECT ON legal_documents, feature_flags, help_articles TO escala_auth;

-- escala_worker: tarefas em segundo plano --------------------------------------------------
GRANT SELECT ON users, devices, notification_preferences, legal_documents, feature_flags, companies,
  freelancer_profiles, skills, review_criteria_scores, badges, reputation_rules TO escala_worker;
GRANT SELECT, INSERT, UPDATE ON notifications, reputation_snapshots, user_badges, penalties,
  company_verifications, kyc_verifications, data_requests TO escala_worker;
GRANT SELECT, UPDATE ON files, jobs, applications, contracts, shifts, disputes, reviews TO escala_worker;
GRANT INSERT ON audit_logs TO escala_worker;

-- escala_support: painel interno. Dados pessoais só pelas funções que registram o acesso ----
GRANT SELECT ON files, legal_documents, company_private_details, company_members, freelancer_profiles,
  skills, freelancer_skills, portfolio_items, kyc_verifications, shifts, review_criteria_scores,
  reputation_snapshots, user_badges, job_status_history, application_status_history,
  contract_status_history, shift_status_history, dispute_status_history, ticket_status_history,
  dispute_evidences TO escala_support;
GRANT INSERT ON legal_documents TO escala_support;
GRANT SELECT, INSERT, UPDATE ON companies, company_verifications, jobs, documents, data_requests,
  skills, badges, help_articles, support_tickets, ticket_messages, disputes, safety_alerts,
  message_reports, review_replies, penalties, penalty_appeals TO escala_support;
GRANT SELECT ON contracts, reviews TO escala_support;
GRANT UPDATE (status, cancelled_by, no_show_party) ON contracts TO escala_support;
GRANT UPDATE (status) ON reviews TO escala_support;
GRANT SELECT, INSERT ON audit_logs TO escala_support;
GRANT SELECT, INSERT, UPDATE ON feature_flags, reputation_rules TO escala_support;

-- Down Migration

DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['escala_app', 'escala_auth', 'escala_worker', 'escala_support'] LOOP
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', role_name);
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA app FROM %I', role_name);
    EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM %I', role_name);
    EXECUTE format('REVOKE USAGE ON SCHEMA app FROM %I', role_name);
  END LOOP;
END;
$$;
REVOKE USAGE ON SCHEMA analytics FROM escala_analytics;
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO PUBLIC;
