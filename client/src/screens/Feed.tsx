import { CalendarDays, Clock, MapPin, Search, SearchX, Users } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';
import { CATEGORIES, PAY_TYPES, SEGMENTS, dateParts, money } from '../domain';
import { go, useAction, useApp, useAsync, useDebounced, useMe } from '../hooks';
import type { Gig, Me } from '../types';
import { Avatar, Button, Empty, ErrorNote, Field, PrivacyNote, Rating, Sheet, Skeleton, StatusBadge, Switch, Ticket, Verified } from '../ui';

const WHEN = [
  { id: '', label: 'Quando for' },
  { id: 'today', label: 'Hoje' },
  { id: 'weekend', label: 'Fim de semana' },
  { id: 'week', label: 'Próximos 7 dias' },
];

export function Feed() {
  const me = useMe();
  const { setMe, toast } = useApp();
  const [category, setCategory] = useState('');
  const [when, setWhen] = useState('');
  const [city, setCity] = useState('');
  const [q, setQ] = useState('');
  const query = useDebounced(q);
  const [selected, setSelected] = useState<Gig | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (when) params.set('when', when);
  if (city) params.set('city', city);
  if (query.trim()) params.set('q', query.trim());
  const qs = params.toString();

  const { data, error, loading, reload } = useAsync(() => api<{ gigs: Gig[]; cities: string[] }>(`/gigs?${qs}`), [qs]);
  const available = me.freelancer?.available ?? false;

  const toggleAvailable = async (value: boolean) => {
    setMe({ ...me, freelancer: { ...me.freelancer!, available: value } });
    try {
      setMe(await api<Me>('/me/profile', { method: 'PATCH', body: { available: value } }));
      toast(value ? 'Você está disponível para convites.' : 'Você está indisponível. Pode voltar quando quiser.');
    } catch (err) {
      setMe(me);
      toast((err as Error).message, 'error');
    }
  };

  const hasFilter = !!(category || when || city || query.trim());
  const firstName = me.fullName.split(' ')[0];

  return (
    <div className="page">
      <header className="feed-head">
        <div>
          <h1>Oi, {firstName}</h1>
          <p>{data ? `${data.gigs.length} ${data.gigs.length === 1 ? 'turno aberto' : 'turnos abertos'}${hasFilter ? ' com esses filtros' : ''}` : 'Buscando turnos…'}</p>
        </div>
        <div className={`avail ${available ? 'on' : ''}`}>
          <span className="avail-label">{available ? 'Disponível' : 'Indisponível'}</span>
          <Switch checked={available} onChange={toggleAvailable} label="Disponível para convites" />
        </div>
      </header>

      <div className="searchbar">
        <Search size={18} aria-hidden />
        <input type="search" placeholder="Buscar por função, casa ou evento" aria-label="Buscar vagas" value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} />
      </div>

      <div className="chips" role="group" aria-label="Filtrar por função">
        <button type="button" className={`chip ${!category ? 'on' : ''}`} aria-pressed={!category} onClick={() => setCategory('')}>Todas</button>
        {Object.entries(CATEGORIES).map(([id, c]) => {
          const Icon = c.icon;
          return (
            <button key={id} type="button" className={`chip ${category === id ? 'on' : ''}`} aria-pressed={category === id} style={{ '--cat': c.color } as React.CSSProperties} onClick={() => setCategory(category === id ? '' : id)}>
              <Icon size={15} aria-hidden />{c.plural}
            </button>
          );
        })}
      </div>

      <div className="filters-row">
        <div className="seg" role="group" aria-label="Filtrar por data">
          {WHEN.map((w) => (
            <button key={w.id} type="button" className={when === w.id ? 'on' : ''} aria-pressed={when === w.id} onClick={() => setWhen(w.id)}>{w.label}</button>
          ))}
        </div>
        <label className="select-inline">
          <MapPin size={15} aria-hidden />
          <span className="sr-only">Cidade</span>
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">Todas as cidades</option>
            {data?.cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading && <Skeleton tall count={4} />}
      {data && data.gigs.length === 0 && (
        <Empty icon={SearchX} title="Nenhum turno com esses filtros">
          <p>Tente outra função ou amplie a data.</p>
          {hasFilter && <Button variant="soft" onClick={() => { setCategory(''); setWhen(''); setCity(''); setQ(''); }}>Limpar filtros</Button>}
        </Empty>
      )}
      <div className={`ticket-list ${loading ? 'refreshing' : ''}`}>
        {data?.gigs.map((gig, i) => (
          <Ticket
            key={gig.id} gig={gig} index={i}
            badge={gig.myApplication ? <StatusBadge status={gig.myApplication.status} /> : undefined}
            onClick={() => { setSelected(gig); setSheetOpen(true); }}
          />
        ))}
      </div>

      <GigSheet gig={selected} open={sheetOpen} onClose={() => setSheetOpen(false)} onApplied={reload} />
    </div>
  );
}

function GigSheet({ gig, open, onClose, onApplied }: { gig: Gig | null; open: boolean; onClose: () => void; onApplied: () => void }) {
  const { toast } = useApp();
  const { busy, fields, run } = useAction();
  const [note, setNote] = useState('');
  const [sentId, setSentId] = useState<{ gig: string; app: string } | null>(null);

  if (!gig) return <Sheet open={false} onClose={onClose} title="Vaga">{null}</Sheet>;

  const sent = sentId?.gig === gig.id ? sentId.app : null;
  const existing = gig.myApplication;
  const date = dateParts(gig.date);

  const apply = async () => {
    const result = await run(() => api<{ id: string }>(`/gigs/${gig.id}/apply`, { body: note.trim() ? { note: note.trim() } : {} }));
    if (result) {
      setSentId({ gig: gig.id, app: result.id });
      setNote('');
      toast('Candidatura enviada! Avisamos quando a empresa responder.');
      onApplied();
    }
  };

  const openThread = (id: string) => { onClose(); go(`turno/${id}`); };

  const footer = sent
    ? <Button block variant="ink" onClick={() => openThread(sent)}>Ver no meu turno</Button>
    : existing
      ? <Button block variant="ink" onClick={() => openThread(existing.id)}>Abrir minha candidatura</Button>
      : <Button block busy={busy} onClick={apply}>Quero esse turno</Button>;

  return (
    <Sheet open={open} onClose={onClose} title={gig.title} footer={footer}>
      <div className="gig-pay" style={{ '--cat': (CATEGORIES[gig.category] ?? CATEGORIES.outros).color } as React.CSSProperties}>
        <strong>{money(gig.payCents)}</strong>
        <span>{PAY_TYPES[gig.payType]?.suffix}</span>
        {existing && <StatusBadge status={existing.status} />}
        {sent && <div className="stamp" aria-hidden>Enviada!</div>}
      </div>

      <ul className="facts">
        <li><CalendarDays size={18} aria-hidden /><span className="capitalize">{date.long}</span></li>
        <li><Clock size={18} aria-hidden />{gig.startTime} às {gig.endTime}</li>
        <li><MapPin size={18} aria-hidden />{gig.neighbourhood}, {gig.city}</li>
        <li><Users size={18} aria-hidden />{gig.slotsLeft} {gig.slotsLeft === 1 ? 'posição aberta' : 'posições abertas'}</li>
      </ul>

      <PrivacyNote>O endereço exato só é liberado quando o turno é confirmado. Seu telefone também.</PrivacyNote>

      <p className="gig-desc">{gig.description}</p>

      <div className="company-card">
        <Avatar name={gig.company.name} id={gig.company.id} />
        <div>
          <b>{gig.company.name}<Verified verified={gig.company.verified} /></b>
          <span>{gig.company.segment ? SEGMENTS[gig.company.segment] : ''}</span>
          <Rating rating={gig.company.rating} count={gig.company.ratingCount} />
        </div>
      </div>
      {gig.company.about && <p className="company-about">{gig.company.about}</p>}

      {!existing && !sent && (
        <Field label="Mensagem para a empresa (opcional)" error={fields.note} hint="Contatos digitados aqui são ocultados até a confirmação.">
          <textarea className="input" rows={2} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Por que você é a pessoa certa para esse turno?" />
        </Field>
      )}
    </Sheet>
  );
}
