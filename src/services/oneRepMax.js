// src/services/oneRepMax.js
// Cálculo de 1RM estimado y detección de récords personales.
// Funciones puras: sin Supabase, sin React. Ver spec en
// docs/superpowers/specs/2026-08-25-gym-series-1rm-pr-design.md

// Por encima de ~12 reps la fórmula de Epley sobreestima. El corte va en 15:
// más abajo dejaría sesiones enteras sin 1RM, que es peor que un número con
// margen de error. Un 1RM derivado de 13-15 reps es orientativo.
export const MAX_REPS_ESTIMABLE = 15

// Epley: 1RM = peso × (1 + reps / 30)
export function estimar1RM({ weight_kg, reps } = {}) {
  const peso = Number(weight_kg)
  const r = Number(reps)
  if (!Number.isFinite(peso) || peso <= 0) return null
  if (!Number.isFinite(r) || r < 1 || r > MAX_REPS_ESTIMABLE) return null
  // A 1 repetición el 1RM es exactamente el peso levantado (sin estimación), no aplicamos Epley
  if (r === 1) return peso
  return peso * (1 + r / 30)
}

// La serie de mayor 1RM estimado. Ante empate se queda con la primera.
// Devuelve null si ninguna serie es estimable.
export function mejorSerie(series) {
  if (!Array.isArray(series)) return null
  let mejor = null
  for (const serie of series) {
    const unaRM = estimar1RM(serie)
    if (unaRM === null) continue
    if (mejor === null || unaRM > mejor.unaRM) mejor = { serie, unaRM }
  }
  return mejor
}

// El peso más alto entre las series, sin importar si son estimables para 1RM
// (a diferencia de mejorSerie). Se usa donde el objetivo es mostrar "qué tanto
// pesaste", no comparar 1RM.
export function pesoMaximo(series) {
  if (!Array.isArray(series)) return null
  const pesos = series
    .map(s => Number(s.weight_kg))
    .filter(p => Number.isFinite(p) && p > 0)
  return pesos.length ? Math.max(...pesos) : null
}

// Los ejercicios se emparejan por nombre porque no hay catálogo. Sin esto,
// "Press Banca" y "press banca " serían dos ejercicios distintos y se perdería
// el histórico. No resuelve variantes de tipeo ("Press de banca"): ver la
// limitación conocida en el spec.
export function normalizarNombre(nombre) {
  if (typeof nombre !== 'string') return ''
  return nombre.trim().toLowerCase().replace(/\s+/g, ' ')
}

// PR se define por 1RM estimado: engloba tanto subir el peso como hacer más
// reps con el mismo peso. La primera vez que se hace un ejercicio no es récord.
export function detectarPR(mejorHoy, mejorPrevio) {
  if (!mejorHoy || !mejorPrevio) return { esPR: false, mejora: 0 }
  const mejora = mejorHoy.unaRM - mejorPrevio.unaRM
  if (mejora <= 0) return { esPR: false, mejora: 0 }
  return { esPR: true, mejora }
}
