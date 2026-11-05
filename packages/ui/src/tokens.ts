/**
 * Primeiros tokens, herdados da identidade do protótipo.
 * O design system completo, com componentes, começa na Fase 3.
 */
export const palette = {
  ink: '#16120D',
  inkMuted: '#6B6357',
  paper: '#F5EFE3',
  surface: '#FFFCF5',
  line: '#E0D7C5',
  night: '#1E1430',
  nightSurface: '#2E2147',
  onNight: '#FFFFFF',
  onNightMuted: '#D7CFE6',
  coral: '#FF7A55',
  amber: '#FFC247',
  lime: '#C9F26B',
  danger: '#B42318',
} as const;

export type ColorRole = 'background' | 'surface' | 'text' | 'textMuted' | 'border' | 'accent';

export const lightColors: Record<ColorRole, string> = {
  background: palette.paper,
  surface: palette.surface,
  text: palette.ink,
  textMuted: palette.inkMuted,
  border: palette.line,
  accent: palette.coral,
};

export const darkColors: Record<ColorRole, string> = {
  background: palette.night,
  surface: palette.nightSurface,
  text: palette.onNight,
  textMuted: palette.onNightMuted,
  border: palette.nightSurface,
  accent: palette.lime,
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radius = { sm: 12, md: 18, lg: 24, full: 999 } as const;

export const fontSize = { caption: 13, body: 16, title: 22, display: 40 } as const;
