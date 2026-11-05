import { describe, expect, it } from 'vitest';
import { darkColors, lightColors, type ColorRole } from './tokens.js';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

describe.each([
  ['claro', lightColors],
  ['escuro', darkColors],
] as [string, Record<ColorRole, string>][])('contraste do tema %s (WCAG AA)', (_, colors) => {
  it.each(['background', 'surface'] as const)('texto sobre %s tem pelo menos 4,5:1', (role) => {
    expect(contrast(colors.text, colors[role])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.textMuted, colors[role])).toBeGreaterThanOrEqual(4.5);
  });
});
