# ROADMAP — Motor de progresión automática

> **Para quien ejecute esto:** los bullets usan checkbox (`- [ ]`) para ir marcando avance.
> Ningún bullet se marca completo sin correr su verificación. La suite entera (`npm test`)
> corre antes de cada commit.

**Objetivo:** que la app deje de sembrar siempre el mismo peso y sugiera qué hacer la
próxima vez con cada ejercicio, a partir del RIR ya registrado; que detecte estancamiento
y ofrezca un deload.

**Arquitectura:** un servicio puro nuevo (`src/services/progresion.js`) sin dependencias de
Supabase ni React, testeado con Vitest, que importa de `oneRepMax.js`. `Gimnasio.jsx` hace
el I/O y le pasa datos ya cargados. **Sin cambios de base de datos:** una sola query — la
que ya alimenta el PR — alimenta también sugerencia y estancamiento.

**Stack:** React 19, Vite 8, Supabase (PostgreSQL + RLS), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-26-gym-motor-progresion-design.md`

**Roadmap anterior (completo):** `docs/superpowers/roadmaps/2026-08-25-gym-series-1rm-pr-roadmap.md`

---

## Restricciones globales

- **Estilos 100% inline.** Sin Tailwind, sin CSS modules, sin styled-components. Todo en
  `style={{}}`, usando los tokens de `src/theme.js`.
- **Sin dependencias nuevas.** Ni de UI ni de otro tipo: este roadmap no instala nada.
- **Íconos** desde `src/components/icons.jsx` (SVG, `viewBox` 24×24, `strokeWidth` 2,
  round caps). Nunca emoji como ícono funcional.
- **Hover / focus / active** vía `useInteractiveStyle` de `src/hooks/useInteractiveStyle.js`.
- **Breakpoint mobile:** `window.innerWidth < 640`.
- **No se toca la base de datos.** Ninguna tarea de este roadmap escribe SQL.
- **Commits convencionales** vía CLI (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`).
- Correr `npm run lint && npm test` antes de cada commit.

---

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/services/progresion.js` | **Crear.** Reglas de entrenamiento: sugerencia, estancamiento, deload. Puro. | 1-4 |
| `src/services/progresion.test.js` | **Crear.** Tests de la lógica pura. | 1-4 |
| `src/components/gym.jsx` | **Crear.** Componentes de presentación de Gimnasio (los nueve existentes + los chips nuevos). | 5-7 |
| `src/components/icons.jsx` | **Modificar.** Dos íconos nuevos (`IconTrendingUp`, `IconTrendingDown`). | 6 |
| `src/pages/Gimnasio.jsx` | **Modificar.** I/O y lógica de página; deja de alojar componentes de presentación. | 5-8 |
| `CLAUDE.md`, `README.md`, `DECISIONS.md` | **Modificar.** Documentación y decisiones. | 9 |

`progresion.js` importa de `oneRepMax.js` (`mejorSerie`, `pesoMaximo`), nunca al revés.

---

## Orden

Las tareas 1-4 son lógica pura: no tocan la UI ni la base, y se pueden hacer sin riesgo.
La tarea 5 es un refactor mecánico que prepara el terreno. Las 6-8 son la UI. La 9 cierra.

---

## Tarea 1 — `sesionesDeEjercicio`

**Archivos:**
- Crear: `src/services/progresion.js`
- Crear: `src/services/progresion.test.js`

**Interfaces:**
- Consume: `mejorSerie(series) → { serie, unaRM } | null` de `src/services/oneRepMax.js`.
- Produce: `sesionesDeEjercicio(filas) → [{ date, series, mejor }]`, ordenado por fecha
  descendente (la más reciente primero). `series` es el array plano de `gym_sets` de esa
  fecha; `mejor` es lo que devuelve `mejorSerie` sobre ese array (puede ser `null`).

`filas` son filas de `gym_exercises` tal como las devuelve Supabase, ya filtradas al mismo
ejercicio, con la forma:

```js
{ exercise_name: 'Press banca', gym_sets: [{ weight_kg, reps, rir }], gym_logs: { date } }
```

- [ ] **Paso 1: escribir el test que falla**

Crear `src/services/progresion.test.js`:

```js
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
```

- [ ] **Paso 2: correr el test y verificar que falla**

```bash
npm test
```

Esperado: FAIL — no se puede resolver el módulo `./progresion`.

- [ ] **Paso 3: implementar**

Crear `src/services/progresion.js`:

```js
// src/services/progresion.js
// Motor de progresión: qué peso poner la próxima vez, cuándo un ejercicio se
// estancó y cuándo conviene un deload. Funciones puras: sin Supabase, sin React.
// Ver spec en docs/superpowers/specs/2026-08-26-gym-motor-progresion-design.md

import { mejorSerie } from './oneRepMax'

// Agrupa las filas de un mismo ejercicio por sesión (fecha) y calcula la mejor
// serie de cada una. Devuelve de la más reciente a la más antigua.
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
```

- [ ] **Paso 4: correr el test y verificar que pasa**

```bash
npm test
```

Esperado: PASS. 7 tests nuevos, más los 21 que ya existían de `oneRepMax`.

- [ ] **Paso 5: lint y commit**

```bash
npm run lint && npm test
git add src/services/progresion.js src/services/progresion.test.js
git commit -m "feat: agrupacion del historico de un ejercicio por sesion"
```

---

## Tarea 2 — `sugerirProximo`

**Archivos:**
- Modificar: `src/services/progresion.js`
- Modificar: `src/services/progresion.test.js`

**Interfaces:**
- Consume: `sesionesDeEjercicio` de la tarea 1.
- Produce: `sugerirProximo(sesiones) → { accion, weight_kg, reps, motivo } | null`.
  `accion` es `'subir' | 'sumar_reps' | 'mantener' | 'sin_rir'`. También produce las
  constantes `INCREMENTO_KG = 2.5` y `RIR_PARA_SUBIR = 2`.

**La regla.** Se mira la última sesión. De sus series se toman las **efectivas** — las que
tienen `weight_kg > 0`, `reps` y `rir` — y de ellas la de **RIR mínimo**: la serie más dura
es la que dice cuánto margen real quedó.

| RIR mínimo | `accion` | Sugerencia |
|---|---|---|
| ≥ 2 | `subir` | peso + 2.5 kg, mismas reps |
| 1 | `sumar_reps` | mismo peso, reps + 1 |
| ≤ 0 | `mantener` | mismo peso, mismas reps |

Devuelve `null` (no hay nada que sugerir) si no hay sesiones o si ninguna serie de la
última tiene peso — futsal, cardio, peso corporal. Devuelve `accion: 'sin_rir'` con
`weight_kg: null` cuando hay series con peso pero ninguna con RIR: la UI necesita
distinguir "no puedo sugerir" de "me falta el dato que vos podés cargar".

- [ ] **Paso 1: escribir el test que falla**

Agregar al final de `src/services/progresion.test.js` (y sumar `sugerirProximo`,
`INCREMENTO_KG` al import de arriba):

```js
// Construye la lista de sesiones directamente, sin pasar por sesionesDeEjercicio:
// estos tests prueban la regla, no la agrupación.
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
    // La última serie tiene RIR 3, pero la más dura de la sesión tuvo RIR 0.
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
```

- [ ] **Paso 2: correr y verificar que falla**

```bash
npm test
```

Esperado: FAIL — `sugerirProximo is not a function`.

- [ ] **Paso 3: implementar**

Agregar a `src/services/progresion.js`:

```js
export const INCREMENTO_KG = 2.5
export const RIR_PARA_SUBIR = 2

// RIR 0 es un valor válido y significativo (fallo muscular): hay que distinguirlo
// de "no cargué el dato". Por eso no se usa `Number(x) || null`, que los mezcla.
function rirDe(serie) {
  const { rir } = serie
  if (rir === null || rir === undefined || rir === '') return null
  const n = Number(rir)
  return Number.isFinite(n) ? n : null
}

// Serie efectiva: la que informa sobre el esfuerzo real. Necesita las tres cosas,
// porque la sugerencia se expresa como peso × reps y se decide por RIR.
function esEfectiva(serie) {
  return Number(serie.weight_kg) > 0
    && Number.isFinite(Number(serie.reps))
    && rirDe(serie) !== null
}

// Doble progresión por RIR sobre la última sesión del ejercicio.
export function sugerirProximo(sesiones) {
  const ultima = sesiones?.[0]
  if (!ultima) return null

  const conPeso = (ultima.series || []).filter(s => Number(s.weight_kg) > 0)
  if (!conPeso.length) return null   // futsal, cardio, peso corporal

  const efectivas = conPeso.filter(esEfectiva)
  if (!efectivas.length) {
    return { accion: 'sin_rir', weight_kg: null, reps: null, motivo: 'cargá el RIR para recibir sugerencias' }
  }

  // La serie más dura de la sesión (menor RIR) es la que dice cuánto margen
  // quedó. Ante empate se queda con la primera, como mejorSerie.
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
  // RIR 0: llegar al fallo es una sesión dura, no un estancamiento. Consolidar el
  // mismo peso es la respuesta. Bajar carga entra solo por la vía del deload.
  return { accion: 'mantener', weight_kg: peso, reps, motivo: 'llegaste al fallo' }
}
```

- [ ] **Paso 4: correr y verificar que pasa**

```bash
npm test
```

Esperado: PASS, 11 tests nuevos.

- [ ] **Paso 5: lint y commit**

```bash
npm run lint && npm test
git add src/services/progresion.js src/services/progresion.test.js
git commit -m "feat: sugerencia de proximo peso por doble progresion de RIR"
```

---

## Tarea 3 — `detectarEstancamiento`

**Archivos:**
- Modificar: `src/services/progresion.js`
- Modificar: `src/services/progresion.test.js`

**Interfaces:**
- Consume: la lista de sesiones de la tarea 1 (usa el campo `mejor`).
- Produce: `detectarEstancamiento(sesiones) → { estancado: boolean, sesionesSinPR: number }`
  y la constante `SESIONES_PARA_ESTANCAMIENTO = 3`.

**La regla.** Estancado = pasaron 3 o más sesiones desde aquella en que se alcanzó el mejor
1RM histórico. Un empate no resetea el contador: se toma la **primera** sesión que alcanzó
el máximo, coherente con que empatar no es PR. Requiere al menos 4 sesiones.

- [ ] **Paso 1: escribir el test que falla**

Agregar al final de `src/services/progresion.test.js` (sumar `detectarEstancamiento` al
import):

```js
// Sesión con un único valor de mejor 1RM, que es lo único que mira la detección.
function sesionConRM(date, unaRM) {
  return { date, series: [], mejor: unaRM === null ? null : { serie: {}, unaRM } }
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

  it('devuelve no estancado sin sesiones', () => {
    expect(detectarEstancamiento([]).estancado).toBe(false)
    expect(detectarEstancamiento(undefined).estancado).toBe(false)
  })
})
```

- [ ] **Paso 2: correr y verificar que falla**

```bash
npm test
```

Esperado: FAIL — `detectarEstancamiento is not a function`.

- [ ] **Paso 3: implementar**

Agregar a `src/services/progresion.js`:

```js
export const SESIONES_PARA_ESTANCAMIENTO = 3

// Estancado = pasaron N sesiones desde aquella en que se alcanzó el mejor 1RM.
// Recibe las sesiones en orden descendente (la más reciente primero).
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

  // En orden descendente, el índice del récord es la cantidad de sesiones posteriores.
  const sesionesSinPR = indiceRecord
  return { estancado: sesionesSinPR >= SESIONES_PARA_ESTANCAMIENTO, sesionesSinPR }
}
```

- [ ] **Paso 4: correr y verificar que pasa**

```bash
npm test
```

Esperado: PASS, 6 tests nuevos.

- [ ] **Paso 5: lint y commit**

```bash
npm run lint && npm test
git add src/services/progresion.js src/services/progresion.test.js
git commit -m "feat: deteccion de estancamiento por sesiones desde el record"
```

---

## Tarea 4 — `sugerirDeload` y `progresionDe`

**Archivos:**
- Modificar: `src/services/progresion.js`
- Modificar: `src/services/progresion.test.js`

**Interfaces:**
- Consume: `pesoMaximo(series) → number | null` de `src/services/oneRepMax.js`; y
  `sesionesDeEjercicio`, `sugerirProximo`, `detectarEstancamiento` de las tareas 1-3.
- Produce: `sugerirDeload(sesiones) → { weight_kg } | null`, la constante
  `FACTOR_DELOAD = 0.9`, y `progresionDe(filas) → { sugerencia, estancamiento, deload }`.
  `progresionDe` es la única función que consume la UI; recibe las mismas `filas` que
  `sesionesDeEjercicio`.

**La regla del deload.** `redondearAbajo(pesoMaximo(última sesión) × 0.9, 2.5)`. Se usa
`pesoMaximo` y no el peso de la mejor serie por 1RM porque el deload se razona en kilos
sobre la barra, no en 1RM estimado. El redondeo va **hacia abajo** para que sea un alivio
real y no un cambio cosmético. Devuelve `null` si la última sesión ya fue más liviana que
la anterior: el deload ya está en curso y re-ofrecerlo lo convertiría en ruido.

`progresionDe` solo calcula el deload cuando hay estancamiento.

- [ ] **Paso 1: escribir el test que falla**

Agregar al final de `src/services/progresion.test.js` (sumar `sugerirDeload` y
`progresionDe` al import):

```js
// Sesión con series reales, que es lo que mira el deload (usa pesoMaximo).
function sesionConSeries(date, series) {
  return { date, series, mejor: null }
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

  it('devuelve null sin sesiones o sin peso', () => {
    expect(sugerirDeload([])).toBeNull()
    expect(sugerirDeload([sesionConSeries('2026-08-20', [{ weight_kg: null, reps: 20, rir: 0 }])])).toBeNull()
  })

  it('devuelve null si el peso es tan bajo que el deload no baja nada', () => {
    // 2.5 × 0.9 = 2.25 → redondeo abajo a 2.5 da 0
    expect(sugerirDeload([sesionConSeries('2026-08-20', [{ weight_kg: 2.5, reps: 8, rir: 0 }])])).toBeNull()
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
```

- [ ] **Paso 2: correr y verificar que falla**

```bash
npm test
```

Esperado: FAIL — `sugerirDeload is not a function`.

- [ ] **Paso 3: implementar**

En `src/services/progresion.js`, cambiar el import de arriba para sumar `pesoMaximo`:

```js
import { mejorSerie, pesoMaximo } from './oneRepMax'
```

Y agregar al final:

```js
export const FACTOR_DELOAD = 0.9

const ESCALON_KG = 2.5

// Baja un 10% redondeando hacia abajo al múltiplo de 2.5, para que el alivio sea
// real y no cosmético. Se basa en pesoMaximo y no en la mejor serie por 1RM: el
// deload se razona en kilos sobre la barra.
export function sugerirDeload(sesiones) {
  const ultima = sesiones?.[0]
  if (!ultima) return null

  const pesoUltima = pesoMaximo(ultima.series || [])
  if (!pesoUltima) return null

  // Si ya venís bajando, el deload está en curso: re-ofrecerlo sería ruido.
  const anterior = sesiones[1]
  const pesoAnterior = anterior ? pesoMaximo(anterior.series || []) : null
  if (pesoAnterior !== null && pesoUltima < pesoAnterior) return null

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
```

- [ ] **Paso 4: correr y verificar que pasa**

```bash
npm test
```

Esperado: PASS, 10 tests nuevos. Total de la suite: 55 tests
(21 de `oneRepMax` + 34 de `progresion`).

- [ ] **Paso 5: lint y commit**

```bash
npm run lint && npm test
git add src/services/progresion.js src/services/progresion.test.js
git commit -m "feat: sugerencia de deload y compositor progresionDe"
```

---

## Tarea 5 — Extraer los componentes de presentación

**Archivos:**
- Crear: `src/components/gym.jsx`
- Modificar: `src/pages/Gimnasio.jsx`

**Interfaces:**
- Produce: `src/components/gym.jsx` exportando `TabButton`, `BadgePR`, `Pill`,
  `PrimarySmallButton`, `ActionButton`, `TinyGhostButton`, `TinyDangerButton`,
  `ModalPrimaryButton`, `ModalSecondaryButton`, con las mismas props que hoy.

`Gimnasio.jsx` tiene 580 líneas y nueve sub-componentes de presentación al final. Las
tareas 6-8 le suman chips; sin este paso el archivo llega a ~700 líneas. **Es un movimiento
mecánico: no se cambia una sola línea del cuerpo de los componentes.**

- [ ] **Paso 1: crear el archivo con los componentes movidos**

Crear `src/components/gym.jsx` con esta cabecera, y **cortar y pegar** debajo los nueve
componentes tal cual están hoy en `src/pages/Gimnasio.jsx` (`TabButton` en la línea 36 y
`BadgePR`, `Pill`, `PrimarySmallButton`, `ActionButton`, `TinyGhostButton`,
`TinyDangerButton`, `ModalPrimaryButton`, `ModalSecondaryButton` a partir de la 508),
agregándole `export` a cada uno:

```jsx
// src/components/gym.jsx
// Componentes de presentación de la pantalla de Gimnasio. Vivían dentro de
// Gimnasio.jsx; se movieron acá para que la página quede con la lógica de I/O.
// Estilos inline y tokens de theme.js, como todo el proyecto.

import { C } from '../theme'
import { useInteractiveStyle, focusRing } from '../hooks/useInteractiveStyle'
import { IconTrophy } from './icons'
```

- [ ] **Paso 2: actualizar los imports de `Gimnasio.jsx`**

Borrar de `src/pages/Gimnasio.jsx` los nueve componentes movidos, e importar:

```js
import {
  TabButton, BadgePR, Pill, PrimarySmallButton, ActionButton,
  TinyGhostButton, TinyDangerButton, ModalPrimaryButton, ModalSecondaryButton,
} from '../components/gym'
```

Después de mover `BadgePR`, `IconTrophy` ya no se usa en `Gimnasio.jsx`: sacarlo de su
import de `../components/icons`. Si `focusRing` o `useInteractiveStyle` quedaran sin uso en
la página, sacarlos también — `npm run lint` lo va a marcar.

- [ ] **Paso 3: verificar que no cambió nada**

```bash
npm run lint && npm test && npm run build
```

Esperado: sin errores de lint (en particular, ningún import sin usar), 55 tests en verde,
build exitoso.

```bash
npm run dev
```

En `localhost:5173` → Gimnasio: recorrer las pestañas Hoy e Historial, abrir el modal de un
ejercicio, y confirmar que **todo se ve exactamente igual que antes** — botones, badge de
PR, pills, tabs. Achicar la ventana por debajo de 640px y repetir.

- [ ] **Paso 4: commit**

```bash
git add src/components/gym.jsx src/pages/Gimnasio.jsx
git commit -m "refactor: extraer componentes de presentacion de Gimnasio"
```

---

## Tarea 6 — Chips de progresión y estancamiento

**Archivos:**
- Modificar: `src/components/icons.jsx`
- Modificar: `src/components/gym.jsx`
- Modificar: `src/pages/Gimnasio.jsx`

**Interfaces:**
- Consume: `progresionDe` de la tarea 4; `normalizarNombre` y `mejorSerie` de
  `oneRepMax.js`; los componentes de la tarea 5.
- Produce: `ChipProgresion({ sugerencia })` y `ChipEstancado({ sesionesSinPR })` en
  `src/components/gym.jsx`; `IconTrendingUp` e `IconTrendingDown` en `icons.jsx`.

- [ ] **Paso 1: agregar los íconos**

Al final de `src/components/icons.jsx`, siguiendo el lenguaje del resto (viewBox 24×24,
stroke 2, round caps):

```jsx
export function IconTrendingUp(p) {
  return <Svg {...p}><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></Svg>
}
export function IconTrendingDown(p) {
  return <Svg {...p}><polyline points="3 7 9 13 13 9 21 17" /><polyline points="15 17 21 17 21 11" /></Svg>
}
```

- [ ] **Paso 2: agregar los chips**

En `src/components/gym.jsx`, sumar `IconWarning`, `IconTrendingUp` al import de `./icons` y
agregar al final:

```jsx
// Base visual compartida con BadgePR: píldora chica, fondo xxxDim, borde al 40%.
function Chip({ color, dim, borde = true, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
      background: dim, color, border: borde ? `1px solid ${color}40` : `1px solid ${C.border}`,
    }}>
      {children}
    </span>
  )
}

// La sugerencia siempre viaja con su motivo: un número raro se detecta leyéndolo.
export function ChipProgresion({ sugerencia }) {
  if (!sugerencia) return null

  if (sugerencia.accion === 'sin_rir') {
    return <Chip color={C.textMuted} dim={C.surfaceHigh} borde={false}>{sugerencia.motivo}</Chip>
  }
  if (sugerencia.accion === 'subir') {
    return (
      <Chip color={C.accentText} dim={C.accentDim}>
        <IconTrendingUp size={11} color={C.accentText} />
        {sugerencia.weight_kg} kg · {sugerencia.motivo}
      </Chip>
    )
  }
  if (sugerencia.accion === 'sumar_reps') {
    return (
      <Chip color={C.blue} dim={C.blueDim}>
        {sugerencia.weight_kg} kg × {sugerencia.reps} · {sugerencia.motivo}
      </Chip>
    )
  }
  return (
    <Chip color={C.textMuted} dim={C.surfaceHigh} borde={false}>
      {sugerencia.weight_kg} kg × {sugerencia.reps} · {sugerencia.motivo}
    </Chip>
  )
}

export function ChipEstancado({ sesionesSinPR }) {
  return (
    <Chip color={C.red} dim={C.redDim}>
      <IconWarning size={11} color={C.red} />
      {sesionesSinPR} sesiones sin PR
    </Chip>
  )
}
```

- [ ] **Paso 3: extender la query del histórico**

En `src/pages/Gimnasio.jsx`, la función `cargarHistoricoPR()` (línea 69) ya trae el
histórico completo excluyendo hoy. Se le suma `rir` a las series y se le agrega el cálculo
de progresión sobre los mismos datos. Reemplazarla entera por:

```js
// Una sola query alimenta las dos derivaciones: mejor 1RM histórico (para el PR)
// y progresión (sugerencia + estancamiento + deload). Excluye la sesión de hoy:
// si no, el récord de hoy se compararía consigo mismo.
async function cargarHistorico() {
  const { data } = await supabase
    .from('gym_exercises')
    .select('exercise_name, gym_sets(weight_kg, reps, rir), gym_logs!inner(user_id, date)')
    .eq('gym_logs.user_id', session.user.id)
    .neq('gym_logs.date', hoy)

  // Agrupar por nombre normalizado: la normalización vive en JS y la base no la conoce.
  const porNombre = {}
  for (const ej of data || []) {
    const clave = normalizarNombre(ej.exercise_name)
    if (!porNombre[clave]) porNombre[clave] = []
    porNombre[clave].push(ej)
  }

  const mapaPR = {}
  const mapaProgresion = {}
  for (const [clave, filas] of Object.entries(porNombre)) {
    for (const ej of filas) {
      const mejor = mejorSerie(ej.gym_sets || [])
      if (!mejor) continue
      if (!mapaPR[clave] || mejor.unaRM > mapaPR[clave].unaRM) mapaPR[clave] = mejor
    }
    mapaProgresion[clave] = progresionDe(filas)
  }
  setHistoricoPR(mapaPR)
  setProgresiones(mapaProgresion)
}
```

- [ ] **Paso 4: actualizar el estado y las llamadas**

Junto a `const [historicoPR, setHistoricoPR] = useState({})` (línea 60):

```js
const [progresiones, setProgresiones] = useState({})
```

Renombrar las tres llamadas a `cargarHistoricoPR()` por `cargarHistorico()`: el `useEffect`
inicial, el final de `cargarPlantilla()` y el final de `guardarEjercicio()`. Verificar con:

```bash
git grep -n "cargarHistoricoPR" src/
```

Esperado: sin resultados.

Y agregar el helper junto a `prDe` (línea 87):

```js
function progresionDeEj(ej) {
  return progresiones[normalizarNombre(ej.exercise_name)] || null
}
```

- [ ] **Paso 5: importar lo nuevo en Gimnasio**

```js
import { progresionDe } from '../services/progresion'
import {
  TabButton, BadgePR, Pill, PrimarySmallButton, ActionButton,
  TinyGhostButton, TinyDangerButton, ModalPrimaryButton, ModalSecondaryButton,
  ChipProgresion, ChipEstancado,
} from '../components/gym'
```

- [ ] **Paso 6: mostrar los chips en la vista mobile**

Ubicar por contenido, no por número de línea: la tarea 5 corrió las líneas. El ancla es el
bloque de la tarjeta mobile donde conviven el nombre y el badge (antes de la tarea 5,
líneas 340-342):

```jsx
<span style={{ fontWeight: 600, fontSize: '14px', color: C.textPrimary }}>{ej.exercise_name}</span>
{prDe(ej).esPR && <BadgePR mejora={prDe(ej).mejora} />}
```

Agregar **debajo** del contenedor flex que envuelve a esos dos:

```jsx
{progresionDeEj(ej) && (
  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
    <ChipProgresion sugerencia={progresionDeEj(ej).sugerencia} />
    {progresionDeEj(ej).estancamiento.estancado && (
      <ChipEstancado sesionesSinPR={progresionDeEj(ej).estancamiento.sesionesSinPR} />
    )}
  </div>
)}
```

- [ ] **Paso 7: mostrar los chips en la tabla de desktop**

Mismo bloque, en la primera `<td>` de la fila de ejercicio de la tabla desktop — la que
tiene `fontWeight: 600` y contiene el `<span>{ej.exercise_name}</span>` junto al `BadgePR`
(antes de la tarea 5, líneas 381-385). Va debajo del contenedor flex de esos dos, igual que
en mobile.

- [ ] **Paso 8: verificar a mano**

```bash
npm run dev
```

En `localhost:5173` → Gimnasio → Hoy. Para preparar los casos hay que crear sesiones con
fecha pasada: cargarlas normalmente y después editar `date` en el editor de Supabase.

1. Ejercicio "Press banca" en una sesión pasada con `80×8 RIR 3` → hoy el chip dice
   **`↑ 82.5 kg · cerraste con RIR 3`** en verde.
2. Cambiar esa sesión pasada a `80×8 RIR 1` → el chip dice
   **`80 kg × 9 · RIR 1, sumá una rep`** en azul.
3. Cambiarla a `80×8 RIR 0` → **`80 kg × 8 · llegaste al fallo`** en gris.
4. Series con RIR `3, 2, 0` en la sesión pasada → el chip usa el **0**, no el 3: dice
   "llegaste al fallo". Es la verificación de que se toma el mínimo.
5. Sesión pasada con peso pero sin ningún RIR → chip gris
   **`cargá el RIR para recibir sugerencias`**.
6. Ejercicio nuevo, sin historial → **ningún chip**.
7. Ejercicio de futsal o cardio (sin peso) → **ningún chip**, sin romperse.
8. Cuatro sesiones pasadas del mismo ejercicio donde la más antigua tiene el mejor 1RM →
   aparece además el chip rojo **`3 sesiones sin PR`**.
9. Escribir el ejercicio de hoy como `"  press   BANCA "` → igual encuentra el histórico y
   muestra el chip (normalización de nombre).
10. Achicar la ventana por debajo de 640px y confirmar que los chips se ven bien en mobile,
    sin desbordar.

- [ ] **Paso 9: lint, tests y commit**

```bash
npm run lint && npm test
git add src/components/icons.jsx src/components/gym.jsx src/pages/Gimnasio.jsx
git commit -m "feat: chips de sugerencia de progresion y estancamiento"
```

---

## Tarea 7 — Chip de deload con acción

**Archivos:**
- Modificar: `src/components/gym.jsx`
- Modificar: `src/pages/Gimnasio.jsx`

**Interfaces:**
- Consume: el campo `deload` de `progresionDe` (tarea 4); `TinyGhostButton` de la tarea 5.
- Produce: `ChipDeload({ weight_kg, onAplicar })` en `src/components/gym.jsx`.

Es el único chip con acción, porque es la única sugerencia que **baja** la carga: subir por
defecto es lo que se espera de un plan de progresión, bajar en silencio no. `aplicar`
reescribe el peso de todas las series del ejercicio en el modal **sin guardar**: se puede
seguir editando o cancelar.

- [ ] **Paso 1: agregar el chip**

Al final de `src/components/gym.jsx`, sumando `IconTrendingDown` al import de `./icons`:

```jsx
export function ChipDeload({ weight_kg, onAplicar }) {
  return (
    <Chip color={C.yellow} dim={C.yellowDim}>
      <IconTrendingDown size={11} color={C.yellow} />
      Probar deload: {weight_kg} kg
      <TinyGhostButton onClick={onAplicar}>aplicar</TinyGhostButton>
    </Chip>
  )
}
```

- [ ] **Paso 2: agregar el handler en Gimnasio**

En `src/pages/Gimnasio.jsx`, junto a los otros helpers de edición de series
(`actualizarSerie`, `agregarSerie`, …):

```js
// Reescribe el peso de todas las series del formulario. No guarda: el usuario
// sigue pudiendo editar o cancelar.
function aplicarPesoATodasLasSeries(weight_kg) {
  setFormEj(f => ({ ...f, series: f.series.map(s => ({ ...s, weight_kg: String(weight_kg) })) }))
}
```

- [ ] **Paso 3: mostrar el chip en el modal de ejercicio**

El deload se aplica sobre el formulario, así que el chip va **dentro del modal**, arriba de
la lista de series. En el modal, justo antes del `<div>` que dice "Series":

```jsx
{modalEj !== 'nuevo' && progresionDeEj(modalEj)?.deload && (
  <div style={{ marginBottom: '12px' }}>
    <ChipDeload
      weight_kg={progresionDeEj(modalEj).deload.weight_kg}
      onAplicar={() => aplicarPesoATodasLasSeries(progresionDeEj(modalEj).deload.weight_kg)}
    />
  </div>
)}
```

Sumar `ChipDeload` al import de `../components/gym`.

- [ ] **Paso 4: verificar a mano**

```bash
npm run dev
```

Preparar el caso: cuatro sesiones pasadas del mismo ejercicio, todas a `100 kg`, donde la
más antigua tiene el mejor 1RM (por ejemplo `100×9`, y las tres siguientes `100×7`).

1. Abrir hoy ese ejercicio en el modal → aparece el chip amarillo
   **`⬇ Probar deload: 90 kg [aplicar]`**.
2. Tocar **aplicar** → todas las series del formulario pasan a `90`, y las reps quedan
   como estaban.
3. Cancelar el modal sin guardar y reabrirlo → los pesos vuelven a los originales
   (`aplicar` no guardó nada).
4. Ejercicio sin estancamiento → **no** aparece el chip de deload.
5. Preparar el caso de deload en curso: que la última sesión pasada haya sido a `90 kg` y
   la anterior a `100 kg`, sin PR nuevo → sigue apareciendo el chip rojo de estancamiento
   pero **no** el de deload.
6. Ejercicio nuevo (modal abierto con "nuevo") → sin chip, sin romperse.

- [ ] **Paso 5: lint, tests y commit**

```bash
npm run lint && npm test
git add src/components/gym.jsx src/pages/Gimnasio.jsx
git commit -m "feat: chip de deload con aplicacion al formulario de series"
```

---

## Tarea 8 — La plantilla siembra el peso sugerido

**Archivos:**
- Modificar: `src/pages/Gimnasio.jsx`

**Interfaces:**
- Consume: `progresiones` y `normalizarNombre`, ya disponibles desde la tarea 6.

Hoy `cargarPlantilla()` siembra siempre `default_weight_kg` / `default_reps` de
`routine_templates` (líneas 149-162). Pasa a sembrar lo sugerido cuando hay sugerencia con
peso, y a caer en los defaults cuando no la hay. La cantidad de series la sigue definiendo
`default_sets`: el motor no la toca. `routine_templates` **no se actualiza** — describe un
plan, no un registro.

- [ ] **Paso 1: cambiar el armado de filas**

En `cargarPlantilla()`, reemplazar el bloque que arma `filas`:

```js
// default_sets de la plantilla define cuántas series se siembran; el peso y las
// reps salen del motor de progresión cuando hay sugerencia. Con accion 'sin_rir'
// el weight_kg viene en null, así que cae en los defaults de la plantilla.
const filas = []
creados?.forEach((ej, i) => {
  const p = plantilla[i]
  const sugerencia = progresiones[normalizarNombre(p.exercise_name)]?.sugerencia
  const usarSugerencia = sugerencia?.weight_kg != null
  const cantidad = Math.max(p.default_sets || 1, 1)
  for (let n = 1; n <= cantidad; n++) {
    filas.push({
      exercise_id: ej.id,
      set_number: n,
      weight_kg: usarSugerencia ? sugerencia.weight_kg : (p.default_weight_kg ?? null),
      reps: usarSugerencia ? sugerencia.reps : (p.default_reps ?? null),
      rir: null,
    })
  }
})
```

- [ ] **Paso 2: verificar a mano**

```bash
npm run dev
```

1. Tener una plantilla cargada para un tipo de rutina, con `default_weight_kg = 60`.
2. Crear una sesión pasada de uno de esos ejercicios con `80×8 RIR 3` (sugerencia:
   `82.5 × 8`).
3. En la sesión de hoy, tocar **Plantilla**. Abrir ese ejercicio: sus series están en
   **`82.5 kg × 8`**, no en `60`.
4. Abrir otro ejercicio de la misma plantilla que **no** tenga historial: sus series están
   en los defaults de la plantilla (`60 kg`).
5. Un ejercicio cuyo historial no tenga RIR cargado → también cae en los defaults de la
   plantilla.
6. Confirmar que la cantidad de series sigue siendo `default_sets` en todos los casos.
7. Confirmar en Supabase que `routine_templates` **no cambió**:
   `SELECT exercise_name, default_weight_kg FROM routine_templates;` → los mismos valores
   de antes.

- [ ] **Paso 3: lint, tests y commit**

```bash
npm run lint && npm test
git add src/pages/Gimnasio.jsx
git commit -m "feat: la plantilla siembra el peso y las reps sugeridas"
```

---

## Tarea 9 — Documentación y cierre

**Archivos:**
- Modificar: `DECISIONS.md`
- Modificar: `CLAUDE.md`
- Modificar: `README.md`

- [ ] **Paso 1: agregar la sección del Spec 2 a `DECISIONS.md`**

Agregar al final de `DECISIONS.md`:

```markdown
## Spec 2 — Motor de progresión (2026-08-26)

- **Doble progresión por RIR** sobre progresión lineal, por rango de reps o por % de 1RM:
  aprovecha un dato que ya se registra en `gym_sets`, es el estándar en hipertrofia y no
  necesita schema nuevo. El rango de reps habría requerido agregar columnas a
  `routine_templates`; el % de 1RM arrastra el error de Epley a la prescripción.
- **RIR mínimo de la sesión, no el de la última serie.** Con series `RIR 0, 2, 3` el mínimo
  manda mantener y la última mandaría subir. Al prescribir carga, equivocarse hacia abajo
  cuesta mucho menos que hacia arriba.
- **RIR 0 mantiene el peso, no lo baja.** Llegar al fallo es una sesión dura, no un
  estancamiento. Bajar carga entra por una sola vía, el deload, y siempre con confirmación.
- **Incremento fijo de 2.5 kg**, sin configuración por ejercicio: es el disco chico estándar
  y el salto sostenible sesión a sesión. Una columna `incremento_kg` en `routine_templates`
  habría sumado migración y UI para un caso que se resuelve editando el número a mano.
- **Estancamiento = 3 sesiones desde el récord.** Una sola definición, testeable. Un empate
  no resetea el contador: se toma la primera sesión que alcanzó el máximo, coherente con la
  decisión del Spec 1 de que empatar no es PR.
- **El deload se ofrece pero nunca se siembra solo**, y no se re-ofrece si la última sesión
  ya bajó el peso. Sin eso el chip reaparecería hasta lograr un PR nuevo y se volvería ruido.
- **El deload se calcula sobre `pesoMaximo`, no sobre la mejor serie por 1RM**: se razona en
  kilos sobre la barra, no en 1RM estimado. El redondeo va hacia abajo para que el alivio
  sea real.
- **`progresion.js` separado de `oneRepMax.js`**: aritmética de 1RM y reglas de entrenamiento
  son dos responsabilidades con motivos de cambio distintos.
- **Spec 2 sin cambios de schema.** Una sola query alimenta PR, sugerencia y estancamiento.

### Decisiones surgidas al escribir el roadmap

- **"Serie efectiva" también exige `reps`.** El spec la definía como `weight_kg > 0` y `rir`
  no nulo, pero la sugerencia se expresa como peso × reps: sin `reps` no hay nada que
  sugerir. Una serie con peso y RIR pero sin reps se trata como no efectiva.
- **`accion: 'sin_rir'` en vez de `null`.** El spec pedía "sin sugerencia" para los tres
  casos sin datos, pero la UI necesita distinguir "no puedo sugerir" (ejercicio nuevo, sin
  peso) de "me falta el dato que vos podés cargar". `sin_rir` viaja con `weight_kg: null`,
  así que `cargarPlantilla()` igual cae en los defaults.
```

- [ ] **Paso 2: actualizar `CLAUDE.md`**

En "Estructura de archivos clave", agregar bajo `services/`:

```
    progresion.js        # Motor de progresión: sugerencia de peso, estancamiento, deload
```

Y bajo `src/`, dentro de `components/`:

```
    gym.jsx              # Componentes de presentación de la pantalla de Gimnasio
```

- [ ] **Paso 3: actualizar `README.md`**

Sumar a la lista de features: sugerencia automática de peso por doble progresión de RIR,
detección de estancamiento y deload.

- [ ] **Paso 4: verificación final**

```bash
npm test && npm run lint && npm run build
```

Esperado: 55 tests en verde, sin errores de lint, build exitoso.

- [ ] **Paso 5: commit**

```bash
git add DECISIONS.md CLAUDE.md README.md
git commit -m "docs: documentar el motor de progresion y sus decisiones"
```

---

## Cierre

Con las 9 tareas completas:

- [ ] Correr la suite entera: `npm test`
- [ ] Revisar la sección del Spec 2 en `DECISIONS.md`
- [ ] Leer el diff de las tareas 6 y 7, que son las que más tocan la UI
- [ ] `npm run build && npx cap sync android` si se va a compilar el APK
- [ ] `git push origin main` — dispara Vercel y el build del APK

**Después de esto:** Spec 3 (heatmap anual de actividad y muscle mapping), que es
independiente de este.
