import { describe, it, expect } from 'vitest'
import { sesionesDeEjercicio } from './progresion'

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
