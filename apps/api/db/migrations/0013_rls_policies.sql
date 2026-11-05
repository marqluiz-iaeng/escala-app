-- Up Migration

-- RLS em todas as tabelas de public. Sem política para um papel, o padrão é negar.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'pgmigrations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END;
$$;

-- Identidade -------------------------------------------------------------------------------
CREATE POLICY users_app_select ON users FOR SELECT TO escala_app USING (id = app.current_user_id());
CREATE POLICY users_app_update ON users FOR UPDATE TO escala_app
  USING (id = app.current_user_id()) WITH CHECK (id = app.current_user_id());
CREATE POLICY users_auth_all ON users FOR ALL TO escala_auth USING (true) WITH CHECK (true);
CREATE POLICY users_worker_select ON users FOR SELECT TO escala_worker USING (true);

CREATE POLICY auth_identities_app_select ON auth_identities FOR SELECT TO escala_app
  USING (user_id = app.current_user_id());
CREATE POLICY auth_identities_auth_all ON auth_identities FOR ALL TO escala_auth USING (true) WITH CHECK (true);

CREATE POLICY otp_codes_auth_all ON otp_codes FOR ALL TO escala_auth USING (true) WITH CHECK (true);
CREATE POLICY mfa_factors_auth_all ON mfa_factors FOR ALL TO escala_auth USING (true) WITH CHECK (true);
CREATE POLICY refresh_tokens_auth_all ON refresh_tokens FOR ALL TO escala_auth USING (true) WITH CHECK (true);

CREATE POLICY devices_app_all ON devices FOR ALL TO escala_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
CREATE POLICY devices_auth_all ON devices FOR ALL TO escala_auth USING (true) WITH CHECK (true);
CREATE POLICY devices_worker_select ON devices FOR SELECT TO escala_worker USING (true);

CREATE POLICY sessions_app_select ON sessions FOR SELECT TO escala_app USING (user_id = app.current_user_id());
CREATE POLICY sessions_app_update ON sessions FOR UPDATE TO escala_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
CREATE POLICY sessions_auth_all ON sessions FOR ALL TO escala_auth USING (true) WITH CHECK (true);

-- Plataforma -------------------------------------------------------------------------------
CREATE POLICY files_app_select ON files FOR SELECT TO escala_app
  USING (owner_user_id = app.current_user_id() OR app.can_read_file(id));
CREATE POLICY files_app_insert ON files FOR INSERT TO escala_app WITH CHECK (owner_user_id = app.current_user_id());
CREATE POLICY files_app_update ON files FOR UPDATE TO escala_app
  USING (owner_user_id = app.current_user_id()) WITH CHECK (owner_user_id = app.current_user_id());
CREATE POLICY files_worker_all ON files FOR ALL TO escala_worker USING (true) WITH CHECK (true);
CREATE POLICY files_support_select ON files FOR SELECT TO escala_support USING (app.is_support());

CREATE POLICY legal_documents_read ON legal_documents FOR SELECT
  TO escala_app, escala_auth, escala_worker, escala_support USING (true);
CREATE POLICY legal_documents_support_write ON legal_documents FOR INSERT TO escala_support WITH CHECK (app.is_admin());

CREATE POLICY consents_app_select ON consents FOR SELECT TO escala_app USING (user_id = app.current_user_id());
CREATE POLICY consents_app_insert ON consents FOR INSERT TO escala_app WITH CHECK (user_id = app.current_user_id());
CREATE POLICY consents_auth_all ON consents FOR ALL TO escala_auth USING (true) WITH CHECK (true);

CREATE POLICY data_requests_app_select ON data_requests FOR SELECT TO escala_app USING (user_id = app.current_user_id());
CREATE POLICY data_requests_app_insert ON data_requests FOR INSERT TO escala_app WITH CHECK (user_id = app.current_user_id());
CREATE POLICY data_requests_worker_all ON data_requests FOR ALL TO escala_worker USING (true) WITH CHECK (true);
CREATE POLICY data_requests_support_all ON data_requests FOR ALL TO escala_support
  USING (app.is_support()) WITH CHECK (app.is_support());

CREATE POLICY audit_logs_app_select ON audit_logs FOR SELECT TO escala_app
  USING (target_user_id = app.current_user_id() OR actor_user_id = app.current_user_id());
CREATE POLICY audit_logs_app_insert ON audit_logs FOR INSERT TO escala_app
  WITH CHECK (actor_user_id = app.current_user_id());
CREATE POLICY audit_logs_auth_insert ON audit_logs FOR INSERT TO escala_auth WITH CHECK (true);
CREATE POLICY audit_logs_worker_insert ON audit_logs FOR INSERT TO escala_worker WITH CHECK (actor_user_id IS NULL);
CREATE POLICY audit_logs_support_select ON audit_logs FOR SELECT TO escala_support USING (app.is_admin());
CREATE POLICY audit_logs_support_insert ON audit_logs FOR INSERT TO escala_support
  WITH CHECK (app.is_support() AND actor_user_id = app.current_user_id());

CREATE POLICY idempotency_keys_app_all ON idempotency_keys FOR ALL TO escala_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());

CREATE POLICY feature_flags_read ON feature_flags FOR SELECT
  TO escala_app, escala_auth, escala_worker, escala_support USING (true);
CREATE POLICY feature_flags_admin_write ON feature_flags FOR ALL TO escala_support
  USING (app.is_admin()) WITH CHECK (app.is_admin());

CREATE POLICY notifications_app_select ON notifications FOR SELECT TO escala_app USING (user_id = app.current_user_id());
CREATE POLICY notifications_app_update ON notifications FOR UPDATE TO escala_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
CREATE POLICY notifications_worker_all ON notifications FOR ALL TO escala_worker USING (true) WITH CHECK (true);

CREATE POLICY notification_preferences_app_all ON notification_preferences FOR ALL TO escala_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
CREATE POLICY notification_preferences_worker_select ON notification_preferences FOR SELECT TO escala_worker USING (true);

-- Empresas ---------------------------------------------------------------------------------
CREATE POLICY companies_app_select ON companies FOR SELECT TO escala_app
  USING (
    (app.current_user_id() IS NOT NULL AND status = 'active' AND deleted_at IS NULL)
    OR created_by = app.current_user_id() OR app.is_company_member(id)
  );
CREATE POLICY companies_app_insert ON companies FOR INSERT TO escala_app WITH CHECK (app.current_user_id() IS NOT NULL);
CREATE POLICY companies_app_update ON companies FOR UPDATE TO escala_app
  USING (app.has_company_role(id, '{owner,admin}')) WITH CHECK (app.has_company_role(id, '{owner,admin}'));
CREATE POLICY companies_worker_select ON companies FOR SELECT TO escala_worker USING (true);
CREATE POLICY companies_support_all ON companies FOR ALL TO escala_support USING (app.is_support()) WITH CHECK (app.is_support());

CREATE POLICY company_private_app_select ON company_private_details FOR SELECT TO escala_app
  USING (app.is_company_member(company_id));
CREATE POLICY company_private_app_insert ON company_private_details FOR INSERT TO escala_app
  WITH CHECK (app.has_company_role(company_id, '{owner,admin}'));
CREATE POLICY company_private_app_update ON company_private_details FOR UPDATE TO escala_app
  USING (app.has_company_role(company_id, '{owner,admin}')) WITH CHECK (app.has_company_role(company_id, '{owner,admin}'));
CREATE POLICY company_private_support_select ON company_private_details FOR SELECT TO escala_support USING (app.is_support());

CREATE POLICY company_members_app_select ON company_members FOR SELECT TO escala_app
  USING (user_id = app.current_user_id() OR app.is_company_member(company_id));
CREATE POLICY company_members_app_insert ON company_members FOR INSERT TO escala_app
  WITH CHECK (app.has_company_role(company_id, '{owner}')
    OR (app.has_company_role(company_id, '{admin}') AND role <> 'owner'));
CREATE POLICY company_members_app_update ON company_members FOR UPDATE TO escala_app
  USING (user_id = app.current_user_id() OR app.has_company_role(company_id, '{owner,admin}'))
  WITH CHECK (user_id = app.current_user_id() OR app.has_company_role(company_id, '{owner,admin}'));
CREATE POLICY company_members_app_delete ON company_members FOR DELETE TO escala_app
  USING (user_id = app.current_user_id() OR app.has_company_role(company_id, '{owner}'));
CREATE POLICY company_members_support_select ON company_members FOR SELECT TO escala_support USING (app.is_support());

CREATE POLICY company_verifications_app_select ON company_verifications FOR SELECT TO escala_app
  USING (app.is_company_member(company_id));
CREATE POLICY company_verifications_worker_all ON company_verifications FOR ALL TO escala_worker USING (true) WITH CHECK (true);
CREATE POLICY company_verifications_support_all ON company_verifications FOR ALL TO escala_support
  USING (app.is_support()) WITH CHECK (app.is_support());

-- Freelancers ------------------------------------------------------------------------------
CREATE POLICY freelancer_profiles_app_select ON freelancer_profiles FOR SELECT TO escala_app
  USING (app.can_view_freelancer(user_id));
CREATE POLICY freelancer_profiles_app_insert ON freelancer_profiles FOR INSERT TO escala_app
  WITH CHECK (user_id = app.current_user_id());
CREATE POLICY freelancer_profiles_app_update ON freelancer_profiles FOR UPDATE TO escala_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
CREATE POLICY freelancer_profiles_worker_select ON freelancer_profiles FOR SELECT TO escala_worker USING (true);
CREATE POLICY freelancer_profiles_support_select ON freelancer_profiles FOR SELECT TO escala_support USING (app.is_support());

CREATE POLICY skills_read ON skills FOR SELECT TO escala_app, escala_worker, escala_support USING (true);
CREATE POLICY skills_support_write ON skills FOR ALL TO escala_support USING (app.is_support()) WITH CHECK (app.is_support());

CREATE POLICY freelancer_skills_app_select ON freelancer_skills FOR SELECT TO escala_app USING (app.can_view_freelancer(freelancer_id));
CREATE POLICY freelancer_skills_app_write ON freelancer_skills FOR ALL TO escala_app
  USING (freelancer_id = app.current_user_id()) WITH CHECK (freelancer_id = app.current_user_id());
CREATE POLICY freelancer_skills_support_select ON freelancer_skills FOR SELECT TO escala_support USING (app.is_support());

CREATE POLICY portfolio_items_app_select ON portfolio_items FOR SELECT TO escala_app USING (app.can_view_freelancer(freelancer_id));
CREATE POLICY portfolio_items_app_write ON portfolio_items FOR ALL TO escala_app
  USING (freelancer_id = app.current_user_id()) WITH CHECK (freelancer_id = app.current_user_id());
CREATE POLICY portfolio_items_support_select ON portfolio_items FOR SELECT TO escala_support USING (app.is_support());

CREATE POLICY availability_slots_app_select ON availability_slots FOR SELECT TO escala_app USING (app.can_view_freelancer(freelancer_id));
CREATE POLICY availability_slots_app_write ON availability_slots FOR ALL TO escala_app
  USING (freelancer_id = app.current_user_id()) WITH CHECK (freelancer_id = app.current_user_id());

CREATE POLICY favorites_app_all ON favorites FOR ALL TO escala_app
  USING (app.is_company_member(company_id))
  WITH CHECK (app.is_company_member(company_id) AND app.can_view_freelancer(freelancer_id));

CREATE POLICY documents_app_select ON documents FOR SELECT TO escala_app USING (user_id = app.current_user_id());
CREATE POLICY documents_app_insert ON documents FOR INSERT TO escala_app WITH CHECK (user_id = app.current_user_id());
CREATE POLICY documents_app_delete ON documents FOR DELETE TO escala_app USING (user_id = app.current_user_id());
CREATE POLICY documents_support_all ON documents FOR ALL TO escala_support USING (app.is_support()) WITH CHECK (app.is_support());

CREATE POLICY kyc_verifications_app_select ON kyc_verifications FOR SELECT TO escala_app USING (user_id = app.current_user_id());
CREATE POLICY kyc_verifications_worker_all ON kyc_verifications FOR ALL TO escala_worker USING (true) WITH CHECK (true);
CREATE POLICY kyc_verifications_support_select ON kyc_verifications FOR SELECT TO escala_support USING (app.is_support());

-- Vagas e contratos ------------------------------------------------------------------------
CREATE POLICY jobs_app_select ON jobs FOR SELECT TO escala_app
  USING (
    (app.current_user_id() IS NOT NULL AND status = 'published' AND deleted_at IS NULL)
    OR app.is_company_member(company_id) OR app.has_application_for_job(id)
  );
CREATE POLICY jobs_app_insert ON jobs FOR INSERT TO escala_app
  WITH CHECK (app.has_company_role(company_id, '{owner,admin,recruiter}'));
CREATE POLICY jobs_app_update ON jobs FOR UPDATE TO escala_app
  USING (app.has_company_role(company_id, '{owner,admin,recruiter}'))
  WITH CHECK (app.has_company_role(company_id, '{owner,admin,recruiter}'));
CREATE POLICY jobs_worker_all ON jobs FOR ALL TO escala_worker USING (true) WITH CHECK (true);
CREATE POLICY jobs_support_all ON jobs FOR ALL TO escala_support USING (app.is_support()) WITH CHECK (app.is_support());

CREATE POLICY job_private_details_app_select ON job_private_details FOR SELECT TO escala_app
  USING (app.is_company_member(app.job_company(job_id)) OR app.has_visible_contract_for_job(job_id));
CREATE POLICY job_private_details_app_insert ON job_private_details FOR INSERT TO escala_app
  WITH CHECK (app.has_company_role(app.job_company(job_id), '{owner,admin,recruiter}'));
CREATE POLICY job_private_details_app_update ON job_private_details FOR UPDATE TO escala_app
  USING (app.has_company_role(app.job_company(job_id), '{owner,admin,recruiter}'))
  WITH CHECK (app.has_company_role(app.job_company(job_id), '{owner,admin,recruiter}'));

CREATE POLICY job_requirements_app_select ON job_requirements FOR SELECT TO escala_app USING (app.can_read_job(job_id));
CREATE POLICY job_requirements_app_write ON job_requirements FOR ALL TO escala_app
  USING (app.has_company_role(app.job_company(job_id), '{owner,admin,recruiter}'))
  WITH CHECK (app.has_company_role(app.job_company(job_id), '{owner,admin,recruiter}'));

-- Olha as colunas da linha: uma função que busca pelo ID não enxerga a linha sendo inserida.
CREATE POLICY applications_app_select ON applications FOR SELECT TO escala_app
  USING (freelancer_id = app.current_user_id()
    OR (status <> 'withdrawn' AND app.is_company_member(app.job_company(job_id))));
CREATE POLICY applications_app_insert ON applications FOR INSERT TO escala_app
  WITH CHECK (
    (freelancer_id = app.current_user_id() AND origin = 'applied')
    OR (origin = 'invited' AND app.can_invite(job_id, freelancer_id))
  );
CREATE POLICY applications_app_update ON applications FOR UPDATE TO escala_app
  USING (freelancer_id = app.current_user_id()
    OR (status <> 'withdrawn' AND app.is_company_member(app.job_company(job_id))))
  WITH CHECK (freelancer_id = app.current_user_id() OR app.is_company_member(app.job_company(job_id)));
CREATE POLICY applications_worker_all ON applications FOR ALL TO escala_worker USING (true) WITH CHECK (true);

CREATE POLICY contracts_app_select ON contracts FOR SELECT TO escala_app
  USING (freelancer_id = app.current_user_id() OR app.is_company_member(company_id));
CREATE POLICY contracts_app_insert ON contracts FOR INSERT TO escala_app
  WITH CHECK (app.has_company_role(company_id, '{owner,admin,recruiter}'));
CREATE POLICY contracts_app_update ON contracts FOR UPDATE TO escala_app
  USING (freelancer_id = app.current_user_id() OR app.is_company_member(company_id))
  WITH CHECK (freelancer_id = app.current_user_id() OR app.is_company_member(company_id));
CREATE POLICY contracts_worker_all ON contracts FOR ALL TO escala_worker USING (true) WITH CHECK (true);
CREATE POLICY contracts_support_all ON contracts FOR ALL TO escala_support USING (app.is_support()) WITH CHECK (app.is_support());

CREATE POLICY shifts_app_select ON shifts FOR SELECT TO escala_app USING (app.is_contract_party(contract_id));
CREATE POLICY shifts_app_insert ON shifts FOR INSERT TO escala_app
  WITH CHECK (app.is_contract_party(contract_id) AND NOT EXISTS (
    SELECT 1 FROM contracts c WHERE c.id = contract_id AND c.freelancer_id = app.current_user_id()
  ));
CREATE POLICY shifts_app_update ON shifts FOR UPDATE TO escala_app
  USING (app.is_contract_party(contract_id)) WITH CHECK (app.is_contract_party(contract_id));
CREATE POLICY shifts_worker_all ON shifts FOR ALL TO escala_worker USING (true) WITH CHECK (true);
CREATE POLICY shifts_support_select ON shifts FOR SELECT TO escala_support USING (app.is_support());

CREATE POLICY check_ins_app_select ON check_ins FOR SELECT TO escala_app USING (app.is_shift_party(shift_id));
CREATE POLICY check_ins_app_insert ON check_ins FOR INSERT TO escala_app WITH CHECK (app.is_shift_freelancer(shift_id));
CREATE POLICY check_ins_app_update ON check_ins FOR UPDATE TO escala_app
  USING (app.is_shift_party(shift_id)) WITH CHECK (app.is_shift_party(shift_id));

CREATE POLICY job_status_history_app_select ON job_status_history FOR SELECT TO escala_app
  USING (app.is_company_member(app.job_company(job_id)));
CREATE POLICY job_status_history_support_select ON job_status_history FOR SELECT TO escala_support USING (app.is_support());
CREATE POLICY application_status_history_app_select ON application_status_history FOR SELECT TO escala_app
  USING (app.is_application_party(application_id));
CREATE POLICY application_status_history_support_select ON application_status_history FOR SELECT TO escala_support USING (app.is_support());
CREATE POLICY contract_status_history_app_select ON contract_status_history FOR SELECT TO escala_app
  USING (app.is_contract_party(contract_id));
CREATE POLICY contract_status_history_support_select ON contract_status_history FOR SELECT TO escala_support USING (app.is_support());
CREATE POLICY shift_status_history_app_select ON shift_status_history FOR SELECT TO escala_app
  USING (app.is_shift_party(shift_id));
CREATE POLICY shift_status_history_support_select ON shift_status_history FOR SELECT TO escala_support USING (app.is_support());

-- Conversas --------------------------------------------------------------------------------
CREATE POLICY conversations_app_select ON conversations FOR SELECT TO escala_app USING (app.is_conversation_participant(id));

CREATE POLICY conversation_participants_app_select ON conversation_participants FOR SELECT TO escala_app
  USING (app.is_conversation_participant(conversation_id));
CREATE POLICY conversation_participants_app_update ON conversation_participants FOR UPDATE TO escala_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());

CREATE POLICY messages_app_select ON messages FOR SELECT TO escala_app
  USING (app.is_conversation_participant(conversation_id)
    AND (status = 'visible' OR sender_user_id = app.current_user_id()));
CREATE POLICY messages_app_insert ON messages FOR INSERT TO escala_app
  WITH CHECK (sender_user_id = app.current_user_id() AND kind <> 'system' AND app.can_post_message(conversation_id));
CREATE POLICY messages_app_update ON messages FOR UPDATE TO escala_app
  USING (sender_user_id = app.current_user_id()) WITH CHECK (sender_user_id = app.current_user_id());

CREATE POLICY message_attachments_app_select ON message_attachments FOR SELECT TO escala_app
  USING (app.is_message_participant(message_id));
CREATE POLICY message_attachments_app_insert ON message_attachments FOR INSERT TO escala_app
  WITH CHECK (EXISTS (
    SELECT 1 FROM messages m WHERE m.id = message_id AND m.sender_user_id = app.current_user_id()
  ));

CREATE POLICY message_reports_app_select ON message_reports FOR SELECT TO escala_app USING (reporter_user_id = app.current_user_id());
CREATE POLICY message_reports_app_insert ON message_reports FOR INSERT TO escala_app
  WITH CHECK (reporter_user_id = app.current_user_id() AND app.is_message_participant(message_id));
CREATE POLICY message_reports_support_all ON message_reports FOR ALL TO escala_support
  USING (app.is_support()) WITH CHECK (app.is_support());

CREATE POLICY user_blocks_app_all ON user_blocks FOR ALL TO escala_app
  USING (blocker_user_id = app.current_user_id()) WITH CHECK (blocker_user_id = app.current_user_id());

-- Suporte ----------------------------------------------------------------------------------
CREATE POLICY help_articles_read ON help_articles FOR SELECT TO escala_app, escala_auth
  USING (published_at IS NOT NULL AND published_at <= now());
CREATE POLICY help_articles_support_all ON help_articles FOR ALL TO escala_support
  USING (app.is_support()) WITH CHECK (app.is_support());

CREATE POLICY support_tickets_app_select ON support_tickets FOR SELECT TO escala_app USING (requester_user_id = app.current_user_id());
CREATE POLICY support_tickets_app_insert ON support_tickets FOR INSERT TO escala_app
  WITH CHECK (requester_user_id = app.current_user_id()
    AND (contract_id IS NULL OR app.is_contract_party(contract_id)));
CREATE POLICY support_tickets_app_update ON support_tickets FOR UPDATE TO escala_app
  USING (requester_user_id = app.current_user_id()) WITH CHECK (requester_user_id = app.current_user_id());
CREATE POLICY support_tickets_support_all ON support_tickets FOR ALL TO escala_support
  USING (app.is_support()) WITH CHECK (app.is_support());

CREATE POLICY ticket_messages_app_select ON ticket_messages FOR SELECT TO escala_app
  USING (NOT internal_note AND app.is_ticket_requester(ticket_id));
CREATE POLICY ticket_messages_app_insert ON ticket_messages FOR INSERT TO escala_app
  WITH CHECK (NOT internal_note AND author_user_id = app.current_user_id() AND app.is_ticket_requester(ticket_id));
CREATE POLICY ticket_messages_support_all ON ticket_messages FOR ALL TO escala_support
  USING (app.is_support()) WITH CHECK (app.is_support());

CREATE POLICY disputes_app_select ON disputes FOR SELECT TO escala_app USING (app.is_contract_party(contract_id));
CREATE POLICY disputes_app_insert ON disputes FOR INSERT TO escala_app WITH CHECK (app.is_contract_party(contract_id));
CREATE POLICY disputes_app_update ON disputes FOR UPDATE TO escala_app
  USING (opened_by = app.current_user_id()) WITH CHECK (opened_by = app.current_user_id());
CREATE POLICY disputes_worker_all ON disputes FOR ALL TO escala_worker USING (true) WITH CHECK (true);
CREATE POLICY disputes_support_all ON disputes FOR ALL TO escala_support USING (app.is_support()) WITH CHECK (app.is_support());

CREATE POLICY dispute_evidences_app_select ON dispute_evidences FOR SELECT TO escala_app USING (submitted_by = app.current_user_id());
CREATE POLICY dispute_evidences_app_insert ON dispute_evidences FOR INSERT TO escala_app
  WITH CHECK (submitted_by = app.current_user_id() AND app.is_dispute_party(dispute_id));
CREATE POLICY dispute_evidences_support_select ON dispute_evidences FOR SELECT TO escala_support USING (app.is_support());

CREATE POLICY dispute_status_history_app_select ON dispute_status_history FOR SELECT TO escala_app
  USING (app.is_dispute_party(dispute_id));
CREATE POLICY dispute_status_history_support_select ON dispute_status_history FOR SELECT TO escala_support USING (app.is_support());
CREATE POLICY ticket_status_history_app_select ON ticket_status_history FOR SELECT TO escala_app
  USING (app.is_ticket_requester(ticket_id));
CREATE POLICY ticket_status_history_support_select ON ticket_status_history FOR SELECT TO escala_support USING (app.is_support());

CREATE POLICY safety_alerts_app_select ON safety_alerts FOR SELECT TO escala_app USING (user_id = app.current_user_id());
CREATE POLICY safety_alerts_app_insert ON safety_alerts FOR INSERT TO escala_app WITH CHECK (user_id = app.current_user_id());
CREATE POLICY safety_alerts_support_all ON safety_alerts FOR ALL TO escala_support USING (app.is_support()) WITH CHECK (app.is_support());

-- Reputação --------------------------------------------------------------------------------
CREATE POLICY reviews_app_select ON reviews FOR SELECT TO escala_app
  USING (reviewer_user_id = app.current_user_id()
    OR (app.current_user_id() IS NOT NULL AND revealed_at IS NOT NULL AND status = 'published'));
CREATE POLICY reviews_app_insert ON reviews FOR INSERT TO escala_app WITH CHECK (app.can_review(contract_id));
CREATE POLICY reviews_worker_all ON reviews FOR ALL TO escala_worker USING (true) WITH CHECK (true);
CREATE POLICY reviews_support_all ON reviews FOR ALL TO escala_support USING (app.is_support()) WITH CHECK (app.is_support());

CREATE POLICY review_scores_app_select ON review_criteria_scores FOR SELECT TO escala_app USING (app.can_read_review(review_id));
CREATE POLICY review_scores_app_insert ON review_criteria_scores FOR INSERT TO escala_app
  WITH CHECK (EXISTS (
    -- Só na mesma transação da avaliação: ninguém completa as notas depois de ler a da outra parte.
    SELECT 1 FROM reviews r
    WHERE r.id = review_id AND r.reviewer_user_id = app.current_user_id() AND r.created_at = now()
  ));
CREATE POLICY review_scores_worker_select ON review_criteria_scores FOR SELECT TO escala_worker USING (true);
CREATE POLICY review_scores_support_select ON review_criteria_scores FOR SELECT TO escala_support USING (app.is_support());

CREATE POLICY review_replies_app_select ON review_replies FOR SELECT TO escala_app
  USING (author_user_id = app.current_user_id() OR (status = 'published' AND app.can_read_review(review_id)));
CREATE POLICY review_replies_app_insert ON review_replies FOR INSERT TO escala_app
  WITH CHECK (author_user_id = app.current_user_id() AND app.is_review_subject(review_id));
CREATE POLICY review_replies_support_all ON review_replies FOR ALL TO escala_support USING (app.is_support()) WITH CHECK (app.is_support());

CREATE POLICY reputation_snapshots_read ON reputation_snapshots FOR SELECT TO escala_app, escala_support
  USING (app.current_user_id() IS NOT NULL);
CREATE POLICY reputation_snapshots_worker_all ON reputation_snapshots FOR ALL TO escala_worker USING (true) WITH CHECK (true);

CREATE POLICY badges_read ON badges FOR SELECT TO escala_app, escala_worker USING (true);
CREATE POLICY badges_support_all ON badges FOR ALL TO escala_support USING (app.is_support()) WITH CHECK (app.is_support());

CREATE POLICY user_badges_read ON user_badges FOR SELECT TO escala_app, escala_support
  USING (app.current_user_id() IS NOT NULL);
CREATE POLICY user_badges_worker_all ON user_badges FOR ALL TO escala_worker USING (true) WITH CHECK (true);

CREATE POLICY reputation_rules_read ON reputation_rules FOR SELECT TO escala_app, escala_worker, escala_support USING (true);
CREATE POLICY reputation_rules_admin_write ON reputation_rules FOR ALL TO escala_support USING (app.is_admin()) WITH CHECK (app.is_admin());

CREATE POLICY penalties_app_select ON penalties FOR SELECT TO escala_app
  USING (subject_user_id = app.current_user_id() OR (subject_company_id IS NOT NULL AND app.is_company_member(subject_company_id)));
CREATE POLICY penalties_worker_all ON penalties FOR ALL TO escala_worker USING (true) WITH CHECK (true);
CREATE POLICY penalties_support_all ON penalties FOR ALL TO escala_support USING (app.is_support()) WITH CHECK (app.is_support());

CREATE POLICY penalty_appeals_app_select ON penalty_appeals FOR SELECT TO escala_app USING (submitted_by = app.current_user_id());
CREATE POLICY penalty_appeals_app_insert ON penalty_appeals FOR INSERT TO escala_app
  WITH CHECK (submitted_by = app.current_user_id() AND app.is_penalty_subject(penalty_id));
CREATE POLICY penalty_appeals_support_all ON penalty_appeals FOR ALL TO escala_support USING (app.is_support()) WITH CHECK (app.is_support());

-- Down Migration

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'pgmigrations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END;
$$;
