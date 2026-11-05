import { ArrowLeft, Check, CheckCircle2, MapPin, MessageCircle, Unlock, UserRoundSearch, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';
import { GIG_STATUS, isPast, money } from '../domain';
import { go, useAction, useApp, useAsync } from '../hooks';
import type { Application, Gig, Talent } from '../types';
import { Avatar, Button, CategoryTag, Empty, ErrorNote, Rating, Sheet, Skeleton, StatusBadge, Ticket } from '../ui';

const TABS = [
  { id: 'pending', label: 'Aguardando', match: ['pending'] },
  { id: 'accepted', label: 'Confirmados', match: ['accepted'] },
  { id: 'invited', label: 'Convidados', match: ['invited'] },
  { id: 'other', label: 'Outros', match: ['rejected', 'cancelled'] },
];

export function CompanyGig({ id }: { id: string }) {
  const { toast } = useApp();
  const gig = useAsync(() => api<Gig & { address: string | null }>(`/gigs/${id}`), [id]);
  const apps = useAsync(() => api<{ applications: Application[] }>(`/gigs/${id}/applications`), [id]);
  const [tab, setTab] = useState('pending');
  const [confirming, setConfirming] = useState<Application | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [viewing, setViewing] = useState<Talent | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const { busy, run } = useAction();

  if (gig.error && !gig.data) return <div className="page"><BackToPanel /><ErrorNote message={gig.error} onRetry={gig.reload} /></div>;
  if (!gig.data) return <div className="page"><BackToPanel /><Skeleton tall count={2} /></div>;

  const g = gig.data;
  const list = apps.data?.applications ?? [];
  const current = TABS.find((t) => t.id === tab)!;
  const visible = list.filter((a) => current.match.includes(a.status));
  const open = g.status === 'open' || g.status === 'filled';

  const refresh = () => { void gig.reload(); void apps.reload(); };

  const decide = async (app: Application, decision: 'accept' | 'reject') => {
    const result = await run(() => api(`/applications/${app.id}/decide`, { body: { decision } }));
    setConfirmOpen(false);
    if (result) {
      toast(decision === 'accept' ? 'Turno confirmado! Os contatos foram liberados.' : 'Resposta enviada.');
      if (decision === 'accept') setTab('accepted');
      refresh();
    } else {
      refresh();
    }
  };

  const closeGig = async (status: 'closed' | 'cancelled') => {
    const result = await run(() => api(`/gigs/${id}/status`, { body: { status } }));
    setCloseOpen(false);
    if (result) {
      toast(status === 'closed' ? 'Vaga encerrada.' : 'Vaga cancelada. Quem estava confirmado vê o cancelamento no app.');
      refresh();
    }
  };

  const viewProfile = async (app: Application) => {
    if (!app.freelancer) return;
    const result = await run(() => api<Talent>(`/talents/${app.freelancer!.id}`));
    if (result) {
      setViewing(result);
      setViewOpen(true);
    }
  };

  return (
    <div className="page">
      <BackToPanel />
      <Ticket gig={{ ...g, company: undefined }} badge={<span className={`badge badge-${g.status === 'open' ? 'ok' : 'off'}`}>{GIG_STATUS[g.status]}</span>} />
      {g.address && <p className="gig-address"><MapPin size={15} aria-hidden /> {g.address} <small>(visível só para você e confirmados)</small></p>}

      <div className="tabs" role="tablist" aria-label="Candidatos por situação">
        {TABS.map((t) => {
          const count = list.filter((a) => t.match.includes(a.status)).length;
          return (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}{count > 0 && <span className="count">{count}</span>}
            </button>
          );
        })}
      </div>

      {apps.error && <ErrorNote message={apps.error} onRetry={apps.reload} />}
      {!apps.data && apps.loading && <Skeleton count={2} />}
      {apps.data && visible.length === 0 && (
        <Empty icon={UserRoundSearch} title={tab === 'pending' ? 'Nenhuma candidatura aguardando' : 'Ninguém por aqui'}>
          {tab === 'pending' && open && <>
            <p>Quer acelerar? Convide profissionais disponíveis.</p>
            <Button variant="soft" onClick={() => go('talentos')}>Buscar talentos</Button>
          </>}
        </Empty>
      )}

      <ul className="candidates">
        {visible.map((app, i) => {
          const f = app.freelancer!;
          return (
            <li key={app.id} className="candidate" style={{ '--i': i } as React.CSSProperties}>
              <button type="button" className="candidate-head" onClick={() => viewProfile(app)}>
                <Avatar name={f.displayName} id={f.id} />
                <span className="talent-id">
                  <b>{f.displayName}</b>
                  <span>{f.city}{f.experienceYears > 0 && ` · ${f.experienceYears} ${f.experienceYears === 1 ? 'ano' : 'anos'}`}</span>
                </span>
                <Rating rating={f.rating} count={f.ratingCount} />
              </button>
              {app.note && <p className="candidate-note">“{app.note}”</p>}
              <div className="candidate-meta">
                {f.dayRateCents && <span>Referência: <b>{money(f.dayRateCents)}</b></span>}
                {app.status !== 'pending' && <StatusBadge status={app.status} />}
                {app.unread > 0 && <span className="ticket-unread"><MessageCircle size={14} aria-hidden />{app.unread}</span>}
              </div>
              <div className="candidate-actions">
                <Button variant="soft" icon={MessageCircle} onClick={() => go(`turno/${app.id}`)}>Conversar</Button>
                {app.status === 'pending' && (
                  <>
                    <Button variant="soft" icon={X} aria-label={`Recusar ${f.displayName}`} busy={busy} onClick={() => decide(app, 'reject')} />
                    <Button icon={Check} busy={busy} onClick={() => { setConfirming(app); setConfirmOpen(true); }}>Confirmar</Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {open && !isPast(g.date) && (
        <div className="danger-actions">
          <button type="button" className="text-link danger" onClick={() => setCloseOpen(true)}>Encerrar ou cancelar esta vaga</button>
        </div>
      )}

      <Sheet
        open={confirmOpen} onClose={() => setConfirmOpen(false)} title={`Confirmar ${confirming?.freelancer?.displayName ?? ''}?`}
        footer={<Button block icon={CheckCircle2} busy={busy} onClick={() => confirming && decide(confirming, 'accept')}>Confirmar turno</Button>}
      >
        <p className="sheet-lead">Ao confirmar, liberamos entre vocês:</p>
        <ul className="unlock-list">
          <li><Unlock size={16} aria-hidden />Nome completo e telefone das duas partes</li>
          <li><Unlock size={16} aria-hidden />Endereço exato do turno</li>
        </ul>
        <p className="muted">Esses dados ficam disponíveis até 30 dias depois do turno e só podem ser usados para combinar este trabalho. O acesso fica registrado para a pessoa.</p>
      </Sheet>

      <Sheet open={closeOpen} onClose={() => setCloseOpen(false)} title="O que fazer com esta vaga?">
        <div className="stack">
          <div className="option-card">
            <b>Encerrar candidaturas</b>
            <p>Para de receber candidatos. Quem está confirmado continua confirmado.</p>
            <Button variant="ink" busy={busy} onClick={() => closeGig('closed')}>Encerrar vaga</Button>
          </div>
          <div className="option-card">
            <b>Cancelar o turno</b>
            <p>O evento não vai acontecer. Todas as confirmações são canceladas.</p>
            <Button variant="danger" busy={busy} onClick={() => closeGig('cancelled')}>Cancelar turno</Button>
          </div>
        </div>
      </Sheet>

      <TalentSheet talent={viewing} open={viewOpen} onClose={() => setViewOpen(false)} />
    </div>
  );
}

export function TalentSheet({ talent, open, onClose, footer, children }: { talent: Talent | null; open: boolean; onClose: () => void; footer?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Sheet open={open} onClose={onClose} title={talent?.displayName ?? 'Perfil'} footer={footer}>
      {talent && (
        <>
          <div className="profile-hero">
            <Avatar name={talent.displayName} id={talent.id} size="lg" />
            <div>
              <p>{talent.city}{talent.experienceYears > 0 && ` · ${talent.experienceYears} ${talent.experienceYears === 1 ? 'ano de experiência' : 'anos de experiência'}`}</p>
              <Rating rating={talent.rating} count={talent.ratingCount} />
              {talent.available && <span className="live-dot"><i />Disponível</span>}
            </div>
          </div>
          <div className="tags">{talent.categories.map((c) => <CategoryTag key={c} id={c} />)}</div>
          {talent.bio && <p className="gig-desc">{talent.bio}</p>}
          {talent.dayRateCents && <p className="talent-rate-line">Valor de referência: <b>{money(talent.dayRateCents)}</b> por diária</p>}
          <p className="muted small">Esta visualização aparece no histórico de privacidade da pessoa. Nome completo e telefone são liberados só depois da confirmação.</p>
          {children}
        </>
      )}
    </Sheet>
  );
}

function BackToPanel() {
  return <a href="#/painel" className="auth-back"><ArrowLeft size={18} aria-hidden /> Minhas vagas</a>;
}
