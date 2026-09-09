// Componentes de presentación de la vista Actividad del Dashboard.

import { useEffect, useRef } from 'react'
import { C, INTENSIDAD, GRUPO_COLORS } from '../theme'
import { nivelDeIntensidad, NIVEL_SIN_SERIES, lunesDe } from '../services/actividad'
import { GRUPOS } from '../services/musculos'
import { useInteractiveStyle, focusRing } from '../hooks/useInteractiveStyle'

const MS_POR_DIA = 86400000

// Stat tipográfico: número grande + label + regla fina, sin card ni borde.
// Tratamiento nº 2 de design.md.
function Stat({ valor, label }) {
  return (
    <div style={{ flex: 1, minWidth: '90px', borderTop: `1px solid ${C.border}`, paddingTop: '10px' }}>
      <div style={{
        fontSize: '1.75rem', fontWeight: 800, color: C.textPrimary,
        letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
      }}>{valor}</div>
      <div style={{
        fontSize: '11px', fontWeight: 600, color: C.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px',
      }}>{label}</div>
    </div>
  )
}

export function ResumenActividad({ sesiones, rachas }) {
  return (
    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
      <Stat valor={sesiones} label="Sesiones" />
      <Stat valor={rachas.actual} label="Racha actual" />
      <Stat valor={rachas.maxima} label="Racha máxima" />
    </div>
  )
}

const CELDA = 11
const GAP = 3

// 53 columnas no entran en un teléfono: el contenedor scrollea solo, el body nunca.
export function TiraAnual({ dias, onSeleccionarMes }) {
  const scroller = useRef(null)

  useEffect(() => {
    // Arranca a la derecha: la semana actual es la que interesa al abrir.
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
  }, [])

  const porFecha = new Map(dias.map(d => [d.date, d]))
  const maximo = Math.max(1, ...dias.map(d => d.totalSeries))

  const hoy = new Date()
  const finSemana = lunesDe(hoy.toISOString().slice(0, 10))
  const inicio = new Date(new Date(finSemana + 'T12:00:00Z').getTime() - 52 * 7 * MS_POR_DIA)

  const celdas = []
  for (let i = 0; i < 53 * 7; i++) {
    const fecha = new Date(inicio.getTime() + i * MS_POR_DIA)
    const iso = fecha.toISOString().slice(0, 10)
    const dia = porFecha.get(iso)
    const nivel = !dia ? 0
      : dia.totalSeries > 0 ? nivelDeIntensidad(dia.totalSeries, maximo)
      : NIVEL_SIN_SERIES
    celdas.push({ iso, dia, nivel })
  }

  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <div style={{
        fontSize: '11px', fontWeight: 600, color: C.textMuted, marginBottom: '8px',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>Último año</div>

      <div ref={scroller} style={{ overflowX: 'auto', paddingBottom: '4px' }}>
        <div style={{
          display: 'grid',
          gridTemplateRows: `repeat(7, ${CELDA}px)`,
          gridAutoFlow: 'column',
          gridAutoColumns: `${CELDA}px`,
          gap: `${GAP}px`,
          width: 'max-content',
        }}>
          {celdas.map(({ iso, dia, nivel }) => (
            <div
              key={iso}
              onClick={() => dia && onSeleccionarMes(iso.slice(0, 7))}
              // El dato viaja como texto y no solo como color.
              title={dia ? `${iso} — ${dia.totalSeries} series` : iso}
              style={{
                background: INTENSIDAD[nivel],
                borderRadius: '2px',
                cursor: dia ? 'pointer' : 'default',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const INICIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// La opacidad codifica el volumen; el tono, el grupo. El nivel 0 no llega acá: un día
// sin sesión no se pinta.
const OPACIDAD = [0, 0.4, 0.6, 0.8, 1]

export function MesDetalle({ dias, mes, onCambiarMes, diaSeleccionado, onSeleccionarDia }) {
  // La intensidad es relativa al mes visible, no al año completo: si no se filtra acá,
  // un mes de bajo volumen sale uniformemente pálido aunque haya sido un mes normal.
  const diasDelMes = dias.filter(d => d.date.startsWith(mes))
  const porFecha = new Map(diasDelMes.map(d => [d.date, d]))
  const maximo = Math.max(1, ...diasDelMes.map(d => d.totalSeries))

  const [anio, mesNum] = mes.split('-').map(Number)
  const primero = new Date(Date.UTC(anio, mesNum - 1, 1))
  const diasEnMes = new Date(Date.UTC(anio, mesNum, 0)).getUTCDate()
  // 0 = lunes, para alinear el día 1 en su columna.
  const offset = (primero.getUTCDay() + 6) % 7

  function moverMes(delta) {
    const d = new Date(Date.UTC(anio, mesNum - 1 + delta, 1))
    onCambiarMes(d.toISOString().slice(0, 7))
  }

  // Solo grupos que fueron dominantes de algún día: el color de cada celda sale de
  // `dominante`, así que un grupo que nunca lo fue no se pinta y no debe estar en la leyenda.
  const gruposDelMes = GRUPOS.filter(g => diasDelMes.some(d => d.dominante === g))

  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <FlechaMes label="←" onClick={() => moverMes(-1)} />
        <div style={{ fontSize: '14px', fontWeight: 600, color: C.textPrimary, minWidth: '150px' }}>
          {MESES[mesNum - 1]} {anio}
        </div>
        <FlechaMes label="→" onClick={() => moverMes(1)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {INICIALES.map((ini, i) => (
          <div key={i} style={{
            fontSize: '10px', fontWeight: 700, color: C.textMuted, textAlign: 'center',
            paddingBottom: '4px', letterSpacing: '0.06em',
          }}>{ini}</div>
        ))}

        {Array.from({ length: offset }, (_, i) => <div key={`v${i}`} />)}

        {Array.from({ length: diasEnMes }, (_, i) => {
          const num = i + 1
          const iso = `${mes}-${String(num).padStart(2, '0')}`
          const dia = porFecha.get(iso)
          const nivel = !dia ? 0
            : dia.totalSeries > 0 ? nivelDeIntensidad(dia.totalSeries, maximo)
            : NIVEL_SIN_SERIES
          const seleccionado = diaSeleccionado === iso

          return (
            <div
              key={iso}
              onClick={() => dia && onSeleccionarDia(seleccionado ? null : iso)}
              title={dia ? `${dia.dominante} — ${dia.totalSeries} series` : ''}
              style={{
                position: 'relative', aspectRatio: '1', minHeight: '40px',
                borderRadius: '6px', cursor: dia ? 'pointer' : 'default',
                border: seleccionado ? `2px solid ${C.accent}` : '1px solid transparent',
                background: C.surface,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {dia && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '5px',
                  background: GRUPO_COLORS[dia.dominante],
                  opacity: OPACIDAD[nivel],
                }} />
              )}
              {/* El número va siempre: el color nunca es el único portador de información. */}
              <span style={{
                position: 'relative', fontSize: '12px',
                fontWeight: dia ? 700 : 400,
                color: dia ? '#0F1117' : C.textMuted,
                fontVariantNumeric: 'tabular-nums',
              }}>{num}</span>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '14px' }}>
        {gruposDelMes.map(g => (
          <div key={g} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: GRUPO_COLORS[g] }} />
            <span style={{ fontSize: '12px', color: C.textSecondary }}>{g}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BarrasPorGrupo({ volumen, titulo }) {
  if (!volumen.length) {
    return (
      <div style={{ color: C.textMuted, fontSize: '13px', padding: '1rem 0' }}>
        No hay series registradas en este período.
      </div>
    )
  }

  // volumenPorGrupo() siempre pone 'Sin clasificar' último aunque tenga más series que
  // el resto: el mayor real hay que calcularlo sobre todo el array, no tomar el primero.
  const mayor = Math.max(...volumen.map(v => v.series))

  return (
    <div>
      <div style={{
        fontSize: '11px', fontWeight: 600, color: C.textMuted, marginBottom: '10px',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>{titulo}</div>

      {volumen.map(({ grupo, series, porcentaje }) => (
        <div key={grupo} style={{ marginBottom: '10px' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: '4px',
          }}>
            <span style={{ fontSize: '13px', color: C.textPrimary }}>{grupo}</span>
            <span style={{
              fontSize: '12px', color: C.textSecondary, fontVariantNumeric: 'tabular-nums',
            }}>{series} series · {porcentaje}%</span>
          </div>
          <div style={{ height: '8px', background: C.surface, borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              // Proporcional al mayor y no al total: con nueve grupos, escalar por el
              // total dejaría todas las barras aplastadas contra la izquierda.
              width: `${(series / mayor) * 100}%`,
              height: '100%',
              background: GRUPO_COLORS[grupo],
              borderRadius: '4px',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function FlechaMes({ label, onClick }) {
  const { style, handlers } = useInteractiveStyle(
    {
      width: '32px', height: '32px', borderRadius: '8px',
      background: C.surface, border: `1px solid ${C.border}`,
      color: C.textSecondary, cursor: 'pointer', fontSize: '14px',
    },
    { hover: { background: C.surfaceHigh }, focus: focusRing }
  )
  return <button onClick={onClick} style={style} {...handlers}>{label}</button>
}

export function PanelDia({ dia }) {
  if (!dia) return null

  const fecha = new Date(dia.date + 'T12:00:00')
    .toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  const grupos = GRUPOS.filter(g => dia.porGrupo[g])

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px',
      padding: '16px', marginBottom: '1.75rem',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: C.textPrimary, textTransform: 'capitalize' }}>
        {fecha}
      </div>
      {dia.tipo && (
        <div style={{ fontSize: '12px', color: C.accentText, marginTop: '2px' }}>{dia.tipo}</div>
      )}

      {grupos.length === 0 ? (
        <div style={{ fontSize: '13px', color: C.textMuted, marginTop: '12px' }}>
          Sesión sin series cargadas.
        </div>
      ) : (
        <div style={{ marginTop: '12px' }}>
          {grupos.map(g => (
            <div key={g} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: GRUPO_COLORS[g] }} />
                <span style={{ fontSize: '13px', color: C.textPrimary }}>{g}</span>
              </div>
              <span style={{
                fontSize: '13px', color: C.textSecondary, fontVariantNumeric: 'tabular-nums',
              }}>{dia.porGrupo[g]} series</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
