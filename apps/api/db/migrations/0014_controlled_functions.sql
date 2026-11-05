-- Up Migration

-- Liberação de contato: só para a outra parte de um contrato vigente, dentro do prazo, e sempre registrada.
CREATE FUNCTION app.reveal_contract_contact(p_contract uuid)
  RETURNS TABLE (legal_name_enc text, phone_enc text)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user uuid := app.current_user_id();
  v_contract public.contracts;
  v_other uuid;
BEGIN
  SELECT * INTO v_contract FROM public.contracts c WHERE c.id = p_contract;
  IF NOT FOUND OR NOT app.is_contract_party(p_contract) THEN
    RAISE EXCEPTION 'contrato não encontrado' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_contract.status NOT IN ('accepted', 'in_progress', 'awaiting_confirmation', 'completed', 'disputed')
     OR v_contract.contact_visible_until IS NULL
     OR v_contract.contact_visible_until <= pg_catalog.now() THEN
    RAISE EXCEPTION 'contato indisponível' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_other := CASE WHEN v_contract.freelancer_id = v_user
    THEN v_contract.company_contact_user_id ELSE v_contract.freelancer_id END;

  -- No máximo um registro por hora para o mesmo acesso, para o histórico continuar legível.
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs l
    WHERE l.actor_user_id = v_user AND l.target_user_id = v_other AND l.action = 'contact.view'
      AND l.occurred_at > pg_catalog.now() - interval '1 hour'
  ) THEN
    INSERT INTO public.audit_logs (actor_user_id, target_user_id, action, entity_type, entity_id)
    VALUES (v_user, v_other, 'contact.view', 'contract', p_contract);
  END IF;

  RETURN QUERY SELECT u.legal_name_enc, u.phone_enc FROM public.users u WHERE u.id = v_other;
END;
$$;

-- Abre a conversa de uma candidatura. Só as partes abrem, e a conversa nunca é duplicada.
CREATE FUNCTION app.ensure_conversation(p_application uuid) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_conversation uuid;
  v_freelancer uuid;
  v_company uuid;
BEGIN
  IF NOT app.is_application_party(p_application) THEN
    RAISE EXCEPTION 'candidatura não encontrada' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT c.id INTO v_conversation FROM public.conversations c WHERE c.application_id = p_application;
  IF FOUND THEN
    RETURN v_conversation;
  END IF;

  SELECT a.freelancer_id, j.company_id INTO v_freelancer, v_company
    FROM public.applications a JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = p_application;

  INSERT INTO public.conversations (application_id) VALUES (p_application) RETURNING id INTO v_conversation;
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (v_conversation, v_freelancer);
  INSERT INTO public.conversation_participants (conversation_id, user_id)
    SELECT v_conversation, m.user_id FROM public.company_members m
    WHERE m.company_id = v_company AND m.accepted_at IS NOT NULL;
  RETURN v_conversation;
END;
$$;

-- "Paguei" e "recebi" são declarações sobre um pagamento feito fora do app.
CREATE FUNCTION app.mark_contract_paid(p_contract uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.contracts c SET company_marked_paid_at = pg_catalog.now()
  WHERE c.id = p_contract AND c.company_marked_paid_at IS NULL
    AND c.status IN ('in_progress', 'awaiting_confirmation', 'completed', 'disputed')
    AND app.is_company_member(c.company_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'não foi possível marcar o pagamento' USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

CREATE FUNCTION app.confirm_contract_paid(p_contract uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.contracts c SET freelancer_confirmed_paid_at = pg_catalog.now()
  WHERE c.id = p_contract AND c.freelancer_confirmed_paid_at IS NULL
    AND c.status IN ('in_progress', 'awaiting_confirmation', 'completed', 'disputed')
    AND c.freelancer_id = app.current_user_id();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'não foi possível confirmar o pagamento' USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- Cada parte confirma o turno realizado. Com as duas confirmações, o contrato é concluído.
CREATE FUNCTION app.confirm_contract_completion(p_contract uuid) RETURNS public.contract_status
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user uuid := app.current_user_id();
  v_contract public.contracts;
BEGIN
  SELECT * INTO v_contract FROM public.contracts c WHERE c.id = p_contract FOR UPDATE;
  IF NOT FOUND OR NOT app.is_contract_party(p_contract) THEN
    RAISE EXCEPTION 'contrato não encontrado' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_contract.status <> 'awaiting_confirmation' THEN
    RAISE EXCEPTION 'este contrato não aguarda confirmação' USING ERRCODE = 'check_violation';
  END IF;

  IF v_contract.freelancer_id = v_user THEN
    UPDATE public.contracts c SET freelancer_confirmed_at = pg_catalog.now() WHERE c.id = p_contract;
  ELSE
    UPDATE public.contracts c SET company_confirmed_at = pg_catalog.now() WHERE c.id = p_contract;
  END IF;

  UPDATE public.contracts c SET status = 'completed'
  WHERE c.id = p_contract AND c.freelancer_confirmed_at IS NOT NULL AND c.company_confirmed_at IS NOT NULL;

  SELECT c.status INTO v_contract.status FROM public.contracts c WHERE c.id = p_contract;
  RETURN v_contract.status;
END;
$$;

-- Leitura pelo suporte: exige motivo e fica sempre registrada.
CREATE FUNCTION app.support_audit(p_action text, p_target uuid, p_entity text, p_entity_id uuid, p_reason text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT app.is_support() THEN
    RAISE EXCEPTION 'acesso restrito ao suporte' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_reason IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'informe o motivo do acesso' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.audit_logs (actor_user_id, target_user_id, action, entity_type, entity_id)
  VALUES (app.current_user_id(), p_target, p_action, p_entity, p_entity_id);
END;
$$;

CREATE FUNCTION app.support_read_user(p_user uuid, p_reason text)
  RETURNS TABLE (id uuid, email_enc text, phone_enc text, legal_name_enc text, status public.user_status)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM app.support_audit('support.user.read', p_user, 'user', p_user, p_reason);
  RETURN QUERY SELECT u.id, u.email_enc, u.phone_enc, u.legal_name_enc, u.status
    FROM public.users u WHERE u.id = p_user;
END;
$$;

-- A mensagem de candidatura fica de fora: o suporte vê só o andamento.
CREATE FUNCTION app.support_read_applications(p_job uuid, p_reason text)
  RETURNS TABLE (id uuid, freelancer_id uuid, status public.application_status, created_at timestamptz)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM app.support_audit('support.applications.read', NULL, 'job', p_job, p_reason);
  RETURN QUERY SELECT a.id, a.freelancer_id, a.status, a.created_at
    FROM public.applications a WHERE a.job_id = p_job ORDER BY a.id;
END;
$$;

-- Conversas só com disputa aberta ou mensagem denunciada.
CREATE FUNCTION app.support_read_messages(p_conversation uuid, p_reason text)
  RETURNS TABLE (id uuid, sender_user_id uuid, kind public.message_kind, body_enc text, status public.message_status, created_at timestamptz)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    JOIN public.contracts ct ON ct.application_id = c.application_id
    JOIN public.disputes d ON d.contract_id = ct.id
    WHERE c.id = p_conversation AND d.status NOT IN ('closed', 'withdrawn')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.message_reports r
    JOIN public.messages m ON m.id = r.message_id
    WHERE m.conversation_id = p_conversation AND r.status = 'open'
  ) THEN
    RAISE EXCEPTION 'sem disputa aberta nem denúncia nesta conversa' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM app.support_audit('support.messages.read', NULL, 'conversation', p_conversation, p_reason);
  RETURN QUERY SELECT m.id, m.sender_user_id, m.kind, m.body_enc, m.status, m.created_at
    FROM public.messages m WHERE m.conversation_id = p_conversation ORDER BY m.id;
END;
$$;

CREATE FUNCTION app.support_read_job_private(p_job uuid, p_reason text)
  RETURNS TABLE (address_enc text, access_notes_enc text)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM app.support_audit('support.job_private.read', NULL, 'job', p_job, p_reason);
  RETURN QUERY SELECT d.address_enc, d.access_notes_enc FROM public.job_private_details d WHERE d.job_id = p_job;
END;
$$;

CREATE FUNCTION app.support_read_check_ins(p_shift uuid, p_reason text)
  RETURNS TABLE (kind public.check_in_kind, occurred_at timestamptz, within_geofence boolean, contested boolean)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shifts s
    JOIN public.disputes d ON d.contract_id = s.contract_id
    WHERE s.id = p_shift AND d.status NOT IN ('closed', 'withdrawn')
  ) THEN
    RAISE EXCEPTION 'sem disputa aberta neste turno' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM app.support_audit('support.check_ins.read', NULL, 'shift', p_shift, p_reason);
  RETURN QUERY SELECT c.kind, c.occurred_at, c.within_geofence, c.contested
    FROM public.check_ins c WHERE c.shift_id = p_shift;
END;
$$;

-- Fecha a empresa quando o único dono exclui a conta.
CREATE FUNCTION app.close_company(p_company uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.contracts c SET status = 'cancelled', cancelled_by = 'platform'
  WHERE c.company_id = p_company AND c.status IN ('proposed', 'accepted');
  UPDATE public.shifts s SET status = 'cancelled'
  FROM public.contracts c
  WHERE s.contract_id = c.id AND c.company_id = p_company AND s.status = 'scheduled';
  UPDATE public.applications a SET status = 'rejected', note_enc = NULL
  FROM public.jobs j
  WHERE a.job_id = j.id AND j.company_id = p_company
    AND a.status IN ('invited', 'applied', 'shortlisted', 'selected');
  UPDATE public.jobs j SET status = 'cancelled'
  WHERE j.company_id = p_company AND j.status IN ('draft', 'published', 'filled');
  UPDATE public.job_private_details d SET address_enc = NULL, access_notes_enc = NULL, site_location = NULL
  FROM public.jobs j WHERE d.job_id = j.id AND j.company_id = p_company;
  DELETE FROM public.company_private_details d WHERE d.company_id = p_company;
  DELETE FROM public.favorites f WHERE f.company_id = p_company;
  UPDATE public.companies c
  SET status = 'deleted', deleted_at = pg_catalog.now(), trade_name = 'Conta removida',
      about = '', logo_file_id = NULL, city = NULL, public_location = NULL, verified_at = NULL
  WHERE c.id = p_company;
END;
$$;

-- Exclusão da conta (LGPD, art. 18, VI). Mantém só o exigido por lei, ligado a um identificador interno.
CREATE FUNCTION app.erase_user(p_user uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_email_index text;
  r record;
BEGIN
  SELECT u.email_index INTO v_email_index FROM public.users u WHERE u.id = p_user AND u.status <> 'deleted';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'conta não encontrada' USING ERRCODE = 'no_data_found';
  END IF;

  FOR r IN
    SELECT m.company_id FROM public.company_members m
    WHERE m.user_id = p_user AND m.role = 'owner' AND m.accepted_at IS NOT NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.company_members o
      WHERE o.company_id = r.company_id AND o.user_id <> p_user AND o.role = 'owner' AND o.accepted_at IS NOT NULL
    ) THEN
      IF EXISTS (SELECT 1 FROM public.company_members o WHERE o.company_id = r.company_id AND o.user_id <> p_user) THEN
        RAISE EXCEPTION 'transfira a empresa para outro dono antes de excluir a conta'
          USING ERRCODE = 'check_violation';
      END IF;
      PERFORM app.close_company(r.company_id);
    END IF;
  END LOOP;

  -- Contratos e candidaturas ainda abertos.
  UPDATE public.contracts c SET status = 'declined' WHERE c.freelancer_id = p_user AND c.status = 'proposed';
  UPDATE public.contracts c SET status = 'cancelled', cancelled_by = 'platform'
    WHERE c.freelancer_id = p_user AND c.status = 'accepted';
  UPDATE public.shifts s SET status = 'cancelled'
    FROM public.contracts c
    WHERE s.contract_id = c.id AND c.freelancer_id = p_user AND s.status = 'scheduled';
  UPDATE public.applications a SET status = 'withdrawn'
    WHERE a.freelancer_id = p_user AND a.status IN ('invited', 'applied', 'shortlisted', 'selected');
  UPDATE public.applications a SET note_enc = NULL WHERE a.freelancer_id = p_user;

  -- O que a pessoa escreveu ou registrou.
  UPDATE public.messages m SET body_enc = NULL, status = 'removed' WHERE m.sender_user_id = p_user;
  UPDATE public.ticket_messages t SET body_enc = NULL WHERE t.author_user_id = p_user;
  UPDATE public.dispute_evidences e SET note_enc = NULL WHERE e.submitted_by = p_user AND e.file_id IS NOT NULL;
  DELETE FROM public.dispute_evidences e WHERE e.submitted_by = p_user AND e.file_id IS NULL;
  UPDATE public.reviews r2 SET comment = NULL WHERE r2.reviewer_user_id = p_user;
  DELETE FROM public.review_replies r3 WHERE r3.author_user_id = p_user;
  UPDATE public.check_ins ci SET location = NULL
    FROM public.shifts s JOIN public.contracts c ON c.id = s.contract_id
    WHERE ci.shift_id = s.id AND c.freelancer_id = p_user;
  UPDATE public.safety_alerts a SET location = NULL WHERE a.user_id = p_user;

  -- Perfil e vínculos.
  DELETE FROM public.favorites f WHERE f.freelancer_id = p_user;
  DELETE FROM public.freelancer_skills s WHERE s.freelancer_id = p_user;
  DELETE FROM public.portfolio_items i WHERE i.freelancer_id = p_user;
  DELETE FROM public.availability_slots a WHERE a.freelancer_id = p_user;
  UPDATE public.freelancer_profiles p
    SET display_name = 'Conta removida', photo_file_id = NULL, bio = '', experience_years = 0,
        reference_rate_cents = NULL, base_location = NULL, available_now = false,
        discoverable = false, status = 'deleted'
    WHERE p.user_id = p_user;
  DELETE FROM public.documents d WHERE d.user_id = p_user;
  DELETE FROM public.kyc_verifications k WHERE k.user_id = p_user;
  DELETE FROM public.company_members m WHERE m.user_id = p_user;
  UPDATE public.conversation_participants p SET left_at = pg_catalog.now() WHERE p.user_id = p_user AND p.left_at IS NULL;

  -- Credenciais, aparelhos e avisos.
  DELETE FROM public.sessions s WHERE s.user_id = p_user;
  DELETE FROM public.devices d WHERE d.user_id = p_user;
  DELETE FROM public.mfa_factors f WHERE f.user_id = p_user;
  DELETE FROM public.auth_identities i WHERE i.user_id = p_user;
  DELETE FROM public.otp_codes o WHERE o.subject IN (v_email_index, p_user::text);
  DELETE FROM public.idempotency_keys k WHERE k.user_id = p_user;
  DELETE FROM public.notifications n WHERE n.user_id = p_user;
  DELETE FROM public.notification_preferences n WHERE n.user_id = p_user;
  DELETE FROM public.user_blocks b WHERE b.blocker_user_id = p_user OR b.blocked_user_id = p_user;

  -- O armazenamento é limpo depois, pelo worker.
  UPDATE public.files f SET deleted_at = pg_catalog.now() WHERE f.owner_user_id = p_user AND f.deleted_at IS NULL;

  UPDATE public.users u
    SET email_index = NULL, email_enc = NULL, phone_enc = NULL, legal_name_enc = NULL,
        cpf_index = NULL, cpf_enc = NULL, birth_date_enc = NULL,
        status = 'deleted', platform_role = 'none', deleted_at = pg_catalog.now()
    WHERE u.id = p_user;

  INSERT INTO public.audit_logs (actor_user_id, target_user_id, action, entity_type, entity_id)
  VALUES (app.current_user_id(), p_user, 'account.erased', 'user', p_user);
END;
$$;

CREATE FUNCTION app.erase_my_account() RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF app.current_user_id() IS NULL THEN
    RAISE EXCEPTION 'sem sessão' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM app.erase_user(app.current_user_id());
END;
$$;

-- Revela avaliações cuja janela de 7 dias fechou.
CREATE FUNCTION app.reveal_due_reviews() RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.reviews r SET revealed_at = pg_catalog.now(), status = 'published'
  FROM public.contracts c
  WHERE r.contract_id = c.id AND r.revealed_at IS NULL
    AND c.completed_at <= pg_catalog.now() - interval '7 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Política de retenção do plano (seção 6.6). Roda periodicamente pelo worker.
CREATE FUNCTION app.purge_expired_data() RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := pg_catalog.now();
  v_otp integer;
  v_keys integer;
  v_sessions integer;
  v_locations integer;
  v_messages integer;
  v_audit integer;
BEGIN
  DELETE FROM public.otp_codes o WHERE o.expires_at < v_now;
  GET DIAGNOSTICS v_otp = ROW_COUNT;

  DELETE FROM public.idempotency_keys k WHERE k.expires_at < v_now;
  GET DIAGNOSTICS v_keys = ROW_COUNT;

  DELETE FROM public.sessions s WHERE s.expires_at < v_now;
  GET DIAGNOSTICS v_sessions = ROW_COUNT;

  -- Local preciso: 90 dias depois do turno, salvo disputa aberta.
  UPDATE public.check_ins ci SET location = NULL
  FROM public.shifts s
  WHERE ci.shift_id = s.id AND ci.location IS NOT NULL
    AND s.ends_at < v_now - interval '90 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.contract_id = s.contract_id AND d.status NOT IN ('closed', 'withdrawn')
    );
  GET DIAGNOSTICS v_locations = ROW_COUNT;

  -- Conversas: 12 meses depois do último turno, salvo disputa aberta.
  UPDATE public.messages m SET body_enc = NULL, status = 'removed'
  FROM public.conversations c
  LEFT JOIN public.contracts ct ON ct.application_id = c.application_id
  WHERE m.conversation_id = c.id AND m.body_enc IS NOT NULL
    AND COALESCE(ct.contact_visible_until - interval '30 days', m.created_at) < v_now - interval '12 months'
    AND NOT EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.contract_id = ct.id AND d.status NOT IN ('closed', 'withdrawn')
    );
  GET DIAGNOSTICS v_messages = ROW_COUNT;

  DELETE FROM public.audit_logs l WHERE l.occurred_at < v_now - interval '6 months';
  GET DIAGNOSTICS v_audit = ROW_COUNT;

  RETURN pg_catalog.jsonb_build_object(
    'otp_codes', v_otp, 'idempotency_keys', v_keys, 'sessions', v_sessions,
    'check_in_locations', v_locations, 'messages', v_messages, 'audit_logs', v_audit
  );
END;
$$;

-- Down Migration

DROP FUNCTION app.purge_expired_data();
DROP FUNCTION app.reveal_due_reviews();
DROP FUNCTION app.erase_my_account();
DROP FUNCTION app.erase_user(uuid);
DROP FUNCTION app.close_company(uuid);
DROP FUNCTION app.support_read_check_ins(uuid, text);
DROP FUNCTION app.support_read_job_private(uuid, text);
DROP FUNCTION app.support_read_messages(uuid, text);
DROP FUNCTION app.support_read_applications(uuid, text);
DROP FUNCTION app.support_read_user(uuid, text);
DROP FUNCTION app.support_audit(text, uuid, text, uuid, text);
DROP FUNCTION app.confirm_contract_completion(uuid);
DROP FUNCTION app.confirm_contract_paid(uuid);
DROP FUNCTION app.mark_contract_paid(uuid);
DROP FUNCTION app.ensure_conversation(uuid);
DROP FUNCTION app.reveal_contract_contact(uuid);
