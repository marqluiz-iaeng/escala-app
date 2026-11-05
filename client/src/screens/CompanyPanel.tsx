import { ArrowLeft, ArrowRight, Minus, Plus, Sparkles, UserCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';
import { CATEGORIES, GIG_STATUS, PAY_TYPES, isPast } from '../domain';
import { go, useAction, useApp, useAsync, useMe } from '../hooks';
import type { Gig } from '../types';
import { Button, Empty, ErrorNote, Field, PrivacyNote, Sheet, Skeleton, Ticket } from '../ui';

export function CompanyPanel() {
  const me = useMe();
  const { data, error, loading, reload } = useAsync(() => api<{ gigs: Gig[] }>('/gigs/mine'), []);
  const [formOpen, setFormOpen] = useState(false);
  const gigs = data?.gigs ?? [];
  const active = gigs.filter((g) => g.status === 'open' || (g.status === 'filled' && !isPast(g.date)));
  const finished = gigs.filter((g) => !active.includes(g));
  const pending = active.reduce((sum, g) => sum + (g.pendingCount ?? 0), 0);
  const confirmed = active.reduce((sum, g) => sum + (g.acceptedCount ?? 0), 0);

  return (
    <div className="page">
      <header className="feed-head">
        <div>
          <h1>{me.displayName}</h1>
          <p>{pending > 0 ? `${pending} ${pending === 1 ? 'pessoa aguarda' : 'pessoas aguardam'} sua resposta` : 'Tudo em dia por aqui'}</p>
        </div>
        <Button icon={Plus} onClick={() => setFormOpen(true)} className="head-action">Publicar vaga</Button>
      </header>

      <div className="stats">
        <div><b>{active.length}</b><span>{active.length === 1 ? 'vaga ativa' : 'vagas ativas'}</span></div>
        <div className={pending ? 'hot' : ''}><b>{pending}</b><span>aguardando</span></div>
        <div><b>{confirmed}</b><span>{confirmed === 1 ? 'confirmado' : 'confirmados'}</span></div>
      </div>

      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading && <Skeleton tall count={3} />}
      {data && gigs.length === 0 && (
        <Empty icon={Sparkles} title="Publique sua primeira vaga">
          <p>Leva menos de dois minutos. Depois é só escolher entre quem se candidatar.</p>
          <Button icon={Plus} onClick={() => setFormOpen(true)}>Publicar vaga</Button>
        </Empty>
      )}

      {active.length > 0 && (
        <section className="shift-section">
          <h2>Vagas ativas</h2>
          <div className="ticket-list">
            {active.map((gig, i) => (
              <Ticket
                key={gig.id} gig={{ ...gig, company: undefined }} index={i} onClick={() => go(`painel/${gig.id}`)}
                badge={gig.status === 'filled' ? <span className="badge badge-ok">Completa</span> : undefined}
                meta={
                  <span className="gig-counts">
                    {!!gig.pendingCount && <span className="count-hot"><Users size={14} aria-hidden />{gig.pendingCount}</span>}
                    <span><UserCheck size={14} aria-hidden />{gig.acceptedCount}/{gig.slots}</span>
                  </span>
                }
              />
            ))}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section className="shift-section">
          <h2>Encerradas</h2>
          <div className="ticket-list dimmed">
            {finished.map((gig, i) => (
              <Ticket
                key={gig.id} gig={{ ...gig, company: undefined }} index={i} onClick={() => go(`painel/${gig.id}`)}
                badge={<span className="badge badge-off">{isPast(gig.date) && gig.status !== 'cancelled' ? 'Realizada' : GIG_STATUS[gig.status]}</span>}
              />
            ))}
          </div>
        </section>
      )}

      <button type="button" className="fab" aria-label="Publicar vaga" onClick={() => setFormOpen(true)}><Plus size={26} aria-hidden /></button>
      <GigForm open={formOpen} onClose={() => setFormOpen(false)} onCreated={(id) => { setFormOpen(false); void reload(); go(`painel/${id}`); }} />
    </div>
  );
}

const STEP_OF_FIELD: Record<string, number> = {
  category: 0, title: 0, description: 0, date: 1, startTime: 1, endTime: 1, payCents: 1, payType: 1, slots: 1, city: 2, neighbourhood: 2, address: 2,
};

const SUGGESTIONS: Record<string, string> = {
  bartender: 'Bartender para sexta à noite',
  garcom: 'Garçom para evento',
  atendente: 'Atendente para o fim de semana',
  musico: 'Música ao vivo no happy hour',
  recepcao: 'Recepcionista para o evento',
  producao: 'Equipe de montagem',
  cozinha: 'Auxiliar de cozinha para buffet',
  outros: 'Freelancer para evento',
};

function GigForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const me = useMe();
  const { toast } = useApp();
  const { busy, fields, setFields, run } = useAction();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    category: '', title: '', description: '', date: '', startTime: '19:00', endTime: '23:00', pay: '', payType: 'diaria', slots: 1,
    city: me.city, neighbourhood: '', address: '',
  });
  const set = (patch: Partial<typeof f>) => {
    setF((prev) => ({ ...prev, ...patch }));
    setFields({});
  };
  const payCents = f.pay ? Math.round(Number(f.pay) * 100) : 0;

  const check = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!f.category) e.category = 'Escolha a função.';
      if (f.title.trim().length < 4) e.title = 'Dê um título à vaga.';
      if (f.description.trim().length < 10) e.description = 'Descreva o trabalho em uma ou duas frases.';
    }
    if (step === 1) {
      if (!f.date) e.date = 'Escolha a data.';
      if (payCents < 1000) e.payCents = 'Informe o valor (mínimo de R$ 10).';
    }
    setFields(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (f.city.trim().length < 2) e.city = 'Informe a cidade.';
    if (f.neighbourhood.trim().length < 2) e.neighbourhood = 'Informe o bairro.';
    if (f.address.trim().length < 5) e.address = 'Informe o endereço.';
    if (Object.keys(e).length) return setFields(e);

    const created = await run(async () => {
      try {
        return await api<Gig>('/gigs', {
          body: {
            category: f.category, title: f.title, description: f.description, date: f.date, startTime: f.startTime, endTime: f.endTime,
            payCents, payType: f.payType, slots: f.slots, city: f.city, neighbourhood: f.neighbourhood, address: f.address,
          },
        });
      } catch (err) {
        const steps = Object.keys((err as { fields?: Record<string, string> }).fields ?? {}).map((k) => STEP_OF_FIELD[k] ?? 2);
        if (steps.length) setStep(Math.min(...steps));
        throw err;
      }
    });
    if (created) {
      toast('Vaga publicada! Freelancers já podem se candidatar.');
      setStep(0);
      setF({ ...f, category: '', title: '', description: '', date: '', pay: '', neighbourhood: '', address: '', slots: 1 });
      onCreated(created.id);
    }
  };

  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <Sheet
      open={open} onClose={onClose} title="Publicar vaga"
      footer={
        <div className="sheet-actions">
          {step > 0 && <Button variant="soft" icon={ArrowLeft} onClick={() => setStep(step - 1)}>Voltar</Button>}
          {step < 2
            ? <Button block icon={ArrowRight} onClick={() => { if (check()) setStep(step + 1); }}>Continuar</Button>
            : <Button block busy={busy} onClick={submit}>Publicar agora</Button>}
        </div>
      }
    >
      <div className="preview-label">Prévia de como a vaga aparece</div>
      <Ticket gig={{ ...f, payCents, category: f.category || 'outros', company: { name: me.displayName, verified: !!me.company?.verified } }} />

      <div className="stepper small" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>

      <div className="stack" key={step}>
        {step === 0 && (
          <>
            <div className={`field ${fields.category ? 'field-error' : ''}`}>
              <span className="field-label">Quem você procura?</span>
              <div className="chip-grid">
                {Object.entries(CATEGORIES).map(([id, c]) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={id} type="button" className={`pick ${f.category === id ? 'on' : ''}`} aria-pressed={f.category === id}
                      style={{ '--cat': c.color } as React.CSSProperties}
                      onClick={() => set({ category: id, title: f.title || SUGGESTIONS[id]! })}
                    >
                      <Icon size={20} aria-hidden />{c.label}
                    </button>
                  );
                })}
              </div>
              {fields.category && <span className="field-msg" role="alert">{fields.category}</span>}
            </div>
            <Field label="Título" error={fields.title}>
              <input className="input" maxLength={80} value={f.title} onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <Field label="O que a pessoa vai fazer?" error={fields.description} hint="Não informe contatos aqui: eles são liberados depois da confirmação.">
              <textarea className="input" rows={3} maxLength={800} value={f.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Data" error={fields.date}>
              <input className="input" type="date" min={minDate} value={f.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
            <div className="grid-2">
              <Field label="Início" error={fields.startTime}><input className="input" type="time" value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} /></Field>
              <Field label="Fim" error={fields.endTime}><input className="input" type="time" value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} /></Field>
            </div>
            <div className="field">
              <span className="field-label">Pagamento</span>
              <div className="seg seg-full" role="group" aria-label="Tipo de pagamento">
                {Object.entries(PAY_TYPES).map(([id, p]) => (
                  <button key={id} type="button" className={f.payType === id ? 'on' : ''} aria-pressed={f.payType === id} onClick={() => set({ payType: id })}>{p.label}</button>
                ))}
              </div>
            </div>
            <div className="grid-2">
              <Field label="Valor" error={fields.payCents}>
                <div className="input-prefix"><span>R$</span><input className="input" inputMode="numeric" value={f.pay} onChange={(e) => set({ pay: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="220" /></div>
              </Field>
              <div className="field">
                <span className="field-label">Posições</span>
                <div className="stepper-input">
                  <button type="button" aria-label="Menos" disabled={f.slots <= 1} onClick={() => set({ slots: f.slots - 1 })}><Minus size={18} aria-hidden /></button>
                  <output aria-live="polite">{f.slots}</output>
                  <button type="button" aria-label="Mais" disabled={f.slots >= 50} onClick={() => set({ slots: f.slots + 1 })}><Plus size={18} aria-hidden /></button>
                </div>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid-2">
              <Field label="Cidade" error={fields.city}><input className="input" value={f.city} onChange={(e) => set({ city: e.target.value })} /></Field>
              <Field label="Bairro" error={fields.neighbourhood}><input className="input" value={f.neighbourhood} onChange={(e) => set({ neighbourhood: e.target.value })} /></Field>
            </div>
            <Field label="Endereço completo" error={fields.address}>
              <input className="input" autoComplete="street-address" value={f.address} onChange={(e) => set({ address: e.target.value })} />
            </Field>
            <PrivacyNote>Só o bairro é público. Quem for confirmado recebe o endereço completo.</PrivacyNote>
          </>
        )}
      </div>
    </Sheet>
  );
}
