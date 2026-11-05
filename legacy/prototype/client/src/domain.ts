import {
  CalendarCheck, ChefHat, ConciergeBell, Headset, Martini, Mic2, Sparkles, Wrench, type LucideIcon,
} from 'lucide-react';

export const CATEGORIES: Record<string, { label: string; plural: string; icon: LucideIcon; color: string }> = {
  bartender: { label: 'Bartender', plural: 'Bartenders', icon: Martini, color: '#FF7A55' },
  garcom: { label: 'Garçom/Garçonete', plural: 'Garçons', icon: ConciergeBell, color: '#FFC247' },
  atendente: { label: 'Atendente', plural: 'Atendentes', icon: Headset, color: '#7CC4FF' },
  musico: { label: 'Música e DJ', plural: 'Músicos', icon: Mic2, color: '#B79CFF' },
  recepcao: { label: 'Recepção', plural: 'Recepção', icon: CalendarCheck, color: '#6FE0C2' },
  producao: { label: 'Produção e montagem', plural: 'Produção', icon: Wrench, color: '#C9F26B' },
  cozinha: { label: 'Cozinha e copa', plural: 'Cozinha', icon: ChefHat, color: '#FFB08A' },
  outros: { label: 'Outras funções', plural: 'Outros', icon: Sparkles, color: '#FFA6C9' },
};

export const SEGMENTS: Record<string, string> = {
  bar_restaurante: 'Bar ou restaurante',
  hospedagem: 'Hostel ou pousada',
  producao_musical: 'Produção musical',
  festas_eventos: 'Festas e eventos',
  entretenimento: 'Entretenimento',
  outros: 'Outro segmento',
};

export const PAY_TYPES: Record<string, { label: string; suffix: string }> = {
  diaria: { label: 'Diária', suffix: 'a diária' },
  hora: { label: 'Por hora', suffix: 'a hora' },
  cache: { label: 'Cachê', suffix: 'de cachê' },
};

export const STATUS: Record<string, { label: string; tone: 'ok' | 'wait' | 'off' | 'new' }> = {
  invited: { label: 'Convite', tone: 'new' },
  pending: { label: 'Aguardando', tone: 'wait' },
  accepted: { label: 'Confirmado', tone: 'ok' },
  rejected: { label: 'Não selecionado', tone: 'off' },
  withdrawn: { label: 'Retirada', tone: 'off' },
  cancelled: { label: 'Cancelado', tone: 'off' },
};

export const GIG_STATUS: Record<string, string> = {
  open: 'Aberta',
  filled: 'Completa',
  closed: 'Encerrada',
  cancelled: 'Cancelada',
};

export const ACTIONS: Record<string, string> = {
  'profile.view': 'viu seu perfil',
  'contact.view': 'acessou seu contato',
  'application.create': 'recebeu sua candidatura',
  'application.accept': 'confirmou um turno com você',
  'application.withdraw': 'teve uma candidatura retirada',
  'invite.create': 'enviou um convite',
  'review.create': 'avaliou um turno',
  'login.success': 'Entrada na conta',
  'login.failed': 'Tentativa de entrada com senha errada',
  'login.locked': 'Conta bloqueada por 15 minutos',
  'password.change': 'Senha alterada',
  'password.reset': 'Senha redefinida com código por e-mail',
  'password.reset_requested': 'Código de recuperação de senha solicitado',
  'email.change': 'E-mail alterado',
  'sessions.revoke': 'Outros aparelhos desconectados',
  'data.export': 'Cópia dos dados exportada',
  'consent.discovery.grant': 'Ativou "aparecer nas buscas"',
  'consent.discovery.revoke': 'Desativou "aparecer nas buscas"',
  'consent.marketing.grant': 'Ativou novidades por e-mail',
  'consent.marketing.revoke': 'Desativou novidades por e-mail',
};

export const CONSENT_LABELS: Record<string, string> = {
  terms: 'Termos e política',
  adult_declaration: 'Declaração de maioridade',
  discovery: 'Aparecer nas buscas',
  marketing: 'Novidades por e-mail',
};

const parseDate = (iso: string) => new Date(`${iso}T12:00:00`);

export function dateParts(iso: string) {
  const d = parseDate(iso);
  return {
    weekday: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
    day: String(d.getDate()),
    month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    long: d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

export function isPast(iso: string) {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return iso < today;
}

export function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatCnpj(raw: string) {
  const v = raw.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14);
  let out = v.slice(0, 2);
  if (v.length > 2) out += `.${v.slice(2, 5)}`;
  if (v.length > 5) out += `.${v.slice(5, 8)}`;
  if (v.length > 8) out += `/${v.slice(8, 12)}`;
  if (v.length > 12) out += `-${v.slice(12)}`;
  return out;
}

export function timeAgo(ts: number) {
  const minutes = Math.round((Date.now() - ts) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function clock(ts: number) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Medidor local e simples: orienta a pessoa, a regra de verdade está no servidor. */
export function passwordStrength(p: string): { score: number; label: string } {
  if (!p) return { score: 0, label: 'Use pelo menos 10 caracteres' };
  if (p.length < 10) return { score: 1, label: `Faltam ${10 - p.length} caracteres` };
  let score = 2;
  if (p.length >= 14) score++;
  if (/[a-z]/.test(p) && /[A-Z0-9]/.test(p) && /[^a-zA-Z0-9]/.test(p)) score++;
  return { score, label: score >= 4 ? 'Senha forte' : score === 3 ? 'Boa senha' : 'Razoável. Uma frase longa é melhor' };
}
