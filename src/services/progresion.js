// src/services/progresion.js
// Motor de progresión: qué peso poner la próxima vez, cuándo un ejercicio se
// estancó y cuándo conviene un deload. Funciones puras: sin Supabase, sin React.
// Ver spec en docs/superpowers/specs/2026-08-26-gym-motor-progresion-design.md

import { mejorSerie } from './oneRepMax'

// Agrupa las filas de un mismo ejercicio por sesión (fecha) y calcula la mejor
// serie de cada una. Devuelve de la más reciente a la más antigua.
// Las fechas vienen como 'YYYY-MM-DD', así que el orden lexicográfico es el
// orden cronológico.
export function sesionesDeEjercicio(filas) {
  if (!Array.isArray(filas)) return []
  const porFecha = new Map()
  for (const fila of filas) {
    const date = fila?.gym_logs?.date
    const series = fila?.gym_sets || []
    if (!date || !series.length) continue
    porFecha.set(date, [...(porFecha.get(date) || []), ...series])
  }
  return [...porFecha.entries()]
    .map(([date, series]) => ({ date, series, mejor: mejorSerie(series) }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
