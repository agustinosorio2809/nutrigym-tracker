/* Hallmark · genre: modern-minimal · design-system: design.md · designed-as-app */
// Tokens de diseño compartidos — ver design.md en la raíz del repo.
// Antes vivían duplicados (con pequeñas inconsistencias) en cada pantalla.
export const C = {
  bg: '#0F1117',
  surface: '#1A1D27',
  surfaceHigh: '#22263A',
  border: '#2A2D3E',
  accent: '#10B981',
  accentDim: '#10B98118',
  accentText: '#34D399',
  blue: '#3B82F6',
  blueDim: '#3B82F618',
  red: '#EF4444',
  redDim: '#EF444418',
  yellow: '#F59E0B',
  yellowDim: '#F59E0B18',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#4B5563',
  navBg: '#13151F',
  navHeight: '64px',
}

export const SPACE = {
  '3xs': '4px', '2xs': '8px', xs: '12px', sm: '16px',
  md: '24px', lg: '32px', xl: '48px',
}

export const ESTADO_COLORS = { cumplida: C.accent, con_cambios: C.yellow, no_cumplida: C.red, omitida: '#6B7280' }
