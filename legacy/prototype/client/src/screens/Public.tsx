import { ArrowLeft, ArrowRight, Briefcase, EyeOff, FileLock2, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api, ApiError } from '../api';
import { CATEGORIES, SEGMENTS, formatCnpj, formatPhone, passwordStrength } from '../domain';
import { go, useAction, useApp } from '../hooks';
import type { Me, Role } from '../types';
import { Button, Field, Logo, Switch } from '../ui';
import { VerifyEmail } from './EmailCode';

const MARQUEE = ['Bartender', 'Garçom', 'Atendente', 'Voz e violão', 'Recepção', 'DJ', 'Hostess', 'Roadie', 'Copa e cozinha', 'Banda', 'Promoter'];

export function Welcome() {
  const { meta, setMe, toast } = useApp();
  const [busy, setBusy] = useState<string | null>(null);

  const demoLogin = async (email: string, password: string) => {
    setBusy(email);
    try {
      await api('/auth/login', { body: { email, password } });
      setMe(await api<Me>('/me'));
      go('');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="welcome">
      <section className="welcome-hero">
        <header className="welcome-top">
          <Logo light />
          <a href="#/entrar" className="link-light">Entrar</a>
        </header>
        <h1>O turno certo.<br /><em>A equipe certa.</em></h1>
        <p className="welcome-lead">
          Quem faz a noite, o evento e a recepção acontecerem encontra aqui bares, pousadas, produtoras e festas que precisam de gente boa para hoje, para sexta ou para a temporada.
        </p>
        <div className="marquee" aria-hidden>
          <div className="marquee-track">
            {[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i}>{m}</span>)}
          </div>
        </div>
      </section>

      <section className="welcome-choices" aria-label="Como você quer usar o Escala?">
        <a href="#/cadastro/freelancer" className="choice choice-free">
          <span className="choice-kicker"><Sparkles size={15} aria-hidden /> Sou freelancer</span>
          <strong>Quero pegar turnos</strong>
          <span className="choice-copy">Veja vagas perto de você, candidate-se em um toque e saiba o valor antes de ir.</span>
          <ArrowRight className="choice-arrow" aria-hidden />
        </a>
        <a href="#/cadastro/empresa" className="choice choice-company">
          <span className="choice-kicker"><Briefcase size={15} aria-hidden /> Sou empresa</span>
          <strong>Preciso de equipe</strong>
          <span className="choice-copy">Publique uma vaga em minutos ou convide profissionais com avaliações reais.</span>
          <ArrowRight className="choice-arrow" aria-hidden />
        </a>
      </section>

      {meta.demoAccounts.length > 0 && (
        <section className="demo-box">
          <h2>Explore com dados fictícios</h2>
          <p>Entre em uma conta de demonstração para ver os dois lados do app.</p>
          <div className="demo-buttons">
            {meta.demoAccounts.map((account) => (
              <Button key={account.email} variant="ink" busy={busy === account.email} disabled={!!busy} onClick={() => demoLogin(account.email, account.password)}>
                {account.label}: {account.hint}
              </Button>
            ))}
          </div>
        </section>
      )}

      <section className="promises" aria-labelledby="promises-title">
        <h2 id="promises-title">Sua privacidade vem antes do primeiro turno</h2>
        <ul>
          <li><EyeOff aria-hidden /><div><b>Contato protegido</b><span>Telefone, nome completo e endereço só são liberados depois que o turno é confirmado pelas duas partes.</span></div></li>
          <li><ShieldCheck aria-hidden /><div><b>Você decide quem te encontra</b><span>Aparecer nas buscas vem desligado. Você liga e desliga quando quiser.</span></div></li>
          <li><FileLock2 aria-hidden /><div><b>Sem rastreadores</b><span>Nada de cookies de publicidade. Dados pessoais ficam criptografados e você vê quem acessou os seus.</span></div></li>
          <li><Trash2 aria-hidden /><div><b>Seus dados, suas regras</b><span>Exporte uma cópia ou exclua sua conta a qualquer momento, direto no app.</span></div></li>
        </ul>
        <a href="#/politica" className="text-link">Ler a política de privacidade</a>
      </section>
    </div>
  );
}

export function Login() {
  const { setMe } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const { busy, fields, run } = useAction();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    await run(async () => {
      try {
        await api('/auth/login', { body: { email, password } });
        setMe(await api<Me>('/me'));
        go('');
      } catch (err) {
        if (err instanceof ApiError && err.code === 'email_unverified') setNeedsVerification(true);
        else setError((err as Error).message);
      }
    });
  };

  if (needsVerification) return <VerifyEmail email={email} password={password} onBack={() => setNeedsVerification(false)} />;

  return (
    <div className="auth">
      <a href="#/" className="auth-back"><ArrowLeft size={18} aria-hidden /> Voltar</a>
      <Logo />
      <h1>Bom te ver de novo</h1>
      <form onSubmit={submit} className="stack" noValidate>
        <Field label="E-mail" error={fields.email}>
          <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Senha" error={fields.password}>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" block busy={busy}>Entrar</Button>
      </form>
      <p className="auth-foot"><a href="#/recuperar" className="text-link">Esqueci minha senha</a></p>
      <p className="auth-foot">Ainda não tem conta? <a href="#/" className="text-link">Criar conta</a></p>
    </div>
  );
}

type SignupForm = {
  fullName: string; tradeName: string; contactName: string; cnpj: string; segment: string; email: string; phone: string; city: string;
  categories: string[]; experienceYears: number; dayRate: string; bio: string; about: string; password: string;
  terms: boolean; adult: boolean; discovery: boolean; marketing: boolean;
};

const EMPTY: SignupForm = {
  fullName: '', tradeName: '', contactName: '', cnpj: '', segment: '', email: '', phone: '', city: '',
  categories: [], experienceYears: 1, dayRate: '', bio: '', about: '', password: '',
  terms: false, adult: false, discovery: false, marketing: false,
};

const STEP_OF_FIELD: Record<string, number> = {
  fullName: 0, tradeName: 0, contactName: 0, cnpj: 0, segment: 0, email: 0, phone: 0, city: 0,
  categories: 1, experienceYears: 1, dayRateCents: 1, bio: 1, about: 1,
};

export function Signup({ role }: { role: Role }) {
  const { meta } = useApp();
  const [form, setForm] = useState<SignupForm>(EMPTY);
  const [step, setStep] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [local, setLocal] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const { busy, fields, run } = useAction();
  const errors = { ...local, ...fields };
  const isFree = role === 'freelancer';
  const set = <K extends keyof SignupForm>(key: K, value: SignupForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setLocal((l) => { const { [key]: _, ...rest } = l; return rest; });
  };

  const validateStep = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (isFree) {
        if (!form.fullName.trim().includes(' ')) e.fullName = 'Informe nome e sobrenome.';
      } else {
        if (form.tradeName.trim().length < 2) e.tradeName = 'Informe o nome da empresa.';
        if (form.cnpj.replace(/[^0-9A-Z]/g, '').length !== 14) e.cnpj = 'O CNPJ tem 14 caracteres.';
        if (!form.segment) e.segment = 'Escolha o segmento.';
        if (!form.contactName.trim().includes(' ')) e.contactName = 'Informe nome e sobrenome.';
      }
      if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'E-mail inválido.';
      if (form.phone.replace(/\D/g, '').length < 10) e.phone = 'Use DDD + número.';
      if (form.city.trim().length < 2) e.city = 'Informe sua cidade.';
    }
    if (step === 1 && isFree && form.categories.length === 0) e.categories = 'Escolha ao menos uma função.';
    setLocal(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep()) setStep((s) => s + 1); };

  const submit = async () => {
    setGeneralError(null);
    const e: Record<string, string> = {};
    if (form.password.length < 10) e.password = 'Use pelo menos 10 caracteres.';
    if (!form.terms) e['consents.terms'] = 'É preciso aceitar para criar a conta.';
    if (!form.adult) e['consents.adult'] = 'A plataforma é exclusiva para maiores de 18 anos.';
    setLocal(e);
    if (Object.keys(e).length) return;

    const consents = { terms: form.terms, adult: form.adult, discovery: isFree ? form.discovery : false, marketing: form.marketing };
    const common = { email: form.email, password: form.password, phone: form.phone, city: form.city, consents };
    const body = isFree
      ? {
          role, fullName: form.fullName, categories: form.categories, experienceYears: form.experienceYears,
          dayRateCents: form.dayRate ? Math.round(Number(form.dayRate) * 100) : null, bio: form.bio, ...common,
        }
      : { role, tradeName: form.tradeName, contactName: form.contactName, cnpj: form.cnpj, segment: form.segment, about: form.about, ...common };

    await run(async () => {
      try {
        await api('/auth/register', { body });
        setVerifying(true);
      } catch (err) {
        const fieldErrors = (err as { fields?: Record<string, string> }).fields ?? {};
        const steps = Object.keys(fieldErrors).map((k) => STEP_OF_FIELD[k] ?? 2);
        if (steps.length) setStep(Math.min(...steps));
        else setGeneralError((err as Error).message);
        throw err;
      }
    });
  };

  if (verifying) return <VerifyEmail email={form.email} password={form.password} onBack={() => setVerifying(false)} />;

  const strength = passwordStrength(form.password);
  const steps = ['Seus dados', isFree ? 'Seu trabalho' : 'Sua empresa', 'Segurança e privacidade'];

  return (
    <div className="auth auth-wide">
      <button type="button" className="auth-back" onClick={() => (step === 0 ? go('') : setStep(step - 1))}>
        <ArrowLeft size={18} aria-hidden /> Voltar
      </button>
      <div className="stepper" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1} aria-label={`Passo ${step + 1} de 3: ${steps[step]}`}>
        {steps.map((s, i) => <span key={s} className={i <= step ? 'on' : ''} />)}
      </div>
      <p className="stepper-label">Passo {step + 1} de 3</p>
      <h1>{steps[step]}</h1>

      <div className="stack" key={step}>
        {step === 0 && (
          <>
            {isFree ? (
              <Field label="Nome completo" error={errors.fullName} hint="Empresas veem só o primeiro nome e a inicial, até o turno ser confirmado.">
                <input className="input" autoComplete="name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Ana Moreira" />
              </Field>
            ) : (
              <>
                <Field label="Nome da empresa" error={errors.tradeName}>
                  <input className="input" autoComplete="organization" value={form.tradeName} onChange={(e) => set('tradeName', e.target.value)} placeholder="Casa Aurora Bar" />
                </Field>
                <Field label="CNPJ" error={errors.cnpj} hint="Serve para validar a empresa e nunca é exibido publicamente. Aceita CNPJ alfanumérico.">
                  <input className="input" inputMode="text" value={form.cnpj} onChange={(e) => set('cnpj', formatCnpj(e.target.value))} placeholder="00.000.000/0000-00" />
                </Field>
                <Field label="Segmento" error={errors.segment}>
                  <select className="input" value={form.segment} onChange={(e) => set('segment', e.target.value)}>
                    <option value="">Escolha…</option>
                    {Object.entries(SEGMENTS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Responsável pelas contratações" error={errors.contactName} hint="Só aparece para quem tiver um turno confirmado.">
                  <input className="input" autoComplete="name" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Marina Duarte" />
                </Field>
              </>
            )}
            <Field label="E-mail" error={errors.email}>
              <input className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="voce@email.com" />
            </Field>
            <div className="grid-2">
              <Field label="Telefone" error={errors.phone}>
                <input className="input" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', formatPhone(e.target.value))} placeholder="(21) 98888-7777" />
              </Field>
              <Field label="Cidade" error={errors.city}>
                <input className="input" autoComplete="address-level2" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Rio de Janeiro" />
              </Field>
            </div>
          </>
        )}

        {step === 1 && isFree && (
          <>
            <div className={`field ${errors.categories ? 'field-error' : ''}`}>
              <span className="field-label">O que você faz? <small>(até 4)</small></span>
              <div className="chip-grid">
                {Object.entries(CATEGORIES).map(([id, c]) => {
                  const Icon = c.icon;
                  const on = form.categories.includes(id);
                  return (
                    <button
                      key={id} type="button" className={`pick ${on ? 'on' : ''}`} aria-pressed={on}
                      style={{ '--cat': c.color } as React.CSSProperties}
                      disabled={!on && form.categories.length >= 4}
                      onClick={() => set('categories', on ? form.categories.filter((x) => x !== id) : [...form.categories, id])}
                    >
                      <Icon size={20} aria-hidden />{c.label}
                    </button>
                  );
                })}
              </div>
              {errors.categories && <span className="field-msg" role="alert">{errors.categories}</span>}
            </div>
            <Field label={`Experiência: ${form.experienceYears === 0 ? 'começando agora' : `${form.experienceYears} ${form.experienceYears === 1 ? 'ano' : 'anos'}`}`}>
              <input className="range" type="range" min={0} max={30} value={form.experienceYears} onChange={(e) => set('experienceYears', Number(e.target.value))} />
            </Field>
            <Field label="Valor de referência por diária (opcional)" error={errors.dayRateCents}>
              <div className="input-prefix"><span>R$</span><input className="input" inputMode="numeric" value={form.dayRate} onChange={(e) => set('dayRate', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="180" /></div>
            </Field>
            <Field label="Apresentação (opcional)" error={errors.bio} hint="Conte sua experiência. Não inclua dados de saúde, religião, origem racial, opinião política ou contato.">
              <textarea className="input" rows={3} maxLength={400} value={form.bio} onChange={(e) => set('bio', e.target.value)} />
            </Field>
          </>
        )}

        {step === 1 && !isFree && (
          <Field label="Sobre a empresa (opcional)" error={errors.about} hint="Freelancers leem isso antes de se candidatar. O que torna o seu lugar um bom lugar para trabalhar?">
            <textarea className="input" rows={5} maxLength={400} value={form.about} onChange={(e) => set('about', e.target.value)} />
          </Field>
        )}

        {step === 2 && (
          <>
            <Field label="Crie uma senha" error={errors.password} hint={strength.label}>
              <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} />
              <span className="meter" aria-hidden>{[1, 2, 3, 4].map((n) => <i key={n} className={n <= strength.score ? `on s${strength.score}` : ''} />)}</span>
            </Field>

            <div className="consent-group">
              <h2>Obrigatório para usar o app</h2>
              <ConsentRow
                checked={form.terms} onChange={(v) => set('terms', v)} error={errors['consents.terms']}
                label={<>Li e aceito os <a className="text-link" href="#/politica" target="_blank" rel="noreferrer">termos e a política de privacidade</a> (versão {meta.policyVersion}).</>}
              />
              <ConsentRow
                checked={form.adult} onChange={(v) => set('adult', v)} error={errors['consents.adult']}
                label="Declaro ter 18 anos ou mais. A plataforma envolve trabalho noturno e serviço de bebidas alcoólicas."
              />
            </div>

            <div className="consent-group">
              <h2>Opcional: você escolhe</h2>
              {isFree && (
                <ConsentRow
                  checked={form.discovery} onChange={(v) => set('discovery', v)}
                  label="Aparecer nas buscas para que empresas possam me encontrar e convidar."
                  hint="Sem isso, só as empresas das vagas em que você se candidatar veem seu perfil."
                />
              )}
              <ConsentRow
                checked={form.marketing} onChange={(v) => set('marketing', v)}
                label="Receber novidades do app por e-mail."
                hint="Não muda nada no uso do app. Pode ser desligado a qualquer momento."
              />
            </div>
            {generalError && <p className="form-error" role="alert">{generalError}</p>}
          </>
        )}

        {step < 2
          ? <Button block onClick={next} icon={ArrowRight}>Continuar</Button>
          : <Button block busy={busy} onClick={submit}>Criar minha conta</Button>}
      </div>
      <p className="auth-foot">Já tem conta? <a href="#/entrar" className="text-link">Entrar</a></p>
    </div>
  );
}

function ConsentRow({ checked, onChange, label, hint, error }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; hint?: string; error?: string }) {
  return (
    <div className={`consent-row ${error ? 'field-error' : ''}`}>
      <Switch checked={checked} onChange={onChange} label={typeof label === 'string' ? label : 'Aceitar os termos e a política de privacidade'} />
      <div>
        <p>{label}</p>
        {hint && <small>{hint}</small>}
        {error && <span className="field-msg" role="alert">{error}</span>}
      </div>
    </div>
  );
}
