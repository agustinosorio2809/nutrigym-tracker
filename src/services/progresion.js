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

// La sugerencia se expresa como peso × reps y se decide por RIR, así que sin
// las tres (weight_kg, reps, rir) no hay nada válido que sugerir.
// Se exige `reps > 0` en vez de solo `Number.isFinite(reps)` para que una serie
// con `reps: null` (Number(null) === 0) no cuente como efectiva; sin este chequeo,
// esa serie colaría y rompería el caso 'sin_rir' cuando falta la cantidad de reps.
// Ver DECISIONS.md, sección "Spec 2 — Motor de progresión".
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
  // Sin ninguna serie con peso no hay nada que progresar: cubre ejercicios sin
  // peso, como futsal, cardio o trabajo a peso corporal.
  if (!conPeso.length) return null

  const efectivas = conPeso.filter(esEfectiva)
  if (!efectivas.length) {
    return { accion: 'sin_rir', weight_kg: null, reps: null, motivo: 'cargá el RIR para recibir sugerencias' }
  }

  // Se toma el RIR mínimo de la sesión (la serie más dura), no el de la última
  // serie: es la lectura conservadora del esfuerzo real.
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
  // RIR 0 es una sesión dura, no un estancamiento: consolidar el mismo peso es
  // la respuesta correcta. Bajar carga entra solo por la vía del deload.
  return { accion: 'mantener', weight_kg: peso, reps, motivo: 'llegaste al fallo' }
}

export const SESIONES_PARA_ESTANCAMIENTO = 3

// cargarPlantilla() siembra series reales en gym_sets con rir null. Una sesión
// donde ninguna serie tiene RIR no llegó a entrenarse, y contarla inflaría el
// estancamiento hasta ofrecer un deload sobre pesos que nadie levantó.
function fueEntrenada(sesion) {
  return (sesion.series || []).some(s => rirDe(s) !== null)
}

export function detectarEstancamiento(sesiones) {
  const conMejor = (sesiones || []).filter(s => s?.mejor && fueEntrenada(s))
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
  // Solo las entrenadas: bajar un 10% de un peso que la plantilla sembró y
  // nadie levantó daría un alivio calculado sobre una carga imaginaria.
  const entrenadas = (sesiones || []).filter(fueEntrenada)
  const ultima = entrenadas[0]
  if (!ultima) return null

  const pesoUltima = pesoMaximo(ultima.series || [])
  if (!pesoUltima) return null

  const anterior = entrenadas[1]
  const pesoAnterior = anterior ? pesoMaximo(anterior.series || []) : null
  // Si ya venís bajando, el deload está en curso: re-ofrecerlo sería ruido.
  if (pesoAnterior !== null && pesoUltima < pesoAnterior) return null

  // Redondeo hacia abajo para que el alivio sea real y no cosmético.
  const weight_kg = Math.floor((pesoUltima * FACTOR_DELOAD) / ESCALON_KG) * ESCALON_KG
  if (weight_kg <= 0 || weight_kg >= pesoUltima) return null
  return { weight_kg }
}

// Decide qué peso/reps sembrar al cargar una plantilla: la sugerencia del motor
// cuando trae un weight_kg utilizable, o los defaults de la plantilla si no.
// Cubre tanto la ausencia de sugerencia (ejercicio sin historial) como el caso
// accion:'sin_rir' (weight_kg viene en null a propósito).
export function pesoParaSembrar(sugerencia, defaults) {
  if (sugerencia?.weight_kg != null) {
    return { weight_kg: sugerencia.weight_kg, reps: sugerencia.reps }
  }
  return { weight_kg: defaults?.weight_kg ?? null, reps: defaults?.reps ?? null }
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
