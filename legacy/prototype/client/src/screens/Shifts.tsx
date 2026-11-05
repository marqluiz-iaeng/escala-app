import { MessageCircle, Search, TicketX } from 'lucide-react';
import { api } from '../api';
import { isPast } from '../domain';
import { go, useAsync } from '../hooks';
import type { Application } from '../types';
import { Button, Empty, ErrorNote, Skeleton, StatusBadge, Ticket } from '../ui';

export function Shifts() {
  const { data, error, loading, reload } = useAsync(() => api<{ applications: Application[] }>('/applications'), []);
  const apps = data?.applications ?? [];

  const byDate = (a: Application, b: Application) => a.gig.date.localeCompare(b.gig.date);
  const invites = apps.filter((a) => a.status === 'invited').sort(byDate);
  const confirmed = apps.filter((a) => a.status === 'accepted' && !isPast(a.gig.date)).sort(byDate);
  const waiting = apps.filter((a) => a.status === 'pending').sort(byDate);
  const past = apps
    .filter((a) => !['invited', 'pending'].includes(a.status) && !(a.status === 'accepted' && !isPast(a.gig.date)))
    .sort((a, b) => byDate(b, a));

  const Section = ({ title, items, note }: { title: string; items: Application[]; note?: string }) =>
    items.length === 0 ? null : (
      <section className="shift-section">
        <h2>{title}<span className="count">{items.length}</span></h2>
        {note && <p className="section-note">{note}</p>}
        <div className="ticket-list">
          {items.map((a, i) => (
            <Ticket
              key={a.id} gig={a.gig} index={i}
              badge={<StatusBadge status={a.status} />}
              onClick={() => go(`turno/${a.id}`)}
              meta={
                a.canReview ? <span className="ticket-cta">Avaliar turno</span>
                  : a.unread > 0 ? <span className="ticket-unread"><MessageCircle size={14} aria-hidden />{a.unread} nova{a.unread > 1 ? 's' : ''}</span>
                  : undefined
              }
            />
          ))}
        </div>
      </section>
    );

  return (
    <div className="page">
      <header className="page-head">
        <h1>Meus turnos</h1>
        <p>Convites, confirmações e tudo o que você já fez.</p>
      </header>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading && <Skeleton tall count={3} />}
      {data && apps.length === 0 && (
        <Empty icon={TicketX} title="Nenhum turno por enquanto">
          <p>Candidate-se a uma vaga e ela aparece aqui.</p>
          <Button icon={Search} onClick={() => go('vagas')}>Ver vagas</Button>
        </Empty>
      )}
      <Section title="Convites para você" items={invites} note="Empresas que viram seu perfil e chamaram você." />
      <Section title="Confirmados" items={confirmed} />
      <Section title="Aguardando resposta" items={waiting} />
      <Section title="Anteriores" items={past} />
    </div>
  );
}
