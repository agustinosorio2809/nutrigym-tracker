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
