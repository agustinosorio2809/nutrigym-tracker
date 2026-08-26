// src/services/progresion.js
// Motor de progresión: qué peso poner la próxima vez, cuándo un ejercicio se
// estancó y cuándo conviene un deload. Funciones puras: sin Supabase, sin React.
// Ver spec en docs/superpowers/specs/2026-08-26-gym-motor-progresion-design.md

import { mejorSerie, pesoMaximo } from './oneRepMax'

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

// RIR 0 es un valor válido y significativo (fallo muscular): hay que distinguirlo
// de "no cargué el dato" para evitar que alguien "simplifique" esto con `Number(x) || null`.
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

export const SESIONES_PARA_ESTANCAMIENTO = 3

export function detectarEstancamiento(sesiones) {
  const conMejor = (sesiones || []).filter(s => s?.mejor)
  // Con menos de N+1 sesiones no hay evidencia suficiente de estancamiento.
  if (conMejor.length <= SESIONES_PARA_ESTANCAMIENTO) return { estancado: false, sesionesSinPR: 0 }

  const maximo = Math.max(...conMejor.map(s => s.mejor.unaRM))
  // El récord se atribuye a la PRIMERA sesión que lo alcanzó (la más antigua),
  // así un empate posterior no resetea el contador: empatar no es progresar.
  // Como la lista viene descendente, se recorre desde el final.
  let indiceRecord = 0
  for (let i = conMejor.length - 1; i >= 0; i--) {
    if (conMejor[i].mejor.unaRM === maximo) { indiceRecord = i; break }
  }

  const sesionesSinPR = indiceRecord
  return { estancado: sesionesSinPR >= SESIONES_PARA_ESTANCAMIENTO, sesionesSinPR }
}

export const FACTOR_DELOAD = 0.9

const ESCALON_KG = 2.5

// Baja un 10% redondeando hacia abajo al múltiplo de 2.5. Se basa en pesoMaximo
// y no en la mejor serie por 1RM: el deload se razona en kilos sobre la barra.
export function sugerirDeload(sesiones) {
  const ultima = sesiones?.[0]
  if (!ultima) return null

  const pesoUltima = pesoMaximo(ultima.series || [])
  if (!pesoUltima) return null

  const anterior = sesiones[1]
  const pesoAnterior = anterior ? pesoMaximo(anterior.series || []) : null
  // Si ya venís bajando, el deload está en curso: re-ofrecerlo sería ruido.
  if (pesoAnterior !== null && pesoUltima < pesoAnterior) return null

  // Redondeo hacia abajo para que el alivio sea real y no cosmético.
  const weight_kg = Math.floor((pesoUltima * FACTOR_DELOAD) / ESCALON_KG) * ESCALON_KG
  if (weight_kg <= 0 || weight_kg >= pesoUltima) return null
  return { weight_kg }
}

// Única función que consume la UI. Recibe las filas crudas de gym_exercises de un
// mismo ejercicio y devuelve todo lo que hay que mostrar.
export function progresionDe(filas) {
  const sesiones = sesionesDeEjercicio(filas)
  const estancamiento = detectarEstancamiento(sesiones)
  return {
    sugerencia: sugerirProximo(sesiones),
    estancamiento,
    // El deload solo tiene sentido como respuesta a un estancamiento.
    deload: estancamiento.estancado ? sugerirDeload(sesiones) : null,
  }
}
