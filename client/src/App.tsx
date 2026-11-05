import { Briefcase, LayoutGrid, MessagesSquare, Search, Ticket as TicketIcon, UserRound, Users, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, SESSION_LOST } from './api';
import { AppContext, go, useRoute, type AppContextValue } from './hooks';
import { CompanyGig } from './screens/CompanyGig';
import { CompanyPanel } from './screens/CompanyPanel';
import { Feed } from './screens/Feed';
import { Inbox } from './screens/Inbox';
import { ForgotPassword } from './screens/EmailCode';
import { Login, Signup, Welcome } from './screens/Public';
import { Policy } from './screens/Policy';
import { Privacy } from './screens/Privacy';
import { Profile } from './screens/Profile';
import { Shifts } from './screens/Shifts';
import { Talents } from './screens/Talents';
import { Thread } from './screens/Thread';
import type { Me, Meta } from './types';
import { Logo, Skeleton } from './ui';

type Tab = { path: string; label: string; icon: LucideIcon; badge?: number };

function Shell({ me, route, children }: { me: Me; route: string[]; children: React.ReactNode }) {
  const tabs: Tab[] = me.role === 'freelancer'
    ? [
        { path: 'vagas', label: 'Vagas', icon: Search },
        { path: 'turnos', label: 'Meus turnos', icon: TicketIcon },
        { path: 'conversas', label: 'Conversas', icon: MessagesSquare, badge: me.unread },
        { path: 'perfil', label: 'Perfil', icon: UserRound },
      ]
    : [
        { path: 'painel', label: 'Minhas vagas', icon: LayoutGrid },
        { path: 'talentos', label: 'Talentos', icon: Users },
        { path: 'conversas', label: 'Conversas', icon: MessagesSquare, badge: me.unread },
        { path: 'perfil', label: 'Empresa', icon: Briefcase },
      ];

  const section = route[0] ?? tabs[0]!.path;
  const activePath = section === 'turno' ? 'conversas' : section === 'privacidade' || section === 'politica' ? 'perfil' : section;
  const immersive = section === 'turno';

  return (
    <div className={`shell ${immersive ? 'shell-immersive' : ''}`}>
      <nav className="rail" aria-label="Navegação principal">
        <a href="#/" className="rail-logo" aria-label="Escala, início"><Logo light /></a>
        <div className="rail-tabs">
          {tabs.map((t) => <NavItem key={t.path} tab={t} active={activePath === t.path} />)}
        </div>
        <div className="rail-who">
          <b>{me.displayName}</b>
          <span>{me.role === 'freelancer' ? 'Freelancer' : 'Empresa'}</span>
        </div>
      </nav>
      <main className="main" id="conteudo">{children}</main>
      <nav className="tabbar" aria-label="Navegação principal">
        {tabs.map((t) => <NavItem key={t.path} tab={t} active={activePath === t.path} />)}
      </nav>
    </div>
  );
}

function NavItem({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <a href={`#/${tab.path}`} className={`nav-item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
      <span className="nav-icon">
        <Icon size={22} aria-hidden />
        {!!tab.badge && <span className="nav-badge" aria-label={`${tab.badge} não lidas`}>{tab.badge > 9 ? '9+' : tab.badge}</span>}
      </span>
      <span className="nav-label">{tab.label}</span>
    </a>
  );
}

function PrivateRoutes({ me, route }: { me: Me; route: string[] }) {
  const [section, param] = route;
  if (section === 'turno' && param) return <Thread key={param} id={param} />;
  if (section === 'conversas') return <Inbox />;
  if (section === 'perfil') return <Profile />;
  if (section === 'privacidade') return <Privacy />;
  if (section === 'politica') return <Policy />;
  if (me.role === 'freelancer') {
    if (section === 'turnos') return <Shifts />;
    return <Feed />;
  }
  if (section === 'talentos') return <Talents />;
  if (section === 'painel' && param) return <CompanyGig key={param} id={param} />;
  return <CompanyPanel />;
}

function PublicRoutes({ route }: { route: string[] }) {
  const [section, param] = route;
  if (section === 'entrar') return <Login />;
  if (section === 'recuperar') return <ForgotPassword />;
  if (section === 'cadastro' && (param === 'freelancer' || param === 'empresa')) {
    return <Signup key={param} role={param === 'freelancer' ? 'freelancer' : 'company'} />;
  }
  if (section === 'politica') return <div className="public-page"><Policy /></div>;
  return <Welcome />;
}

export function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [booting, setBooting] = useState(true);
  const [failed, setFailed] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: 'ok' | 'error' }[]>([]);
  const toastId = useRef(0);
  const toastLayer = useRef<HTMLDivElement>(null);
  const route = useRoute();

  // Reabrir como popover coloca os avisos acima de qualquer janela modal aberta.
  useEffect(() => {
    const layer = toastLayer.current;
    if (!layer?.showPopover) return;
    if (layer.matches(':popover-open')) layer.hidePopover();
    if (toasts.length > 0) layer.showPopover();
  }, [toasts]);

  const toast = useCallback((message: string, tone: 'ok' | 'error' = 'ok') => {
    const id = ++toastId.current;
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3800);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      setMe(await api<Me>('/me'));
    } catch {
      /* 401 é tratado pelo evento de sessão perdida. */
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setMeta(await api<Meta>('/meta'));
        await refreshMe();
      } catch {
        setFailed(true);
      } finally {
        setBooting(false);
      }
    })();
  }, [refreshMe]);

  useEffect(() => {
    const onLost = () => setMe((current) => {
      if (current) {
        toast('Sua sessão terminou. Entre de novo para continuar.', 'error');
        go('');
      }
      return null;
    });
    window.addEventListener(SESSION_LOST, onLost);
    return () => window.removeEventListener(SESSION_LOST, onLost);
  }, [toast]);

  const loggedIn = !!me;
  useEffect(() => {
    if (!loggedIn) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshMe();
    }, 20_000);
    return () => clearInterval(timer);
  }, [loggedIn, refreshMe]);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {});
    setMe(null);
    go('');
  }, []);

  const context = useMemo<AppContextValue | null>(
    () => (meta ? { me, meta, refreshMe, setMe, toast, logout } : null),
    [me, meta, refreshMe, toast, logout],
  );

  if (booting) return <div className="boot"><Logo /><Skeleton count={1} /></div>;
  if (failed || !context) {
    return (
      <div className="boot">
        <Logo />
        <p>Não foi possível conectar ao servidor. Verifique sua conexão e recarregue a página.</p>
      </div>
    );
  }

  return (
    <AppContext.Provider value={context}>
      {me ? <Shell me={me} route={route}><PrivateRoutes me={me} route={route} /></Shell> : <PublicRoutes route={route} />}
      <div ref={toastLayer} popover="manual" className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast toast-${t.tone}`}>{t.message}</div>)}
      </div>
    </AppContext.Provider>
  );
}
