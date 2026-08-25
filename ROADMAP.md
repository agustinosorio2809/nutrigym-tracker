# ROADMAP — Series, 1RM estimado y detección de PR

> **Para quien ejecute esto:** los bullets usan checkbox (`- [ ]`) para ir marcando avance.
> Ningún bullet se marca completo sin correr su verificación. La suite entera (`npm test`)
> corre antes de cada commit.

**Objetivo:** migrar el registro de gimnasio a un modelo por serie y construir encima el
cálculo de 1RM estimado y la detección de récords personales.

**Arquitectura:** toda la aritmética vive en un servicio puro (`src/services/oneRepMax.js`)
sin dependencias de Supabase ni React, testeado con Vitest. Las páginas hacen el I/O y le
pasan datos ya cargados. La migración de base se parte en dos scripts SQL con verificación
manual entre medio, porque no hay ambiente de desarrollo separado.

**Stack:** React 19, Vite 8, Supabase (PostgreSQL + RLS), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-25-gym-series-1rm-pr-design.md`

---

## Restricciones globales

- **Estilos 100% inline.** Sin Tailwind, sin CSS modules, sin styled-components. Todo en
  `style={{}}`, usando los tokens de `src/theme.js`.
- **Sin dependencias de UI nuevas.** El proyecto tiene cero componentes externos.
- **Íconos** desde `src/components/icons.jsx` (SVG, `viewBox` 24×24, `strokeWidth` 2).
  Nunca emoji como ícono funcional.
- **Hover / focus / active** vía `useInteractiveStyle` de `src/hooks/useInteractiveStyle.js`.
- **Breakpoint mobile:** `window.innerWidth < 640`.
- **RLS activo en todas las tablas.** Nunca desactivarlo.
- **`auth.uid()` devuelve `null` en el editor SQL de Supabase** (corre como `service_role`).
  No usarlo en scripts manuales.
- **Commits convencionales** vía CLI (`feat:`, `fix:`, `test:`, `refactor:`).
- Correr `npm run lint` antes de cada commit.

---

## Orden y estado de la base

Las tareas 1-3 son solo lógica pura: no tocan la base ni la UI, y se pueden hacer sin
riesgo. La tarea 4 crea la tabla. Entre la tarea 4 y la 10 conviven los dos esquemas: las
columnas viejas de `gym_exercises` quedan congeladas y dejan de leerse, pero no se borran.
El backfill está escrito para ser **idempotente** (solo inserta para ejercicios que todavía
no tienen series), así que se vuelve a correr en la tarea 10 para levantar cualquier sesión
cargada en el medio.

---

## Tarea 1 — Vitest + `estimar1RM`

**Archivos:**
- Modificar: `package.json`
- Crear: `src/services/oneRepMax.js`
- Crear: `src/services/oneRepMax.test.js`

**Produce:** `estimar1RM({ weight_kg, reps }) → number | null` y la constante
`MAX_REPS_ESTIMABLE = 15`.

- [ ] **Paso 1: instalar Vitest**

```bash
npm i -D vitest
```

- [ ] **Paso 2: agregar el script de test**

En `package.json`, dentro de `"scripts"`, agregar:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Paso 3: escribir el test que falla**

Crear `src/services/oneRepMax.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { estimar1RM, MAX_REPS_ESTIMABLE } from './oneRepMax'

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
```

- [ ] **Paso 4: correr el test y verificar que falla**

```bash
npm test
```

Esperado: FAIL — `estimar1RM is not a function` (el módulo todavía no existe).

- [ ] **Paso 5: implementar el mínimo**

Crear `src/services/oneRepMax.js`:

```js
// src/services/oneRepMax.js
// Cálculo de 1RM estimado y detección de récords personales.
// Funciones puras: sin Supabase, sin React. Ver spec en
// docs/superpowers/specs/2026-08-25-gym-series-1rm-pr-design.md

// Por encima de ~12 reps la fórmula de Epley sobreestima. El corte va en 15:
// más abajo dejaría sesiones enteras sin 1RM, que es peor que un número con
// margen de error. Un 1RM derivado de 13-15 reps es orientativo.
export const MAX_REPS_ESTIMABLE = 15

// Epley: 1RM = peso × (1 + reps / 30)
export function estimar1RM({ weight_kg, reps } = {}) {
  const peso = Number(weight_kg)
  const r = Number(reps)
  if (!Number.isFinite(peso) || peso <= 0) return null
  if (!Number.isFinite(r) || r < 1 || r > MAX_REPS_ESTIMABLE) return null
  return peso * (1 + r / 30)
}
```

- [ ] **Paso 6: correr el test y verificar que pasa**

```bash
npm test
```

Esperado: PASS, 7 tests.

- [ ] **Paso 7: lint y commit**

```bash
npm run lint
git add package.json package-lock.json src/services/oneRepMax.js src/services/oneRepMax.test.js
git commit -m "test: vitest + calculo de 1RM estimado con formula Epley"
```

---

## Tarea 2 — `mejorSerie`

**Archivos:**
- Modificar: `src/services/oneRepMax.js`
- Modificar: `src/services/oneRepMax.test.js`

**Consume:** `estimar1RM` de la tarea 1.
**Produce:** `mejorSerie(series) → { serie, unaRM } | null`.

- [ ] **Paso 1: escribir el test que falla**

Agregar al final de `src/services/oneRepMax.test.js` (y sumar `mejorSerie` al import
de arriba):

```js
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
```

- [ ] **Paso 2: correr y verificar que falla**

```bash
npm test
```

Esperado: FAIL — `mejorSerie is not a function`.

- [ ] **Paso 3: implementar**

Agregar a `src/services/oneRepMax.js`:

```js
// La serie de mayor 1RM estimado. Ante empate se queda con la primera.
// Devuelve null si ninguna serie es estimable.
export function mejorSerie(series) {
  if (!Array.isArray(series)) return null
  let mejor = null
  for (const serie of series) {
    const unaRM = estimar1RM(serie)
    if (unaRM === null) continue
    if (mejor === null || unaRM > mejor.unaRM) mejor = { serie, unaRM }
  }
  return mejor
}
```

- [ ] **Paso 4: correr y verificar que pasa**

```bash
npm test
```

Esperado: PASS, 13 tests.

- [ ] **Paso 5: lint y commit**

```bash
npm run lint
git add src/services/oneRepMax.js src/services/oneRepMax.test.js
git commit -m "feat: seleccion de mejor serie por 1RM estimado"
```

---

## Tarea 3 — `normalizarNombre` y `detectarPR`

**Archivos:**
- Modificar: `src/services/oneRepMax.js`
- Modificar: `src/services/oneRepMax.test.js`

**Consume:** `mejorSerie` de la tarea 2.
**Produce:** `normalizarNombre(nombre) → string` y
`detectarPR(mejorHoy, mejorPrevio) → { esPR: boolean, mejora: number }`.
Ambos argumentos de `detectarPR` tienen la forma que devuelve `mejorSerie`
(`{ serie, unaRM }`) o `null`.

- [ ] **Paso 1: escribir el test que falla**

Agregar al final de `src/services/oneRepMax.test.js` (sumar ambas funciones al import):

```js
describe('normalizarNombre', () => {
  it('pasa a minúsculas y recorta los bordes', () => {
    expect(normalizarNombre('  Press Banca ')).toBe('press banca')
  })

  it('colapsa espacios internos', () => {
    expect(normalizarNombre('Press    Banca')).toBe('press banca')
  })

  it('devuelve string vacío si no recibe un string', () => {
    expect(normalizarNombre(null)).toBe('')
  })
})

describe('detectarPR', () => {
  it('es PR cuando supera el 1RM histórico', () => {
    const r = detectarPR({ unaRM: 105 }, { unaRM: 100 })
    expect(r.esPR).toBe(true)
    expect(r.mejora).toBeCloseTo(5, 2)
  })

  it('no es PR cuando empata', () => {
    expect(detectarPR({ unaRM: 100 }, { unaRM: 100 }).esPR).toBe(false)
  })

  it('no es PR cuando queda por debajo', () => {
    expect(detectarPR({ unaRM: 95 }, { unaRM: 100 }).esPR).toBe(false)
  })

  it('no es PR la primera vez que se hace el ejercicio', () => {
    expect(detectarPR({ unaRM: 100 }, null).esPR).toBe(false)
  })

  it('no es PR si hoy no hay serie estimable', () => {
    expect(detectarPR(null, { unaRM: 100 }).esPR).toBe(false)
  })
})
```

- [ ] **Paso 2: correr y verificar que falla**

```bash
npm test
```

Esperado: FAIL — `normalizarNombre is not a function`.

- [ ] **Paso 3: implementar**

Agregar a `src/services/oneRepMax.js`:

```js
// Los ejercicios se emparejan por nombre porque no hay catálogo. Sin esto,
// "Press Banca" y "press banca " serían dos ejercicios distintos y se perdería
// el histórico. No resuelve variantes de tipeo ("Press de banca"): ver la
// limitación conocida en el spec.
export function normalizarNombre(nombre) {
  if (typeof nombre !== 'string') return ''
  return nombre.trim().toLowerCase().replace(/\s+/g, ' ')
}

// PR se define por 1RM estimado: engloba tanto subir el peso como hacer más
// reps con el mismo peso. La primera vez que se hace un ejercicio no es récord.
export function detectarPR(mejorHoy, mejorPrevio) {
  if (!mejorHoy || !mejorPrevio) return { esPR: false, mejora: 0 }
  const mejora = mejorHoy.unaRM - mejorPrevio.unaRM
  if (mejora <= 0) return { esPR: false, mejora: 0 }
  return { esPR: true, mejora }
}
```

- [ ] **Paso 4: correr y verificar que pasa**

```bash
npm test
```

Esperado: PASS, 21 tests.

- [ ] **Paso 5: lint y commit**

```bash
npm run lint
git add src/services/oneRepMax.js src/services/oneRepMax.test.js
git commit -m "feat: deteccion de PR por 1RM estimado y normalizacion de nombres"
```

---

## Tarea 4 — Migración aditiva: tabla `gym_sets`

**Archivos:**
- Crear: `supabase/migrations/20260826120000_create_gym_sets.sql`

Esta tarea toca la base real. **No borra nada.**

- [ ] **Paso 1: escribir la migración**

Crear `supabase/migrations/20260826120000_create_gym_sets.sql`:

```sql
-- Modelo por serie para el registro de gimnasio.
-- Ver docs/superpowers/specs/2026-08-25-gym-series-1rm-pr-design.md
--
-- Esta migración es ADITIVA: crea la tabla, aplica RLS y backfillea desde los
-- datos existentes. Las columnas viejas de gym_exercises quedan intactas y se
-- borran en una migración posterior, una vez verificado el resultado.

CREATE TABLE IF NOT EXISTS gym_sets (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exercise_id bigint NOT NULL REFERENCES gym_exercises(id) ON DELETE CASCADE,
  set_number  int NOT NULL,
  weight_kg   numeric,
  reps        int,
  rir         int,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gym_sets_exercise_id_idx ON gym_sets (exercise_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- gym_sets no tiene user_id: la pertenencia se deriva dos niveles arriba,
-- gym_sets → gym_exercises → gym_logs.user_id. Mismo patrón que meal_logs.

ALTER TABLE gym_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gym_sets: select own"
  ON gym_sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM gym_exercises
      JOIN gym_logs ON gym_logs.id = gym_exercises.log_id
      WHERE gym_exercises.id = gym_sets.exercise_id
        AND gym_logs.user_id = auth.uid()
    )
  );

CREATE POLICY "gym_sets: insert own"
  ON gym_sets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gym_exercises
      JOIN gym_logs ON gym_logs.id = gym_exercises.log_id
      WHERE gym_exercises.id = gym_sets.exercise_id
        AND gym_logs.user_id = auth.uid()
    )
  );

CREATE POLICY "gym_sets: update own"
  ON gym_sets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM gym_exercises
      JOIN gym_logs ON gym_logs.id = gym_exercises.log_id
      WHERE gym_exercises.id = gym_sets.exercise_id
        AND gym_logs.user_id = auth.uid()
    )
  );

CREATE POLICY "gym_sets: delete own"
  ON gym_sets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM gym_exercises
      JOIN gym_logs ON gym_logs.id = gym_exercises.log_id
      WHERE gym_exercises.id = gym_sets.exercise_id
        AND gym_logs.user_id = auth.uid()
    )
  );

-- ── Backfill (idempotente) ────────────────────────────────────────────────────
-- Cada ejercicio con sets = N genera N series idénticas. Solo inserta para
-- ejercicios que todavía no tienen series, así se puede volver a correr sin
-- duplicar — necesario para levantar sesiones cargadas entre esta migración y
-- el deploy de la UI nueva.

INSERT INTO gym_sets (exercise_id, set_number, weight_kg, reps, rir)
SELECT e.id, s.n, e.weight_kg, e.reps, e.rir
FROM gym_exercises e
CROSS JOIN LATERAL generate_series(1, GREATEST(COALESCE(e.sets, 1), 1)) AS s(n)
WHERE NOT EXISTS (
  SELECT 1 FROM gym_sets gs WHERE gs.exercise_id = e.id
);
```

- [ ] **Paso 2: hacer backup antes de tocar la base**

En Supabase → Database → Backups, confirmar que hay un backup reciente. Hay una sola
base y no hay ambiente de desarrollo separado.

- [ ] **Paso 3: correr la migración en el editor SQL de Supabase**

Pegar el archivo completo y ejecutar.

- [ ] **Paso 4: verificar que el backfill cuadra**

Correr en el editor SQL:

```sql
SELECT
  (SELECT SUM(GREATEST(COALESCE(sets, 1), 1)) FROM gym_exercises) AS esperado,
  (SELECT COUNT(*) FROM gym_sets)                                 AS obtenido;
```

Esperado: las dos columnas dan el mismo número.

- [ ] **Paso 5: verificar que RLS quedó activo**

```sql
SELECT relrowsecurity FROM pg_class WHERE relname = 'gym_sets';
```

Esperado: `true`.

```sql
SELECT policyname FROM pg_policies WHERE tablename = 'gym_sets';
```

Esperado: 4 filas (select / insert / update / delete).

- [ ] **Paso 6: commit**

```bash
git add supabase/migrations/20260826120000_create_gym_sets.sql
git commit -m "feat(db): tabla gym_sets con RLS y backfill idempotente"
```

---

## Tarea 5 — Leer y escribir series desde `Gimnasio.jsx`

**Archivos:**
- Modificar: `src/pages/Gimnasio.jsx`

**Consume:** la tabla `gym_sets` de la tarea 4.

Después de esta tarea la app escribe series de verdad y las columnas viejas dejan de
leerse. El modal pasa de cuatro campos sueltos a una lista de series.

- [ ] **Paso 1: traer las series en las queries de lectura**

En `cargarHoy()` (`src/pages/Gimnasio.jsx:55`), reemplazar la query de ejercicios:

```js
const { data: ejs } = await supabase
  .from('gym_exercises')
  .select('*, gym_sets(*)')
  .eq('log_id', sesion.id)
  .order('id')
  .order('set_number', { referencedTable: 'gym_sets' })
```

En `cargarHistorial()` (`src/pages/Gimnasio.jsx:62`):

```js
const { data } = await supabase
  .from('gym_logs')
  .select('*, gym_exercises(*, gym_sets(*))')
  .eq('user_id', session.user.id)
  .order('date', { ascending: false })
  .limit(20)
```

- [ ] **Paso 2: cambiar la forma del estado del formulario**

Reemplazar el `useState` de `formEj` (`src/pages/Gimnasio.jsx:39`):

```js
const SERIE_VACIA = { weight_kg: '', reps: '', rir: '' }
const [formEj, setFormEj] = useState({ exercise_name: '', notes: '', series: [{ ...SERIE_VACIA }] })
```

(`SERIE_VACIA` va a nivel de módulo, arriba del componente, junto a `RUTINAS`.)

- [ ] **Paso 3: reescribir el guardado**

Reemplazar `guardarEjercicio()` (`src/pages/Gimnasio.jsx:95-101`):

```js
async function guardarEjercicio() {
  setSaving(true)
  const base = { exercise_name: formEj.exercise_name, notes: formEj.notes, log_id: sesionHoy.id }

  let exerciseId
  if (modalEj === 'nuevo') {
    const { data } = await supabase.from('gym_exercises').insert(base).select()
    exerciseId = data?.[0]?.id
  } else {
    exerciseId = modalEj.id
    await supabase.from('gym_exercises').update(base).eq('id', exerciseId)
    await supabase.from('gym_sets').delete().eq('exercise_id', exerciseId)
  }

  const filas = formEj.series.map((s, i) => ({
    exercise_id: exerciseId,
    set_number: i + 1,
    weight_kg: s.weight_kg === '' ? null : Number(s.weight_kg),
    reps: s.reps === '' ? null : Number(s.reps),
    // RIR 0 es un valor válido y significativo: comparar contra '' y no usar
    // `Number(x) || null`, que lo convertiría en null.
    rir: s.rir === '' ? null : Number(s.rir),
  }))
  if (filas.length) await supabase.from('gym_sets').insert(filas)

  await cargarHoy(); await cargarHistorial(); setSaving(false); setModalEj(null)
}
```

- [ ] **Paso 4: adaptar los abridores del modal**

Reemplazar `abrirNuevoEj()` y `abrirEditarEj()` (`src/pages/Gimnasio.jsx:109-117`):

```js
function abrirNuevoEj() {
  setFormEj({ exercise_name: '', notes: '', series: [{ ...SERIE_VACIA }] })
  setModalEj('nuevo')
}

function abrirEditarEj(ej) {
  const series = (ej.gym_sets || [])
    .slice()
    .sort((a, b) => a.set_number - b.set_number)
    .map(s => ({
      weight_kg: s.weight_kg ?? '',
      reps: s.reps ?? '',
      rir: s.rir ?? '',
    }))
  setFormEj({
    exercise_name: ej.exercise_name,
    notes: ej.notes || '',
    series: series.length ? series : [{ ...SERIE_VACIA }],
  })
  setModalEj(ej)
}
```

- [ ] **Paso 5: agregar los helpers de edición de series**

Dentro del componente, junto a los otros handlers:

```js
function actualizarSerie(i, campo, valor) {
  setFormEj(f => ({
    ...f,
    series: f.series.map((s, idx) => (idx === i ? { ...s, [campo]: valor } : s)),
  }))
}

function agregarSerie() {
  setFormEj(f => ({ ...f, series: [...f.series, { ...SERIE_VACIA }] }))
}

// Cargar 4 series iguales no puede costar 4 veces el trabajo: es el caso más
// frecuente y sin esto la carga empeora respecto del formulario anterior.
function duplicarUltimaSerie() {
  setFormEj(f => ({ ...f, series: [...f.series, { ...f.series[f.series.length - 1] }] }))
}

function quitarSerie(i) {
  setFormEj(f => ({ ...f, series: f.series.filter((_, idx) => idx !== i) }))
}
```

- [ ] **Paso 6: reemplazar la grilla de inputs del modal**

En el modal (`src/pages/Gimnasio.jsx:308-316`), reemplazar la grilla de cuatro inputs por
la lista de series:

```jsx
<div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '6px' }}>Series</div>

{formEj.series.map((s, i) => (
  <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 1fr 32px', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
    <span style={{ fontSize: '12px', color: C.textMuted, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
    <input type="number" inputMode="decimal" value={s.weight_kg} placeholder="kg"
      onChange={e => actualizarSerie(i, 'weight_kg', e.target.value)} style={{ ...inp, margin: 0 }} />
    <input type="number" inputMode="numeric" value={s.reps} placeholder="reps"
      onChange={e => actualizarSerie(i, 'reps', e.target.value)} style={{ ...inp, margin: 0 }} />
    <input type="number" inputMode="numeric" value={s.rir} placeholder="RIR"
      onChange={e => actualizarSerie(i, 'rir', e.target.value)} style={{ ...inp, margin: 0 }} />
    {formEj.series.length > 1
      ? <TinyDangerButton onClick={() => quitarSerie(i)}><IconClose size={11} /></TinyDangerButton>
      : <span />}
  </div>
))}

<div style={{ display: 'flex', gap: '8px', margin: '4px 0 16px' }}>
  <TinyGhostButton onClick={agregarSerie}>+ Serie</TinyGhostButton>
  <TinyGhostButton onClick={duplicarUltimaSerie}>Duplicar última</TinyGhostButton>
</div>
```

- [ ] **Paso 7: verificar a mano en la app**

```bash
npm run dev
```

En `localhost:5173` → Gimnasio → Hoy:
1. Crear una sesión y agregar un ejercicio con 3 series de distinto peso.
2. Guardar, recargar la página: las 3 series vuelven con sus valores y en orden.
3. Editar el ejercicio, borrar la serie del medio, guardar: quedan 2 series renumeradas 1 y 2.
4. Cargar una serie con **RIR 0** y verificar que al reabrir sigue diciendo 0 y no está vacía.
5. Usar "Duplicar última" y confirmar que copia peso, reps y RIR.

- [ ] **Paso 8: lint, tests y commit**

```bash
npm run lint && npm test
git add src/pages/Gimnasio.jsx
git commit -m "feat: carga de ejercicios serie por serie"
```

---

## Tarea 6 — La plantilla también siembra series

**Archivos:**
- Modificar: `src/pages/Gimnasio.jsx`

`cargarPlantilla()` inserta ejercicios desde `routine_templates`. Sin este cambio, los
ejercicios sembrados desde plantilla quedarían sin ninguna serie.

- [ ] **Paso 1: reescribir `cargarPlantilla`**

Reemplazar el cuerpo de `cargarPlantilla()` (`src/pages/Gimnasio.jsx:77-86`) desde el
`if (ejercicios.length > 0) await supabase...` hasta antes de `await cargarHoy()`:

```js
if (ejercicios.length > 0) await supabase.from('gym_exercises').delete().eq('log_id', sesionHoy.id)

const { data: creados } = await supabase
  .from('gym_exercises')
  .insert(plantilla.map(p => ({
    log_id: sesionHoy.id,
    exercise_name: p.exercise_name,
    notes: '',
  })))
  .select()

// default_sets de la plantilla define cuántas series se siembran.
const filas = []
creados?.forEach((ej, i) => {
  const p = plantilla[i]
  const cantidad = Math.max(p.default_sets || 1, 1)
  for (let n = 1; n <= cantidad; n++) {
    filas.push({
      exercise_id: ej.id,
      set_number: n,
      weight_kg: p.default_weight_kg ?? null,
      reps: p.default_reps ?? null,
      rir: null,
    })
  }
})
if (filas.length) await supabase.from('gym_sets').insert(filas)
```

> El borrado de `gym_exercises` arrastra sus series por el `ON DELETE CASCADE`, así que
> no hace falta borrar `gym_sets` a mano.

- [ ] **Paso 2: verificar a mano**

```bash
npm run dev
```

1. En Gimnasio → Hoy, elegir un tipo de rutina que tenga plantilla cargada.
2. Tocar "Plantilla".
3. Abrir un ejercicio sembrado: debe tener tantas series como `default_sets`, todas con
   el peso y las reps por defecto.
4. Volver a tocar "Plantilla" y aceptar el reemplazo: no deben quedar series huérfanas
   (verificar en Supabase con `SELECT COUNT(*) FROM gym_sets gs WHERE NOT EXISTS
   (SELECT 1 FROM gym_exercises e WHERE e.id = gs.exercise_id);` → debe dar `0`).

- [ ] **Paso 3: lint, tests y commit**

```bash
npm run lint && npm test
git add src/pages/Gimnasio.jsx
git commit -m "feat: la plantilla de rutina siembra las series del ejercicio"
```

---

## Tarea 7 — Mostrar resumen de series y 1RM estimado

**Archivos:**
- Modificar: `src/pages/Gimnasio.jsx`

**Consume:** `mejorSerie` y `estimar1RM` de las tareas 1-2.

- [ ] **Paso 1: importar el servicio**

En el bloque de imports de `src/pages/Gimnasio.jsx`:

```js
import { mejorSerie } from '../services/oneRepMax'
```

- [ ] **Paso 2: agregar el helper de resumen**

A nivel de módulo, abajo del componente junto a `Pill`:

```js
// "4 series · mejor 85 × 5" — null si el ejercicio no tiene series cargadas.
function resumenSeries(series) {
  if (!series?.length) return null
  const mejor = mejorSerie(series)
  const cantidad = `${series.length} serie${series.length !== 1 ? 's' : ''}`
  if (!mejor) return cantidad
  const { weight_kg, reps } = mejor.serie
  return `${cantidad} · mejor ${weight_kg} × ${reps}`
}
```

- [ ] **Paso 3: mostrarlo en la vista mobile**

En la tarjeta de ejercicio de mobile (`src/pages/Gimnasio.jsx:204-209`), reemplazar la
fila de `Pill` por:

```jsx
<div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
  <span style={{ fontSize: '13px', color: C.textSecondary }}>{resumenSeries(ej.gym_sets)}</span>
  {mejorSerie(ej.gym_sets || []) && (
    <Pill label="1RM est." value={`${Math.round(mejorSerie(ej.gym_sets).unaRM)} kg`} accent />
  )}
</div>
```

- [ ] **Paso 4: mostrarlo en la tabla de desktop**

En la tabla (`src/pages/Gimnasio.jsx:216-243`), cambiar los encabezados a
`['Ejercicio', 'Series', '1RM est.', 'Notas', '']` y reemplazar las celdas de
`Series / Reps / Kg / RIR` por dos:

```jsx
<td style={{ padding: '12px 14px', color: C.textSecondary }}>{resumenSeries(ej.gym_sets) || '—'}</td>
<td style={{ padding: '12px 14px', color: C.accentText, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
  {mejorSerie(ej.gym_sets || []) ? `${Math.round(mejorSerie(ej.gym_sets).unaRM)} kg` : '—'}
</td>
```

- [ ] **Paso 5: arreglar los chips del historial**

Los chips de la vista Historial (`src/pages/Gimnasio.jsx:284`) leen `ej.weight_kg`, una
columna que la tarea 10 elimina. Hoy funciona, pero se rompería en silencio (mostraría solo
el nombre). Reemplazar por el peso de la mejor serie:

```jsx
{s.gym_exercises.map(ej => {
  const mejor = mejorSerie(ej.gym_sets || [])
  return (
    <span key={ej.id} style={{ fontSize: '12px', background: C.surfaceHigh, color: C.textSecondary, padding: '3px 10px', borderRadius: '20px', border: `1px solid ${C.border}` }}>
      {ej.exercise_name}{mejor ? ` · ${mejor.serie.weight_kg}kg` : ''}
    </span>
  )
})}
```

- [ ] **Paso 6: verificar a mano**

```bash
npm run dev
```

1. Ejercicio con series `80×8`, `85×6`, `85×5` → el resumen dice `3 series · mejor 85 × 6`
   (85×6 = 102 estimado, mayor que 80×8 = 101,3) y el 1RM muestra `102 kg`.
2. Ejercicio de futsal o cardio, sin peso → resumen con la cantidad de series y 1RM en `—`,
   sin romperse.
3. Ejercicio sin ninguna serie → celdas en `—`.
4. Achicar la ventana por debajo de 640px y confirmar que la vista mobile muestra lo mismo.
5. Ir a la pestaña Historial: los chips siguen mostrando `nombre · Nkg` con el peso de la
   mejor serie, y los ejercicios sin peso muestran solo el nombre.

- [ ] **Paso 7: lint, tests y commit**

```bash
npm run lint && npm test
git add src/pages/Gimnasio.jsx
git commit -m "feat: resumen de series y 1RM estimado en la lista de ejercicios"
```

---

## Tarea 8 — Detección y badge de PR

**Archivos:**
- Modificar: `src/pages/Gimnasio.jsx`
- Modificar: `src/components/icons.jsx`

**Consume:** `mejorSerie`, `detectarPR` y `normalizarNombre` de las tareas 1-3.

- [ ] **Paso 1: agregar el ícono de trofeo**

Al final de `src/components/icons.jsx`, siguiendo el lenguaje del resto (viewBox 24×24,
stroke 2, round caps):

```jsx
export function IconTrophy(p) {
  return <Svg {...p}><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M7 6H4v2a3 3 0 0 0 3 3" /><path d="M17 6h3v2a3 3 0 0 1-3 3" /><line x1="12" y1="14" x2="12" y2="18" /><path d="M8 21h8" /><path d="M10 18h4v3h-4z" /></Svg>
}
```

- [ ] **Paso 2: importar lo necesario en Gimnasio**

```js
import { mejorSerie, detectarPR, normalizarNombre } from '../services/oneRepMax'
import { IconPlan, IconTrash, IconGym, IconCheck, IconClose, IconTrophy } from '../components/icons'
```

- [ ] **Paso 3: agregar el estado y la carga del histórico**

Junto a los demás `useState` del componente:

```js
const [historicoPR, setHistoricoPR] = useState({})
```

Y una función nueva, llamada desde el `useEffect` inicial:

```js
// Mejor 1RM histórico por ejercicio (nombre normalizado → { serie, unaRM }),
// excluyendo la sesión de hoy: si no, el récord de hoy se compararía consigo mismo.
async function cargarHistoricoPR() {
  const { data } = await supabase
    .from('gym_exercises')
    .select('exercise_name, gym_sets(weight_kg, reps), gym_logs!inner(user_id, date)')
    .eq('gym_logs.user_id', session.user.id)
    .neq('gym_logs.date', hoy)

  const mapa = {}
  for (const ej of data || []) {
    const clave = normalizarNombre(ej.exercise_name)
    const mejor = mejorSerie(ej.gym_sets || [])
    if (!mejor) continue
    if (!mapa[clave] || mejor.unaRM > mapa[clave].unaRM) mapa[clave] = mejor
  }
  setHistoricoPR(mapa)
}
```

Actualizar el `useEffect` (`src/pages/Gimnasio.jsx:47`):

```js
useEffect(() => { cargarHoy(); cargarHistorial(); cargarHistoricoPR() }, [])
```

Y llamarla también al final de `guardarEjercicio()` y de `cargarPlantilla()`, después de
`cargarHoy()`, para que el histórico refleje los cambios.

> Trae todos los ejercicios pasados del usuario y agrega en el cliente, porque la
> normalización de nombres vive en JS y la base no la conoce. Para el volumen de una app
> personal es una query acotada; si el historial creciera mucho, se acota por fecha.

- [ ] **Paso 4: agregar el badge**

A nivel de módulo, junto a `Pill`:

```js
function BadgePR({ mejora }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
      background: C.yellowDim, color: C.yellow, border: `1px solid ${C.yellow}40`,
    }}>
      <IconTrophy size={11} color={C.yellow} />
      PR +{mejora.toFixed(1)} kg
    </span>
  )
}
```

- [ ] **Paso 5: mostrarlo junto al nombre del ejercicio**

Agregar un helper dentro del componente:

```js
function prDe(ej) {
  return detectarPR(mejorSerie(ej.gym_sets || []), historicoPR[normalizarNombre(ej.exercise_name)])
}
```

En mobile (`src/pages/Gimnasio.jsx:198`), envolver el nombre:

```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
  <span style={{ fontWeight: 600, fontSize: '14px', color: C.textPrimary }}>{ej.exercise_name}</span>
  {prDe(ej).esPR && <BadgePR mejora={prDe(ej).mejora} />}
</div>
```

En la celda de nombre de la tabla desktop, aplicar el mismo bloque.

- [ ] **Paso 6: verificar a mano**

```bash
npm run dev
```

1. Cargar en una fecha pasada (editando `date` en Supabase) un ejercicio "Press banca" con
   `80 × 8`. En la sesión de hoy cargar "Press banca" con `85 × 6` → aparece el badge PR.
2. Cargar hoy `70 × 5` en ese mismo ejercicio → **no** aparece badge.
3. Cargar un ejercicio que nunca hiciste antes → **no** aparece badge (la primera vez no
   es récord).
4. Cargar exactamente el mismo peso y reps que el histórico → **no** aparece badge.
5. Escribir el ejercicio como `"  press   BANCA "` → igual detecta el histórico y muestra
   el badge (normalización de nombre).

- [ ] **Paso 7: lint, tests y commit**

```bash
npm run lint && npm test
git add src/pages/Gimnasio.jsx src/components/icons.jsx
git commit -m "feat: badge de record personal por 1RM estimado"
```

---

## Tarea 9 — Adaptar el gráfico de evolución del Dashboard

**Archivos:**
- Modificar: `src/pages/Dashboard.jsx`

**Consume:** `mejorSerie` de la tarea 2.

`cargarEvolucion()` alimenta el gráfico de progresión de carga leyendo `ej.weight_kg`,
`ej.sets` y `ej.reps` — las tres columnas que elimina la tarea 10. Sin este cambio el
gráfico quedaría vacío después de la migración destructiva.

- [ ] **Paso 1: importar el servicio**

En los imports de `src/pages/Dashboard.jsx`:

```js
import { mejorSerie } from '../services/oneRepMax'
```

- [ ] **Paso 2: reescribir `cargarEvolucion`**

Reemplazar el cuerpo desde la query hasta el `setEvolucionCargas`
(`src/pages/Dashboard.jsx:241-247`):

```js
const { data: ejs } = await supabase
  .from('gym_exercises')
  .select('log_id, gym_sets(weight_kg, reps)')
  .in('log_id', logIds)
  .eq('exercise_name', ejercicioSeleccionado)
if (!ejs?.length) { setEvolucionCargas([]); return }

const evolucion = ejs.map(ej => {
  const sesion = gymLogs.find(l => l.id === ej.log_id)
  const mejor = mejorSerie(ej.gym_sets || [])
  return {
    fecha: new Date(sesion.date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
    kg: mejor ? mejor.serie.weight_kg : 0,
    series: ej.gym_sets?.length || 0,
    reps: mejor ? mejor.serie.reps : 0,
  }
}).filter(e => e.kg > 0)
setEvolucionCargas(evolucion)
```

> El gráfico ahora traza la **mejor serie** de cada sesión en vez del valor único que
> había antes. Es la lectura correcta para progresión de carga. Agregar una línea de 1RM
> estimado al gráfico queda **fuera de alcance** de este spec: esta tarea solo mantiene
> el comportamiento actual funcionando sobre el esquema nuevo.

- [ ] **Paso 3: verificar a mano**

```bash
npm run dev
```

1. En el Dashboard, ir al selector de ejercicio y elegir uno con historial.
2. El gráfico dibuja los mismos puntos que antes del cambio (una sesión = un punto).
3. Elegir un ejercicio sin peso (futsal, cardio): el gráfico queda vacío, sin romperse.

- [ ] **Paso 4: lint, tests y commit**

```bash
npm run lint && npm test
git add src/pages/Dashboard.jsx
git commit -m "fix: grafico de evolucion lee la mejor serie de gym_sets"
```

---

## Tarea 10 — Migración destructiva: limpiar las columnas viejas

**Archivos:**
- Crear: `supabase/migrations/20260827120000_drop_gym_exercises_legacy_cols.sql`

Solo después de que las tareas 5-9 estén deployadas y verificadas en uso real. Ninguna
parte del código debe leer ya `sets`, `reps`, `weight_kg` ni `rir` de `gym_exercises`:
confirmarlo con `git grep -n "ej\.weight_kg\|ej\.sets\|ej\.reps" src/` → sin resultados.

- [ ] **Paso 1: re-correr el backfill idempotente**

En el editor SQL de Supabase, volver a correr el bloque `INSERT INTO gym_sets ...` de la
tarea 4. Levanta cualquier ejercicio cargado entre aquella migración y el deploy de la UI
nueva. Verificar cuántas filas insertó: idealmente `0`.

- [ ] **Paso 2: confirmar que no quedan ejercicios sin series**

```sql
SELECT COUNT(*) FROM gym_exercises e
WHERE NOT EXISTS (SELECT 1 FROM gym_sets gs WHERE gs.exercise_id = e.id);
```

Esperado: `0`. Si da distinto de `0`, **frenar** y revisar antes de seguir.

- [ ] **Paso 3: backup**

Confirmar backup reciente en Supabase → Database → Backups. Este paso sí borra datos.

- [ ] **Paso 4: escribir y correr la migración**

Crear `supabase/migrations/20260827120000_drop_gym_exercises_legacy_cols.sql`:

```sql
-- Elimina las columnas escalares de gym_exercises, reemplazadas por gym_sets.
-- Correr SOLO después de verificar que todo ejercicio tiene sus series
-- (ver ROADMAP.md, tarea 10, paso 2). gym_exercises queda como
-- (id, log_id, exercise_name, notes).

ALTER TABLE gym_exercises
  DROP COLUMN IF EXISTS sets,
  DROP COLUMN IF EXISTS reps,
  DROP COLUMN IF EXISTS weight_kg,
  DROP COLUMN IF EXISTS rir;
```

- [ ] **Paso 5: verificar el esquema resultante**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'gym_exercises' ORDER BY ordinal_position;
```

Esperado: solo `id`, `log_id`, `exercise_name`, `notes` (más las de sistema que hubiera).

- [ ] **Paso 6: verificar que la app sigue andando**

```bash
npm run dev
```

Recorrer Gimnasio → Hoy e Historial, crear un ejercicio nuevo con series, cargar una
plantilla. Nada debe romperse: ningún código lee ya esas columnas.

- [ ] **Paso 7: commit**

```bash
git add supabase/migrations/20260827120000_drop_gym_exercises_legacy_cols.sql
git commit -m "refactor(db): eliminar columnas escalares de gym_exercises"
```

---

## Tarea 11 — Documentación y cierre

**Archivos:**
- Modificar: `CLAUDE.md`
- Modificar: `README.md`
- Crear: `DECISIONS.md`

- [ ] **Paso 1: actualizar `CLAUDE.md`**

En la tabla de tablas de Supabase, corregir la fila de `gym_exercises` (ya no tiene
`sets`, `reps`, `weight_kg`, `rir`) y agregar la fila de `gym_sets`:

```markdown
| `gym_exercises` | Ejercicios por sesion | `id`, `log_id`, `exercise_name`, `notes` |
| `gym_sets` | Series por ejercicio | `id`, `exercise_id`, `set_number`, `weight_kg`, `reps`, `rir` |
```

En "Comandos esenciales", agregar:

```markdown
npm test             # Suite de tests (Vitest) — correr antes de cada commit
```

- [ ] **Paso 2: actualizar `README.md`**

Agregar `gym_sets` a la tabla de base de datos y sumar a la lista de features:
1RM estimado por ejercicio y detección de récords personales.

- [ ] **Paso 3: crear `DECISIONS.md`**

```markdown
# Decisiones

Registro de ambigüedades resueltas durante la implementación.
Ver `vibecoding-estructurado.md` (vault) para el flujo.

## Spec 1 — Series, 1RM y PR (2026-08-25)

- **Fórmula Epley** (`peso × (1 + reps/30)`) sobre Brzycki o Lombardi: es la de uso
  más extendido y coincide exactamente en reps = 1. Vive en una sola función, así que
  cambiarla es una línea más sus tests.
- **Tope de 15 repeticiones, no 12.** Por encima de ~12 reps Epley sobreestima, pero
  cortar en 12 dejaría sesiones enteras sin 1RM ni posibilidad de PR. Un 1RM derivado
  de 13-15 reps se lee como orientativo: sirve para comparar la propia progresión, no
  contra tablas externas.
- **PR definido por 1RM estimado**, no por peso máximo levantado: engloba tanto subir
  el peso como hacer más reps con el mismo peso. Con "peso máximo", pasar de 85×3 a
  85×5 no contaría como progreso, cuando claramente lo es.
- **`is_warmup` excluido del modelo.** openGym lo tiene, pero la mejor serie se define
  por mayor 1RM y una serie de calentamiento es más liviana: nunca gana. Sería
  complejidad sin efecto.
- **Migración partida en dos scripts SQL** con verificación manual entre medio, porque
  hay una sola base y no hay ambiente de desarrollo separado. El backfill es idempotente
  para poder re-correrlo antes del paso destructivo.
- **Tests solo sobre lógica pura**, no sobre componentes React ni queries a Supabase:
  requerirían mocks pesados y la lógica de UI está acoplada a estilos inline, lo que
  haría esos tests caros de mantener sin cubrir la parte riesgosa.
- **Empate en `mejorSerie` se resuelve por la primera serie.** Arbitrario pero
  determinista; ninguna de las dos es "más" récord que la otra.
- **RIR 0 se distingue de RIR vacío.** El código anterior usaba `Number(x) || null`,
  que convertía un RIR 0 (fallo muscular) en `null`. Se compara contra `''`.
```

- [ ] **Paso 4: verificación final**

```bash
npm test && npm run lint && npm run build
```

Esperado: 21 tests en verde, sin errores de lint, build exitoso.

- [ ] **Paso 5: commit**

```bash
git add CLAUDE.md README.md DECISIONS.md
git commit -m "docs: documentar gym_sets, 1RM y decisiones del spec 1"
```

---

## Cierre

Con las 11 tareas completas:

- [ ] Correr la suite entera: `npm test`
- [ ] Revisar `DECISIONS.md` completo
- [ ] Leer el diff de las tareas 5 y 8, que son las más grandes y riesgosas
- [ ] `npm run build && npx cap sync android` si se va a compilar el APK
- [ ] `git push origin main` — dispara Vercel y el build del APK

**Después de esto:** Spec 2 (motor de progresión automática), que consume `estimar1RM`
y `mejorSerie` ya construidos.
