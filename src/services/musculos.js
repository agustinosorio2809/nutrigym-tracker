// Qué grupo muscular trabaja cada ejercicio. Sin secundarios: cada serie se cuenta
// una sola vez. Ver spec en docs/superpowers/specs/2026-09-08-gym-heatmap-actividad-design.md

import { normalizarNombre } from './oneRepMax'

// El orden es normativo: fija el desempate del grupo dominante de un día y el orden
// de la leyenda en la UI.
export const GRUPOS = [
  'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Core',
  'Cardio', 'Sin clasificar',
]

export const SIN_CLASIFICAR = 'Sin clasificar'

// Claves en su forma normalizada: así "Press Banca" y "press banca " caen en la misma
// entrada sin duplicar filas del mapa.
export const MAPA = {
  // Pecho
  'press banco plano (mancuernas)': 'Pecho',
  'apertura en banco plano': 'Pecho',
  'peck deck / pec fly': 'Pecho',
  'cruces en polea': 'Pecho',
  'chest press hammer': 'Pecho',
  'press banco inclinado': 'Pecho',
  'inclinado en smith': 'Pecho',
  'pectorales': 'Pecho',

  // Espalda
  'vertical trac (jalón al frente)': 'Espalda',
  'remo con barra (bent over)': 'Espalda',
  'remo a un brazo con mancuerna': 'Espalda',
  'low row (remo bajo en máquina)': 'Espalda',
  'lat con triángulo (polea baja)': 'Espalda',
  'pull over con mancuerna': 'Espalda',

  // Hombros
  'press militar con barra': 'Hombros',
  'press militar con mancuernas': 'Hombros',
  'press militar (máquina)': 'Hombros',
  'vuelo lateral con mancuerna': 'Hombros',
  'vuelos posteriores en máquina': 'Hombros',
  'vuelos frontales con polea': 'Hombros',

  // Bíceps
  'curl con barra de pie': 'Bíceps',
  'curl alternado con mancuerna': 'Bíceps',
  'curl concentrado con mancuerna': 'Bíceps',

  // Tríceps
  'press francés con barra ez': 'Tríceps',
  'extensión en polea con soga': 'Tríceps',
  'fondos en banco': 'Tríceps',

  // Piernas
  'prensa 45°': 'Piernas',
  'leg curl (femorales)': 'Piernas',
  'leg extension': 'Piernas',
  'sentadilla': 'Piernas',
  'sentadilla goblet': 'Piernas',
  'estocadas': 'Piernas',
  'gemelos': 'Piernas',
  'peso muerto rumano': 'Piernas',
  'buenos dias': 'Piernas',

  // Core
  'plancha frontal': 'Core',
  'plancha lateral alternada': 'Core',
  'plancha con toque de hombros': 'Core',
  'crunch en polea alta': 'Core',
  'crunch bicicleta': 'Core',
  'crunch abdominal': 'Core',
  'crunch inverso': 'Core',
  'abdominales cruzados': 'Core',
  'elevación de piernas en banco': 'Core',
  'extensión lumbar en banco 45°': 'Core',
  'dragon flag asistido': 'Core',
  'abwheel': 'Core',
  'mountain climbers': 'Core',

  // Cardio
  'fulbito laboral': 'Cardio',
  'caminata suave': 'Cardio',
  'movilidad': 'Cardio',
}

export function grupoDe(nombre) {
  return MAPA[normalizarNombre(nombre)] || SIN_CLASIFICAR
}
