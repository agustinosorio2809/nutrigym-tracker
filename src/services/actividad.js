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

// Un día con sesión válida pero sin series (futsal, cardio) toma un nivel fijo
// intermedio: dejarlo en el más bajo lo haría parecer un día flojo, y no lo es.
export const NIVEL_SIN_SERIES = 2

// La escala es relativa al período visible y no absoluta: con umbrales fijos, un mes de
// bajo volumen se veria uniformemente pálido y no se distinguiría "entrené poco" de
// "la escala está mal calibrada".
export function nivelDeIntensidad(series, referencia) {
  if (!series || series <= 0) return 0
  if (!referencia || referencia <= 0) return 0
  const proporcion = series / referencia
  if (proporcion > 0.75) return 4
  if (proporcion > 0.5) return 3
  if (proporcion > 0.25) return 2
  return 1
}

const MS_POR_DIA = 86400000

// Las semanas arrancan el lunes, igual que week_start en meal_plans. Se usa mediodía UTC
// para que el cambio de huso horario no corra la fecha un día.
export function lunesDe(fecha) {
  const d = new Date(fecha + 'T12:00:00Z')
  const diaSemana = (d.getUTCDay() + 6) % 7   // 0 = lunes
  return new Date(d.getTime() - diaSemana * MS_POR_DIA).toISOString().slice(0, 10)
}

// Las rachas se miden en semanas y no en días: con una rutina de 3 días, una racha de
// días calendario consecutivos se cortaría cada martes y no significaría nada.
export function rachas(dias, diasEntreno, hoy) {
  if (!Array.isArray(dias) || !dias.length) return { actual: 0, maxima: 0 }

  const porSemana = new Map()
  for (const d of dias) {
    const semana = lunesDe(d.date)
    porSemana.set(semana, (porSemana.get(semana) || 0) + 1)
  }

  const semanaActual = lunesDe(hoy)
  const semanas = [...porSemana.keys()].sort()
  const primera = semanas[0]

  // Se recorre semana a semana incluyendo las vacías, que son las que cortan la racha.
  const cumplidas = []
  for (let s = primera; s < semanaActual; s = siguienteSemana(s)) {
    cumplidas.push((porSemana.get(s) || 0) >= diasEntreno)
  }

  let maxima = 0
  let corriendo = 0
  for (const cumple of cumplidas) {
    corriendo = cumple ? corriendo + 1 : 0
    if (corriendo > maxima) maxima = corriendo
  }

  // La semana en curso no se evalúa: todavía faltan días para completarla.
  let actual = 0
  for (let i = cumplidas.length - 1; i >= 0 && cumplidas[i]; i--) actual++

  return { actual, maxima }
}

function siguienteSemana(lunes) {
  return new Date(new Date(lunes + 'T12:00:00Z').getTime() + 7 * MS_POR_DIA)
    .toISOString().slice(0, 10)
}
