import { describe, it, expect } from 'vitest'
import { sesionesDeEjercicio, sugerirProximo, detectarEstancamiento, INCREMENTO_KG, sugerirDeload, progresionDe, pesoParaSembrar } from './progresion'

// Helper: una fila de gym_exercises con la forma que devuelve Supabase.
// completed viaja en gym_logs, no en la serie: es el dato explicito del usuario
// (el toggle de Gimnasio.jsx), no algo que se infiera del RIR cargado.
function fila(date, series, completed = true) {
  return { exercise_name: 'Press banca', gym_sets: series, gym_logs: { date, completed } }
}

describe('sesionesDeEjercicio', () => {
  it('ordena de la más reciente a la más antigua', () => {
    const r = sesionesDeEjercicio([
      fila('2026-08-01', [{ weight_kg: 80, reps: 8, rir: 2 }]),
      fila('2026-08-20', [{ weight_kg: 85, reps: 8, rir: 2 }]),
      fila('2026-08-10', [{ weight_kg: 82.5, reps: 8, rir: 2 }]),
    ])
    expect(r.map(s => s.date)).toEqual(['2026-08-20', '2026-08-10', '2026-08-01'])
  })

  it('calcula la mejor serie de cada sesión', () => {
    const r = sesionesDeEjercicio([fila('2026-08-01', [
      { weight_kg: 90, reps: 1, rir: 0 },   // 1RM = 90
      { weight_kg: 80, reps: 8, rir: 2 },   // 1RM = 101.3 ← gana
    ])])
    expect(r[0].mejor.unaRM).toBeCloseTo(101.33, 2)
  })

  it('junta en una sola sesión dos filas de la misma fecha', () => {
    const r = sesionesDeEjercicio([
      fila('2026-08-01', [{ weight_kg: 80, reps: 8, rir: 2 }]),
      fila('2026-08-01', [{ weight_kg: 85, reps: 5, rir: 1 }]),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].series).toHaveLength(2)
  })

  it('ignora los ejercicios sin series', () => {
    expect(sesionesDeEjercicio([fila('2026-08-01', [])])).toEqual([])
  })

  it('ignora las filas sin fecha', () => {
    expect(sesionesDeEjercicio([{ gym_sets: [{ weight_kg: 80, reps: 8 }] }])).toEqual([])
  })

  it('devuelve lista vacía si no recibe un array', () => {
    expect(sesionesDeEjercicio(undefined)).toEqual([])
  })

  it('deja mejor en null si ninguna serie es estimable', () => {
    const r = sesionesDeEjercicio([fila('2026-08-01', [{ weight_kg: null, reps: 30, rir: 0 }])])
    expect(r[0].mejor).toBeNull()
  })

  it('conserva el completed de la sesion, que es lo que define si se entreno', () => {
    const r = sesionesDeEjercicio([fila('2026-08-01', [{ weight_kg: 80, reps: 8, rir: null }], false)])
    expect(r[0].completed).toBe(false)
  })
})

function sesion(date, series) {
  return { date, series, mejor: null }
}

describe('sugerirProximo', () => {
  it('sube el peso con RIR 2 o más', () => {
    const r = sugerirProximo([sesion('2026-08-20', [
      { weight_kg: 80, reps: 8, rir: 3 },
      { weight_kg: 80, reps: 8, rir: 2 },
    ])])
    expect(r.accion).toBe('subir')
    expect(r.weight_kg).toBe(80 + INCREMENTO_KG)
    expect(r.reps).toBe(8)
  })

  it('suma una repetición con RIR 1', () => {
    const r = sugerirProximo([sesion('2026-08-20', [{ weight_kg: 80, reps: 8, rir: 1 }])])
    expect(r.accion).toBe('sumar_reps')
    expect(r.weight_kg).toBe(80)
    expect(r.reps).toBe(9)
  })

  it('mantiene el peso con RIR 0', () => {
    const r = sugerirProximo([sesion('2026-08-20', [{ weight_kg: 80, reps: 8, rir: 0 }])])
    expect(r.accion).toBe('mantener')
    expect(r.weight_kg).toBe(80)
    expect(r.reps).toBe(8)
  })

  it('usa el RIR mínimo, no el de la última serie', () => {
    const r = sugerirProximo([sesion('2026-08-20', [
      { weight_kg: 80, reps: 6, rir: 0 },
      { weight_kg: 80, reps: 8, rir: 3 },
    ])])
    expect(r.accion).toBe('mantener')
    expect(r.reps).toBe(6)
  })

  it('mira solo la última sesión', () => {
    const r = sugerirProximo([
      sesion('2026-08-20', [{ weight_kg: 90, reps: 5, rir: 1 }]),
      sesion('2026-08-10', [{ weight_kg: 80, reps: 8, rir: 3 }]),
    ])
    expect(r.weight_kg).toBe(90)
    expect(r.accion).toBe('sumar_reps')
  })

  it('ignora las series sin peso', () => {
    const r = sugerirProximo([sesion('2026-08-20', [
      { weight_kg: null, reps: 20, rir: 0 },
      { weight_kg: 80, reps: 8, rir: 3 },
    ])])
    expect(r.accion).toBe('subir')
  })

  it('distingue RIR 0 de RIR ausente', () => {
    const conCero = sugerirProximo([sesion('2026-08-20', [{ weight_kg: 80, reps: 8, rir: 0 }])])
    const sinRir = sugerirProximo([sesion('2026-08-20', [{ weight_kg: 80, reps: 8, rir: null }])])
    expect(conCero.accion).toBe('mantener')
    expect(sinRir.accion).toBe('sin_rir')
  })

  it('avisa cuando hay peso pero falta el RIR', () => {
    const r = sugerirProximo([sesion('2026-08-20', [{ weight_kg: 80, reps: 8, rir: null }])])
    expect(r.accion).toBe('sin_rir')
    expect(r.weight_kg).toBeNull()
  })

  it('devuelve null sin historial', () => {
    expect(sugerirProximo([])).toBeNull()
    expect(sugerirProximo(undefined)).toBeNull()
  })

  it('devuelve null si ninguna serie tiene peso (futsal, cardio)', () => {
    expect(sugerirProximo([sesion('2026-08-20', [{ weight_kg: null, reps: null, rir: null }])])).toBeNull()
  })

  it('trata una serie con peso y RIR pero sin reps como no efectiva', () => {
    expect(sugerirProximo([sesion('2026-08-20', [{ weight_kg: 80, reps: null, rir: 2 }])]).accion)
      .toBe('sin_rir')
  })
})

// Una sesión entrenada: completed = true, el dato explícito del usuario.
function sesionConRM(date, unaRM, completed = true) {
  const series = [{ weight_kg: 100, reps: 5, rir: 2 }]
  return { date, series, completed, mejor: unaRM === null ? null : { serie: {}, unaRM } }
}

// Una sesión que cargarPlantilla() sembró y nadie entrenó: series con peso y
// reps, pero completed en false porque nunca se marcó la sesión como hecha.
function sesionSembrada(date) {
  return { date, series: [{ weight_kg: 100, reps: 8, rir: null }], completed: false, mejor: { serie: {}, unaRM: 100 } }
}

describe('detectarEstancamiento', () => {
  it('marca estancado tras 3 sesiones sin superar el récord', () => {
    // orden descendente: la más reciente primero
    const r = detectarEstancamiento([
      sesionConRM('2026-08-20', 100),
      sesionConRM('2026-08-13', 98),
      sesionConRM('2026-08-06', 99),
      sesionConRM('2026-07-30', 102),   // ← el récord, hace 3 sesiones
    ])
    expect(r.estancado).toBe(true)
    expect(r.sesionesSinPR).toBe(3)
  })

  it('no marca estancado si el récord es reciente', () => {
    const r = detectarEstancamiento([
      sesionConRM('2026-08-20', 105),   // ← récord en la última
      sesionConRM('2026-08-13', 98),
      sesionConRM('2026-08-06', 99),
      sesionConRM('2026-07-30', 102),
    ])
    expect(r.estancado).toBe(false)
    expect(r.sesionesSinPR).toBe(0)
  })

  it('un empate no resetea el contador', () => {
    // Se repite 102 en la última sesión, pero empatar no es progresar.
    const r = detectarEstancamiento([
      sesionConRM('2026-08-20', 102),
      sesionConRM('2026-08-13', 98),
      sesionConRM('2026-08-06', 99),
      sesionConRM('2026-07-30', 102),
    ])
    expect(r.estancado).toBe(true)
    expect(r.sesionesSinPR).toBe(3)
  })

  it('nunca marca estancado con menos de 4 sesiones', () => {
    const r = detectarEstancamiento([
      sesionConRM('2026-08-20', 90),
      sesionConRM('2026-08-13', 95),
      sesionConRM('2026-08-06', 100),
    ])
    expect(r.estancado).toBe(false)
  })

  it('ignora las sesiones sin 1RM estimable', () => {
    const r = detectarEstancamiento([
      sesionConRM('2026-08-20', 100),
      sesionConRM('2026-08-13', null),
      sesionConRM('2026-08-06', 98),
      sesionConRM('2026-07-30', 99),
      sesionConRM('2026-07-23', 102),
    ])
    // Quedan 4 sesiones con 1RM; el récord está en la más antigua.
    expect(r.estancado).toBe(true)
    expect(r.sesionesSinPR).toBe(3)
  })

  it('ignora las sesiones sembradas por plantilla y nunca entrenadas', () => {
    // cargarPlantilla() escribe series reales en gym_sets con rir null. Si se
    // carga la plantilla y no se entrena, esas sesiones no son evidencia de nada.
    const r = detectarEstancamiento([
      sesionSembrada('2026-08-27'),
      sesionSembrada('2026-08-26'),
      sesionSembrada('2026-08-25'),
      sesionConRM('2026-08-20', 102),
    ])
    expect(r.estancado).toBe(false)
    expect(r.sesionesSinPR).toBe(0)
  })

  it('cuenta la sesión si esta completada, sin importar si cargo el RIR', () => {
    // El usuario entrena seguido sin anotar el RIR porque completa todas las
    // repeticiones previstas: inferir "no entrenada" del RIR ausente descartaba
    // sesiones reales suyas. completed es el dato que el usuario marca a mano.
    const r = detectarEstancamiento([
      { date: '2026-08-27', series: [{ weight_kg: 100, reps: 8, rir: null }], completed: true, mejor: { serie: {}, unaRM: 100 } },
      sesionConRM('2026-08-20', 100),
      sesionConRM('2026-08-13', 98),
      sesionConRM('2026-08-06', 102),
    ])
    expect(r.estancado).toBe(true)
    expect(r.sesionesSinPR).toBe(3)
  })

  it('devuelve no estancado sin sesiones', () => {
    expect(detectarEstancamiento([]).estancado).toBe(false)
    expect(detectarEstancamiento(undefined).estancado).toBe(false)
  })
})

// Sesión con series reales, que es lo que mira el deload (usa pesoMaximo).
function sesionConSeries(date, series, completed = true) {
  return { date, series, completed, mejor: null }
}

describe('sugerirDeload', () => {
  it('baja un 10% redondeando hacia abajo a 2.5', () => {
    const r = sugerirDeload([sesionConSeries('2026-08-20', [{ weight_kg: 100, reps: 8, rir: 0 }])])
    expect(r.weight_kg).toBe(90)
  })

  it('redondea hacia abajo cuando no da un múltiplo exacto', () => {
    // 82.5 × 0.9 = 74.25 → 72.5
    const r = sugerirDeload([sesionConSeries('2026-08-20', [{ weight_kg: 82.5, reps: 8, rir: 0 }])])
    expect(r.weight_kg).toBe(72.5)
  })

  it('usa el peso máximo de la sesión, no el de la mejor serie por 1RM', () => {
    // 90×1 pesa más; 80×8 tiene mayor 1RM estimado. El deload mira los kilos.
    const r = sugerirDeload([sesionConSeries('2026-08-20', [
      { weight_kg: 80, reps: 8, rir: 0 },
      { weight_kg: 90, reps: 1, rir: 0 },
    ])])
    expect(r.weight_kg).toBe(80)   // 90 × 0.9 = 81 → 80
  })

  it('no se re-ofrece si la última sesión ya bajó el peso', () => {
    const r = sugerirDeload([
      sesionConSeries('2026-08-20', [{ weight_kg: 90, reps: 8, rir: 2 }]),
      sesionConSeries('2026-08-13', [{ weight_kg: 100, reps: 8, rir: 0 }]),
    ])
    expect(r).toBeNull()
  })

  it('sí se ofrece si la última sesión mantuvo el peso', () => {
    const r = sugerirDeload([
      sesionConSeries('2026-08-20', [{ weight_kg: 100, reps: 8, rir: 0 }]),
      sesionConSeries('2026-08-13', [{ weight_kg: 100, reps: 8, rir: 0 }]),
    ])
    expect(r.weight_kg).toBe(90)
  })

  it('se calcula sobre la última sesión entrenada, no sobre una sembrada', () => {
    // La plantilla sembró 120 kg para hoy y todavía no se entrenó (completed:
    // false): el deload tiene que partir de los 100 kg que sí se levantaron.
    const r = sugerirDeload([
      sesionConSeries('2026-08-27', [{ weight_kg: 120, reps: 8, rir: null }], false),
      sesionConSeries('2026-08-20', [{ weight_kg: 100, reps: 8, rir: 0 }]),
    ])
    expect(r.weight_kg).toBe(90)
  })

  it('devuelve null sin sesiones o sin peso', () => {
    expect(sugerirDeload([])).toBeNull()
    expect(sugerirDeload([sesionConSeries('2026-08-20', [{ weight_kg: null, reps: 20, rir: 0 }])])).toBeNull()
  })

  it('devuelve null si el peso es tan bajo que el deload no baja nada', () => {
    // 2.5 × 0.9 = 2.25 → redondeo abajo a 2.5 da 0
    expect(sugerirDeload([sesionConSeries('2026-08-20', [{ weight_kg: 2.5, reps: 8, rir: 0 }])])).toBeNull()
  })
})

describe('pesoParaSembrar', () => {
  it('usa la sugerencia cuando trae weight_kg', () => {
    const r = pesoParaSembrar({ weight_kg: 82.5, reps: 8 }, { weight_kg: 60, reps: 10 })
    expect(r).toEqual({ weight_kg: 82.5, reps: 8 })
  })

  it('cae en los defaults con accion sin_rir (weight_kg null)', () => {
    const r = pesoParaSembrar({ accion: 'sin_rir', weight_kg: null, reps: null }, { weight_kg: 60, reps: 10 })
    expect(r).toEqual({ weight_kg: 60, reps: 10 })
  })

  it('cae en los defaults sin sugerencia (ejercicio sin historial)', () => {
    const r = pesoParaSembrar(undefined, { weight_kg: 60, reps: 10 })
    expect(r).toEqual({ weight_kg: 60, reps: 10 })
  })

  it('devuelve null si tampoco hay defaults', () => {
    const r = pesoParaSembrar(undefined, undefined)
    expect(r).toEqual({ weight_kg: null, reps: null })
  })
})

describe('progresionDe', () => {
  it('compone sugerencia, estancamiento y deload desde las filas crudas', () => {
    const filas = [
      fila('2026-08-20', [{ weight_kg: 100, reps: 8, rir: 3 }]),
      fila('2026-08-13', [{ weight_kg: 100, reps: 7, rir: 1 }]),
      fila('2026-08-06', [{ weight_kg: 100, reps: 7, rir: 1 }]),
      fila('2026-07-30', [{ weight_kg: 100, reps: 9, rir: 0 }]),   // récord
    ]
    const r = progresionDe(filas)
    expect(r.sugerencia.accion).toBe('subir')
    expect(r.sugerencia.weight_kg).toBe(102.5)
    expect(r.estancamiento.estancado).toBe(true)
    expect(r.deload.weight_kg).toBe(90)
  })

  it('no calcula deload si no hay estancamiento', () => {
    const filas = [fila('2026-08-20', [{ weight_kg: 100, reps: 8, rir: 3 }])]
    const r = progresionDe(filas)
    expect(r.estancamiento.estancado).toBe(false)
    expect(r.deload).toBeNull()
  })

  it('devuelve sugerencia null para un ejercicio sin historial', () => {
    const r = progresionDe([])
    expect(r.sugerencia).toBeNull()
    expect(r.deload).toBeNull()
  })
})
