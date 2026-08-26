// Sistema de íconos único de la app — SVG dibujados a mano, mismo lenguaje que los
// que ya existían en el nav (stroke 2, viewBox 24x24, round caps). Reemplaza todos los
// emoji usados como ícono funcional. Ver design.md § Iconografía.
const base = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

function Svg({ size = 20, color = 'currentColor', children, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} style={style} {...base}>
      {children}
    </svg>
  )
}

export function IconDashboard(p) {
  return <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Svg>
}
export function IconPlan(p) {
  return <Svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="15" x2="12" y2="15" /></Svg>
}
export function IconViandas(p) {
  return <Svg {...p}><path d="M3 11l19-9-9 19-2-8-8-2z" /></Svg>
}
export function IconGym(p) {
  return <Svg {...p}><path d="M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 12h12" /></Svg>
}
export function IconPerfil(p) {
  return <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></Svg>
}
export function IconSunrise(p) {
  return <Svg {...p}><circle cx="12" cy="14" r="4" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="4.2" y1="9" x2="6.8" y2="10.8" /><line x1="19.8" y1="9" x2="17.2" y2="10.8" /><line x1="2" y1="20" x2="22" y2="20" /></Svg>
}
export function IconSun(p) {
  return <Svg {...p}><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" /><line x1="4.9" y1="4.9" x2="6.3" y2="6.3" /><line x1="17.7" y1="17.7" x2="19.1" y2="19.1" /><line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" /><line x1="4.9" y1="19.1" x2="6.3" y2="17.7" /><line x1="17.7" y1="6.3" x2="19.1" y2="4.9" /></Svg>
}
export function IconApple(p) {
  return <Svg {...p}><path d="M12 8c-3 0-5.5 2.5-5.5 6.5S9 21 11 21c1 0 1-.6 2-.6s1 .6 2 .6c2 0 4.5-2.5 4.5-6.5S17 8 14 8c-.8 0-1.3.3-2 .3S12.8 8 12 8z" /><path d="M12 8c0-2 1-3.5 2.5-4" /></Svg>
}
export function IconMoon(p) {
  return <Svg {...p}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" /></Svg>
}
export function IconSparkle(p) {
  return <Svg {...p}><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z" /></Svg>
}
export function IconUpload(p) {
  return <Svg {...p}><path d="M12 16V4" /><path d="M6 9l6-6 6 6" /><path d="M4 20h16" /></Svg>
}
export function IconDownload(p) {
  return <Svg {...p}><path d="M12 4v12" /><path d="M6 11l6 6 6-6" /><path d="M4 20h16" /></Svg>
}
export function IconTrash(p) {
  return <Svg {...p}><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></Svg>
}
export function IconBox(p) {
  return <Svg {...p}><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><line x1="12" y1="13" x2="12" y2="21" /></Svg>
}
export function IconMeat(p) {
  return <Svg {...p}><path d="M15.5 8.5a5 5 0 1 0-7 7L4 20l1.5 1.5 4.5-4.5a5 5 0 0 0 5.5-8.5z" /></Svg>
}
export function IconChart(p) {
  return <Svg {...p}><line x1="4" y1="20" x2="4" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="20" y1="20" x2="20" y2="14" /></Svg>
}
export function IconSalad(p) {
  return <Svg {...p}><path d="M3 13a9 9 0 0 1 18 0z" /><line x1="2" y1="13" x2="22" y2="13" /><path d="M7 13c0-3 1-5 2-6" /><path d="M12 13c0-4 .5-6.5 2-8" /><path d="M17 13c0-2.5-.5-4-1.5-5.5" /></Svg>
}
export function IconBell(p) {
  return <Svg {...p}><path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10z" /><path d="M10 19a2 2 0 0 0 4 0" /></Svg>
}
export function IconWarning(p) {
  return <Svg {...p}><path d="M12 3l10 18H2L12 3z" /><line x1="12" y1="10" x2="12" y2="14" /><line x1="12" y1="17" x2="12.01" y2="17" /></Svg>
}
export function IconCheck(p) {
  return <Svg {...p}><path d="M4 12l5 5L20 6" /></Svg>
}
export function IconClose(p) {
  return <Svg {...p}><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></Svg>
}
export function IconChevronRight(p) {
  return <Svg {...p}><path d="M9 5l7 7-7 7" /></Svg>
}
export function IconMeal(p) {
  return <Svg {...p}><circle cx="12" cy="12" r="9" /><line x1="12" y1="7" x2="12" y2="12" /><line x1="12" y1="12" x2="15" y2="14" /></Svg>
}
export function IconBall(p) {
  return <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 3v6l5 3-2 6H9l-2-6 5-3V3z" /></Svg>
}
export function IconRobot(p) {
  return <Svg {...p}><rect x="5" y="8" width="14" height="11" rx="2" /><line x1="12" y1="4" x2="12" y2="8" /><circle cx="12" cy="3" r="1" /><line x1="9" y1="13" x2="9" y2="15" /><line x1="15" y1="13" x2="15" y2="15" /><line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" /></Svg>
}
export function IconTrophy(p) {
  return <Svg {...p}><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M7 6H4v2a3 3 0 0 0 3 3" /><path d="M17 6h3v2a3 3 0 0 1-3 3" /><line x1="12" y1="14" x2="12" y2="18" /><path d="M8 21h8" /><path d="M10 18h4v3h-4z" /></Svg>
}
export function IconTrendingUp(p) {
  return <Svg {...p}><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></Svg>
}
export function IconTrendingDown(p) {
  return <Svg {...p}><polyline points="3 7 9 13 13 9 21 17" /><polyline points="15 17 21 17 21 11" /></Svg>
}
