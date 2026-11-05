import { BadgeCheck, ChevronRight, Clock, Eye, LogOut, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';
import { CATEGORIES, SEGMENTS, formatPhone } from '../domain';
import { useAction, useApp, useMe } from '../hooks';
import type { Me, Talent } from '../types';
import { Avatar, Button, Field, Rating, TalentCard } from '../ui';
import { EmailChangeSheet } from './EmailCode';

export function Profile() {
  const me = useMe();
  const { logout } = useApp();
  const [emailOpen, setEmailOpen] = useState(false);
  const openEmail = () => setEmailOpen(true);
  return (
    <div className="page">
      <header className="page-head">
        <h1>{me.role === 'freelancer' ? 'Seu perfil' : 'Sua empresa'}</h1>
      </header>

      <a href="#/privacidade" className="privacy-link">
        <span className="privacy-link-icon"><ShieldCheck size={22} aria-hidden /></span>
        <span><b>Privacidade e segurança</b><small>Veja quem acessou seus dados, exporte ou exclua sua conta.</small></span>
        <ChevronRight size={20} aria-hidden />
      </a>

      {me.role === 'freelancer' ? <FreelancerForm onChangeEmail={openEmail} /> : <CompanyForm onChangeEmail={openEmail} />}
      {/* Fica fora dos formulários do perfil: a janela tem um formulário próprio, e formulários não se aninham. */}
      <EmailChangeSheet open={emailOpen} onClose={() => setEmailOpen(false)} />

      <Button variant="ghost" block icon={LogOut} onClick={logout}>Sair da conta</Button>
    </div>
  );
}

function EmailField({ onChange }: { onChange: () => void }) {
  const me = useMe();
  return (
    <div className="field">
      <span className="field-label">E-mail</span>
      <div className="email-row">
        <span className="email-value">{me.email}</span>
        <Button variant="soft" onClick={onChange}>Trocar</Button>
      </div>
      <span className="field-hint">Só você vê. Serve para entrar e receber avisos de segurança.</span>
    </div>
  );
}

function FreelancerForm({ onChangeEmail }: { onChangeEmail: () => void }) {
  const me = useMe();
  const { setMe, toast } = useApp();
  const profile = me.freelancer!;
  const initial = {
    fullName: me.fullName, phone: formatPhone(me.phone), city: me.city, categories: profile.categories, bio: profile.bio,
    experienceYears: profile.experienceYears, dayRate: profile.dayRateCents ? String(profile.dayRateCents / 100) : '',
  };
  const [f, setF] = useState(initial);
  const { busy, fields, run } = useAction();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch }));

  const parts = f.fullName.trim().split(/\s+/);
  const previewName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.` : parts[0] ?? '';
  const preview: Talent = {
    id: me.id, displayName: previewName, city: f.city, categories: f.categories, bio: f.bio, experienceYears: f.experienceYears,
    dayRateCents: f.dayRate ? Number(f.dayRate) * 100 : null, available: profile.available, rating: me.rating, ratingCount: me.ratingCount,
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await run(() => api<Me>('/me/profile', {
      method: 'PATCH',
      body: {
        fullName: f.fullName, phone: f.phone, city: f.city, categories: f.categories, bio: f.bio, experienceYears: f.experienceYears,
        dayRateCents: f.dayRate ? Math.round(Number(f.dayRate) * 100) : null,
      },
    }));
    if (result) {
      setMe(result);
      setF({ ...f, phone: formatPhone(result.phone) });
      toast('Perfil atualizado.');
    }
  };

  return (
    <>
      <section className="preview-block">
        <h2><Eye size={16} aria-hidden /> Como as empresas veem você</h2>
        <TalentCard talent={preview} />
        <p className="muted small">
          {profile.discoverable
            ? 'Seu perfil aparece nas buscas.'
            : 'Seu perfil não aparece nas buscas. Só empresas de vagas em que você se candidatou veem este cartão.'}
          {' '}<a className="text-link" href="#/privacidade">Alterar</a>
        </p>
      </section>

      <form className="stack card-form" onSubmit={save}>
        <h2>Editar informações</h2>
        <Field label="Nome completo" error={fields.fullName} hint="Só é liberado para a outra parte depois de um turno confirmado.">
          <input className="input" autoComplete="name" value={f.fullName} onChange={(e) => set({ fullName: e.target.value })} />
        </Field>
        <div className="grid-2">
          <Field label="Telefone" error={fields.phone}>
            <input className="input" type="tel" autoComplete="tel" value={f.phone} onChange={(e) => set({ phone: formatPhone(e.target.value) })} />
          </Field>
          <Field label="Cidade" error={fields.city}>
            <input className="input" autoComplete="address-level2" value={f.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
        </div>
        <EmailField onChange={onChangeEmail} />
        <div className={`field ${fields.categories ? 'field-error' : ''}`}>
          <span className="field-label">Funções <small>(até 4)</small></span>
          <div className="chip-grid">
            {Object.entries(CATEGORIES).map(([id, c]) => {
              const Icon = c.icon;
              const on = f.categories.includes(id);
              return (
                <button
                  key={id} type="button" className={`pick ${on ? 'on' : ''}`} aria-pressed={on} style={{ '--cat': c.color } as React.CSSProperties}
                  disabled={!on && f.categories.length >= 4}
                  onClick={() => set({ categories: on ? f.categories.filter((x) => x !== id) : [...f.categories, id] })}
                >
                  <Icon size={20} aria-hidden />{c.label}
                </button>
              );
            })}
          </div>
          {fields.categories && <span className="field-msg" role="alert">{fields.categories}</span>}
        </div>
        <Field label={`Experiência: ${f.experienceYears === 0 ? 'começando agora' : `${f.experienceYears} ${f.experienceYears === 1 ? 'ano' : 'anos'}`}`}>
          <input className="range" type="range" min={0} max={30} value={f.experienceYears} onChange={(e) => set({ experienceYears: Number(e.target.value) })} />
        </Field>
        <Field label="Valor de referência por diária" error={fields.dayRateCents}>
          <div className="input-prefix"><span>R$</span><input className="input" inputMode="numeric" value={f.dayRate} onChange={(e) => set({ dayRate: e.target.value.replace(/\D/g, '').slice(0, 6) })} /></div>
        </Field>
        <Field label="Apresentação" error={fields.bio} hint="Não inclua dados de saúde, religião, origem racial, opinião política ou contato.">
          <textarea className="input" rows={3} maxLength={400} value={f.bio} onChange={(e) => set({ bio: e.target.value })} />
        </Field>
        <Button type="submit" block busy={busy} disabled={!dirty}>{dirty ? 'Salvar alterações' : 'Tudo salvo'}</Button>
      </form>
    </>
  );
}

function CompanyForm({ onChangeEmail }: { onChangeEmail: () => void }) {
  const me = useMe();
  const { setMe, toast } = useApp();
  const company = me.company!;
  const initial = { tradeName: me.displayName, contactName: me.fullName, phone: formatPhone(me.phone), city: me.city, segment: company.segment, about: company.about };
  const [f, setF] = useState(initial);
  const { busy, fields, run } = useAction();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { tradeName, ...rest } = f;
    const body = tradeName !== me.displayName ? f : rest;
    const result = await run(() => api<Me>('/me/profile', { method: 'PATCH', body }));
    if (result) {
      setMe(result);
      setF({ ...f, phone: formatPhone(result.phone) });
      toast('Dados da empresa atualizados.');
    }
  };

  return (
    <>
      <section className="preview-block">
        <h2><Eye size={16} aria-hidden /> Como os freelancers veem você</h2>
        <div className="company-card big">
          <Avatar name={f.tradeName || 'E'} id={me.id} size="lg" />
          <div>
            <b>{f.tradeName}{company.verified && <BadgeCheck className="verified" size={18} aria-label="Empresa verificada" role="img" />}</b>
            <span>{SEGMENTS[f.segment]} · {f.city}</span>
            <Rating rating={me.rating} count={me.ratingCount} />
          </div>
        </div>
        {f.about && <p className="company-about">{f.about}</p>}
        <p className={`verify-state ${company.verified ? 'ok' : ''}`}>
          {company.verified ? <BadgeCheck size={16} aria-hidden /> : <Clock size={16} aria-hidden />}
          {company.verified
            ? 'Empresa verificada. Alterar o nome remove o selo até uma nova checagem.'
            : 'Verificação pendente. No protótipo, o CNPJ passa só pela checagem dos dígitos.'}
        </p>
      </section>

      <form className="stack card-form" onSubmit={save}>
        <h2>Editar informações</h2>
        <Field label="Nome da empresa" error={fields.tradeName}>
          <input className="input" value={f.tradeName} onChange={(e) => set({ tradeName: e.target.value })} />
        </Field>
        <Field label="CNPJ" hint="Protegido por criptografia e nunca exibido publicamente.">
          <input className="input" value={company.cnpjMasked} disabled />
        </Field>
        <EmailField onChange={onChangeEmail} />
        <Field label="Segmento" error={fields.segment}>
          <select className="input" value={f.segment} onChange={(e) => set({ segment: e.target.value })}>
            {Object.entries(SEGMENTS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </Field>
        <Field label="Responsável pelas contratações" error={fields.contactName} hint="Só aparece para quem tiver um turno confirmado.">
          <input className="input" value={f.contactName} onChange={(e) => set({ contactName: e.target.value })} />
        </Field>
        <div className="grid-2">
          <Field label="Telefone" error={fields.phone}><input className="input" type="tel" value={f.phone} onChange={(e) => set({ phone: formatPhone(e.target.value) })} /></Field>
          <Field label="Cidade" error={fields.city}><input className="input" value={f.city} onChange={(e) => set({ city: e.target.value })} /></Field>
        </div>
        <Field label="Sobre a empresa" error={fields.about}>
          <textarea className="input" rows={3} maxLength={400} value={f.about} onChange={(e) => set({ about: e.target.value })} />
        </Field>
        <Button type="submit" block busy={busy} disabled={!dirty}>{dirty ? 'Salvar alterações' : 'Tudo salvo'}</Button>
      </form>
    </>
  );
}
