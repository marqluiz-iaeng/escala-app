-- Up Migration

-- Visões sem identificação de pessoas. O papel escala_analytics só enxerga este esquema.
CREATE VIEW analytics.job_facts AS
  SELECT j.id AS job_id, c.segment, s.category AS skill_category, j.city, j.status, j.slots,
         j.pay_amount_cents, j.currency, j.pay_unit, j.starts_at, j.created_at
  FROM public.jobs j
  JOIN public.companies c ON c.id = j.company_id
  JOIN public.skills s ON s.id = j.primary_skill_id;
COMMENT ON VIEW analytics.job_facts IS 'Vagas sem dados de pessoas ou endereço.';

CREATE VIEW analytics.contract_facts AS
  SELECT ct.id AS contract_id, ct.job_id, co.segment, ct.status, ct.agreed_amount_cents, ct.currency,
         ct.pay_unit, ct.created_at, ct.accepted_at, ct.completed_at,
         ct.freelancer_confirmed_paid_at IS NOT NULL AS payment_confirmed
  FROM public.contracts ct
  JOIN public.companies co ON co.id = ct.company_id;
COMMENT ON VIEW analytics.contract_facts IS 'Contratos sem identificar as partes.';

CREATE VIEW analytics.signup_facts AS
  SELECT pg_catalog.date_trunc('day', u.created_at) AS day, u.status, pg_catalog.count(*) AS users
  FROM public.users u
  GROUP BY 1, 2;
COMMENT ON VIEW analytics.signup_facts IS 'Cadastros agregados por dia.';

GRANT SELECT ON analytics.job_facts, analytics.contract_facts, analytics.signup_facts TO escala_analytics;

-- Down Migration

DROP VIEW analytics.signup_facts;
DROP VIEW analytics.contract_facts;
DROP VIEW analytics.job_facts;
