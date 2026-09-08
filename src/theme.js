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

// Paleta categórica para los grupos musculares. Luminosidad pareja para que ninguno
// domine, y deliberadamente fuera de los colores con significado de estado: ningún grupo
// usa el rojo (error) ni el amarillo (pendiente). Cardio y Sin clasificar van en neutros
// porque no son grupos musculares con los que comparar volumen.
export const GRUPO_COLORS = {
  'Pecho': '#F472B6',
  'Espalda': '#38BDF8',
  'Hombros': '#A78BFA',
  'Bíceps': '#2DD4BF',
  'Tríceps': '#FB923C',
  'Piernas': '#818CF8',
  'Core': '#34D399',
  'Cardio': '#64748B',
  'Sin clasificar': '#3F4453',
}

// Cinco niveles del verde de marca para la tira anual. El 0 es "sin actividad" y tiene
// que leerse como fondo, no como un valor bajo.
export const INTENSIDAD = ['#1A1D27', '#0E4437', '#12684F', '#10B981', '#5EEAD4']

export const SPACE = {
  '3xs': '4px', '2xs': '8px', xs: '12px', sm: '16px',
  md: '24px', lg: '32px', xl: '48px',
}

export const ESTADO_COLORS = { cumplida: C.accent, con_cambios: C.yellow, no_cumplida: C.red, omitida: '#6B7280' }
