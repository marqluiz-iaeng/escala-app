-- Up Migration

-- updated_at em toda tabela que tem a coluna.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables t USING (table_schema, table_name)
    WHERE c.table_schema = 'public' AND c.column_name = 'updated_at' AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.set_updated_at()',
      r.table_name || '_set_updated_at', r.table_name
    );
  END LOOP;
END;
$$;

-- created_by vem da sessão. Quem insere não escolhe o autor.
CREATE FUNCTION app.set_created_by() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF app.current_user_id() IS NOT NULL THEN
    NEW.created_by := app.current_user_id();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables t USING (table_schema, table_name)
    WHERE c.table_schema = 'public' AND c.column_name = 'created_by' AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION app.set_created_by()',
      r.table_name || '_set_created_by', r.table_name
    );
  END LOOP;
END;
$$;

-- Quem cria a empresa vira dono.
CREATE FUNCTION app.add_company_owner() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF app.current_user_id() IS NOT NULL THEN
    INSERT INTO public.company_members (company_id, user_id, role, accepted_at)
    VALUES (NEW.id, app.current_user_id(), 'owner', pg_catalog.now());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER companies_add_owner AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION app.add_company_owner();

-- Alterar o nome de uma empresa verificada derruba o selo: impede se passar por outra.
CREATE FUNCTION app.reset_verification_on_rename() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.trade_name IS DISTINCT FROM OLD.trade_name THEN
    NEW.verified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER companies_reset_verification BEFORE UPDATE OF trade_name ON companies
  FOR EACH ROW EXECUTE FUNCTION app.reset_verification_on_rename();

-- Só o dono altera papéis. Um membro comum só aceita o próprio convite.
CREATE FUNCTION app.guard_member_update() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user uuid := app.current_user_id();
BEGIN
  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.company_id = NEW.company_id AND m.user_id = v_user
      AND m.role = 'owner' AND m.accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'só o dono altera papéis' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.accepted_at IS DISTINCT FROM OLD.accepted_at AND NEW.user_id <> v_user THEN
    RAISE EXCEPTION 'só a própria pessoa aceita o convite' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER company_members_guard BEFORE UPDATE ON company_members
  FOR EACH ROW EXECUTE FUNCTION app.guard_member_update();

-- A empresa ativa nunca fica sem dono.
CREATE FUNCTION app.keep_company_owner() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF app.current_user_id() IS NOT NULL AND OLD.role = 'owner' AND OLD.accepted_at IS NOT NULL
     AND (TG_OP = 'DELETE' OR NEW.role <> 'owner')
     AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = OLD.company_id AND c.status <> 'deleted')
     AND NOT EXISTS (
       SELECT 1 FROM public.company_members m
       WHERE m.company_id = OLD.company_id AND m.id <> OLD.id
         AND m.role = 'owner' AND m.accepted_at IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'a empresa precisa de outro dono antes desta alteração' USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER company_members_keep_owner BEFORE UPDATE OF role OR DELETE ON company_members
  FOR EACH ROW EXECUTE FUNCTION app.keep_company_owner();

-- Só o próprio dono do arquivo pode vinculá-lo. Sem isso, apontar para o arquivo de outra pessoa
-- daria acesso a ele: a regra de leitura depende de onde o arquivo é usado.
CREATE FUNCTION app.check_file_owner() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_file uuid := (pg_catalog.to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
BEGIN
  IF v_file IS NOT NULL AND app.current_user_id() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.files f WHERE f.id = v_file AND f.owner_user_id = app.current_user_id()
  ) THEN
    RAISE EXCEPTION 'arquivo não encontrado' USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER companies_check_logo BEFORE INSERT OR UPDATE OF logo_file_id ON companies
  FOR EACH ROW EXECUTE FUNCTION app.check_file_owner('logo_file_id');
CREATE TRIGGER freelancer_profiles_check_photo BEFORE INSERT OR UPDATE OF photo_file_id ON freelancer_profiles
  FOR EACH ROW EXECUTE FUNCTION app.check_file_owner('photo_file_id');
CREATE TRIGGER portfolio_items_check_file BEFORE INSERT OR UPDATE OF file_id ON portfolio_items
  FOR EACH ROW EXECUTE FUNCTION app.check_file_owner('file_id');
CREATE TRIGGER documents_check_file BEFORE INSERT OR UPDATE OF file_id ON documents
  FOR EACH ROW EXECUTE FUNCTION app.check_file_owner('file_id');
CREATE TRIGGER message_attachments_check_file BEFORE INSERT OR UPDATE OF file_id ON message_attachments
  FOR EACH ROW EXECUTE FUNCTION app.check_file_owner('file_id');
CREATE TRIGGER ticket_messages_check_file BEFORE INSERT OR UPDATE OF file_id ON ticket_messages
  FOR EACH ROW EXECUTE FUNCTION app.check_file_owner('file_id');
CREATE TRIGGER dispute_evidences_check_file BEFORE INSERT OR UPDATE OF file_id ON dispute_evidences
  FOR EACH ROW EXECUTE FUNCTION app.check_file_owner('file_id');

-- Uma pessoa não se candidata à vaga da própria empresa: impediria inflar reputação.
CREATE FUNCTION app.check_new_application() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_job public.jobs;
BEGIN
  SELECT * INTO v_job FROM public.jobs j WHERE j.id = NEW.job_id;
  IF EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.company_id = v_job.company_id AND m.user_id = NEW.freelancer_id
  ) THEN
    RAISE EXCEPTION 'não é possível se candidatar à vaga da própria empresa'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.origin = 'applied' AND NEW.status <> 'applied' THEN
    RAISE EXCEPTION 'candidatura nasce com status applied' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.origin = 'invited' AND NEW.status <> 'invited' THEN
    RAISE EXCEPTION 'convite nasce com status invited' USING ERRCODE = 'check_violation';
  END IF;
  IF v_job.status <> 'published' OR v_job.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'a vaga não está aberta' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER applications_check_new BEFORE INSERT ON applications
  FOR EACH ROW EXECUTE FUNCTION app.check_new_application();

CREATE FUNCTION app.check_new_contract() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.applications a WHERE a.id = NEW.application_id AND a.status = 'selected'
  ) THEN
    RAISE EXCEPTION 'o contrato exige uma candidatura selecionada' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.company_id = NEW.company_id AND m.user_id = NEW.company_contact_user_id
      AND m.accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'o responsável precisa ser membro da empresa' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER contracts_check_new BEFORE INSERT ON contracts
  FOR EACH ROW EXECUTE FUNCTION app.check_new_contract();

-- Efeitos de cada mudança de status do contrato. Quem cancelou ou faltou vem de quem agiu:
-- a pessoa não escolhe o registro que depois pesa na reputação.
CREATE FUNCTION app.contract_status_effects() RETURNS trigger
  LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_actor text := app.party_kind('contract', pg_catalog.to_jsonb(NEW));
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'accepted' THEN
    NEW.accepted_at := pg_catalog.now();
  END IF;
  IF NEW.status = 'completed' THEN
    NEW.completed_at := pg_catalog.now();
    NEW.cancelled_by := NULL;
    NEW.no_show_party := NULL;
  END IF;
  IF NEW.status = 'cancelled' THEN
    NEW.no_show_party := NULL;
    IF current_user = 'escala_app' THEN
      NEW.cancelled_by := v_actor::public.contract_party;
    ELSE
      NEW.cancelled_by := COALESCE(NEW.cancelled_by, 'platform');
    END IF;
  END IF;
  IF NEW.status = 'no_show' THEN
    NEW.cancelled_by := NULL;
    IF current_user = 'escala_app' THEN
      -- Quem registra a falta aponta a outra parte.
      NEW.no_show_party := CASE v_actor WHEN 'company' THEN 'freelancer' ELSE 'company' END::public.contract_party;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER contracts_status_effects BEFORE UPDATE OF status ON contracts
  FOR EACH ROW EXECUTE FUNCTION app.contract_status_effects();

-- O contato fica liberado até 30 dias depois do último turno.
CREATE FUNCTION app.refresh_contact_window() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_contract uuid := COALESCE(NEW.contract_id, OLD.contract_id);
BEGIN
  UPDATE public.contracts c
  SET contact_visible_until = (
    SELECT pg_catalog.max(s.ends_at) + interval '30 days' FROM public.shifts s
    WHERE s.contract_id = v_contract AND s.status <> 'cancelled'
  )
  WHERE c.id = v_contract;
  RETURN NULL;
END;
$$;
CREATE TRIGGER shifts_refresh_contact_window
  AFTER INSERT OR DELETE OR UPDATE OF ends_at, status ON shifts
  FOR EACH ROW EXECUTE FUNCTION app.refresh_contact_window();

-- O banco calcula a geocerca: o app não pode declarar que estava no local.
CREATE FUNCTION app.prepare_check_in() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, extensions
AS $$
DECLARE
  v_site extensions.geography;
  v_radius integer;
BEGIN
  IF NEW.kind = 'out' AND NOT EXISTS (
    SELECT 1 FROM public.check_ins c WHERE c.shift_id = NEW.shift_id AND c.kind = 'in'
  ) THEN
    RAISE EXCEPTION 'não há chegada registrada neste turno' USING ERRCODE = 'check_violation';
  END IF;

  SELECT d.site_location, d.checkin_radius_m INTO v_site, v_radius
    FROM public.shifts s
    JOIN public.contracts c ON c.id = s.contract_id
    JOIN public.job_private_details d ON d.job_id = c.job_id
    WHERE s.id = NEW.shift_id;

  NEW.within_geofence := NEW.location IS NOT NULL AND v_site IS NOT NULL
    AND extensions.ST_DWithin(NEW.location, v_site, v_radius);
  IF app.current_user_id() IS NOT NULL THEN
    NEW.occurred_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER check_ins_prepare BEFORE INSERT ON check_ins
  FOR EACH ROW EXECUTE FUNCTION app.prepare_check_in();

-- O check-in move o turno e o contrato. Roda como dono, então conta como ação do sistema.
CREATE FUNCTION app.apply_check_in() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_contract uuid;
BEGIN
  SELECT s.contract_id INTO v_contract FROM public.shifts s WHERE s.id = NEW.shift_id;
  IF NEW.kind = 'in' THEN
    UPDATE public.shifts s SET status = 'in_progress' WHERE s.id = NEW.shift_id AND s.status = 'scheduled';
    UPDATE public.contracts c SET status = 'in_progress' WHERE c.id = v_contract AND c.status = 'accepted';
  ELSE
    UPDATE public.shifts s SET status = 'done' WHERE s.id = NEW.shift_id AND s.status = 'in_progress';
    IF NOT EXISTS (
      SELECT 1 FROM public.shifts s
      WHERE s.contract_id = v_contract AND s.status IN ('scheduled', 'in_progress')
    ) THEN
      UPDATE public.contracts c SET status = 'awaiting_confirmation'
      WHERE c.id = v_contract AND c.status = 'in_progress';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER check_ins_apply AFTER INSERT ON check_ins
  FOR EACH ROW EXECUTE FUNCTION app.apply_check_in();

CREATE FUNCTION app.touch_conversation() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.conversations c SET last_message_at = NEW.created_at WHERE c.id = NEW.conversation_id;
  RETURN NULL;
END;
$$;
CREATE TRIGGER messages_touch_conversation AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION app.touch_conversation();

-- Disputa: autor vem da sessão, e o contrato entra em disputa junto.
CREATE FUNCTION app.prepare_dispute() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_status public.contract_status;
BEGIN
  IF app.current_user_id() IS NOT NULL THEN
    NEW.opened_by := app.current_user_id();
  END IF;
  SELECT c.status INTO v_status FROM public.contracts c WHERE c.id = NEW.contract_id;
  IF v_status NOT IN ('in_progress', 'awaiting_confirmation', 'cancelled', 'no_show') THEN
    RAISE EXCEPTION 'este contrato não pode ser contestado agora' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER disputes_prepare BEFORE INSERT ON disputes
  FOR EACH ROW EXECUTE FUNCTION app.prepare_dispute();

CREATE FUNCTION app.apply_dispute() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.contracts c SET status = 'disputed' WHERE c.id = NEW.contract_id;
  RETURN NULL;
END;
$$;
CREATE TRIGGER disputes_apply AFTER INSERT ON disputes
  FOR EACH ROW EXECUTE FUNCTION app.apply_dispute();

-- Disputa retirada: o contrato volta ao estado anterior à disputa.
CREATE FUNCTION app.restore_contract_after_withdrawal() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_previous public.contract_status;
BEGIN
  SELECT h.from_status INTO v_previous FROM public.contract_status_history h
    WHERE h.contract_id = NEW.contract_id AND h.to_status = 'disputed'
    ORDER BY h.id DESC LIMIT 1;
  UPDATE public.contracts c SET status = v_previous
    WHERE c.id = NEW.contract_id AND c.status = 'disputed';
  RETURN NULL;
END;
$$;
CREATE TRIGGER disputes_restore_contract AFTER UPDATE OF status ON disputes
  FOR EACH ROW WHEN (NEW.status = 'withdrawn' AND OLD.status <> 'withdrawn')
  EXECUTE FUNCTION app.restore_contract_after_withdrawal();

-- Avaliação: o banco define quem avalia e quem é avaliado, a partir do contrato.
CREATE FUNCTION app.prepare_review() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user uuid := app.current_user_id();
  v_contract public.contracts;
BEGIN
  SELECT * INTO v_contract FROM public.contracts c WHERE c.id = NEW.contract_id;
  IF v_contract.status <> 'completed' THEN
    RAISE EXCEPTION 'só contrato concluído pode ser avaliado' USING ERRCODE = 'check_violation';
  END IF;
  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;
  IF v_contract.completed_at < pg_catalog.now() - interval '7 days' THEN
    RAISE EXCEPTION 'a janela de avaliação fechou' USING ERRCODE = 'check_violation';
  END IF;

  NEW.reviewer_user_id := v_user;
  IF v_contract.freelancer_id = v_user THEN
    NEW.reviewer_side := 'freelancer';
    NEW.subject_company_id := v_contract.company_id;
    NEW.subject_user_id := NULL;
  ELSE
    NEW.reviewer_side := 'company';
    NEW.subject_user_id := v_contract.freelancer_id;
    NEW.subject_company_id := NULL;
  END IF;
  NEW.status := 'submitted';
  NEW.revealed_at := NULL;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reviews_prepare BEFORE INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION app.prepare_review();

-- Com as duas avaliações feitas, as duas aparecem ao mesmo tempo.
CREATE FUNCTION app.reveal_reviews() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.reviews r WHERE r.contract_id = NEW.contract_id) = 2 THEN
    UPDATE public.reviews r
    SET revealed_at = pg_catalog.now(), status = 'published'
    WHERE r.contract_id = NEW.contract_id AND r.revealed_at IS NULL;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER reviews_reveal AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION app.reveal_reviews();

-- Down Migration

DROP TRIGGER reviews_reveal ON reviews;
DROP FUNCTION app.reveal_reviews();
DROP TRIGGER reviews_prepare ON reviews;
DROP FUNCTION app.prepare_review();
DROP TRIGGER disputes_restore_contract ON disputes;
DROP FUNCTION app.restore_contract_after_withdrawal();
DROP TRIGGER disputes_apply ON disputes;
DROP FUNCTION app.apply_dispute();
DROP TRIGGER disputes_prepare ON disputes;
DROP FUNCTION app.prepare_dispute();
DROP TRIGGER messages_touch_conversation ON messages;
DROP FUNCTION app.touch_conversation();
DROP TRIGGER check_ins_apply ON check_ins;
DROP FUNCTION app.apply_check_in();
DROP TRIGGER check_ins_prepare ON check_ins;
DROP FUNCTION app.prepare_check_in();
DROP TRIGGER shifts_refresh_contact_window ON shifts;
DROP FUNCTION app.refresh_contact_window();
DROP TRIGGER contracts_status_effects ON contracts;
DROP FUNCTION app.contract_status_effects();
DROP TRIGGER contracts_check_new ON contracts;
DROP FUNCTION app.check_new_contract();
DROP TRIGGER applications_check_new ON applications;
DROP FUNCTION app.check_new_application();
DROP TRIGGER dispute_evidences_check_file ON dispute_evidences;
DROP TRIGGER ticket_messages_check_file ON ticket_messages;
DROP TRIGGER message_attachments_check_file ON message_attachments;
DROP TRIGGER documents_check_file ON documents;
DROP TRIGGER portfolio_items_check_file ON portfolio_items;
DROP TRIGGER freelancer_profiles_check_photo ON freelancer_profiles;
DROP TRIGGER companies_check_logo ON companies;
DROP FUNCTION app.check_file_owner();
DROP TRIGGER company_members_keep_owner ON company_members;
DROP FUNCTION app.keep_company_owner();
DROP TRIGGER company_members_guard ON company_members;
DROP FUNCTION app.guard_member_update();
DROP TRIGGER companies_reset_verification ON companies;
DROP FUNCTION app.reset_verification_on_rename();
DROP TRIGGER companies_add_owner ON companies;
DROP FUNCTION app.add_company_owner();

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.tgname, c.relname FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
      AND (t.tgname LIKE '%\_set\_updated\_at' OR t.tgname LIKE '%\_set\_created\_by')
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.%I', r.tgname, r.relname);
  END LOOP;
END;
$$;
DROP FUNCTION app.set_created_by();
