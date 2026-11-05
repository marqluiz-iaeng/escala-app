import { ArrowLeft, ArrowRight, Inbox, KeyRound, MailCheck, RotateCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { passwordStrength, timeAgo } from '../domain';
import { go, useAction, useApp } from '../hooks';
import type { Me } from '../types';
import { Button, Field, Logo, Sheet } from '../ui';

const CODE_LENGTH = 6;

/** Um único campo por baixo das caixas: colar e o preenchimento automático do celular funcionam sozinhos. */
export function CodeInput({ value, onChange, onComplete, error, disabled, label = 'Código de 6 dígitos' }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; error?: string; disabled?: boolean; label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);

  // O campo é desativado durante o envio e perderia o foco: devolve para a pessoa tentar de novo sem tocar na tela.
  useEffect(() => {
    if (!disabled) input.current?.focus();
  }, [disabled]);

  return (
    <label className={`field ${error ? 'field-error' : ''}`}>
      <span className="field-label">{label}</span>
      <span className="code-input">
        <input
          ref={input} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={CODE_LENGTH}
          aria-invalid={!!error} disabled={disabled} value={value}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH);
            onChange(next);
            if (next.length === CODE_LENGTH) onComplete?.(next);
          }}
        />
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <span key={i} className={`code-box ${i === value.length ? 'active' : ''} ${value[i] ? 'filled' : ''}`} aria-hidden>{value[i]}</span>
        ))}
      </span>
      {error && <span className="field-msg" role="alert">{error}</span>}
    </label>
  );
}

export function ResendButton({ onResend, label = 'Enviar outro código' }: { onResend: () => Promise<void>; label?: string }) {
  const [seconds, setSeconds] = useState(45);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  return (
    <button
      type="button" className="resend" disabled={seconds > 0 || busy}
      onClick={async () => {
        setBusy(true);
        await onResend();
        setBusy(false);
        setSeconds(45);
      }}
    >
      <RotateCw size={15} aria-hidden />
      {seconds > 0 ? `${label} em ${seconds}s` : label}
    </button>
  );
}

/** Só no modo demonstração, em que nenhum e-mail real é enviado. */
export function DemoInbox({ email, onUseCode }: { email: string; onUseCode: (code: string) => void }) {
  const { meta } = useApp();
  const [message, setMessage] = useState<{ subject: string; text: string; at: number } | null>(null);

  useEffect(() => {
    if (!meta.demoInbox) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await api<{ messages: { subject: string; text: string; at: number }[] }>('/dev/outbox', { body: { email } });
        if (alive) setMessage(res.messages[0] ?? null);
      } catch {
        /* a caixa simulada é só um apoio à demonstração */
      }
    };
    void load();
    const timer = setInterval(load, 2000);
    return () => { alive = false; clearInterval(timer); };
  }, [email, meta.demoInbox]);

  if (!meta.demoInbox) return null;
  const code = message?.text.match(/\b\d{6}\b/)?.[0];

  return (
    <aside className="demo-inbox" aria-label="Caixa de entrada de demonstração">
      <h2><Inbox size={16} aria-hidden /> Caixa de entrada simulada</h2>
      <p className="demo-inbox-note">No modo demonstração, nenhum e-mail real é enviado. A mensagem aparece aqui.</p>
      {message ? (
        <div className="demo-mail">
          <div className="demo-mail-head"><b>{message.subject}</b><small>{timeAgo(message.at)}</small></div>
          <p>{message.text}</p>
          {code && <Button variant="ink" block onClick={() => onUseCode(code)}>Usar o código {code}</Button>}
        </div>
      ) : (
        <p className="demo-mail-empty">Nenhuma mensagem para este endereço. Se ele já tem conta ou passou do limite por hora, nenhum código é gerado.</p>
      )}
    </aside>
  );
}

export function VerifyEmail({ email, password, onBack }: { email: string; password: string; onBack: () => void }) {
  const { setMe, toast } = useApp();
  const [code, setCode] = useState('');
  const { busy, fields, run } = useAction();
  const submitting = useRef(false);

  const submit = async (value: string) => {
    if (submitting.current) return;
    submitting.current = true;
    const result = await run(() => api('/auth/verify', { body: { email, code: value, password } }));
    submitting.current = false;
    if (result) {
      setMe(await api<Me>('/me'));
      toast('E-mail confirmado. Sua conta está pronta!');
      go('');
    } else {
      setCode('');
    }
  };

  const use = (value: string) => {
    setCode(value);
    void submit(value);
  };

  return (
    <div className="auth">
      <button type="button" className="auth-back" onClick={onBack}><ArrowLeft size={18} aria-hidden /> Corrigir meus dados</button>
      <span className="auth-icon"><MailCheck size={28} aria-hidden /></span>
      <h1>Confirme seu e-mail</h1>
      <p className="auth-lead">Se este endereço puder ser usado, um código de 6 dígitos chega em instantes em <b className="break">{email}</b>. Ele vale por 1 hora.</p>
      <div className="stack">
        <CodeInput value={code} onChange={setCode} onComplete={submit} error={fields.code} disabled={busy} />
        <Button block busy={busy} disabled={code.length < CODE_LENGTH} onClick={() => submit(code)}>Confirmar e entrar</Button>
        <ResendButton onResend={async () => {
          await api('/auth/verify/resend', { body: { email } }).catch(() => {});
          toast('Se houver um cadastro pendente, enviamos um novo código.');
        }} />
        <p className="auth-hint">Não chegou? Veja a caixa de spam. Se este e-mail já tem conta, enviamos um aviso em vez do código: tente <a className="text-link" href="#/entrar">entrar</a> ou <a className="text-link" href="#/recuperar">recuperar a senha</a>.</p>
        <DemoInbox email={email} onUseCode={use} />
      </div>
    </div>
  );
}

export function ForgotPassword() {
  const { toast } = useApp();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const { busy, fields, setFields, run } = useAction();
  const strength = passwordStrength(password);

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setFields({ email: 'E-mail inválido.' });
    const result = await run(() => api('/auth/password/forgot', { body: { email } }));
    if (result) setStep('code');
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < CODE_LENGTH) return setFields({ code: 'Digite os 6 números do código.' });
    if (password.length < 10) return setFields({ password: 'Use pelo menos 10 caracteres.' });
    const result = await run(async () => {
      try {
        return await api('/auth/password/reset', { body: { email, code, password } });
      } catch (err) {
        // Só apaga o código se o problema foi ele: uma senha fraca não o invalida.
        if (err instanceof ApiError && err.fields.code) setCode('');
        throw err;
      }
    });
    if (result) {
      toast('Senha alterada. Entre com a nova senha.');
      go('entrar');
    }
  };

  if (step === 'email') {
    return (
      <div className="auth">
        <a href="#/entrar" className="auth-back"><ArrowLeft size={18} aria-hidden /> Voltar</a>
        <Logo />
        <h1>Esqueceu a senha?</h1>
        <p className="auth-lead">Informe o e-mail da sua conta. Enviamos um código para você criar uma nova senha.</p>
        <form className="stack" onSubmit={request} noValidate>
          <Field label="E-mail" error={fields.email}>
            <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          <Button type="submit" block icon={ArrowRight} busy={busy}>Enviar código</Button>
        </form>
      </div>
    );
  }

  return (
    <div className="auth">
      <button type="button" className="auth-back" onClick={() => setStep('email')}><ArrowLeft size={18} aria-hidden /> Corrigir e-mail</button>
      <span className="auth-icon"><KeyRound size={28} aria-hidden /></span>
      <h1>Crie uma nova senha</h1>
      <p className="auth-lead">Se houver uma conta com <b className="break">{email}</b>, o código chega em instantes. Ele vale por 15 minutos.</p>
      <form className="stack" onSubmit={reset} noValidate>
        <CodeInput value={code} onChange={setCode} error={fields.code} />
        <Field label="Nova senha" error={fields.password} hint={strength.label}>
          <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <span className="meter" aria-hidden>{[1, 2, 3, 4].map((n) => <i key={n} className={n <= strength.score ? `on s${strength.score}` : ''} />)}</span>
        </Field>
        <Button type="submit" block busy={busy}>Salvar nova senha</Button>
        <p className="auth-hint">Por segurança, todos os aparelhos conectados serão desconectados.</p>
        <ResendButton onResend={async () => {
          await api('/auth/password/forgot', { body: { email } }).catch(() => {});
          toast('Se houver uma conta com este e-mail, enviamos um novo código.');
        }} />
        <DemoInbox email={email} onUseCode={setCode} />
      </form>
    </div>
  );
}

export function EmailChangeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { setMe, toast } = useApp();
  const [step, setStep] = useState<'request' | 'code'>('request');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const { busy, fields, setFields, run } = useAction();

  const close = () => {
    onClose();
    setStep('request');
    setEmail('');
    setPassword('');
    setCode('');
    setFields({});
  };

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setFields({ email: 'E-mail inválido.' });
    const result = await run(() => api('/me/email', { body: { email, password } }));
    if (result) {
      setPassword('');
      setStep('code');
    }
  };

  const confirm = async (value: string) => {
    const result = await run(() => api<Me>('/me/email/confirm', { body: { code: value } }));
    if (result) {
      setMe(result);
      toast('E-mail alterado. Avisamos o endereço antigo.');
      close();
    } else {
      setCode('');
    }
  };

  const use = (value: string) => {
    setCode(value);
    void confirm(value);
  };

  return (
    <Sheet open={open} onClose={close} title="Trocar e-mail">
      {step === 'request' ? (
        <form className="stack" onSubmit={request} noValidate>
          <p className="sheet-lead">Enviamos um código para o endereço novo. A troca só vale depois que você confirmar.</p>
          <Field label="Novo e-mail" error={fields.email}>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Sua senha atual" error={fields.password}>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" block busy={busy} disabled={!email || !password}>Enviar código</Button>
        </form>
      ) : (
        <div className="stack">
          <p className="sheet-lead">Se este endereço puder ser usado, o código chega em instantes em <b className="break">{email}</b>. Ele vale por 15 minutos.</p>
          <CodeInput value={code} onChange={setCode} onComplete={confirm} error={fields.code} disabled={busy} />
          <Button block busy={busy} disabled={code.length < CODE_LENGTH} onClick={() => confirm(code)}>Confirmar troca</Button>
          <p className="auth-hint">Ao confirmar, os outros aparelhos serão desconectados.</p>
          <DemoInbox email={email} onUseCode={use} />
        </div>
      )}
    </Sheet>
  );
}
