export const colors = {
  bg: '#F6F7FB',
  surface: '#FFFFFF',
  navy: '#0E1A2B',
  primary: '#1E6FD9',
  primaryDark: '#1557AE',
  accent: '#17B88C',
  warn: '#E0A72B',
  danger: '#D64545',
  text: '#13203A',
  muted: '#6B7690',
  border: '#E3E7EF',
  overlay: 'rgba(14,26,43,0.55)',
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
