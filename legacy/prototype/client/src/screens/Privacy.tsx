import { ArrowLeft, Download, Eye, FileText, KeyRound, LaptopMinimal, Mail, PencilLine, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';
import { ACTIONS, CONSENT_LABELS, passwordStrength, timeAgo } from '../domain';
import { go, useAction, useApp, useAsync, useMe } from '../hooks';
import type { Consent, PrivacyOverview } from '../types';
import { Button, ErrorNote, Field, Sheet, Skeleton, Switch } from '../ui';

const fullDate = (ts: number) => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function Privacy() {
  const me = useMe();
  const { meta, toast, refreshMe, setMe } = useApp();
  const { data, error, loading, reload, setData } = useAsync(() => api<PrivacyOverview>('/privacy/overview'), []);
  const [sheet, setSheet] = useState<'export' | 'delete' | 'password' | null>(null);
  const { busy: revoking, run: runRevoke } = useAction();

  const toggle = async (purpose: 'discovery' | 'marketing', granted: boolean) => {
    if (!data) return;
    const previous = data;
    setData({ ...data, consents: { ...data.consents, [purpose]: { ...(data.consents[purpose] as NonNullable<Consent>), granted } } });
    try {
      await api('/privacy/consents', { body: { purpose, granted } });
      toast(granted ? 'Permissão ativada.' : 'Permissão desativada. Vale a partir de agora.');
      void reload();
      void refreshMe();
    } catch (err) {
      setData(previous);
      toast((err as Error).message, 'error');
    }
  };

  const revokeOthers = async () => {
    const result = await runRevoke(() => api<{ revoked: number }>('/privacy/sessions/revoke-others', { body: {} }));
    if (result) {
      toast(result.revoked ? 'Outros aparelhos foram desconectados.' : 'Não há outros aparelhos conectados.');
      void reload();
    }
  };

  const viewers = new Set(data?.accessLog.map((e) => e.actor)).size;

  return (
    <div className="page">
      <a href="#/perfil" className="auth-back"><ArrowLeft size={18} aria-hidden /> {me.role === 'freelancer' ? 'Perfil' : 'Empresa'}</a>

      <section className="privacy-hero">
        <ShieldCheck size={30} aria-hidden />
        <h1>Você está no controle</h1>
        <p>Veja quem acessou seus dados, decida o que compartilhar e leve suas informações com você.</p>
      </section>

      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading && <Skeleton tall count={3} />}

      {data && (
        <>
          <section className="panel">
            <h2><Eye size={18} aria-hidden /> Quem acessou seus dados</h2>
            {data.accessLog.length === 0 ? (
              <p className="muted">Ninguém acessou seu perfil ou contato até agora.</p>
            ) : (
              <>
                <p className="muted">{viewers} {viewers === 1 ? 'empresa ou pessoa acessou' : 'empresas ou pessoas acessaram'} recentemente.</p>
                <ol className="timeline">
                  {data.accessLog.slice(0, 8).map((e, i) => (
                    <li key={i}>
                      <span><b>{e.actor ?? 'Conta removida'}</b> {ACTIONS[e.action] ?? e.action}</span>
                      <time dateTime={new Date(e.at).toISOString()} title={fullDate(e.at)}>{timeAgo(e.at)}</time>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>

          <section className="panel">
            <h2><ShieldCheck size={18} aria-hidden /> Suas permissões</h2>
            {me.role === 'freelancer' && (
              <PermissionRow
                title="Aparecer nas buscas"
                body="Empresas podem encontrar seu perfil, com nome abreviado, e enviar convites."
                consent={data.consents.discovery}
                onChange={(v) => toggle('discovery', v)}
              />
            )}
            <PermissionRow
              title="Novidades por e-mail"
              body="Mensagens sobre novos recursos. Não muda nada no uso do app."
              consent={data.consents.marketing}
              onChange={(v) => toggle('marketing', v)}
            />
            <details className="disclosure">
              <summary>Histórico de consentimentos</summary>
              <ul className="history">
                {data.consentHistory.map((c, i) => (
                  <li key={i}>
                    <span>{CONSENT_LABELS[c.purpose] ?? c.purpose}: <b>{c.granted ? 'aceito' : 'recusado'}</b></span>
                    <small>{fullDate(c.at)} · versão {c.version}</small>
                  </li>
                ))}
              </ul>
            </details>
          </section>

          <section className="panel">
            <h2><FileText size={18} aria-hidden /> Seus direitos</h2>
            <p className="muted">Garantidos pelo art. 18 da LGPD. Sem custo e sem precisar pedir para ninguém.</p>
            <div className="rights">
              <button type="button" className="right-card" onClick={() => setSheet('export')}>
                <Download size={22} aria-hidden /><b>Baixar meus dados</b><span>Cópia completa em arquivo JSON, para guardar ou levar para outro serviço.</span>
              </button>
              <button type="button" className="right-card" onClick={() => go('perfil')}>
                <PencilLine size={22} aria-hidden /><b>Corrigir meus dados</b><span>Atualize nome, telefone, cidade e perfil.</span>
              </button>
              <a className="right-card" href={`mailto:${meta.controller.dpoEmail}`}>
                <Mail size={22} aria-hidden /><b>Falar com o encarregado</b><span>{meta.controller.dpoEmail}</span>
              </a>
              <button type="button" className="right-card right-danger" onClick={() => setSheet('delete')}>
                <Trash2 size={22} aria-hidden /><b>Excluir minha conta</b><span>Apaga seus dados pessoais de forma definitiva.</span>
              </button>
            </div>
          </section>

          <section className="panel">
            <h2><FileText size={18} aria-hidden /> O que guardamos e por quê</h2>
            <div className="accordion">
              {meta.dataMap.map((item) => (
                <details key={item.id} className="disclosure">
                  <summary>{item.title}</summary>
                  <dl>
                    <dt>Dados</dt><dd>{item.data}</dd>
                    <dt>Para quê</dt><dd>{item.purpose}</dd>
                    <dt>Base legal</dt><dd>{item.legalBasis}</dd>
                    <dt>Por quanto tempo</dt><dd>{item.retention}</dd>
                    <dt>Com quem</dt><dd>{item.sharing}</dd>
                  </dl>
                </details>
              ))}
            </div>
            <a className="text-link" href="#/politica">Ler a política de privacidade completa</a>
          </section>

          <section className="panel">
            <h2><KeyRound size={18} aria-hidden /> Segurança da conta</h2>
            <ul className="sessions">
              {data.sessions.map((s, i) => (
                <li key={i}>
                  <LaptopMinimal size={18} aria-hidden />
                  <span><b>{s.device}</b>{s.current && <em> · este aparelho</em>}<small>Último uso: {timeAgo(s.lastSeenAt)}</small></span>
                </li>
              ))}
            </ul>
            <div className="panel-actions">
              <Button variant="soft" onClick={() => setSheet('password')}>Trocar senha</Button>
              <Button variant="soft" busy={revoking} onClick={revokeOthers}>Desconectar outros aparelhos</Button>
            </div>
            {data.activity.length > 0 && (
              <details className="disclosure">
                <summary>Atividade recente da conta</summary>
                <ul className="history">
                  {data.activity.map((a, i) => (
                    <li key={i}><span>{ACTIONS[a.action] ?? a.action}</span><small>{fullDate(a.at)}</small></li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </>
      )}

      <ExportSheet open={sheet === 'export'} onClose={() => setSheet(null)} />
      <PasswordSheet open={sheet === 'password'} onClose={() => { setSheet(null); void reload(); }} />
      <DeleteSheet open={sheet === 'delete'} onClose={() => setSheet(null)} onDeleted={() => { setMe(null); go(''); }} />
    </div>
  );
}

function PermissionRow({ title, body, consent, onChange }: { title: string; body: string; consent: Consent; onChange: (v: boolean) => void }) {
  return (
    <div className="permission">
      <div>
        <b>{title}</b>
        <p>{body}</p>
        {consent && <small>{consent.granted ? 'Ativado' : 'Desativado'} em {fullDate(consent.at)}</small>}
      </div>
      <Switch checked={!!consent?.granted} onChange={onChange} label={title} />
    </div>
  );
}

function ExportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useApp();
  const [password, setPassword] = useState('');
  const { busy, fields, run } = useAction();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await run(() => api<unknown>('/privacy/export', { body: { password } }));
    if (data) {
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'meus-dados-escala.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPassword('');
      toast('Arquivo gerado. Guarde em um lugar seguro.');
      onClose();
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Baixar meus dados">
      <form className="stack" onSubmit={submit}>
        <p className="sheet-lead">O arquivo tem conta, perfil, candidaturas, mensagens, consentimentos e histórico de acessos. Por segurança, confirme sua senha.</p>
        <Field label="Sua senha" error={fields.password}>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Button type="submit" block icon={Download} busy={busy} disabled={!password}>Gerar arquivo</Button>
      </form>
    </Sheet>
  );
}

function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useApp();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const { busy, fields, run } = useAction();
  const strength = passwordStrength(next);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await run(() => api('/me/password', { body: { current, next } }));
    if (result) {
      setCurrent('');
      setNext('');
      toast('Senha alterada. Os outros aparelhos foram desconectados.');
      onClose();
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Trocar senha">
      <form className="stack" onSubmit={submit}>
        <Field label="Senha atual" error={fields.current}>
          <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </Field>
        <Field label="Nova senha" error={fields.next} hint={strength.label}>
          <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
          <span className="meter" aria-hidden>{[1, 2, 3, 4].map((n) => <i key={n} className={n <= strength.score ? `on s${strength.score}` : ''} />)}</span>
        </Field>
        <Button type="submit" block busy={busy} disabled={!current || !next}>Salvar nova senha</Button>
      </form>
    </Sheet>
  );
}

function DeleteSheet({ open, onClose, onDeleted }: { open: boolean; onClose: () => void; onDeleted: () => void }) {
  const me = useMe();
  const { toast } = useApp();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { busy, fields, run } = useAction();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await run(() => api('/privacy/delete', { body: { password, confirm } }));
    if (result) {
      toast('Sua conta foi excluída.');
      onDeleted();
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Excluir minha conta">
      <form className="stack" onSubmit={submit}>
        <p className="sheet-lead">Esta ação não pode ser desfeita.</p>
        <ul className="delete-list">
          <li><b>Apagamos agora:</b> nome, e-mail, telefone, senha, perfil{me.role === 'company' ? ', CNPJ, endereços' : ''} e suas mensagens.</li>
          <li><b>Encerramos:</b> {me.role === 'freelancer' ? 'candidaturas abertas e turnos futuros' : 'vagas abertas e turnos futuros'}. A outra parte vê o cancelamento no app.</li>
          <li><b>Mantemos por exigência legal, sem seu nome:</b> registros de acesso por 6 meses e comprovantes de consentimento.</li>
        </ul>
        <Field label="Sua senha" error={fields.password}>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Field label="Digite EXCLUIR para confirmar" error={fields.confirm}>
          <input className="input" value={confirm} autoComplete="off" onChange={(e) => setConfirm(e.target.value.toUpperCase())} required />
        </Field>
        <Button type="submit" block variant="danger" icon={Trash2} busy={busy} disabled={!password || confirm !== 'EXCLUIR'}>Excluir definitivamente</Button>
      </form>
    </Sheet>
  );
}
