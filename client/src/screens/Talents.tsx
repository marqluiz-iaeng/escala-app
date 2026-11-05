import { MapPin, Plus, Send, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';
import { CATEGORIES, dateParts } from '../domain';
import { go, useAction, useApp, useAsync } from '../hooks';
import type { Gig, Talent } from '../types';
import { Button, Empty, ErrorNote, Field, Skeleton, Switch, TalentCard } from '../ui';
import { TalentSheet } from './CompanyGig';

export function Talents() {
  const { toast } = useApp();
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selected, setSelected] = useState<Talent | null>(null);
  const [open, setOpen] = useState(false);
  const [gigId, setGigId] = useState('');
  const [note, setNote] = useState('');
  const { busy, fields, run } = useAction();

  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (city) params.set('city', city);
  if (onlyAvailable) params.set('available', '1');
  const qs = params.toString();

  const { data, error, loading, reload } = useAsync(() => api<{ talents: Talent[]; cities: string[] }>(`/talents?${qs}`), [qs]);
  const mine = useAsync(() => api<{ gigs: Gig[] }>('/gigs/mine'), []);
  const openGigs = (mine.data?.gigs ?? []).filter((g) => g.status === 'open');

  const show = async (t: Talent) => {
    // Abre pela rota de detalhe para o acesso ficar registrado no histórico da pessoa.
    const result = await run(() => api<Talent>(`/talents/${t.id}`));
    if (result) {
      setSelected(result);
      setGigId(openGigs[0]?.id ?? '');
      setNote('');
      setOpen(true);
    }
  };

  const invite = async () => {
    if (!selected) return;
    const result = await run(() => api(`/talents/${selected.id}/invite`, { body: { gigId, ...(note.trim() ? { note: note.trim() } : {}) } }));
    if (result) {
      toast(`Convite enviado: ${selected.displayName}`);
      setOpen(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Talentos</h1>
        <p>Só aparece aqui quem escolheu ser encontrado. Nome completo e contato ficam protegidos até a confirmação.</p>
      </header>

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
        <label className="select-inline">
          <MapPin size={15} aria-hidden />
          <span className="sr-only">Cidade</span>
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">Todas as cidades</option>
            {data?.cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <div className="inline-switch">
          <span>Só disponíveis</span>
          <Switch checked={onlyAvailable} onChange={setOnlyAvailable} label="Mostrar só disponíveis" />
        </div>
      </div>

      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading && <Skeleton tall count={4} />}
      {data && data.talents.length === 0 && (
        <Empty icon={UsersRound} title="Ninguém com esses filtros">
          <p>Tente outra cidade ou função.</p>
        </Empty>
      )}
      <div className={`talent-grid ${loading ? 'refreshing' : ''}`}>
        {data?.talents.map((t, i) => <TalentCard key={t.id} talent={t} index={i} onClick={() => show(t)} />)}
      </div>

      <TalentSheet
        talent={selected} open={open} onClose={() => setOpen(false)}
        footer={
          openGigs.length > 0
            ? <Button block icon={Send} busy={busy} disabled={!gigId} onClick={invite}>Enviar convite</Button>
            : <Button block icon={Plus} onClick={() => { setOpen(false); go('painel'); }}>Publique uma vaga para convidar</Button>
        }
      >
        {openGigs.length > 0 && (
          <div className="invite-form">
            <Field label="Convidar para a vaga" error={fields.gigId}>
              <select className="input" value={gigId} onChange={(e) => setGigId(e.target.value)}>
                {openGigs.map((g) => <option key={g.id} value={g.id}>{dateParts(g.date).day}/{g.date.slice(5, 7)} · {g.title}</option>)}
              </select>
            </Field>
            <Field label="Mensagem (opcional)" error={fields.note} hint="Contatos digitados aqui são ocultados até a confirmação.">
              <textarea className="input" rows={2} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Vimos seu perfil e adoraríamos ter você com a gente." />
            </Field>
          </div>
        )}
      </TalentSheet>
    </div>
  );
}
