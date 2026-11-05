-- Up Migration

-- Funções usadas pelas políticas de RLS. Rodam como dono para consultar as relações
-- sem cair em recursão de políticas. Todas respondem só sobre a pessoa logada.

CREATE FUNCTION app.is_support() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = app.current_user_id() AND u.platform_role IN ('support', 'admin') AND u.status = 'active'
  )
$$;

CREATE FUNCTION app.is_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = app.current_user_id() AND u.platform_role = 'admin' AND u.status = 'active'
  )
$$;

CREATE FUNCTION app.is_company_member(p_company uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.company_id = p_company AND m.user_id = app.current_user_id() AND m.accepted_at IS NOT NULL
  )
$$;

CREATE FUNCTION app.has_company_role(p_company uuid, p_roles public.company_member_role[]) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.company_id = p_company AND m.user_id = app.current_user_id()
      AND m.accepted_at IS NOT NULL AND m.role = ANY (p_roles)
  )
$$;

CREATE FUNCTION app.is_member_of_any_company() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.user_id = app.current_user_id() AND m.accepted_at IS NOT NULL
  )
$$;

CREATE FUNCTION app.job_company(p_job uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT j.company_id FROM public.jobs j WHERE j.id = p_job
$$;

-- Só candidatura ativa dá acesso ao perfil: quem retirou ou foi recusado volta à privacidade.
CREATE FUNCTION app.company_has_application_from(p_freelancer uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    JOIN public.company_members m ON m.company_id = j.company_id
    WHERE a.freelancer_id = p_freelancer AND a.status IN ('invited', 'applied', 'shortlisted', 'selected')
      AND m.user_id = app.current_user_id() AND m.accepted_at IS NOT NULL
  )
$$;

CREATE FUNCTION app.can_view_freelancer(p_freelancer uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p_freelancer = app.current_user_id()
    OR app.company_has_application_from(p_freelancer)
    OR (
      app.is_member_of_any_company() AND EXISTS (
        SELECT 1 FROM public.freelancer_profiles p
        WHERE p.user_id = p_freelancer AND p.discoverable AND p.status = 'active'
      )
    )
$$;

-- A foto só é liberada depois da pré-seleção, para reduzir discriminação na escolha.
CREATE FUNCTION app.can_view_photo(p_freelancer uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p_freelancer = app.current_user_id() OR EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    JOIN public.company_members m ON m.company_id = j.company_id
    WHERE a.freelancer_id = p_freelancer AND a.status IN ('shortlisted', 'selected')
      AND m.user_id = app.current_user_id() AND m.accepted_at IS NOT NULL
  )
$$;

CREATE FUNCTION app.can_invite(p_job uuid, p_freelancer uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT app.has_company_role(app.job_company(p_job), '{owner,admin,recruiter}')
    AND EXISTS (
      SELECT 1 FROM public.freelancer_profiles p
      WHERE p.user_id = p_freelancer AND p.discoverable AND p.status = 'active'
    )
$$;

CREATE FUNCTION app.has_application_for_job(p_job uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.job_id = p_job AND a.freelancer_id = app.current_user_id()
  )
$$;

CREATE FUNCTION app.can_read_job(p_job uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = p_job AND (
      (app.current_user_id() IS NOT NULL AND j.status = 'published' AND j.deleted_at IS NULL)
      OR app.is_company_member(j.company_id)
      OR app.has_application_for_job(j.id)
    )
  )
$$;

CREATE FUNCTION app.is_application_party(p_application uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = p_application AND (
      a.freelancer_id = app.current_user_id()
      OR (a.status <> 'withdrawn' AND app.is_company_member(j.company_id))
    )
  )
$$;

CREATE FUNCTION app.is_contract_party(p_contract uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = p_contract
      AND (c.freelancer_id = app.current_user_id() OR app.is_company_member(c.company_id))
  )
$$;

CREATE FUNCTION app.is_shift_party(p_shift uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shifts s
    WHERE s.id = p_shift AND app.is_contract_party(s.contract_id)
  )
$$;

CREATE FUNCTION app.is_shift_freelancer(p_shift uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shifts s
    JOIN public.contracts c ON c.id = s.contract_id
    WHERE s.id = p_shift AND c.freelancer_id = app.current_user_id()
      AND c.status IN ('accepted', 'in_progress')
  )
$$;

-- Endereço exato: só com contrato aceito e dentro do prazo de 30 dias depois do último turno.
CREATE FUNCTION app.has_visible_contract_for_job(p_job uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.job_id = p_job AND c.freelancer_id = app.current_user_id()
      AND c.status IN ('accepted', 'in_progress', 'awaiting_confirmation', 'completed', 'disputed')
      AND c.contact_visible_until > pg_catalog.now()
  )
$$;

CREATE FUNCTION app.is_conversation_participant(p_conversation uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants p
    WHERE p.conversation_id = p_conversation AND p.user_id = app.current_user_id() AND p.left_at IS NULL
  )
$$;

CREATE FUNCTION app.is_message_participant(p_message uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = p_message AND app.is_conversation_participant(m.conversation_id)
  )
$$;

-- Participante pode escrever se a conversa estiver aberta e ninguém tiver bloqueado ninguém.
CREATE FUNCTION app.can_post_message(p_conversation uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT app.is_conversation_participant(p_conversation)
    AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = p_conversation AND c.status = 'open')
    AND NOT EXISTS (
      SELECT 1 FROM public.conversation_participants other
      JOIN public.user_blocks b ON
        (b.blocker_user_id = app.current_user_id() AND b.blocked_user_id = other.user_id)
        OR (b.blocked_user_id = app.current_user_id() AND b.blocker_user_id = other.user_id)
      WHERE other.conversation_id = p_conversation AND other.user_id <> app.current_user_id()
    )
$$;

CREATE FUNCTION app.can_review(p_contract uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT app.is_contract_party(p_contract) AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = p_contract AND c.status = 'completed'
      AND c.completed_at > pg_catalog.now() - interval '7 days'
  )
$$;

CREATE FUNCTION app.can_read_review(p_review uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.id = p_review AND (
      r.reviewer_user_id = app.current_user_id()
      OR (app.current_user_id() IS NOT NULL AND r.revealed_at IS NOT NULL AND r.status = 'published')
    )
  )
$$;

CREATE FUNCTION app.is_review_subject(p_review uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.id = p_review AND r.revealed_at IS NOT NULL AND (
      r.subject_user_id = app.current_user_id()
      OR (r.subject_company_id IS NOT NULL AND app.is_company_member(r.subject_company_id))
    )
  )
$$;

CREATE FUNCTION app.is_penalty_subject(p_penalty uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.penalties p
    WHERE p.id = p_penalty AND (
      p.subject_user_id = app.current_user_id()
      OR (p.subject_company_id IS NOT NULL AND app.is_company_member(p.subject_company_id))
    )
  )
$$;

CREATE FUNCTION app.is_ticket_requester(p_ticket uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = p_ticket AND t.requester_user_id = app.current_user_id()
  )
$$;

CREATE FUNCTION app.is_dispute_party(p_dispute uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.id = p_dispute AND app.is_contract_party(d.contract_id)
  )
$$;

-- Quem pode acessar um arquivo depende de onde ele é usado.
CREATE FUNCTION app.can_read_file(p_file uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT app.current_user_id() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.id = p_file AND f.owner_user_id = app.current_user_id()
    )
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.logo_file_id = p_file)
    OR EXISTS (
      SELECT 1 FROM public.freelancer_profiles p
      WHERE p.photo_file_id = p_file AND app.can_view_photo(p.user_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.portfolio_items i
      WHERE i.file_id = p_file AND app.can_view_freelancer(i.freelancer_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.message_attachments a
      WHERE a.file_id = p_file AND app.is_message_participant(a.message_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.ticket_messages tm
      WHERE tm.file_id = p_file AND NOT tm.internal_note AND app.is_ticket_requester(tm.ticket_id)
    )
  )
$$;

-- Depois do aceite, os horários só mudam com um novo combinado.
CREATE FUNCTION app.guard_shift_update() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF app.current_user_id() IS NOT NULL
     AND (NEW.starts_at, NEW.ends_at) IS DISTINCT FROM (OLD.starts_at, OLD.ends_at)
     AND NOT EXISTS (
       SELECT 1 FROM public.contracts c
       WHERE c.id = NEW.contract_id AND c.status = 'proposed' AND app.is_company_member(c.company_id)
     ) THEN
    RAISE EXCEPTION 'os horários só podem mudar antes do aceite, pela empresa'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER shifts_guard_update BEFORE UPDATE OF starts_at, ends_at ON shifts
  FOR EACH ROW EXECUTE FUNCTION app.guard_shift_update();

-- Mensagem não se edita: alterar o texto mudaria a evidência de uma disputa ou denúncia.
-- Quem enviou só pode remover, e não enquanto ela estiver em análise.
CREATE FUNCTION app.message_under_review(p_message uuid, p_conversation uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
      SELECT 1 FROM public.message_reports r WHERE r.message_id = p_message AND r.status = 'open'
    )
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.contracts ct ON ct.application_id = c.application_id
      JOIN public.disputes d ON d.contract_id = ct.id
      WHERE c.id = p_conversation AND d.status NOT IN ('closed', 'withdrawn')
    )
$$;

-- Roda como quem chamou: a exclusão de conta e a retenção passam por funções do sistema.
CREATE FUNCTION app.guard_message_update() RETURNS trigger
  LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF current_user = 'escala_app' AND (
    NEW.status <> 'removed' OR NEW.body_enc IS NOT NULL OR OLD.status <> 'visible'
    OR app.message_under_review(OLD.id, OLD.conversation_id)
  ) THEN
    RAISE EXCEPTION 'esta mensagem não pode ser alterada' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER messages_guard_update BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION app.guard_message_update();

-- Down Migration

DROP TRIGGER messages_guard_update ON messages;
DROP FUNCTION app.guard_message_update();
DROP FUNCTION app.message_under_review(uuid, uuid);
DROP TRIGGER shifts_guard_update ON shifts;
DROP FUNCTION app.guard_shift_update();
DROP FUNCTION app.can_read_file(uuid);
DROP FUNCTION app.is_dispute_party(uuid);
DROP FUNCTION app.is_ticket_requester(uuid);
DROP FUNCTION app.is_penalty_subject(uuid);
DROP FUNCTION app.is_review_subject(uuid);
DROP FUNCTION app.can_read_review(uuid);
DROP FUNCTION app.can_review(uuid);
DROP FUNCTION app.can_post_message(uuid);
DROP FUNCTION app.is_message_participant(uuid);
DROP FUNCTION app.is_conversation_participant(uuid);
DROP FUNCTION app.has_visible_contract_for_job(uuid);
DROP FUNCTION app.is_shift_freelancer(uuid);
DROP FUNCTION app.is_shift_party(uuid);
DROP FUNCTION app.is_contract_party(uuid);
DROP FUNCTION app.is_application_party(uuid);
DROP FUNCTION app.can_read_job(uuid);
DROP FUNCTION app.has_application_for_job(uuid);
DROP FUNCTION app.can_invite(uuid, uuid);
DROP FUNCTION app.can_view_photo(uuid);
DROP FUNCTION app.can_view_freelancer(uuid);
DROP FUNCTION app.company_has_application_from(uuid);
DROP FUNCTION app.job_company(uuid);
DROP FUNCTION app.is_member_of_any_company();
DROP FUNCTION app.has_company_role(uuid, public.company_member_role[]);
DROP FUNCTION app.is_company_member(uuid);
DROP FUNCTION app.is_admin();
DROP FUNCTION app.is_support();
