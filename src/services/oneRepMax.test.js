import { describe, it, expect } from 'vitest'
import { estimar1RM, MAX_REPS_ESTIMABLE, mejorSerie } from './oneRepMax'

describe('estimar1RM', () => {
  it('con 1 repetición devuelve el peso exacto', () => {
    expect(estimar1RM({ weight_kg: 100, reps: 1 })).toBe(100)
  })

  it('aplica la fórmula de Epley', () => {
    // 80 × (1 + 8/30) = 101.333…
    expect(estimar1RM({ weight_kg: 80, reps: 8 })).toBeCloseTo(101.33, 2)
  })

  it('acepta el tope de 15 repeticiones', () => {
    expect(estimar1RM({ weight_kg: 100, reps: MAX_REPS_ESTIMABLE })).toBeCloseTo(150, 2)
  })

  it('devuelve null por encima del tope', () => {
    expect(estimar1RM({ weight_kg: 100, reps: 16 })).toBeNull()
  })

  it('devuelve null sin peso (futsal, cardio, peso corporal)', () => {
    expect(estimar1RM({ weight_kg: null, reps: 10 })).toBeNull()
  })

  it('devuelve null con peso 0', () => {
    expect(estimar1RM({ weight_kg: 0, reps: 10 })).toBeNull()
  })

  it('devuelve null sin repeticiones', () => {
    expect(estimar1RM({ weight_kg: 80, reps: null })).toBeNull()
  })
})

describe('mejorSerie', () => {
  it('elige por 1RM estimado, no por peso crudo', () => {
    const series = [
      { weight_kg: 90, reps: 1 },   // 1RM = 90
      { weight_kg: 80, reps: 8 },   // 1RM = 101.3 ← gana pese a pesar menos
    ]
    expect(mejorSerie(series).serie).toBe(series[1])
  })

  it('devuelve null con lista vacía', () => {
    expect(mejorSerie([])).toBeNull()
  })

  it('devuelve null si ninguna serie es estimable', () => {
    expect(mejorSerie([{ weight_kg: null, reps: 10 }])).toBeNull()
  })

  it('ignora las series no estimables y usa el resto', () => {
    const series = [
      { weight_kg: null, reps: 10 },
      { weight_kg: 60, reps: 5 },
    ]
    expect(mejorSerie(series).serie).toBe(series[1])
  })

  it('ante un empate se queda con la primera', () => {
    const series = [
      { weight_kg: 80, reps: 5 },
      { weight_kg: 80, reps: 5 },
    ]
    expect(mejorSerie(series).serie).toBe(series[0])
  })

  it('devuelve null si no recibe un array', () => {
    expect(mejorSerie(undefined)).toBeNull()
  })
})
