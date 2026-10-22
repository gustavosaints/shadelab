/**
 * Tema do Cypris Smile (2026-10-22): tons pastel, grafite para texto e um rosé discreto, combinando com a
 * logomarca (proposta D: "Cypris" em Italiana, arco de sorriso rosé, "SMILE" em Jost espaçado).
 * Contraste: textos em `text`/`muted` sobre branco ou `bg` passam 4,5:1; botões usam `primary` com texto branco (5,5:1).
 */
export const colors = {
  bg: '#FAF7F5',
  surface: '#FFFFFF',
  /** grafite (nome antigo mantido: várias telas usam `navy` para fundos escuros) */
  navy: '#2B2E38',
  ink: '#2B2E38',
  primary: '#9C6B63',
  primaryDark: '#80554E',
  /** rosé da logomarca: só para detalhes e traços, não para texto pequeno */
  rose: '#B4847C',
  accent: '#557563',
  warn: '#A87A2A',
  danger: '#B5524E',
  text: '#2B2E38',
  muted: '#6E6A70',
  border: '#EDE4DF',
  overlay: 'rgba(43,46,56,0.55)',
};

/** Fundos pastel para os cartões da tela inicial. */
export const pastel = {
  blush: '#F4E4E0',
  sage: '#E3ECE5',
  powder: '#E2E8F1',
  lavender: '#ECE6F0',
  sand: '#F3ECE1',
};

/** Famílias carregadas em `app/_layout.tsx` (@expo-google-fonts). */
export const fonts = {
  display: 'Italiana_400Regular',
  light: 'Jost_300Light',
  regular: 'Jost_400Regular',
  medium: 'Jost_500Medium',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 8, md: 14, lg: 20 };

export const qualityColor: Record<string, string> = {
  imperceptivel: colors.accent,
  aceitavel: colors.warn,
  visivel: colors.danger,
};

export const qualityLabel: Record<string, string> = {
  imperceptivel: 'Imperceptível',
  aceitavel: 'Aceitável',
  visivel: 'Diferença visível',
};
