// Componentes de presentación de la vista Actividad del Dashboard.

import { useEffect, useRef } from 'react'
import { C, INTENSIDAD } from '../theme'
import { nivelDeIntensidad, NIVEL_SIN_SERIES, lunesDe } from '../services/actividad'

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
