/**
 * Transições válidas de cada máquina de estado e quem pode fazer cada uma.
 * A mesma tabela é imposta por gatilho no banco (migração 0010), e um teste confere que as duas são iguais.
 */
export type ActorKind = 'freelancer' | 'company' | 'requester' | 'support' | 'system';

export type Transition = { from: string | null; to: string; actors: readonly ActorKind[] };

const t = (from: string | null, to: string, ...actors: ActorKind[]): Transition => ({
  from,
  to,
  actors,
});

export const STATE_MACHINES = {
  job: [
    t(null, 'draft', 'company', 'system'),
    t(null, 'published', 'company', 'system'),
    t('draft', 'published', 'company'),
    t('draft', 'cancelled', 'company', 'system'),
    t('published', 'filled', 'company', 'system'),
    t('published', 'closed', 'company', 'system'),
    t('published', 'expired', 'system'),
    t('published', 'cancelled', 'company', 'support', 'system'),
    t('filled', 'published', 'company', 'system'),
    t('filled', 'closed', 'company', 'system'),
    t('filled', 'cancelled', 'company', 'support', 'system'),
  ],
  application: [
    t(null, 'invited', 'company', 'system'),
    t(null, 'applied', 'freelancer', 'system'),
    t('invited', 'applied', 'freelancer'),
    t('invited', 'withdrawn', 'freelancer', 'system'),
    t('invited', 'rejected', 'company', 'system'),
    t('invited', 'expired', 'system'),
    t('applied', 'shortlisted', 'company'),
    t('applied', 'selected', 'company'),
    t('applied', 'rejected', 'company', 'system'),
    t('applied', 'withdrawn', 'freelancer', 'system'),
    t('applied', 'expired', 'system'),
    t('shortlisted', 'selected', 'company'),
    t('shortlisted', 'rejected', 'company', 'system'),
    t('shortlisted', 'withdrawn', 'freelancer', 'system'),
    t('shortlisted', 'expired', 'system'),
    t('selected', 'rejected', 'company', 'system'),
    t('selected', 'withdrawn', 'freelancer', 'system'),
    t('selected', 'expired', 'system'),
  ],
  contract: [
    t(null, 'proposed', 'company', 'system'),
    t('proposed', 'accepted', 'freelancer', 'system'),
    t('proposed', 'declined', 'freelancer', 'system'),
    t('proposed', 'expired', 'system'),
    t('proposed', 'cancelled', 'company', 'system'),
    t('accepted', 'in_progress', 'system'),
    t('accepted', 'cancelled', 'company', 'freelancer', 'support', 'system'),
    t('accepted', 'no_show', 'company', 'freelancer', 'system'),
    t('in_progress', 'awaiting_confirmation', 'system'),
    t('in_progress', 'disputed', 'system', 'support'),
    t('awaiting_confirmation', 'completed', 'system'),
    t('awaiting_confirmation', 'disputed', 'system', 'support'),
    t('cancelled', 'disputed', 'system', 'support'),
    t('no_show', 'disputed', 'system', 'support'),
    t('disputed', 'completed', 'system', 'support'),
    t('disputed', 'cancelled', 'system', 'support'),
    t('disputed', 'no_show', 'system', 'support'),
    t('disputed', 'in_progress', 'system'),
    t('disputed', 'awaiting_confirmation', 'system'),
  ],
  shift: [
    t(null, 'scheduled', 'company', 'system'),
    t('scheduled', 'in_progress', 'system'),
    t('scheduled', 'no_show', 'company', 'system'),
    t('scheduled', 'cancelled', 'company', 'freelancer', 'support', 'system'),
    t('in_progress', 'done', 'system'),
  ],
  dispute: [
    t(null, 'opened', 'freelancer', 'company', 'system'),
    t('opened', 'collecting_evidence', 'support', 'system'),
    t('opened', 'withdrawn', 'freelancer', 'company', 'support'),
    t('collecting_evidence', 'under_review', 'support', 'system'),
    t('collecting_evidence', 'withdrawn', 'freelancer', 'company', 'support'),
    t('under_review', 'decided', 'support'),
    t('decided', 'applied', 'support', 'system'),
    t('applied', 'closed', 'support', 'system'),
  ],
  ticket: [
    t(null, 'open', 'requester', 'support', 'system'),
    t('open', 'pending_user', 'support'),
    t('open', 'pending_support', 'support'),
    t('open', 'resolved', 'support'),
    t('pending_user', 'pending_support', 'requester', 'support', 'system'),
    t('pending_user', 'resolved', 'support', 'system'),
    t('pending_support', 'pending_user', 'support'),
    t('pending_support', 'resolved', 'support'),
    t('resolved', 'closed', 'requester', 'support', 'system'),
    t('resolved', 'open', 'requester'),
  ],
} as const satisfies Record<string, readonly Transition[]>;

export type StateMachineEntity = keyof typeof STATE_MACHINES;

export function canTransition(
  entity: StateMachineEntity,
  from: string | null,
  to: string,
  actor: ActorKind,
): boolean {
  const machine: readonly Transition[] = STATE_MACHINES[entity];
  return machine.some(
    (transition) =>
      transition.from === from && transition.to === to && transition.actors.includes(actor),
  );
}
