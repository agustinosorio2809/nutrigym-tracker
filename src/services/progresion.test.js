import { describe, it, expect } from 'vitest'
import { sesionesDeEjercicio, sugerirProximo, INCREMENTO_KG } from './progresion'

// Helper: una fila de gym_exercises con la forma que devuelve Supabase.
function fila(date, series) {
  return { exercise_name: 'Press banca', gym_sets: series, gym_logs: { date } }
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
