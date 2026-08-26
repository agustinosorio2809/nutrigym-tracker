// src/components/gym.jsx
// Componentes de presentación de la pantalla de Gimnasio. Vivían dentro de
// Gimnasio.jsx; se movieron acá para que la página quede con la lógica de I/O.
// Estilos inline y tokens de theme.js, como todo el proyecto.

import { C } from '../theme'
import { useInteractiveStyle, focusRing } from '../hooks/useInteractiveStyle'
import { IconTrophy, IconWarning, IconTrendingUp, IconTrendingDown } from './icons'

export function TabButton({ active, onClick, children }) {
  const { style, handlers } = useInteractiveStyle(
    {
      padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
      background: active ? C.accent : C.surface,
      color: active ? '#fff' : C.textSecondary,
      fontWeight: active ? 700 : 400, fontSize: '14px',
    },
    { hover: active ? null : { background: C.surfaceHigh, color: C.textPrimary }, focus: focusRing }
  )
  return <button onClick={onClick} style={style} {...handlers}>{children}</button>
}

export function BadgePR({ mejora }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
      background: C.yellowDim, color: C.yellow, border: `1px solid ${C.yellow}40`,
    }}>
      <IconTrophy size={11} color={C.yellow} />
      PR +{mejora.toFixed(1)} kg
    </span>
  )
}

export function Pill({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: accent ? C.accentDim : C.surfaceHigh, borderRadius: '8px', padding: '4px 12px', minWidth: '44px' }}>
      <span style={{ fontSize: '14px', fontWeight: 700, color: accent ? C.accentText : C.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: '10px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
    </div>
  )
}

export function PrimarySmallButton({ onClick, disabled, children }) {
  const { style, handlers } = useInteractiveStyle(
    { background: C.accent, color: 'white', border: 'none', padding: '9px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', opacity: disabled ? 0.7 : 1 },
    { hover: disabled ? null : { filter: 'brightness(1.08)' }, focus: focusRing }
  )
  return <button onClick={onClick} disabled={disabled} style={style} {...handlers}>{children}</button>
}

export function ActionButton({ onClick, disabled, tone = 'default', children }) {
  const tones = {
    blue: { base: { background: C.blueDim, color: C.blue, border: `1px solid ${C.blue}40` }, hover: { background: C.blue, color: '#fff' } },
    red: { base: { background: '#EF444415', color: C.red, border: `1px solid ${C.red}40` }, hover: { background: C.red, color: '#fff' } },
  }
  const t = tones[tone]
  const { style, handlers } = useInteractiveStyle(
    { ...t.base, display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, opacity: disabled ? 0.7 : 1 },
    { hover: disabled ? null : t.hover, focus: focusRing }
  )
  return <button onClick={onClick} disabled={disabled} style={style} {...handlers}>{children}</button>
}

export function TinyGhostButton({ onClick, children }) {
  const { style, handlers } = useInteractiveStyle(
    { fontSize: '12px', border: `1px solid ${C.border}`, padding: '3px 10px', borderRadius: '6px', cursor: 'pointer', background: 'transparent', color: C.textSecondary },
    { hover: { borderColor: C.textMuted, color: C.textPrimary }, focus: focusRing }
  )
  return <button onClick={onClick} style={style} {...handlers}>{children}</button>
}

export function TinyDangerButton({ onClick, children }) {
  const { style, handlers } = useInteractiveStyle(
    { display: 'flex', alignItems: 'center', fontSize: '12px', border: `1px solid ${C.red}40`, color: C.red, padding: '3px 8px', borderRadius: '6px', cursor: 'pointer', background: 'transparent' },
    { hover: { background: C.red, color: '#fff' }, focus: focusRing }
  )
  return <button onClick={onClick} style={style} {...handlers}>{children}</button>
}

export function ModalPrimaryButton({ onClick, disabled, children }) {
  const { style, handlers } = useInteractiveStyle(
    { flex: 1, background: C.accent, color: 'white', border: 'none', padding: '13px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', opacity: disabled ? 0.5 : 1 },
    { hover: disabled ? null : { filter: 'brightness(1.08)' }, focus: focusRing }
  )
  return <button onClick={onClick} disabled={disabled} style={style} {...handlers}>{children}</button>
}
export function ModalSecondaryButton({ onClick, children }) {
  const { style, handlers } = useInteractiveStyle(
    { padding: '13px 20px', border: `1px solid ${C.border}`, borderRadius: '10px', cursor: 'pointer', background: 'transparent', color: C.textSecondary, fontSize: '15px' },
    { hover: { borderColor: C.textMuted, color: C.textPrimary }, focus: focusRing }
  )
  return <button onClick={onClick} style={style} {...handlers}>{children}</button>
}

// Base visual compartida con BadgePR: píldora chica, fondo xxxDim, borde al 40%.
function Chip({ color, dim, borde = true, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
      background: dim, color, border: borde ? `1px solid ${color}40` : `1px solid ${C.border}`,
    }}>
      {children}
    </span>
  )
}

// La sugerencia siempre viaja con su motivo: un número raro se detecta leyéndolo.
export function ChipProgresion({ sugerencia }) {
  if (!sugerencia) return null

  if (sugerencia.accion === 'sin_rir') {
    return <Chip color={C.textMuted} dim={C.surfaceHigh} borde={false}>{sugerencia.motivo}</Chip>
  }
  if (sugerencia.accion === 'subir') {
    return (
      <Chip color={C.accentText} dim={C.accentDim}>
        <IconTrendingUp size={11} color={C.accentText} />
        {sugerencia.weight_kg} kg · {sugerencia.motivo}
      </Chip>
    )
  }
  if (sugerencia.accion === 'sumar_reps') {
    return (
      <Chip color={C.blue} dim={C.blueDim}>
        {sugerencia.weight_kg} kg × {sugerencia.reps} · {sugerencia.motivo}
      </Chip>
    )
  }
  return (
    <Chip color={C.textMuted} dim={C.surfaceHigh} borde={false}>
      {sugerencia.weight_kg} kg × {sugerencia.reps} · {sugerencia.motivo}
    </Chip>
  )
}

export function ChipEstancado({ sesionesSinPR }) {
  return (
    <Chip color={C.red} dim={C.redDim}>
      <IconWarning size={11} color={C.red} />
      {sesionesSinPR} sesiones sin PR
    </Chip>
  )
}

// Único chip con acción: es la única sugerencia que baja la carga, y bajar en
// silencio no es lo esperable de un plan de progresión.
export function ChipDeload({ weight_kg, onAplicar }) {
  return (
    <Chip color={C.yellow} dim={C.yellowDim}>
      <IconTrendingDown size={11} color={C.yellow} />
      Probar deload: {weight_kg} kg
      <TinyGhostButton onClick={onAplicar}>aplicar</TinyGhostButton>
    </Chip>
  )
}
