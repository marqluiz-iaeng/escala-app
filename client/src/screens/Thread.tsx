import { ArrowLeft, Check, CheckCircle2, Lock, MapPin, Phone, Send, ShieldAlert, Unlock, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { dateParts, formatPhone, clock, money, PAY_TYPES } from '../domain';
import { go, useAction, useApp, useAsync, useMe } from '../hooks';
import type { ApplicationDetail, Message } from '../types';
import { Avatar, Button, ErrorNote, Sheet, Skeleton, StarInput, StatusBadge } from '../ui';

export function Thread({ id }: { id: string }) {
  const me = useMe();
  const { refreshMe, toast } = useApp();
  const { data: app, error, loading, reload } = useAsync(() => api<ApplicationDetail>(`/applications/${id}`), [id]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [maskedNotice, setMaskedNotice] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const { busy, run } = useAction();
  const { busy: sending, run: runSend } = useAction();
  const endRef = useRef<HTMLDivElement>(null);
  const lastAt = useRef(0);

  // Atualiza a conversa enquanto a tela estiver aberta; o servidor só devolve o que é novo.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await api<{ messages: Message[]; status: string }>(`/applications/${id}/messages?after=${lastAt.current}`);
        if (!alive) return;
        if (res.messages.length) {
          lastAt.current = res.messages[res.messages.length - 1]!.at;
          setMessages((list) => {
            const known = new Set(list.map((m) => m.id));
            return [...list, ...res.messages.filter((m) => !known.has(m.id))];
          });
          void refreshMe();
        }
      } catch {
        /* erros de rede em segundo plano não interrompem a conversa */
      }
    };
    void tick();
    const timer = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(timer); };
  }, [id, refreshMe]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  if (error && !app) return <div className="page"><BackLink /><ErrorNote message={error} onRetry={reload} /></div>;
  if (!app) return <div className="page"><BackLink />{loading && <Skeleton count={3} />}</div>;

  const isCompany = me.role === 'company';
  const otherName = app.other.displayName;
  const otherId = isCompany ? app.freelancer?.id ?? app.id : app.gig.company.id;
  const canDecide = (isCompany && app.status === 'pending') || (!isCompany && app.status === 'invited');
  const canWrite = ['invited', 'pending', 'accepted'].includes(app.status);
  const canWithdraw = !isCompany && ['pending', 'accepted'].includes(app.status);
  const date = dateParts(app.gig.date);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const result = await runSend(() => api<Message>(`/applications/${id}/messages`, { body: { body } }));
    if (result) {
      setDraft('');
      setMaskedNotice(!!result.masked);
      lastAt.current = result.at;
      setMessages((list) => [...list, result]);
    }
  };

  const decide = async (decision: 'accept' | 'reject') => {
    const result = await run(() => api(`/applications/${id}/decide`, { body: { decision } }));
    setConfirmOpen(false);
    if (result) {
      toast(decision === 'accept' ? 'Turno confirmado! Os contatos foram liberados.' : 'Resposta enviada.');
      void reload();
    }
  };

  const withdraw = async () => {
    const result = await run(() => api(`/applications/${id}/withdraw`, { body: {} }));
    setWithdrawOpen(false);
    if (result) {
      toast('Candidatura retirada.');
      go('turnos');
    }
  };

  const review = async (value: number) => {
    setStars(value);
    const result = await run(() => api(`/applications/${id}/review`, { body: { stars: value } }));
    if (result) {
      toast('Obrigado! Sua avaliação foi registrada.');
      void reload();
    } else {
      setStars(0);
    }
  };

  return (
    <div className="thread-page">
      <header className="thread-head">
        <BackLink />
        <Avatar name={otherName} id={otherId} size="sm" />
        <div className="thread-title">
          <b>{otherName}</b>
          <span>{app.gig.title}</span>
        </div>
        <StatusBadge status={app.status} />
      </header>

      <div className="thread-scroll">
        <section className="thread-card">
          <div className="thread-facts">
            <span className="capitalize">{date.long}</span>
            <span>{app.gig.startTime} às {app.gig.endTime}</span>
            <span>{money(app.gig.payCents)} {PAY_TYPES[app.gig.payType]?.suffix}</span>
          </div>

          {app.other.contact ? (
            <div className="unlock">
              <h3><Unlock size={16} aria-hidden /> Contato liberado</h3>
              <p className="unlock-name">{app.other.contact.fullName}</p>
              {app.other.contact.phone && (
                <a className="btn btn-ink btn-block" href={`tel:+55${app.other.contact.phone}`}><Phone size={18} aria-hidden />{formatPhone(app.other.contact.phone)}</a>
              )}
              {app.address && <p className="unlock-address"><MapPin size={16} aria-hidden />{app.address}</p>}
              <small>Fica disponível até 30 dias depois do turno. Esse acesso aparece no histórico de privacidade de cada um.</small>
            </div>
          ) : app.status === 'accepted' ? (
            <p className="locked"><Lock size={15} aria-hidden /> O contato não está mais disponível. Ele fica liberado até 30 dias depois do turno.</p>
          ) : canWrite ? (
            <p className="locked"><Lock size={15} aria-hidden /> Telefone, nome completo e endereço ficam protegidos até o turno ser confirmado.</p>
          ) : null}

          {isCompany && app.freelancer && (
            <p className="thread-note-line">
              <a className="text-link" href={`#/painel/${app.gig.id}`}>Ver todos os candidatos desta vaga</a>
            </p>
          )}

          {canDecide && (
            <div className="decide">
              <Button variant="soft" icon={X} busy={busy} onClick={() => decide('reject')}>Recusar</Button>
              <Button icon={Check} busy={busy} onClick={() => setConfirmOpen(true)}>{isCompany ? 'Confirmar' : 'Aceitar convite'}</Button>
            </div>
          )}

          {app.canReview && (
            <div className="review-box">
              <h3>Como foi esse turno?</h3>
              <StarInput value={stars} onChange={review} disabled={busy} />
              <small>Só a média é mostrada, sem comentários, para evitar exposição de dados.</small>
            </div>
          )}
        </section>

        {app.note && (
          <div className="msg-note">
            <span>{isCompany && app.status !== 'invited' ? 'Mensagem da candidatura' : 'Mensagem inicial'}</span>
            <p>{app.note}</p>
          </div>
        )}

        <div className="messages" aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.mine ? 'mine' : ''} ${m.body === null ? 'removed' : ''}`}>
              <p>{m.body ?? 'Mensagem removida a pedido do titular'}</p>
              <time>{clock(m.at)}</time>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {canWithdraw && (
          <button type="button" className="text-link danger thread-withdraw" onClick={() => setWithdrawOpen(true)}>Retirar candidatura</button>
        )}
      </div>

      {canWrite ? (
        <form className="composer" onSubmit={send}>
          {maskedNotice && (
            <p className="masked-notice" role="status">
              <ShieldAlert size={15} aria-hidden /> Ocultamos o contato da sua mensagem. Ele é liberado automaticamente quando o turno for confirmado.
            </p>
          )}
          <div className="composer-row">
            <input className="input" placeholder="Escreva uma mensagem" aria-label="Mensagem" value={draft} maxLength={1000} onChange={(e) => setDraft(e.target.value)} />
            <button type="submit" className="send" aria-label="Enviar mensagem" disabled={sending || !draft.trim()}><Send size={19} aria-hidden /></button>
          </div>
        </form>
      ) : (
        <p className="composer-closed">Esta conversa foi encerrada.</p>
      )}

      <Sheet
        open={confirmOpen} onClose={() => setConfirmOpen(false)}
        title={isCompany ? `Confirmar ${otherName}?` : 'Aceitar este convite?'}
        footer={<Button block icon={CheckCircle2} busy={busy} onClick={() => decide('accept')}>Confirmar turno</Button>}
      >
        <p className="sheet-lead">Ao confirmar, liberamos entre vocês:</p>
        <ul className="unlock-list">
          <li><Unlock size={16} aria-hidden />Nome completo e telefone das duas partes</li>
          <li><Unlock size={16} aria-hidden />Endereço exato do turno</li>
        </ul>
        <p className="muted">Esses dados ficam disponíveis até 30 dias depois do turno e só podem ser usados para combinar este trabalho. O acesso fica registrado.</p>
      </Sheet>

      <Sheet
        open={withdrawOpen} onClose={() => setWithdrawOpen(false)} title="Retirar candidatura?"
        footer={<Button block variant="danger" busy={busy} onClick={withdraw}>Retirar candidatura</Button>}
      >
        <p className="sheet-lead">A empresa deixa de ver seu perfil nesta vaga{app.status === 'accepted' ? ' e a posição volta a ficar aberta' : ''}. Não dá para desfazer.</p>
      </Sheet>
    </div>
  );
}

function BackLink() {
  return (
    <button type="button" className="icon-btn" aria-label="Voltar" onClick={() => window.history.length > 1 ? window.history.back() : go('conversas')}>
      <ArrowLeft size={22} aria-hidden />
    </button>
  );
}
