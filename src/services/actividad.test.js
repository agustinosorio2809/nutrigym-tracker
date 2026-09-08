import { describe, it, expect } from 'vitest'
import { actividadPorDia, volumenPorGrupo } from './actividad'

const log = (id, date, routine_type) => ({ id, date, routine_type, completed: true })
const ej = (log_id, exercise_name, series) => ({
  log_id, exercise_name, gym_sets: Array.from({ length: series }, () => ({})),
})

describe('actividadPorDia', () => {
  it('suma las series de cada grupo en un día', () => {
    const r = actividadPorDia(
      [log('l1', '2026-09-07', 'Pecho + Tríceps + Core')],
      [ej('l1', 'Press banco plano (mancuernas)', 4), ej('l1', 'Fondos en banco', 3)],
    )
    expect(r).toHaveLength(1)
    expect(r[0].totalSeries).toBe(7)
    expect(r[0].porGrupo).toEqual({ Pecho: 4, Tríceps: 3 })
    expect(r[0].dominante).toBe('Pecho')
  })

  it('incluye un día de futsal aunque no tenga ejercicios ni series', () => {
    const r = actividadPorDia([log('l1', '2026-09-08', 'Partido Futsal')], [])
    expect(r[0].totalSeries).toBe(0)
    expect(r[0].dominante).toBe('Cardio')
  })

  it('resuelve el empate por el orden de GRUPOS', () => {
    // Espalda va antes que Bíceps en GRUPOS, así que gana con la misma cantidad.
    const r = actividadPorDia(
      [log('l1', '2026-09-07', 'Espalda + Bíceps + Core')],
      [ej('l1', 'Remo con barra (bent over)', 3), ej('l1', 'Curl con barra de pie', 3)],
    )
    expect(r[0].dominante).toBe('Espalda')
  })

  it('junta dos ejercicios del mismo grupo en la misma clave', () => {
    const r = actividadPorDia(
      [log('l1', '2026-09-07', 'Pecho + Tríceps + Core')],
      [ej('l1', 'Cruces en polea', 3), ej('l1', 'Peck Deck / Pec Fly', 2)],
    )
    expect(r[0].porGrupo).toEqual({ Pecho: 5 })
  })

  it('manda a Sin clasificar un ejercicio que no está en el mapa', () => {
    const r = actividadPorDia(
      [log('l1', '2026-09-07', 'Otra')],
      [ej('l1', 'Sentadilla búlgara', 3)],
    )
    expect(r[0].porGrupo).toEqual({ 'Sin clasificar': 3 })
  })

  it('ordena de la más antigua a la más reciente', () => {
    const r = actividadPorDia(
      [log('l1', '2026-09-07', 'Cardio'), log('l2', '2026-03-24', 'Cardio')],
      [],
    )
    expect(r.map(d => d.date)).toEqual(['2026-03-24', '2026-09-07'])
  })

  it('ignora un ejercicio cuyo log no está en la lista', () => {
    const r = actividadPorDia([log('l1', '2026-09-07', 'Cardio')], [ej('l9', 'Cruces en polea', 3)])
    expect(r[0].totalSeries).toBe(0)
  })

  it('devuelve lista vacía sin logs', () => {
    expect(actividadPorDia([], [])).toEqual([])
    expect(actividadPorDia(null, null)).toEqual([])
  })
})

describe('volumenPorGrupo', () => {
  const dias = [
    { porGrupo: { Pecho: 10, Tríceps: 5 } },
    { porGrupo: { Pecho: 6, Espalda: 4 } },
  ]

  it('suma las series de todos los días y ordena de mayor a menor', () => {
    const r = volumenPorGrupo(dias)
    expect(r.map(g => g.grupo)).toEqual(['Pecho', 'Tríceps', 'Espalda'])
    expect(r[0].series).toBe(16)
  })

  it('calcula el porcentaje sobre el total', () => {
    const r = volumenPorGrupo([{ porGrupo: { Pecho: 3, Espalda: 1 } }])
    expect(r[0].porcentaje).toBe(75)
    expect(r[1].porcentaje).toBe(25)
  })

  it('deja Sin clasificar último aunque tenga más series que el resto', () => {
    const r = volumenPorGrupo([{ porGrupo: { 'Sin clasificar': 50, Pecho: 3 } }])
    expect(r.map(g => g.grupo)).toEqual(['Pecho', 'Sin clasificar'])
  })

  it('omite los grupos sin series', () => {
    const r = volumenPorGrupo([{ porGrupo: { Pecho: 3 } }])
    expect(r).toHaveLength(1)
  })

  it('devuelve lista vacía sin días o sin series', () => {
    expect(volumenPorGrupo([])).toEqual([])
    expect(volumenPorGrupo(null)).toEqual([])
    expect(volumenPorGrupo([{ porGrupo: {} }])).toEqual([])
  })
})
