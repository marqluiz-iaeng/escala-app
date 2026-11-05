import { BadgeCheck, Inbox, Loader2, Lock, Star, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { CATEGORIES, PAY_TYPES, STATUS, dateParts, money } from './domain';
import type { Gig, Talent } from './types';

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo ${light ? 'logo-light' : ''}`}>
      <svg viewBox="0 0 40 32" aria-hidden="true">
        <rect x="0" y="1" width="26" height="8" rx="4" fill="#FF7A55" />
        <rect x="12" y="12" width="26" height="8" rx="4" fill="#FFC247" />
        <rect x="0" y="23" width="26" height="8" rx="4" fill="#C9F26B" />
      </svg>
      escala
    </span>
  );
}

export function Button({
  children, variant = 'primary', busy, icon: Icon, block, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ink' | 'ghost' | 'danger' | 'soft'; busy?: boolean; icon?: LucideIcon; block?: boolean;
}) {
  return (
    <button {...props} type={props.type ?? 'button'} disabled={busy || props.disabled} className={`btn btn-${variant} ${block ? 'btn-block' : ''} ${props.className ?? ''}`}>
      {busy ? <Loader2 className="spin" size={18} aria-hidden /> : Icon ? <Icon size={18} aria-hidden /> : null}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, id }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; id?: string }) {
  return (
    <label className={`field ${error ? 'field-error' : ''}`} htmlFor={id}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-msg" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className="switch" onClick={() => onChange(!checked)}>
      <span className="switch-thumb" />
    </button>
  );
}

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      setMounted(true);
      dialog.classList.remove('closing');
      dialog.style.transform = '';
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      // Mantém o conteúdo na tela até a animação de saída terminar.
      dialog.classList.add('closing');
      const timer = setTimeout(() => {
        dialog.close();
        setMounted(false);
      }, 170);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Arrastar para baixo para fechar, como em um app nativo.
  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const dialog = ref.current;
    if (!dialog || (e.target as HTMLElement).closest('button')) return;
    const startY = e.clientY;
    let delta = 0;
    dialog.classList.add('dragging');
    const move = (ev: PointerEvent) => {
      delta = Math.max(0, ev.clientY - startY);
      dialog.style.transform = `translateY(${delta}px)`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dialog.classList.remove('dragging');
      dialog.style.transform = '';
      if (delta > 110) onClose();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {(open || mounted) && (
        <div className="sheet-inner">
          <div className="sheet-head" onPointerDown={startDrag}>
            <span className="sheet-grip" aria-hidden />
            <div className="sheet-title">
              <h2>{title}</h2>
              <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}><X size={20} /></button>
            </div>
          </div>
          <div className="sheet-body">{children}</div>
          {footer && <div className="sheet-foot">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: 'off' as const };
  return <span className={`badge badge-${s.tone}`}>{s.label}</span>;
}

export function Verified({ verified }: { verified: boolean }) {
  if (!verified) return null;
  return <BadgeCheck className="verified" size={16} aria-label="Empresa verificada" role="img" />;
}

export function Rating({ rating, count, size = 14 }: { rating: number | null; count: number; size?: number }) {
  if (!rating) return <span className="rating rating-new">Novo por aqui</span>;
  return (
    <span className="rating" aria-label={`Nota ${rating} de 5, ${count} avaliações`}>
      <Star size={size} fill="currentColor" aria-hidden />
      <b>{rating.toFixed(1).replace('.', ',')}</b>
      <span className="rating-count">({count})</span>
    </span>
  );
}

export function StarInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="star-input" role="radiogroup" aria-label="Sua nota">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} de 5`} disabled={disabled} onClick={() => onChange(n)}>
          <Star size={28} fill={n <= value ? 'currentColor' : 'none'} aria-hidden />
        </button>
      ))}
    </div>
  );
}

const AVATAR_COLORS = ['#FF7A55', '#FFC247', '#7CC4FF', '#B79CFF', '#6FE0C2', '#C9F26B', '#FFB08A', '#FFA6C9'];

/** Sem foto de propósito: reduz o risco de discriminação antes da contratação (LGPD, art. 6º, IX). */
export function Avatar({ name, id, size = 'md' }: { name: string; id: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.replace('.', '').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const hash = [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return <span className={`avatar avatar-${size}`} style={{ background: AVATAR_COLORS[hash % AVATAR_COLORS.length] }} aria-hidden>{initials}</span>;
}

export function CategoryTag({ id }: { id: string }) {
  const c = CATEGORIES[id] ?? CATEGORIES.outros;
  const Icon = c.icon;
  return <span className="tag" style={{ '--cat': c.color } as React.CSSProperties}><Icon size={13} aria-hidden />{c.label}</span>;
}

export function Empty({ icon: Icon = Inbox, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon size={26} aria-hidden /></span>
      <h3>{title}</h3>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

export function Skeleton({ count = 3, tall }: { count?: number; tall?: boolean }) {
  return (
    <div className="skeletons" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: count }, (_, i) => <div key={i} className={`skeleton ${tall ? 'skeleton-tall' : ''}`} />)}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-note" role="alert">
      <p>{message}</p>
      {onRetry && <Button variant="soft" onClick={onRetry}>Tentar de novo</Button>}
    </div>
  );
}

export function PrivacyNote({ children }: { children: ReactNode }) {
  return <p className="privacy-note"><Lock size={14} aria-hidden /><span>{children}</span></p>;
}

type TicketGig = Pick<Gig, 'title' | 'category' | 'date' | 'startTime' | 'endTime' | 'payCents' | 'payType' | 'city' | 'neighbourhood'> & {
  company?: Pick<Gig['company'], 'name' | 'verified'>;
};

export function Ticket({ gig, onClick, badge, index = 0, meta }: { gig: TicketGig; onClick?: () => void; badge?: ReactNode; index?: number; meta?: ReactNode }) {
  const cat = CATEGORIES[gig.category] ?? CATEGORIES.outros;
  const Icon = cat.icon;
  const date = gig.date ? dateParts(gig.date) : null;
  const pay = PAY_TYPES[gig.payType];
  const content = (
    <>
      <span className="ticket-stub">
        {date ? (
          <>
            <span className="ticket-weekday">{date.weekday}</span>
            <span className="ticket-day">{date.day}</span>
            <span className="ticket-month">{date.month}</span>
          </>
        ) : <span className="ticket-day">?</span>}
      </span>
      <span className="ticket-body">
        <span className="ticket-kicker"><Icon size={13} aria-hidden />{cat.label}{badge && <span className="ticket-badge">{badge}</span>}</span>
        <span className="ticket-title">{gig.title || 'Título da vaga'}</span>
        {gig.company && <span className="ticket-company">{gig.company.name}<Verified verified={gig.company.verified} /></span>}
        <span className="ticket-where">
          {[gig.neighbourhood, gig.city].filter(Boolean).join(' · ') || 'Local'}
          {gig.startTime && ` · ${gig.startTime}–${gig.endTime}`}
        </span>
        <span className="ticket-foot">
          <span className="ticket-pay">{gig.payCents ? money(gig.payCents) : 'R$ --'}<small>{pay?.suffix}</small></span>
          {meta}
        </span>
      </span>
    </>
  );
  const style = { '--cat': cat.color, '--i': Math.min(index, 12) } as React.CSSProperties;
  return onClick ? (
    <button type="button" className="ticket ticket-action" style={style} onClick={onClick}>{content}</button>
  ) : (
    <div className="ticket" style={style}>{content}</div>
  );
}

export function TalentCard({ talent, onClick, index = 0 }: { talent: Talent; onClick?: () => void; index?: number }) {
  return (
    <button type="button" className="talent" style={{ '--i': Math.min(index, 12) } as React.CSSProperties} onClick={onClick}>
      <span className="talent-head">
        <Avatar name={talent.displayName} id={talent.id} />
        <span className="talent-id">
          <b>{talent.displayName}</b>
          <span>{talent.city}{talent.experienceYears > 0 && ` · ${talent.experienceYears} ${talent.experienceYears === 1 ? 'ano' : 'anos'}`}</span>
        </span>
        {talent.available && <span className="live-dot" title="Disponível"><i />Disponível</span>}
      </span>
      <span className="tags">{talent.categories.map((c) => <CategoryTag key={c} id={c} />)}</span>
      {talent.bio && <span className="talent-bio">{talent.bio}</span>}
      <span className="talent-foot">
        <Rating rating={talent.rating} count={talent.ratingCount} />
        {talent.dayRateCents && <span className="talent-rate">a partir de <b>{money(talent.dayRateCents)}</b></span>}
      </span>
    </button>
  );
}
