import { describe, expect, it } from 'vitest';
import { canTransition, STATE_MACHINES } from './state-machines.js';

describe('máquinas de estado', () => {
  it('freelancer não se aprova na própria candidatura', () => {
    expect(canTransition('application', 'applied', 'selected', 'freelancer')).toBe(false);
    expect(canTransition('application', 'applied', 'selected', 'company')).toBe(true);
  });

  it('empresa não aceita o contrato no lugar do freelancer', () => {
    expect(canTransition('contract', 'proposed', 'accepted', 'company')).toBe(false);
    expect(canTransition('contract', 'proposed', 'accepted', 'freelancer')).toBe(true);
  });

  it('ninguém conclui um contrato diretamente: só o sistema, após a confirmação', () => {
    for (const actor of ['company', 'freelancer', 'requester', 'support'] as const) {
      expect(canTransition('contract', 'awaiting_confirmation', 'completed', actor)).toBe(false);
    }
  });

  it('só o suporte decide uma disputa', () => {
    expect(canTransition('dispute', 'under_review', 'decided', 'support')).toBe(true);
    for (const actor of ['company', 'freelancer', 'system'] as const) {
      expect(canTransition('dispute', 'under_review', 'decided', actor)).toBe(false);
    }
  });

  it('todo estado de destino tem um caminho desde o início', () => {
    for (const machine of Object.values(STATE_MACHINES)) {
      const reachable = new Set<string | null>([null]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const transition of machine) {
          if (reachable.has(transition.from) && !reachable.has(transition.to)) {
            reachable.add(transition.to);
            grew = true;
          }
        }
      }
      for (const transition of machine) expect(reachable.has(transition.to)).toBe(true);
    }
  });

  it('nenhuma transição fica sem quem possa executá-la', () => {
    for (const machine of Object.values(STATE_MACHINES)) {
      for (const transition of machine) expect(transition.actors.length).toBeGreaterThan(0);
    }
  });
});
