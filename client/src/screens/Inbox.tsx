import { MessagesSquare } from 'lucide-react';
import { api } from '../api';
import { timeAgo } from '../domain';
import { go, useAsync, useMe } from '../hooks';
import type { Application } from '../types';
import { Avatar, Empty, ErrorNote, Skeleton, StatusBadge } from '../ui';

export function Inbox() {
  const me = useMe();
  const { data, error, loading, reload } = useAsync(() => api<{ applications: Application[] }>('/applications'), []);

  const threads = (data?.applications ?? [])
    .filter((a) => a.lastMessageAt || a.status === 'invited' || a.status === 'accepted')
    .sort((a, b) => (b.unread - a.unread) || ((b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt)));

  return (
    <div className="page">
      <header className="page-head">
        <h1>Conversas</h1>
        <p>Tudo fica aqui dentro. Seu telefone continua protegido até a confirmação.</p>
      </header>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading && <Skeleton count={4} />}
      {data && threads.length === 0 && (
        <Empty icon={MessagesSquare} title="Nenhuma conversa ainda">
          <p>{me.role === 'freelancer' ? 'Quando você se candidatar, pode tirar dúvidas com a empresa por aqui.' : 'Abra uma candidatura para conversar com quem se candidatou.'}</p>
        </Empty>
      )}
      <ul className="threads">
        {threads.map((a) => {
          const name = me.role === 'company' ? a.freelancer?.displayName ?? 'Candidato' : a.gig.company.name;
          const id = me.role === 'company' ? a.freelancer?.id ?? a.id : a.gig.company.id;
          return (
            <li key={a.id}>
              <button type="button" className={`thread-row ${a.unread ? 'unread' : ''}`} onClick={() => go(`turno/${a.id}`)}>
                <Avatar name={name} id={id} />
                <span className="thread-main">
                  <b>{name}</b>
                  <span className="thread-sub">{a.gig.title}</span>
                </span>
                <span className="thread-side">
                  <small>{timeAgo(a.lastMessageAt ?? a.createdAt)}</small>
                  {a.unread > 0 ? <span className="nav-badge static">{a.unread}</span> : <StatusBadge status={a.status} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
