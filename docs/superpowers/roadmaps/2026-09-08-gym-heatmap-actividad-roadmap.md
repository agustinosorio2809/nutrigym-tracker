# ROADMAP — Heatmap de actividad y mapa muscular

> **Para quien ejecute esto:** los bullets usan checkbox (`- [ ]`) para ir marcando avance.
> Ningún bullet se marca completo sin correr su verificación. La suite entera (`npm test`)
> corre antes de cada commit. Los pasos que no se pueden testear automáticamente traen su
> verificación manual explícita, con el resultado esperado escrito.

**Objetivo:** que el Dashboard responda dos preguntas que hoy no responde — si el
entrenamiento viene siendo constante, y qué grupos musculares están recibiendo el volumen.

**Arquitectura:** dos servicios puros nuevos (`musculos.js`, `actividad.js`) sin Supabase
ni React, testeados con Vitest. `actividad.js` importa `grupoDe()` de `musculos.js`, nunca
al revés. `Dashboard.jsx` hace el I/O y le pasa datos ya cargados. Los componentes de
presentación viven en `src/components/actividad.jsx`. **Sin cambios de base de datos.**

**Stack:** React 19, Vite 8, Supabase (PostgreSQL + RLS), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-gym-heatmap-actividad-design.md`

**Roadmap anterior (completo):** `docs/superpowers/roadmaps/2026-08-26-gym-motor-progresion-roadmap.md`

---

## Restricciones globales

- **Estilos 100% inline.** Sin Tailwind, sin CSS modules, sin styled-components. Todo en
  `style={{}}`, usando los tokens de `src/theme.js`.
- **Sin dependencias nuevas.** Ni de UI ni de otro tipo: este roadmap no instala nada.
  El calendario se dibuja con CSS grid inline, no con una librería.
- **Íconos** desde `src/components/icons.jsx` (SVG, `viewBox` 24×24, `strokeWidth` 2,
  round caps). Nunca emoji como ícono funcional.
- **Hover / focus / active** vía `useInteractiveStyle` de `src/hooks/useInteractiveStyle.js`.
- **Breakpoint mobile:** `window.innerWidth < 640`.
- **No se toca la base de datos.** Ninguna tarea de este roadmap escribe SQL ni agrega
  migraciones.
- **Nombres de función y variable en español**; tablas y columnas de Supabase en inglés.
- **Comentarios solo para explicar un porqué no obvio.** Nunca el qué.
- **Commits convencionales** vía CLI (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`).
- **`npm test && npm run lint` antes de cada commit.** El lint tiene que quedar en
  **0 errores** — se limpió el 2026-08-26. Los 7 warnings de `react-hooks/exhaustive-deps`
  son preexistentes y se toleran; no sumar errores nuevos ni warnings nuevos.
- **El color nunca es el único portador de información.** Toda celda coloreada lleva
  además texto, y la leyenda está siempre visible.

---

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/services/musculos.js` | **Crear.** Identidad: qué grupo trabaja cada ejercicio y cada tipo de rutina. Puro. | 1-2 |
| `src/services/musculos.test.js` | **Crear.** Tests del mapa. | 1-2 |
| `src/services/actividad.js` | **Crear.** Agregación temporal: días, volumen, intensidad, rachas. Puro. | 3-6 |
| `src/services/actividad.test.js` | **Crear.** Tests de la agregación. | 3-6 |
| `design.md` | **Modificar.** Sección de color categórico. | 7 |
| `src/theme.js` | **Modificar.** Tokens `GRUPO_COLORS` y `INTENSIDAD`. | 7 |
| `src/components/actividad.jsx` | **Crear.** Componentes de presentación de la vista. | 9-11 |
| `src/pages/Dashboard.jsx` | **Modificar.** Pestaña nueva, queries, composición. | 8-11 |
| `CLAUDE.md`, `README.md`, `DECISIONS.md` | **Modificar.** Documentación y decisiones. | 12 |

`actividad.js` importa de `musculos.js`. `musculos.js` importa `normalizarNombre` de
`oneRepMax.js`. Ninguna dependencia va en sentido contrario.

---

## Orden

Las tareas 1-6 son lógica pura: no tocan la UI ni la base, y se pueden hacer sin riesgo ni
verificación manual. La 7 es el sistema de diseño y habilita las siguientes. Las 8-11 son
la UI y cada una trae su verificación manual en el navegador. La 12 cierra.

---

## Tarea 1 — `musculos.js`: grupos y mapa de ejercicios

**Archivos:**
- Crear: `src/services/musculos.js`
- Crear: `src/services/musculos.test.js`

**Interfaces:**
- Consume: `normalizarNombre(nombre)` de `src/services/oneRepMax.js`.
- Produce: `GRUPOS` (array de 9 strings), `MAPA` (objeto), `grupoDe(nombre) -> string`.

- [ ] **Paso 1: Escribir los tests que fallan**

```js
// src/services/musculos.test.js
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
```

- [ ] **Paso 2: Correr los tests y verificar que fallan**

Correr: `npx vitest run src/services/musculos.test.js`
Esperado: FAIL con `Failed to resolve import "./musculos"`.

- [ ] **Paso 3: Escribir la implementación mínima**

```js
// src/services/musculos.js
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
```

- [ ] **Paso 4: Correr los tests y verificar que pasan**

Correr: `npx vitest run src/services/musculos.test.js`
Esperado: PASS, 4 tests.

- [ ] **Paso 5: Correr la suite entera y el lint**

Correr: `npm test && npm run lint`
Esperado: todos los tests en verde, `0 errors` en el lint.

- [ ] **Paso 6: Commit**

```bash
git add src/services/musculos.js src/services/musculos.test.js
git commit -m "feat: mapa de ejercicios a grupos musculares"
```

> **Nota para quien ejecute:** `Dorsalera (Pecho)` queda deliberadamente fuera del mapa.
> El nombre se contradice (una dorsalera trabaja espalda) y el usuario pidió no tocarlo,
> así que cae en `Sin clasificar`, que es la señal correcta. No inventar un grupo.

---

## Tarea 2 — `musculos.js`: grupo del tipo de rutina

Un día de futsal o cardio no tiene ejercicios ni series, así que su grupo no se puede
derivar del volumen: sale del `routine_type`.

**Archivos:**
- Modificar: `src/services/musculos.js`
- Modificar: `src/services/musculos.test.js`

**Interfaces:**
- Produce: `grupoDeRutina(routineType) -> string`.

- [ ] **Paso 1: Escribir los tests que fallan**

```js
// agregar en src/services/musculos.test.js, y sumar grupoDeRutina al import
describe('grupoDeRutina', () => {
  it('mapea futsal y cardio al grupo Cardio', () => {
    expect(grupoDeRutina('Partido Futsal')).toBe('Cardio')
    expect(grupoDeRutina('Cardio')).toBe('Cardio')
  })

  it('manda a Sin clasificar los tipos sin grupo definido', () => {
    expect(grupoDeRutina('Otra')).toBe('Sin clasificar')
    expect(grupoDeRutina('')).toBe('Sin clasificar')
    expect(grupoDeRutina(null)).toBe('Sin clasificar')
  })

  it('manda a Sin clasificar una rutina de gimnasio, que debería traer series', () => {
    expect(grupoDeRutina('Pecho + Tríceps + Core')).toBe('Sin clasificar')
  })
})
```

- [ ] **Paso 2: Correr los tests y verificar que fallan**

Correr: `npx vitest run src/services/musculos.test.js`
Esperado: FAIL con `grupoDeRutina is not a function`.

- [ ] **Paso 3: Escribir la implementación mínima**

```js
// agregar en src/services/musculos.js
const RUTINAS_SIN_SERIES = {
  'partido futsal': 'Cardio',
  'cardio': 'Cardio',
}

// Solo para dias sin ninguna serie cargada. Una rutina de gimnasio que llegue acá se
// marco como completada sin cargar nada: Sin clasificar es la lectura correcta, no un
// grupo inventado.
export function grupoDeRutina(routineType) {
  return RUTINAS_SIN_SERIES[normalizarNombre(routineType)] || SIN_CLASIFICAR
}
```

- [ ] **Paso 4: Correr los tests y verificar que pasan**

Correr: `npx vitest run src/services/musculos.test.js`
Esperado: PASS, 7 tests.

- [ ] **Paso 5: Correr la suite entera y el lint**

Correr: `npm test && npm run lint`
Esperado: verde, `0 errors`.

- [ ] **Paso 6: Commit**

```bash
git add src/services/musculos.js src/services/musculos.test.js
git commit -m "feat: grupo muscular derivado del tipo de rutina"
```

---

## Tarea 3 — `actividad.js`: actividad por día

**Archivos:**
- Crear: `src/services/actividad.js`
- Crear: `src/services/actividad.test.js`

**Interfaces:**
- Consume: `grupoDe`, `grupoDeRutina`, `GRUPOS` de `musculos.js`.
- Produce: `actividadPorDia(logs, ejercicios) -> [{ date, totalSeries, porGrupo, dominante, tipo }]`,
  ordenado ascendente por fecha.
  - `logs`: `[{ id, date, routine_type, completed }]` — se asume ya filtrado a `completed: true`.
  - `ejercicios`: `[{ exercise_name, log_id, gym_sets: [...] }]`.
  - `porGrupo`: objeto `{ [grupo]: cantidadDeSeries }`, solo con los grupos presentes.

- [ ] **Paso 1: Escribir los tests que fallan**

```js
// src/services/actividad.test.js
import { describe, it, expect } from 'vitest'
import { actividadPorDia } from './actividad'

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
```

- [ ] **Paso 2: Correr los tests y verificar que fallan**

Correr: `npx vitest run src/services/actividad.test.js`
Esperado: FAIL con `Failed to resolve import "./actividad"`.

- [ ] **Paso 3: Escribir la implementación mínima**

```js
// src/services/actividad.js
// Agregación temporal de la actividad de gimnasio: qué se entrenó cada día, cuánto
// volumen recibió cada grupo, y con qué constancia.
// Ver spec en docs/superpowers/specs/2026-09-08-gym-heatmap-actividad-design.md

import { GRUPOS, grupoDe, grupoDeRutina } from './musculos'

// Las fechas vienen como 'YYYY-MM-DD', así que el orden lexicográfico es el cronológico.
export function actividadPorDia(logs, ejercicios) {
  if (!Array.isArray(logs)) return []

  const porLog = new Map()
  for (const l of logs) porLog.set(l.id, { date: l.date, tipo: l.routine_type, porGrupo: {} })

  for (const e of (ejercicios || [])) {
    const dia = porLog.get(e.log_id)
    // Un ejercicio cuyo log no vino en esta página de resultados no se cuenta: sin la
    // fecha del log no hay dónde ubicarlo.
    if (!dia) continue
    const series = (e.gym_sets || []).length
    if (!series) continue
    const grupo = grupoDe(e.exercise_name)
    dia.porGrupo[grupo] = (dia.porGrupo[grupo] || 0) + series
  }

  const porFecha = new Map()
  for (const { date, tipo, porGrupo } of porLog.values()) {
    if (!date) continue
    const acumulado = porFecha.get(date) || { date, tipo, porGrupo: {} }
    for (const [grupo, series] of Object.entries(porGrupo)) {
      acumulado.porGrupo[grupo] = (acumulado.porGrupo[grupo] || 0) + series
    }
    porFecha.set(date, acumulado)
  }

  return [...porFecha.values()]
    .map(({ date, tipo, porGrupo }) => ({
      date,
      tipo,
      porGrupo,
      totalSeries: Object.values(porGrupo).reduce((a, b) => a + b, 0),
      dominante: dominanteDe(porGrupo, tipo),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

// Ante empate gana el grupo que aparece primero en GRUPOS: arbitrario pero determinista,
// igual que el criterio de mejorSerie() del Spec 1.
function dominanteDe(porGrupo, tipo) {
  let dominante = null
  let max = 0
  for (const grupo of GRUPOS) {
    const series = porGrupo[grupo] || 0
    if (series > max) { dominante = grupo; max = series }
  }
  // Sin series el día existe igual (futsal, cardio) y su grupo sale del tipo de rutina.
  return dominante || grupoDeRutina(tipo)
}
```

- [ ] **Paso 4: Correr los tests y verificar que pasan**

Correr: `npx vitest run src/services/actividad.test.js`
Esperado: PASS, 8 tests.

- [ ] **Paso 5: Correr la suite entera y el lint**

Correr: `npm test && npm run lint`
Esperado: verde, `0 errors`.

- [ ] **Paso 6: Commit**

```bash
git add src/services/actividad.js src/services/actividad.test.js
git commit -m "feat: agregacion de actividad por dia y grupo muscular"
```

---

## Tarea 4 — `actividad.js`: volumen por grupo

**Archivos:**
- Modificar: `src/services/actividad.js`
- Modificar: `src/services/actividad.test.js`

**Interfaces:**
- Consume: la salida de `actividadPorDia`.
- Produce: `volumenPorGrupo(dias) -> [{ grupo, series, porcentaje }]`, orden descendente
  por series, con `'Sin clasificar'` siempre último. `porcentaje` es 0-100 redondeado.

- [ ] **Paso 1: Escribir los tests que fallan**

```js
// agregar en src/services/actividad.test.js, sumando volumenPorGrupo al import
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
```

- [ ] **Paso 2: Correr los tests y verificar que fallan**

Correr: `npx vitest run src/services/actividad.test.js`
Esperado: FAIL con `volumenPorGrupo is not a function`.

- [ ] **Paso 3: Escribir la implementación mínima**

```js
// agregar en src/services/actividad.js
import { GRUPOS, SIN_CLASIFICAR, grupoDe, grupoDeRutina } from './musculos'
// (reemplazar el import anterior por este)

export function volumenPorGrupo(dias) {
  const total = {}
  for (const dia of (dias || [])) {
    for (const [grupo, series] of Object.entries(dia?.porGrupo || {})) {
      total[grupo] = (total[grupo] || 0) + series
    }
  }

  const suma = Object.values(total).reduce((a, b) => a + b, 0)
  if (!suma) return []

  return Object.entries(total)
    .map(([grupo, series]) => ({ grupo, series, porcentaje: Math.round((series / suma) * 100) }))
    // Sin clasificar va último aunque tenga más volumen: no es un grupo muscular con el
    // que comparar, es una tarea pendiente de mapeo.
    .sort((a, b) => {
      if (a.grupo === SIN_CLASIFICAR) return 1
      if (b.grupo === SIN_CLASIFICAR) return -1
      return b.series - a.series
    })
}
```

- [ ] **Paso 4: Correr los tests y verificar que pasan**

Correr: `npx vitest run src/services/actividad.test.js`
Esperado: PASS, 13 tests.

- [ ] **Paso 5: Correr la suite entera y el lint**

Correr: `npm test && npm run lint`
Esperado: verde, `0 errors`.

- [ ] **Paso 6: Commit**

```bash
git add src/services/actividad.js src/services/actividad.test.js
git commit -m "feat: volumen por grupo muscular"
```

---

## Tarea 5 — `actividad.js`: nivel de intensidad

**Archivos:**
- Modificar: `src/services/actividad.js`
- Modificar: `src/services/actividad.test.js`

**Interfaces:**
- Produce: `nivelDeIntensidad(series, referencia) -> 0 | 1 | 2 | 3 | 4` y la constante
  `NIVEL_SIN_SERIES = 2`.
  - `referencia` es el volumen máximo del período visible.

- [ ] **Paso 1: Escribir los tests que fallan**

```js
// agregar en src/services/actividad.test.js, sumando nivelDeIntensidad y NIVEL_SIN_SERIES
describe('nivelDeIntensidad', () => {
  it('devuelve 0 sin actividad', () => {
    expect(nivelDeIntensidad(0, 20)).toBe(0)
  })

  it('devuelve 4 en el máximo del período', () => {
    expect(nivelDeIntensidad(20, 20)).toBe(4)
  })

  it('reparte los intermedios en cuartiles', () => {
    expect(nivelDeIntensidad(5, 20)).toBe(1)
    expect(nivelDeIntensidad(10, 20)).toBe(2)
    expect(nivelDeIntensidad(15, 20)).toBe(3)
  })

  it('devuelve 1 para cualquier volumen mínimo, nunca 0', () => {
    // Una serie sola es actividad: no puede pintarse igual que un día sin entrenar.
    expect(nivelDeIntensidad(1, 100)).toBe(1)
  })

  it('devuelve el nivel fijo cuando hubo sesión pero no series', () => {
    // "Jugué al futsal" no tiene grados.
    expect(NIVEL_SIN_SERIES).toBe(2)
  })

  it('no explota si la referencia es 0', () => {
    expect(nivelDeIntensidad(0, 0)).toBe(0)
  })
})
```

- [ ] **Paso 2: Correr los tests y verificar que fallan**

Correr: `npx vitest run src/services/actividad.test.js`
Esperado: FAIL con `nivelDeIntensidad is not a function`.

- [ ] **Paso 3: Escribir la implementación mínima**

```js
// agregar en src/services/actividad.js

// Un día con sesión válida pero sin series (futsal, cardio) toma un nivel fijo
// intermedio: dejarlo en el más bajo lo haría parecer un día flojo, y no lo es.
export const NIVEL_SIN_SERIES = 2

// La escala es relativa al período visible y no absoluta: con umbrales fijos, un mes de
// bajo volumen se veria uniformemente pálido y no se distinguiría "entrené poco" de
// "la escala está mal calibrada".
export function nivelDeIntensidad(series, referencia) {
  if (!series || series <= 0) return 0
  if (!referencia || referencia <= 0) return 0
  const proporcion = series / referencia
  if (proporcion > 0.75) return 4
  if (proporcion > 0.5) return 3
  if (proporcion > 0.25) return 2
  return 1
}
```

- [ ] **Paso 4: Correr los tests y verificar que pasan**

Correr: `npx vitest run src/services/actividad.test.js`
Esperado: PASS, 19 tests.

- [ ] **Paso 5: Correr la suite entera y el lint**

Correr: `npm test && npm run lint`
Esperado: verde, `0 errors`.

- [ ] **Paso 6: Commit**

```bash
git add src/services/actividad.js src/services/actividad.test.js
git commit -m "feat: escala de intensidad relativa al periodo"
```

---

## Tarea 6 — `actividad.js`: rachas semanales

**Archivos:**
- Modificar: `src/services/actividad.js`
- Modificar: `src/services/actividad.test.js`

**Interfaces:**
- Produce: `rachas(dias, diasEntreno, hoy) -> { actual, maxima }`.
  - `diasEntreno`: número de sesiones que hacen que una semana cuente como cumplida.
  - `hoy`: string `'YYYY-MM-DD'`. Parámetro explícito para que el test sea determinista.
- Produce también: `lunesDe(fecha) -> 'YYYY-MM-DD'`.

- [ ] **Paso 1: Escribir los tests que fallan**

```js
// agregar en src/services/actividad.test.js, sumando rachas al import
describe('rachas', () => {
  // Semanas de lunes a domingo. 2026-09-07 es lunes.
  const dia = date => ({ date })

  it('cuenta como cumplida la semana que alcanza dias_entreno', () => {
    const dias = [dia('2026-08-31'), dia('2026-09-02'), dia('2026-09-04')]
    expect(rachas(dias, 3, '2026-09-10').actual).toBe(1)
  })

  it('no cuenta la semana que no llega al mínimo', () => {
    const dias = [dia('2026-08-31'), dia('2026-09-02')]
    expect(rachas(dias, 3, '2026-09-10').actual).toBe(0)
  })

  it('la semana en curso no corta la racha aunque esté incompleta', () => {
    // Semana pasada completa; la actual (del 7) tiene una sola sesión y todavía corre.
    const dias = [
      dia('2026-08-31'), dia('2026-09-02'), dia('2026-09-04'),
      dia('2026-09-07'),
    ]
    expect(rachas(dias, 3, '2026-09-08').actual).toBe(1)
  })

  it('una semana floja corta la racha', () => {
    const dias = [
      dia('2026-08-17'), dia('2026-08-19'), dia('2026-08-21'),
      dia('2026-08-24'),
      dia('2026-08-31'), dia('2026-09-02'), dia('2026-09-04'),
    ]
    expect(rachas(dias, 3, '2026-09-10').actual).toBe(1)
  })

  it('la racha máxima mira todo el historial, no solo el final', () => {
    const dias = [
      dia('2026-08-03'), dia('2026-08-05'), dia('2026-08-07'),
      dia('2026-08-10'), dia('2026-08-12'), dia('2026-08-14'),
      dia('2026-08-24'),
    ]
    expect(rachas(dias, 3, '2026-09-10').maxima).toBe(2)
  })

  it('devuelve ceros sin días', () => {
    expect(rachas([], 3, '2026-09-10')).toEqual({ actual: 0, maxima: 0 })
    expect(rachas(null, 3, '2026-09-10')).toEqual({ actual: 0, maxima: 0 })
  })
})

describe('lunesDe', () => {
  it('devuelve el lunes de la semana de una fecha', () => {
    expect(lunesDe('2026-09-10')).toBe('2026-09-07')
    expect(lunesDe('2026-09-07')).toBe('2026-09-07')
  })

  it('trata el domingo como fin de esa semana, no como inicio de la siguiente', () => {
    expect(lunesDe('2026-09-13')).toBe('2026-09-07')
  })
})
```

- [ ] **Paso 2: Correr los tests y verificar que fallan**

Correr: `npx vitest run src/services/actividad.test.js`
Esperado: FAIL con `rachas is not a function`.

- [ ] **Paso 3: Escribir la implementación mínima**

```js
// agregar en src/services/actividad.js

const MS_POR_DIA = 86400000

// Las semanas arrancan el lunes, igual que week_start en meal_plans. Se usa mediodía UTC
// para que el cambio de huso horario no corra la fecha un día.
export function lunesDe(fecha) {
  const d = new Date(fecha + 'T12:00:00Z')
  const diaSemana = (d.getUTCDay() + 6) % 7   // 0 = lunes
  return new Date(d.getTime() - diaSemana * MS_POR_DIA).toISOString().slice(0, 10)
}

// Las rachas se miden en semanas y no en días: con una rutina de 3 días, una racha de
// días calendario consecutivos se cortaría cada martes y no significaría nada.
export function rachas(dias, diasEntreno, hoy) {
  if (!Array.isArray(dias) || !dias.length) return { actual: 0, maxima: 0 }

  const porSemana = new Map()
  for (const d of dias) {
    const semana = lunesDe(d.date)
    porSemana.set(semana, (porSemana.get(semana) || 0) + 1)
  }

  const semanaActual = lunesDe(hoy)
  const semanas = [...porSemana.keys()].sort()
  const primera = semanas[0]

  // Se recorre semana a semana incluyendo las vacías, que son las que cortan la racha.
  const cumplidas = []
  for (let s = primera; s < semanaActual; s = siguienteSemana(s)) {
    cumplidas.push((porSemana.get(s) || 0) >= diasEntreno)
  }

  let maxima = 0
  let corriendo = 0
  for (const cumple of cumplidas) {
    corriendo = cumple ? corriendo + 1 : 0
    if (corriendo > maxima) maxima = corriendo
  }

  // La semana en curso no se evalúa: todavía faltan días para completarla.
  let actual = 0
  for (let i = cumplidas.length - 1; i >= 0 && cumplidas[i]; i--) actual++

  return { actual, maxima }
}

function siguienteSemana(lunes) {
  return new Date(new Date(lunes + 'T12:00:00Z').getTime() + 7 * MS_POR_DIA)
    .toISOString().slice(0, 10)
}
```

- [ ] **Paso 4: Correr los tests y verificar que pasan**

Correr: `npx vitest run src/services/actividad.test.js`
Esperado: PASS, 27 tests.

- [ ] **Paso 5: Correr la suite entera y el lint**

Correr: `npm test && npm run lint`
Esperado: verde, `0 errors`.

- [ ] **Paso 6: Commit**

```bash
git add src/services/actividad.js src/services/actividad.test.js
git commit -m "feat: rachas semanales de entrenamiento"
```

---

## Tarea 7 — Paleta categórica en `design.md` y `theme.js`

**Archivos:**
- Modificar: `design.md`
- Modificar: `src/theme.js`

**Interfaces:**
- Produce: `GRUPO_COLORS` (objeto grupo → hex) y `INTENSIDAD` (array de 5 hex) en
  `src/theme.js`.

- [ ] **Paso 1: Agregar los tokens a `src/theme.js`**

```js
// agregar en src/theme.js, después de C

// Paleta categórica para los grupos musculares. Luminosidad pareja para que ninguno
// domine, y deliberadamente fuera de los colores con significado de estado: ningún grupo
// usa el rojo (error) ni el amarillo (pendiente). Cardio y Sin clasificar van en neutros
// porque no son grupos musculares con los que comparar volumen.
export const GRUPO_COLORS = {
  'Pecho': '#F472B6',
  'Espalda': '#38BDF8',
  'Hombros': '#A78BFA',
  'Bíceps': '#2DD4BF',
  'Tríceps': '#FB923C',
  'Piernas': '#818CF8',
  'Core': '#34D399',
  'Cardio': '#64748B',
  'Sin clasificar': '#3F4453',
}

// Cinco niveles del verde de marca para la tira anual. El 0 es "sin actividad" y tiene
// que leerse como fondo, no como un valor bajo.
export const INTENSIDAD = ['#1A1D27', '#0E4437', '#12684F', '#10B981', '#5EEAD4']
```

- [ ] **Paso 2: Verificar que el bundle sigue compilando**

Correr: `npm run build`
Esperado: `built in ...` sin errores.

- [ ] **Paso 3: Documentar la paleta en `design.md`**

Agregar una sección después de `## Paleta`:

```markdown
## Color categórico (grupos musculares)

La paleta de § Paleta es de **marca y estado**: un solo acento, más rojo/amarillo/azul con
significado fijo. El heatmap de actividad necesita distinguir nueve categorías que no son
estados, así que se agrega una escala categórica separada, en `src/theme.js` como
`GRUPO_COLORS`.

Reglas:

- **Ningún grupo usa el rojo ni el amarillo.** Están tomados por error y pendiente; un
  grupo muscular pintado de rojo se lee como un problema.
- **Luminosidad pareja** entre los nueve, para que ninguno domine la grilla por brillo.
- **`Cardio` y `Sin clasificar` van en neutros fríos**: no son grupos musculares y no
  deberían competir visualmente con los que sí.
- **El color nunca es el único portador de información.** Nueve tonos en celdas chicas no
  son distinguibles con certeza para nadie, y menos con daltonismo. Toda celda coloreada
  lleva su número de día, la leyenda está siempre visible, y el detalle del día se lee
  escrito en el panel.

La tira anual **no** usa esta paleta: es monocroma sobre el verde de marca (`INTENSIDAD`,
5 niveles), porque responde una pregunta distinta — constancia, no composición.
```

- [ ] **Paso 4: Verificación manual del contraste**

Abrir `design.md` y confirmar contra la tabla de § Paleta que ninguno de los nueve valores
de `GRUPO_COLORS` coincide con `red` (`#EF4444`) ni con `yellow` (`#F59E0B`).
Esperado: ninguna coincidencia.

- [ ] **Paso 5: Correr la suite entera y el lint**

Correr: `npm test && npm run lint`
Esperado: verde, `0 errors`.

- [ ] **Paso 6: Commit**

```bash
git add src/theme.js design.md
git commit -m "feat: paleta categorica para los grupos musculares"
```

---

## Tarea 8 — Pestaña Actividad y carga de datos

**Archivos:**
- Modificar: `src/pages/Dashboard.jsx`

**Interfaces:**
- Consume: `actividadPorDia`, `volumenPorGrupo`, `rachas` de `actividad.js`.
- Produce: estado `actividad` (array de días) y `reporteVista === 'actividad'`.

- [ ] **Paso 1: Agregar la pestaña y el estado**

En `Dashboard.jsx`, sumar `'actividad'` a las opciones de `reporteVista` (donde ya están
`'adherencia'`, `'viandas'` y `'cargas'`), con la etiqueta `Actividad`. Agregar:

```js
const [actividad, setActividad] = useState([])
const [mesActividad, setMesActividad] = useState(() => new Date().toISOString().slice(0, 7))
const [diaSeleccionado, setDiaSeleccionado] = useState(null)
const [diasEntreno, setDiasEntreno] = useState(3)
```

`Dashboard.jsx` **no carga el perfil hoy** — verificado el 2026-09-08, no hay ninguna
referencia a `user_profile` en el archivo. Hay que traer `dias_entreno` explícitamente en
la carga de la Tarea 8; el default de 3 cubre el caso de un perfil sin ese campo.

- [ ] **Paso 2: Agregar la carga de datos**

```js
async function cargarActividad() {
  const desde = new Date()
  desde.setFullYear(desde.getFullYear() - 1)
  const desdeStr = desde.toISOString().slice(0, 10)

  // completed = true: cargarPlantilla() escribe series con rir null, así que una plantilla
  // cargada y no entrenada pintaría el día como entrenado e inflaría la racha.
  const { data: logs } = await supabase
    .from('gym_logs')
    .select('id, date, routine_type, completed')
    .eq('user_id', session.user.id)
    .eq('completed', true)
    .gte('date', desdeStr)
    .order('date')
  if (!logs?.length) { setActividad([]); return }

  // El rango va en la query y no en memoria: PostgREST corta en 1000 filas sin avisar, y
  // el síntoma sería un calendario al que le faltan días en silencio.
  const { data: ejs } = await supabase
    .from('gym_exercises')
    .select('exercise_name, log_id, gym_sets(id)')
    .in('log_id', logs.map(l => l.id))

  const { data: perfil } = await supabase
    .from('user_profile')
    .select('dias_entreno')
    .eq('user_id', session.user.id)
    .single()
  if (perfil?.dias_entreno) setDiasEntreno(perfil.dias_entreno)

  setActividad(actividadPorDia(logs, ejs || []))
}
```

Y disparar la carga:

```js
useEffect(() => { if (reporteVista === 'actividad') cargarActividad() }, [reporteVista])
```

- [ ] **Paso 3: Renderizar el resumen**

```jsx
{reporteVista === 'actividad' && (
  actividad.length === 0 ? (
    <div style={{ color: C.textMuted, textAlign: 'center', padding: '2rem' }}>
      No hay sesiones completadas en el último año.
    </div>
  ) : (
    <div>
      <ResumenActividad
        sesiones={actividad.length}
        rachas={rachas(actividad, diasEntreno, new Date().toISOString().slice(0, 10))}
      />
    </div>
  )
)}
```

`ResumenActividad` se crea en la Tarea 9 junto al resto de los componentes. Para este paso,
definirlo provisionalmente al final de `Dashboard.jsx` mostrando los tres números como
stats tipográficos (número grande peso 800, label chico en `C.textMuted`, `border-top`
fino), sin card ni borde — tratamiento nº 2 de `design.md`.

- [ ] **Paso 4: Correr la suite entera y el lint**

Correr: `npm test && npm run lint`
Esperado: verde, `0 errors`. Los tests no cubren esto: la verificación es el paso 5.

- [ ] **Paso 5: Verificación manual en el navegador**

1. `npm run dev` y abrir `http://localhost:5173`.
2. Ir a **Reportes → Actividad**.
3. Esperado: aparece la pestaña y se ven tres números. **Sesiones = 39**, que es el conteo
   de `gym_logs` con `completed = true` verificado el 2026-09-08 después de recuperar las
   14 sesiones que estaban sin marcar (ver `DECISIONS.md`). Las 5 que siguen en `false`
   son sesiones vacías y una carga duplicada, y no deben aparecer.
4. Abrir la consola del navegador. Esperado: **sin errores**.
5. En la pestaña Network, buscar la request a `gym_exercises`. Esperado: trae menos de
   1000 filas.

- [ ] **Paso 6: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: pestana Actividad con resumen y rachas"
```

---

## Tarea 9 — Tira anual

**Archivos:**
- Crear: `src/components/actividad.jsx`
- Modificar: `src/pages/Dashboard.jsx`

**Interfaces:**
- Consume: `INTENSIDAD` de `theme.js`, `nivelDeIntensidad` y `NIVEL_SIN_SERIES` de
  `actividad.js`.
- Produce: `<TiraAnual dias mesSeleccionado onSeleccionarMes />` y `<ResumenActividad sesiones rachas />`.

- [ ] **Paso 1: Crear `src/components/actividad.jsx` con `ResumenActividad` y `TiraAnual`**

`ResumenActividad` se mueve acá desde `Dashboard.jsx` (patrón del repo: cuando una página
pasa de ~500 líneas, sus componentes de presentación se van a `src/components/<pagina>.jsx`;
`Dashboard.jsx` ya supera las 600). Borrar la definición provisional que la Tarea 8 dejó al
final de `Dashboard.jsx` y agregar el import.

```jsx
// src/components/actividad.jsx
// Componentes de presentación de la vista Actividad del Dashboard.

import { useEffect, useRef } from 'react'
import { C, INTENSIDAD } from '../theme'
import { nivelDeIntensidad, NIVEL_SIN_SERIES, lunesDe } from '../services/actividad'

const MS_POR_DIA = 86400000

// Stat tipográfico: número grande + label + regla fina, sin card ni borde.
// Tratamiento nº 2 de design.md.
function Stat({ valor, label }) {
  return (
    <div style={{ flex: 1, minWidth: '90px', borderTop: `1px solid ${C.border}`, paddingTop: '10px' }}>
      <div style={{
        fontSize: '1.75rem', fontWeight: 800, color: C.textPrimary,
        letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
      }}>{valor}</div>
      <div style={{
        fontSize: '11px', fontWeight: 600, color: C.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px',
      }}>{label}</div>
    </div>
  )
}

export function ResumenActividad({ sesiones, rachas }) {
  return (
    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
      <Stat valor={sesiones} label="Sesiones" />
      <Stat valor={rachas.actual} label="Racha actual" />
      <Stat valor={rachas.maxima} label="Racha máxima" />
    </div>
  )
}

const CELDA = 11
const GAP = 3

// 53 columnas no entran en un teléfono: el contenedor scrollea solo, el body nunca.
export function TiraAnual({ dias, onSeleccionarMes }) {
  const scroller = useRef(null)

  useEffect(() => {
    // Arranca a la derecha: la semana actual es la que interesa al abrir.
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
  }, [])

  const porFecha = new Map(dias.map(d => [d.date, d]))
  const maximo = Math.max(1, ...dias.map(d => d.totalSeries))

  const hoy = new Date()
  const finSemana = lunesDe(hoy.toISOString().slice(0, 10))
  const inicio = new Date(new Date(finSemana + 'T12:00:00Z').getTime() - 52 * 7 * MS_POR_DIA)

  const celdas = []
  for (let i = 0; i < 53 * 7; i++) {
    const fecha = new Date(inicio.getTime() + i * MS_POR_DIA)
    const iso = fecha.toISOString().slice(0, 10)
    const dia = porFecha.get(iso)
    const nivel = !dia ? 0
      : dia.totalSeries > 0 ? nivelDeIntensidad(dia.totalSeries, maximo)
      : NIVEL_SIN_SERIES
    celdas.push({ iso, dia, nivel })
  }

  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <div style={{
        fontSize: '11px', fontWeight: 600, color: C.textMuted, marginBottom: '8px',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>Último año</div>

      <div ref={scroller} style={{ overflowX: 'auto', paddingBottom: '4px' }}>
        <div style={{
          display: 'grid',
          gridTemplateRows: `repeat(7, ${CELDA}px)`,
          gridAutoFlow: 'column',
          gridAutoColumns: `${CELDA}px`,
          gap: `${GAP}px`,
          width: 'max-content',
        }}>
          {celdas.map(({ iso, dia, nivel }) => (
            <div
              key={iso}
              onClick={() => dia && onSeleccionarMes(iso.slice(0, 7))}
              // El dato viaja como texto y no solo como color.
              title={dia ? `${iso} — ${dia.totalSeries} series` : iso}
              style={{
                background: INTENSIDAD[nivel],
                borderRadius: '2px',
                cursor: dia ? 'pointer' : 'default',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Paso 2: Verificación manual en el navegador**

1. `npm run dev`, ir a **Reportes → Actividad**.
2. Esperado: una tira de 53 columnas × 7 filas. Los días con sesión se ven verdes en
   distintas intensidades; el resto, del color del fondo de superficie.
3. Pasar el mouse sobre una celda verde. Esperado: el tooltip muestra fecha y series.
4. Achicar la ventana a menos de 640px. Esperado: la tira scrollea horizontalmente
   **dentro de su contenedor**, arrancando a la derecha, y la página **no** scrollea de
   costado.
5. Contar a ojo los días verdes. Esperado: 39, repartidos entre marzo y septiembre de 2026.

- [ ] **Paso 3: Correr la suite entera y el lint**

Correr: `npm test && npm run lint`
Esperado: verde, `0 errors`.

- [ ] **Paso 4: Commit**

```bash
git add src/components/actividad.jsx src/pages/Dashboard.jsx
git commit -m "feat: tira anual de actividad"
```

---

## Tarea 10 — Mes en detalle y panel del día

**Archivos:**
- Modificar: `src/components/actividad.jsx`
- Modificar: `src/pages/Dashboard.jsx`

**Interfaces:**
- Consume: `GRUPO_COLORS` de `theme.js`, `GRUPOS` de `musculos.js`.
- Produce: `<MesDetalle dias mes onCambiarMes diaSeleccionado onSeleccionarDia />` y
  `<PanelDia dia />`.

- [ ] **Paso 1: Implementar `MesDetalle` en `src/components/actividad.jsx`**

```jsx
// agregar en src/components/actividad.jsx
// sumar al import de theme: GRUPO_COLORS
// sumar al import de services: nada nuevo
import { GRUPOS } from '../services/musculos'

const INICIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// La opacidad codifica el volumen; el tono, el grupo. El nivel 0 no llega acá: un día
// sin sesión no se pinta.
const OPACIDAD = [0, 0.4, 0.6, 0.8, 1]

export function MesDetalle({ dias, mes, onCambiarMes, diaSeleccionado, onSeleccionarDia }) {
  const porFecha = new Map(dias.map(d => [d.date, d]))
  const maximo = Math.max(1, ...dias.map(d => d.totalSeries))

  const [anio, mesNum] = mes.split('-').map(Number)
  const primero = new Date(Date.UTC(anio, mesNum - 1, 1))
  const diasEnMes = new Date(Date.UTC(anio, mesNum, 0)).getUTCDate()
  // 0 = lunes, para alinear el día 1 en su columna.
  const offset = (primero.getUTCDay() + 6) % 7

  function moverMes(delta) {
    const d = new Date(Date.UTC(anio, mesNum - 1 + delta, 1))
    onCambiarMes(d.toISOString().slice(0, 7))
  }

  const gruposDelMes = GRUPOS.filter(g =>
    dias.some(d => d.date.startsWith(mes) && (d.dominante === g || d.porGrupo[g])))

  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <FlechaMes label="←" onClick={() => moverMes(-1)} />
        <div style={{ fontSize: '14px', fontWeight: 600, color: C.textPrimary, minWidth: '150px' }}>
          {MESES[mesNum - 1]} {anio}
        </div>
        <FlechaMes label="→" onClick={() => moverMes(1)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {INICIALES.map((ini, i) => (
          <div key={i} style={{
            fontSize: '10px', fontWeight: 700, color: C.textMuted, textAlign: 'center',
            paddingBottom: '4px', letterSpacing: '0.06em',
          }}>{ini}</div>
        ))}

        {Array.from({ length: offset }, (_, i) => <div key={`v${i}`} />)}

        {Array.from({ length: diasEnMes }, (_, i) => {
          const num = i + 1
          const iso = `${mes}-${String(num).padStart(2, '0')}`
          const dia = porFecha.get(iso)
          const nivel = !dia ? 0
            : dia.totalSeries > 0 ? nivelDeIntensidad(dia.totalSeries, maximo)
            : NIVEL_SIN_SERIES
          const seleccionado = diaSeleccionado === iso

          return (
            <div
              key={iso}
              onClick={() => dia && onSeleccionarDia(seleccionado ? null : iso)}
              title={dia ? `${dia.dominante} — ${dia.totalSeries} series` : ''}
              style={{
                position: 'relative', aspectRatio: '1', minHeight: '40px',
                borderRadius: '6px', cursor: dia ? 'pointer' : 'default',
                border: seleccionado ? `2px solid ${C.accent}` : '1px solid transparent',
                background: C.surface,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {dia && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '5px',
                  background: GRUPO_COLORS[dia.dominante],
                  opacity: OPACIDAD[nivel],
                }} />
              )}
              {/* El número va siempre: el color nunca es el único portador de información. */}
              <span style={{
                position: 'relative', fontSize: '12px',
                fontWeight: dia ? 700 : 400,
                color: dia ? '#0F1117' : C.textMuted,
                fontVariantNumeric: 'tabular-nums',
              }}>{num}</span>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '14px' }}>
        {gruposDelMes.map(g => (
          <div key={g} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: GRUPO_COLORS[g] }} />
            <span style={{ fontSize: '12px', color: C.textSecondary }}>{g}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FlechaMes({ label, onClick }) {
  const { style, handlers } = useInteractiveStyle(
    {
      width: '32px', height: '32px', borderRadius: '8px',
      background: C.surface, border: `1px solid ${C.border}`,
      color: C.textSecondary, cursor: 'pointer', fontSize: '14px',
    },
    { hover: { background: C.surfaceHigh }, focus: focusRing }
  )
  return <button onClick={onClick} style={style} {...handlers}>{label}</button>
}
```

Agregar al import de hooks: `import { useInteractiveStyle, focusRing } from '../hooks/useInteractiveStyle'`.

- [ ] **Paso 2: Implementar `PanelDia`**

Panel y no modal: el modal taparía el calendario y se perdería el contexto del día tocado.

```jsx
// agregar en src/components/actividad.jsx
export function PanelDia({ dia }) {
  if (!dia) return null

  const fecha = new Date(dia.date + 'T12:00:00')
    .toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  const grupos = GRUPOS.filter(g => dia.porGrupo[g])

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px',
      padding: '16px', marginBottom: '1.75rem',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: C.textPrimary, textTransform: 'capitalize' }}>
        {fecha}
      </div>
      {dia.tipo && (
        <div style={{ fontSize: '12px', color: C.accentText, marginTop: '2px' }}>{dia.tipo}</div>
      )}

      {grupos.length === 0 ? (
        <div style={{ fontSize: '13px', color: C.textMuted, marginTop: '12px' }}>
          Sesión sin series cargadas.
        </div>
      ) : (
        <div style={{ marginTop: '12px' }}>
          {grupos.map(g => (
            <div key={g} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: GRUPO_COLORS[g] }} />
                <span style={{ fontSize: '13px', color: C.textPrimary }}>{g}</span>
              </div>
              <span style={{
                fontSize: '13px', color: C.textSecondary, fontVariantNumeric: 'tabular-nums',
              }}>{dia.porGrupo[g]} series</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Paso 3: Verificación manual en el navegador**

1. `npm run dev`, ir a **Reportes → Actividad**.
2. Esperado: el mes en curso con celdas grandes, los días alineados en su columna correcta
   (verificar contra un calendario real que el 1 caiga en el día de semana que corresponde).
3. Navegar a un mes con entrenamientos. Esperado: los días entrenados se ven en el color de
   su grupo dominante, y los más cargados más saturados.
4. Verificar que **todas** las celdas muestran su número, tengan o no sesión.
5. Tocar un día con sesión. Esperado: se abre el panel debajo con el tipo de rutina y las
   series por grupo, y el calendario **sigue visible**.
6. Tocar un día sin sesión. Esperado: no pasa nada.
7. Comparar el panel de un día contra la pantalla de Gimnasio para esa misma fecha.
   Esperado: la cantidad de series coincide.
8. En mobile (<640px): las 7 columnas entran sin scroll horizontal.

- [ ] **Paso 4: Correr la suite entera y el lint**

Correr: `npm test && npm run lint`
Esperado: verde, `0 errors`.

- [ ] **Paso 5: Commit**

```bash
git add src/components/actividad.jsx src/pages/Dashboard.jsx
git commit -m "feat: calendario mensual por grupo muscular con panel de dia"
```

---

## Tarea 11 — Barras de volumen por grupo

**Archivos:**
- Modificar: `src/components/actividad.jsx`
- Modificar: `src/pages/Dashboard.jsx`

**Interfaces:**
- Consume: `volumenPorGrupo` de `actividad.js`, `GRUPO_COLORS` de `theme.js`.
- Produce: `<BarrasPorGrupo volumen />`.

- [ ] **Paso 1: Implementar `BarrasPorGrupo`**

Sin Recharts: es una barra por fila, un div con `width` en porcentaje alcanza y evita
montar un gráfico para algo que no lo necesita.

Las barras reflejan el **mes seleccionado**, no el año, para que se lean junto al
calendario que está arriba. El título dice explícitamente qué período cubre.

```jsx
// agregar en src/components/actividad.jsx
export function BarrasPorGrupo({ volumen, titulo }) {
  if (!volumen.length) {
    return (
      <div style={{ color: C.textMuted, fontSize: '13px', padding: '1rem 0' }}>
        No hay series registradas en este período.
      </div>
    )
  }

  const mayor = volumen[0].series

  return (
    <div>
      <div style={{
        fontSize: '11px', fontWeight: 600, color: C.textMuted, marginBottom: '10px',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>{titulo}</div>

      {volumen.map(({ grupo, series, porcentaje }) => (
        <div key={grupo} style={{ marginBottom: '10px' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: '4px',
          }}>
            <span style={{ fontSize: '13px', color: C.textPrimary }}>{grupo}</span>
            <span style={{
              fontSize: '12px', color: C.textSecondary, fontVariantNumeric: 'tabular-nums',
            }}>{series} series · {porcentaje}%</span>
          </div>
          <div style={{ height: '8px', background: C.surface, borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              // Proporcional al mayor y no al total: con nueve grupos, escalar por el
              // total dejaría todas las barras aplastadas contra la izquierda.
              width: `${(series / mayor) * 100}%`,
              height: '100%',
              background: GRUPO_COLORS[grupo],
              borderRadius: '4px',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}
```

En `Dashboard.jsx`, componer los cuatro bloques y filtrar el volumen al mes visible:

```jsx
const diasDelMes = actividad.filter(d => d.date.startsWith(mesActividad))

<ResumenActividad sesiones={actividad.length} rachas={rachas(actividad, diasEntreno, hoyISO)} />
<TiraAnual dias={actividad} onSeleccionarMes={setMesActividad} />
<MesDetalle
  dias={actividad} mes={mesActividad} onCambiarMes={setMesActividad}
  diaSeleccionado={diaSeleccionado} onSeleccionarDia={setDiaSeleccionado}
/>
<PanelDia dia={actividad.find(d => d.date === diaSeleccionado)} />
<BarrasPorGrupo volumen={volumenPorGrupo(diasDelMes)} titulo="Volumen del mes" />
```

- [ ] **Paso 2: Verificación manual en el navegador**

1. `npm run dev`, ir a **Reportes → Actividad**.
2. Esperado: una barra por grupo con volumen en el mes, ordenadas de mayor a menor.
3. Sumar mentalmente los porcentajes. Esperado: 100 (±1 por redondeo).
4. Cambiar de mes con las flechas. Esperado: las barras se actualizan.
5. Si aparece `Sin clasificar`, verificar que está **última** aunque tenga más series que
   otras.
6. Cruzar el total de series de un grupo contra el panel de los días de ese mes. Esperado:
   coincide.

- [ ] **Paso 3: Correr la suite entera y el lint**

Correr: `npm test && npm run lint`
Esperado: verde, `0 errors`.

- [ ] **Paso 4: Commit**

```bash
git add src/components/actividad.jsx src/pages/Dashboard.jsx
git commit -m "feat: barras de volumen por grupo muscular"
```

---

## Tarea 12 — Documentación y cierre

**Archivos:**
- Modificar: `CLAUDE.md`, `README.md`, `DECISIONS.md`, `ROADMAP.md`

- [ ] **Paso 1: Actualizar `CLAUDE.md`**

Agregar `musculos.js` y `actividad.js` a la estructura de archivos, y
`src/components/actividad.jsx`.

- [ ] **Paso 2: Actualizar `README.md`**

Sumar los dos servicios al árbol y una línea en Features: *"Activity heatmap & muscle
mapping — yearly consistency view and volume distribution per muscle group"*.

- [ ] **Paso 3: Registrar las decisiones en `DECISIONS.md`**

Bajo `## Spec 3 — Heatmap de actividad (2026-09-08)`, las cinco de la sección
correspondiente del spec, más cualquier ambigüedad resuelta durante la ejecución.

- [ ] **Paso 4: Vaciar `ROADMAP.md`**

Dejarlo apuntando a este roadmap como archivado, con el siguiente candidato si lo hay.

- [ ] **Paso 5: Verificación final completa**

1. `npm test` — esperado: toda la suite en verde.
2. `npm run lint` — esperado: `0 errors`.
3. `npm run build` — esperado: `built in ...` sin errores.
4. Recorrer las cuatro pestañas de Reportes (Adherencia, Viandas, Cargas, Actividad).
   Esperado: ninguna se rompió.
5. Consola del navegador sin errores en ninguna de las cuatro.

- [ ] **Paso 6: Commit**

```bash
git add CLAUDE.md README.md DECISIONS.md ROADMAP.md
git commit -m "docs: cerrar el spec 3 y archivar su roadmap"
```

---

## Cierre

Con las 12 tareas completas:

- [ ] Correr la suite entera: `npm test`
- [ ] Revisar la sección del Spec 3 en `DECISIONS.md`
- [ ] Leer el diff de las tareas 9, 10 y 11, que son las que más tocan la UI
- [ ] `npm run build && npx cap sync android` si se va a compilar el APK
- [ ] `git push origin main` — dispara Vercel y el build del APK

**Riesgo a vigilar durante la ejecución:** las tareas 9-11 no tienen tests automáticos,
así que su verificación manual **es** la verificación. No marcar esos bullets sin haber
recorrido los pasos en el navegador con los datos reales.
