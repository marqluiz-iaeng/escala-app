-- Up Migration

-- Transições válidas e quem pode fazer cada uma. Igual a packages/shared/src/state-machines.ts.
CREATE TABLE app.status_transitions (
  entity      text NOT NULL,
  from_status text,
  to_status   text NOT NULL,
  actors      text[] NOT NULL,
  UNIQUE NULLS NOT DISTINCT (entity, from_status, to_status)
);
COMMENT ON TABLE app.status_transitions IS 'Transições permitidas por entidade e tipo de ator.';

INSERT INTO app.status_transitions (entity, from_status, to_status, actors) VALUES
  ('job', NULL, 'draft', '{company,system}'),
  ('job', NULL, 'published', '{company,system}'),
  ('job', 'draft', 'published', '{company}'),
  ('job', 'draft', 'cancelled', '{company,system}'),
  ('job', 'published', 'filled', '{company,system}'),
  ('job', 'published', 'closed', '{company,system}'),
  ('job', 'published', 'expired', '{system}'),
  ('job', 'published', 'cancelled', '{company,support,system}'),
  ('job', 'filled', 'published', '{company,system}'),
  ('job', 'filled', 'closed', '{company,system}'),
  ('job', 'filled', 'cancelled', '{company,support,system}'),

  ('application', NULL, 'invited', '{company,system}'),
  ('application', NULL, 'applied', '{freelancer,system}'),
  ('application', 'invited', 'applied', '{freelancer}'),
  ('application', 'invited', 'withdrawn', '{freelancer,system}'),
  ('application', 'invited', 'rejected', '{company,system}'),
  ('application', 'invited', 'expired', '{system}'),
  ('application', 'applied', 'shortlisted', '{company}'),
  ('application', 'applied', 'selected', '{company}'),
  ('application', 'applied', 'rejected', '{company,system}'),
  ('application', 'applied', 'withdrawn', '{freelancer,system}'),
  ('application', 'applied', 'expired', '{system}'),
  ('application', 'shortlisted', 'selected', '{company}'),
  ('application', 'shortlisted', 'rejected', '{company,system}'),
  ('application', 'shortlisted', 'withdrawn', '{freelancer,system}'),
  ('application', 'shortlisted', 'expired', '{system}'),
  ('application', 'selected', 'rejected', '{company,system}'),
  ('application', 'selected', 'withdrawn', '{freelancer,system}'),
  ('application', 'selected', 'expired', '{system}'),

  ('contract', NULL, 'proposed', '{company,system}'),
  ('contract', 'proposed', 'accepted', '{freelancer,system}'),
  ('contract', 'proposed', 'declined', '{freelancer,system}'),
  ('contract', 'proposed', 'expired', '{system}'),
  ('contract', 'proposed', 'cancelled', '{company,system}'),
  ('contract', 'accepted', 'in_progress', '{system}'),
  ('contract', 'accepted', 'cancelled', '{company,freelancer,support,system}'),
  ('contract', 'accepted', 'no_show', '{company,freelancer,system}'),
  ('contract', 'in_progress', 'awaiting_confirmation', '{system}'),
  ('contract', 'in_progress', 'disputed', '{system,support}'),
  ('contract', 'awaiting_confirmation', 'completed', '{system}'),
  ('contract', 'awaiting_confirmation', 'disputed', '{system,support}'),
  ('contract', 'cancelled', 'disputed', '{system,support}'),
  ('contract', 'no_show', 'disputed', '{system,support}'),
  ('contract', 'disputed', 'completed', '{system,support}'),
  ('contract', 'disputed', 'cancelled', '{system,support}'),
  ('contract', 'disputed', 'no_show', '{system,support}'),
  -- Disputa retirada: o contrato volta ao ponto em que estava.
  ('contract', 'disputed', 'in_progress', '{system}'),
  ('contract', 'disputed', 'awaiting_confirmation', '{system}'),

  ('shift', NULL, 'scheduled', '{company,system}'),
  ('shift', 'scheduled', 'in_progress', '{system}'),
  ('shift', 'scheduled', 'no_show', '{company,system}'),
  ('shift', 'scheduled', 'cancelled', '{company,freelancer,support,system}'),
  ('shift', 'in_progress', 'done', '{system}'),

  ('dispute', NULL, 'opened', '{freelancer,company,system}'),
  ('dispute', 'opened', 'collecting_evidence', '{support,system}'),
  ('dispute', 'opened', 'withdrawn', '{freelancer,company,support}'),
  ('dispute', 'collecting_evidence', 'under_review', '{support,system}'),
  ('dispute', 'collecting_evidence', 'withdrawn', '{freelancer,company,support}'),
  ('dispute', 'under_review', 'decided', '{support}'),
  ('dispute', 'decided', 'applied', '{support,system}'),
  ('dispute', 'applied', 'closed', '{support,system}'),

  ('ticket', NULL, 'open', '{requester,support,system}'),
  ('ticket', 'open', 'pending_user', '{support}'),
  ('ticket', 'open', 'pending_support', '{support}'),
  ('ticket', 'open', 'resolved', '{support}'),
  ('ticket', 'pending_user', 'pending_support', '{requester,support,system}'),
  ('ticket', 'pending_user', 'resolved', '{support,system}'),
  ('ticket', 'pending_support', 'pending_user', '{support}'),
  ('ticket', 'pending_support', 'resolved', '{support}'),
  ('ticket', 'resolved', 'closed', '{requester,support,system}'),
  ('ticket', 'resolved', 'open', '{requester}');

-- Papel da pessoa logada em relação à linha. Roda como dono, para enxergar a relação mesmo sob RLS.
CREATE FUNCTION app.party_kind(p_entity text, p_row jsonb) RETURNS text
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user uuid := app.current_user_id();
  v_company uuid;
  v_freelancer uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;
  CASE p_entity
    WHEN 'ticket' THEN
      RETURN CASE WHEN (p_row ->> 'requester_user_id')::uuid = v_user THEN 'requester' END;
    WHEN 'job' THEN
      v_company := (p_row ->> 'company_id')::uuid;
    WHEN 'application' THEN
      v_freelancer := (p_row ->> 'freelancer_id')::uuid;
      SELECT j.company_id INTO v_company FROM public.jobs j WHERE j.id = (p_row ->> 'job_id')::uuid;
    WHEN 'contract' THEN
      v_freelancer := (p_row ->> 'freelancer_id')::uuid;
      v_company := (p_row ->> 'company_id')::uuid;
    WHEN 'shift' THEN
      SELECT c.freelancer_id, c.company_id INTO v_freelancer, v_company
        FROM public.contracts c WHERE c.id = (p_row ->> 'contract_id')::uuid;
    WHEN 'dispute' THEN
      SELECT c.freelancer_id, c.company_id INTO v_freelancer, v_company
        FROM public.contracts c WHERE c.id = (p_row ->> 'contract_id')::uuid;
    ELSE
      RETURN NULL;
  END CASE;

  IF v_freelancer = v_user THEN
    RETURN 'freelancer';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.company_id = v_company AND m.user_id = v_user AND m.accepted_at IS NOT NULL
  ) THEN
    RETURN 'company';
  END IF;
  RETURN NULL;
END;
$$;

-- Só pode ser chamada de dentro de um gatilho: ninguém forja histórico chamando direto.
CREATE FUNCTION app.record_transition(
  p_entity text, p_history text, p_fk text, p_enum text, p_id uuid,
  p_from text, p_to text, p_actor text
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actors text[];
BEGIN
  IF pg_catalog.pg_trigger_depth() = 0 THEN
    RAISE EXCEPTION 'transição só pode vir de um gatilho' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT t.actors INTO v_actors FROM app.status_transitions t
    WHERE t.entity = p_entity AND t.from_status IS NOT DISTINCT FROM p_from AND t.to_status = p_to;
  IF v_actors IS NULL THEN
    RAISE EXCEPTION 'transição inválida de % : % -> %', p_entity, COALESCE(p_from, 'início'), p_to
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_actor IS NULL OR NOT p_actor = ANY (v_actors) THEN
    RAISE EXCEPTION 'quem está agindo não pode fazer esta transição de %', p_entity
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  EXECUTE pg_catalog.format(
    'INSERT INTO public.%I (%I, from_status, to_status, actor_user_id, reason)
     VALUES ($1, $2::public.%I, $3::public.%I, $4, $5)',
    p_history, p_fk, p_enum, p_enum
  ) USING p_id, p_from, p_to, app.current_user_id(),
    NULLIF(pg_catalog.current_setting('app.transition_reason', true), '');
END;
$$;

-- Roda como quem fez a mudança: é isso que distingue pedido direto de ação do sistema.
CREATE FUNCTION app.track_status() RETURNS trigger
  LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_from text;
  v_to text := NEW.status::text;
  v_actor text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_from := OLD.status::text;
    IF v_from = v_to THEN
      RETURN NEW;
    END IF;
  END IF;

  v_actor := CASE current_user
    WHEN 'escala_migrator' THEN 'system'
    WHEN 'escala_worker' THEN 'system'
    WHEN 'escala_support' THEN 'support'
    ELSE app.party_kind(TG_ARGV[0], pg_catalog.to_jsonb(NEW))
  END;

  PERFORM app.record_transition(
    TG_ARGV[0], TG_ARGV[1], TG_ARGV[2], TG_ARGV[3], NEW.id, v_from, v_to, v_actor
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_track_status AFTER INSERT OR UPDATE OF status ON jobs
  FOR EACH ROW EXECUTE FUNCTION app.track_status('job', 'job_status_history', 'job_id', 'job_status');
CREATE TRIGGER applications_track_status AFTER INSERT OR UPDATE OF status ON applications
  FOR EACH ROW EXECUTE FUNCTION app.track_status('application', 'application_status_history', 'application_id', 'application_status');
CREATE TRIGGER contracts_track_status AFTER INSERT OR UPDATE OF status ON contracts
  FOR EACH ROW EXECUTE FUNCTION app.track_status('contract', 'contract_status_history', 'contract_id', 'contract_status');
CREATE TRIGGER shifts_track_status AFTER INSERT OR UPDATE OF status ON shifts
  FOR EACH ROW EXECUTE FUNCTION app.track_status('shift', 'shift_status_history', 'shift_id', 'shift_status');
CREATE TRIGGER disputes_track_status AFTER INSERT OR UPDATE OF status ON disputes
  FOR EACH ROW EXECUTE FUNCTION app.track_status('dispute', 'dispute_status_history', 'dispute_id', 'dispute_status');
CREATE TRIGGER support_tickets_track_status AFTER INSERT OR UPDATE OF status ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION app.track_status('ticket', 'ticket_status_history', 'ticket_id', 'ticket_status');

-- Down Migration

DROP TRIGGER support_tickets_track_status ON support_tickets;
DROP TRIGGER disputes_track_status ON disputes;
DROP TRIGGER shifts_track_status ON shifts;
DROP TRIGGER contracts_track_status ON contracts;
DROP TRIGGER applications_track_status ON applications;
DROP TRIGGER jobs_track_status ON jobs;
DROP FUNCTION app.track_status();
DROP FUNCTION app.record_transition(text, text, text, text, uuid, text, text, text);
DROP FUNCTION app.party_kind(text, jsonb);
DROP TABLE app.status_transitions;
