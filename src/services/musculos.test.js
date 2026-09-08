import { describe, it, expect } from 'vitest'
import { GRUPOS, grupoDe } from './musculos'

describe('GRUPOS', () => {
  it('tiene los nueve grupos en el orden normativo', () => {
    expect(GRUPOS).toEqual([
      'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Core',
      'Cardio', 'Sin clasificar',
    ])
  })
})

describe('grupoDe', () => {
  it('mapea un ejercicio de la rutina a su grupo', () => {
    expect(grupoDe('Press banco plano (mancuernas)')).toBe('Pecho')
    expect(grupoDe('Vertical Trac (jalón al frente)')).toBe('Espalda')
    expect(grupoDe('Press militar con barra')).toBe('Hombros')
    expect(grupoDe('Curl con barra de pie')).toBe('Bíceps')
    expect(grupoDe('Press francés con barra EZ')).toBe('Tríceps')
    expect(grupoDe('Prensa 45°')).toBe('Piernas')
    expect(grupoDe('Plancha frontal')).toBe('Core')
    expect(grupoDe('Fulbito laboral')).toBe('Cardio')
  })

  it('devuelve Sin clasificar para un ejercicio desconocido', () => {
    expect(grupoDe('Sentadilla búlgara')).toBe('Sin clasificar')
  })

  it('resuelve dos grafías del mismo ejercicio al mismo grupo', () => {
    expect(grupoDe('  PRESS   Banco Plano (Mancuernas) ')).toBe('Pecho')
  })

  it('devuelve Sin clasificar ante un nombre vacío o no string', () => {
    expect(grupoDe('')).toBe('Sin clasificar')
    expect(grupoDe(null)).toBe('Sin clasificar')
  })
})
