// Agregación temporal de la actividad de gimnasio: qué se entrenó cada día, cuánto
// volumen recibió cada grupo, y con qué constancia.
// Ver spec en docs/superpowers/specs/2026-09-08-gym-heatmap-actividad-design.md

import { GRUPOS, SIN_CLASIFICAR, grupoDe, grupoDeRutina } from './musculos'

// Las fechas vienen como 'YYYY-MM-DD', así que el orden lexicográfico es el cronológico.
export function actividadPorDia(logs, ejercicios) {
  if (!Array.isArray(logs)) return []

  const porLog = new Map()
  for (const l of logs) porLog.set(l.id, { date: l.date, tipo: l.routine_type, porGrupo: {} })

  for (const e of (ejercicios || [])) {
    const dia = porLog.get(e.log_id)
    // Un ejercicio cuyo log no vino en esta página de resultados no se cuenta: sin la
    // fecha del log no hay dónde ubicarlo.
    if (!dia) continue
    const series = (e.gym_sets || []).length
    if (!series) continue
    const grupo = grupoDe(e.exercise_name)
    dia.porGrupo[grupo] = (dia.porGrupo[grupo] || 0) + series
  }

  const porFecha = new Map()
  for (const { date, tipo, porGrupo } of porLog.values()) {
    if (!date) continue
    const acumulado = porFecha.get(date) || { date, tipo, porGrupo: {} }
    for (const [grupo, series] of Object.entries(porGrupo)) {
      acumulado.porGrupo[grupo] = (acumulado.porGrupo[grupo] || 0) + series
    }
    porFecha.set(date, acumulado)
  }

  return [...porFecha.values()]
    .map(({ date, tipo, porGrupo }) => ({
      date,
      tipo,
      porGrupo,
      totalSeries: Object.values(porGrupo).reduce((a, b) => a + b, 0),
      dominante: dominanteDe(porGrupo, tipo),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

// Ante empate gana el grupo que aparece primero en GRUPOS: arbitrario pero determinista,
// igual que el criterio de mejorSerie() del Spec 1.
function dominanteDe(porGrupo, tipo) {
  let dominante = null
  let max = 0
  for (const grupo of GRUPOS) {
    const series = porGrupo[grupo] || 0
    if (series > max) { dominante = grupo; max = series }
  }
  // Sin series el día existe igual (futsal, cardio) y su grupo sale del tipo de rutina.
  return dominante || grupoDeRutina(tipo)
}

export function volumenPorGrupo(dias) {
  const total = {}
  for (const dia of (dias || [])) {
    for (const [grupo, series] of Object.entries(dia?.porGrupo || {})) {
      total[grupo] = (total[grupo] || 0) + series
    }
  }

  const suma = Object.values(total).reduce((a, b) => a + b, 0)
  if (!suma) return []

  return Object.entries(total)
    .map(([grupo, series]) => ({ grupo, series, porcentaje: Math.round((series / suma) * 100) }))
    // Sin clasificar va último aunque tenga más volumen: no es un grupo muscular con el
    // que comparar, es una tarea pendiente de mapeo.
    .sort((a, b) => {
      if (a.grupo === SIN_CLASIFICAR) return 1
      if (b.grupo === SIN_CLASIFICAR) return -1
      return b.series - a.series
    })
}
