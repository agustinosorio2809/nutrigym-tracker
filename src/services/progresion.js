// src/services/progresion.js
// Motor de progresión: qué peso poner la próxima vez, cuándo un ejercicio se
// estancó y cuándo conviene un deload. Funciones puras: sin Supabase, sin React.
// Ver spec en docs/superpowers/specs/2026-08-26-gym-motor-progresion-design.md

import { mejorSerie } from './oneRepMax'

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

export const INCREMENTO_KG = 2.5
export const RIR_PARA_SUBIR = 2

function rirDe(serie) {
  const { rir } = serie
  if (rir === null || rir === undefined || rir === '') return null
  const n = Number(rir)
  return Number.isFinite(n) ? n : null
}

function esEfectiva(serie) {
  const reps = Number(serie.reps)
  return Number(serie.weight_kg) > 0
    && Number.isFinite(reps) && reps > 0
    && rirDe(serie) !== null
}

export function sugerirProximo(sesiones) {
  const ultima = sesiones?.[0]
  if (!ultima) return null

  const conPeso = (ultima.series || []).filter(s => Number(s.weight_kg) > 0)
  if (!conPeso.length) return null

  const efectivas = conPeso.filter(esEfectiva)
  if (!efectivas.length) {
    return { accion: 'sin_rir', weight_kg: null, reps: null, motivo: 'cargá el RIR para recibir sugerencias' }
  }

  let ref = efectivas[0]
  for (const s of efectivas) if (rirDe(s) < rirDe(ref)) ref = s

  const peso = Number(ref.weight_kg)
  const reps = Number(ref.reps)
  const rir = rirDe(ref)

  if (rir >= RIR_PARA_SUBIR) {
    return { accion: 'subir', weight_kg: peso + INCREMENTO_KG, reps, motivo: `cerraste con RIR ${rir}` }
  }
  if (rir === 1) {
    return { accion: 'sumar_reps', weight_kg: peso, reps: reps + 1, motivo: 'RIR 1, sumá una rep' }
  }
  return { accion: 'mantener', weight_kg: peso, reps, motivo: 'llegaste al fallo' }
}
