# Spec 1 — Series, 1RM estimado y detección de PR

**Fecha:** 2026-08-25
**Estado:** aprobado, pendiente de plan de implementación
**Inspiración:** [openGym](https://gitea.com/DuarteSantos/openGym)

---

## Contexto

Hoy `Gimnasio.jsx` es un registro: anotás qué hiciste y ahí termina. No te dice si
progresaste, si batiste un récord, ni cómo se compara la sesión de hoy con la de hace
un mes. openGym resuelve eso con 1RM estimado y detección de PR sobre un modelo de
datos por serie.

El bloqueo para replicarlo es el schema actual: `gym_exercises` guarda una fila por
ejercicio con `sets`, `reps`, `weight_kg` como escalares (`4 × 8 @ 80kg`). Si las series
no fueron todas al mismo peso, ese registro único no dice cuál fue la mejor — y tanto el
1RM como el PR se calculan sobre la mejor serie.

Este spec migra el modelo a filas por serie y construye encima el cálculo de 1RM y la
detección de PR. Es la base de la que dependen las features siguientes.

### Glosario

- **PR** (*Personal Record*): tu mejor marca histórica en un ejercicio.
- **1RM** (*One Repetition Maximum*): el peso máximo que podrías levantar una sola vez.
  Es la vara común que permite comparar series de distinto peso y reps entre sí.
- **1RM estimado**: el 1RM deducido de una serie normal mediante fórmula, sin necesidad
  de intentar el máximo real.
- **RIR** (*Reps In Reserve*): cuántas repeticiones te quedaban en el tanque al terminar
  la serie.

---

## Alcance

**Incluye:**

- Tabla `gym_sets` (una fila por serie) con sus policies RLS.
- Migración de los datos existentes, en dos pasos separados.
- Servicio puro `src/services/oneRepMax.js` con el cálculo de 1RM, selección de mejor
  serie y detección de PR.
- Vitest como framework de tests, cubriendo la lógica pura.
- Carga de ejercicios serie por serie en la UI.
- Visualización del 1RM estimado y badge de PR.

**No incluye** (specs posteriores):

- Motor de progresión automática: sugerir próximo peso, detectar estancamiento, deload
  (Spec 2 — depende de este).
- Heatmap anual de actividad y muscle mapping (Spec 3 — independiente).
- Catálogo de ejercicios importado (tipo ExerciseDB).
- Rest timer durante el entrenamiento.
- Import desde Strong / Hevy / FitNotes.

---

## Modelo de datos

### Tabla `gym_sets`

| Columna | Tipo | Nota |
|---|---|---|
| `id` | `bigint` PK generated always as identity | |
| `exercise_id` | `bigint` FK → `gym_exercises.id` | `ON DELETE CASCADE` |
| `set_number` | `int` NOT NULL | orden dentro del ejercicio (1, 2, 3…) |
| `weight_kg` | `numeric` NULL | `null` = sin peso (futsal, cardio, peso corporal) |
| `reps` | `int` NULL | |
| `rir` | `int` NULL | |
| `created_at` | `timestamptz` DEFAULT `now()` | |

Índice sobre `exercise_id` (toda lectura filtra por ahí).

**`is_warmup` queda deliberadamente afuera.** openGym distingue series de calentamiento,
pero acá no aportaría: la mejor serie se define como la de mayor 1RM estimado, y una
serie de calentamiento es por definición más liviana, así que nunca gana. Sería
complejidad sin efecto sobre el resultado.

### RLS

`gym_sets` no lleva `user_id`. La pertenencia se deriva dos niveles arriba:

```
gym_sets → gym_exercises → gym_logs.user_id
```

Las cuatro policies (select / insert / update / delete) siguen la forma que ya usa
`meal_logs`, que tiene exactamente la misma estructura de dos saltos: un `EXISTS` con
`JOIN` contra la tabla padre verificando `auth.uid()`.

### Migración: dos migraciones SQL con una verificación entre medio

El proyecto tiene **una sola base de datos, sin ambiente de desarrollo separado** (ver
`Vault/Proyectos/NutriGym Tracker/MCP - conectar Claude a la base de NutriGym.md`).
Cualquier operación destructiva impacta datos reales. Por eso la migración no se hace
de una sola vez:

**Paso 1 — aditivo, sin riesgo.** Crear `gym_sets`, aplicar RLS, y backfillear desde los
datos existentes: cada `gym_exercises` con `sets = N` genera N filas idénticas
(`4 × 8 @ 80kg` → 4 filas de `8 reps @ 80kg`, `set_number` 1 a 4, mismo `rir`). Las
columnas viejas quedan intactas y la app sigue funcionando con ambos esquemas.

**Paso 2 — verificación manual.** Contrastar contra los datos reales que el conteo de
filas cuadre: `SUM(COALESCE(sets, 1))` sobre `gym_exercises` debe igualar `COUNT(*)`
sobre `gym_sets`.

**Paso 3 — destructivo, en migración aparte y posterior.** Recién ahí dropear `sets`,
`reps`, `weight_kg` y `rir` de `gym_exercises`, que queda como
`(id, log_id, exercise_name, notes)`.

Detalles del backfill:

- Ejercicio con `sets` nulo o 0 → se migra como **una** serie.
- `routine_templates` **no se toca**. Sus `default_sets` / `default_reps` /
  `default_weight_kg` describen un plan, no un registro; siguen sirviendo para sembrar
  la sesión del día.
- La migración corre como `service_role` desde el editor SQL, así que RLS no aplica y
  `auth.uid()` sería `null` — no usarlo en el script (ver gotcha en `CLAUDE.md`).

---

## Servicio de cálculo

Archivo nuevo: `src/services/oneRepMax.js`. Funciones puras, sin Supabase y sin React.
Toda la aritmética vive acá y se testea sin mocks, siguiendo el patrón de los servicios
existentes (`geminiPlan.js`, `notifications.js`).

### API

```js
estimar1RM({ weight_kg, reps })    → number | null
mejorSerie(series)                 → { serie, unaRM } | null
detectarPR(mejorHoy, mejorPrevio)  → { esPR: boolean, mejora: number }
normalizarNombre(nombre)           → string
```

### Fórmula: Epley

```
1RM = peso × (1 + reps / 30)
```

Elegida por ser la de uso más extendido y por coincidir exactamente en `reps = 1`. Vive
en una única función, así que cambiarla después es una línea más sus tests.

### Reglas de cálculo

**Tope de 15 repeticiones.** Por encima de ~12 reps Epley tiende a sobreestimar, y a 20
reps devuelve un número que no representa nada. El corte va en 15: series más largas
devuelven `null` en vez de un valor falso. Se eligió 15 y no 12 porque cortar antes
dejaría sesiones enteras sin 1RM ni posibilidad de PR, lo que es peor que un número con
más margen de error. Un 1RM derivado de una serie de 13-15 reps es orientativo: sirve
para comparar la propia progresión (que es el uso real), no para comparar contra tablas
externas.

**PR se define por 1RM estimado.** Es la definición que engloba a las otras: tanto subir
el peso como hacer más reps con el mismo peso levantan el 1RM estimado. Si en cambio se
tomara "peso máximo levantado", hacer 85×5 después de 85×3 no contaría como progreso,
cuando claramente lo es.

**El match entre ejercicios es por nombre normalizado.** No hay catálogo de ejercicios,
así que el histórico de un ejercicio se busca por string. `normalizarNombre` aplica
minúsculas, `trim` y colapso de espacios internos: sin eso `"Press Banca"` y
`"press banca "` serían dos ejercicios distintos y se perdería el PR.

> **Limitación conocida:** la normalización no resuelve variantes reales de tipeo
> (`"Press de banca"` vs `"Press banca"`). Quedan como ejercicios distintos y cada uno
> lleva su propio histórico. Se resolvería con un catálogo de ejercicios, que está fuera
> del alcance de este spec.

### Casos borde

| Caso | Comportamiento |
|---|---|
| `weight_kg` null (futsal, cardio, peso corporal) | sin 1RM (`null`) |
| `reps` null | sin 1RM (`null`) |
| `reps` > 15 | sin 1RM (`null`) |
| `reps` = 1 | 1RM = peso exacto |
| Ejercicio sin ninguna serie estimable | `mejorSerie` devuelve `null` |
| Ejercicio sin historial previo | **no** es PR (la primera vez no es récord) |
| Empate exacto contra el histórico | **no** es PR |
| `weight_kg` = 0 | tratado como sin peso → sin 1RM |

### Separación de responsabilidades

El servicio **no sabe que Supabase existe**. La query del histórico vive en
`Gimnasio.jsx`: trae las series pasadas de los ejercicios presentes en la sesión de hoy,
excluyendo la sesión actual, y le pasa los datos ya cargados a las funciones puras.

---

## Cambios de UI

Todos siguiendo la convención del proyecto: estilos inline, tokens de `theme.js`, íconos
de `components/icons.jsx`, interacción vía `useInteractiveStyle`.

### Modal de ejercicio

Hoy tiene cuatro campos sueltos (`sets`, `reps`, `weight_kg`, `rir`). Pasa a ser una
lista de series editables:

- Una fila por serie con peso, reps y RIR.
- Botón **+ Serie** para agregar.
- Botón **duplicar última serie**: cargar 4 series iguales no puede costar 4 veces el
  trabajo. Es el caso más frecuente y sin esto la UX empeora respecto de hoy.
- Botón de borrar por fila.
- El nombre del ejercicio y las observaciones siguen igual.

### Lista de ejercicios del día

Cada ejercicio muestra el resumen de sus series (ej. `4 series · mejor 85 × 5`), su 1RM
estimado, y el badge de PR cuando corresponde. En mobile y desktop se respetan los dos
layouts que ya existen (lista de tarjetas y tabla).

### Carga desde plantilla

`cargarPlantilla()` hoy inserta filas en `gym_exercises` con los valores por defecto de
`routine_templates`. Pasa a insertar además las N filas correspondientes en `gym_sets`,
usando `default_sets` como cantidad de series.

### Badge de PR

Marca visual sobre el ejercicio cuando la mejor serie de hoy supera el mejor 1RM
histórico de ese ejercicio, con la mejora expresada en kg.

### Consumidores existentes que hay que adaptar

Dos lugares fuera del flujo principal leen las columnas escalares y romperían con la
migración destructiva:

- **Chips del historial** en `Gimnasio.jsx`: muestran `nombre · Nkg` desde `ej.weight_kg`.
  Pasan a usar el peso de la mejor serie.
- **Gráfico de evolución de carga** en `Dashboard.jsx` (`cargarEvolucion`): lee
  `weight_kg`, `sets` y `reps` para trazar la progresión por ejercicio. Pasa a leer la
  mejor serie de cada sesión, que es además la lectura correcta para progresión de carga.

Agregar una línea de 1RM estimado al gráfico del Dashboard queda **fuera de alcance**: el
cambio solo mantiene el comportamiento actual funcionando sobre el esquema nuevo.

---

## Testing

Se agrega **Vitest** como dependencia de desarrollo, con script `npm test`.

Se testea la lógica pura de `oneRepMax.js`, que es donde un bug pasa desapercibido y
muestra un número equivocado sin fallar:

- `estimar1RM`: valores conocidos, `reps = 1`, el corte en 15, nulls, peso 0.
- `mejorSerie`: elige por 1RM y no por peso crudo, lista vacía, series no estimables.
- `detectarPR`: supera / no supera / empata / sin historial.
- `normalizarNombre`: mayúsculas, espacios al borde, espacios internos.

**No se testean** componentes React ni queries a Supabase: requerirían mocks pesados y el
proyecto tiene la lógica de UI acoplada a estilos inline, lo que haría esos tests caros
de mantener sin cubrir la parte riesgosa.

**Regla no negociable** (según `vibecoding-estructurado.md`): ningún bullet del roadmap
se marca completo sin correr su test, y la suite entera corre antes de cada commit.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Una sola base, sin ambiente dev | Migración partida en aditiva → verificación → destructiva. Backup antes del paso destructivo. |
| Pérdida de datos en el backfill | El paso 1 no borra nada; las columnas viejas conviven hasta verificar. |
| Ejercicios con nombres inconsistentes pierden su histórico | Normalización de nombre; limitación documentada arriba. |
| El modal serie por serie empeora la carga rápida | Botón de duplicar última serie. |
| 1RM sobreestimado en series largas | Corte en 15 reps; el número se lee como orientativo. |

---

## Decisiones a registrar en `DECISIONS.md`

1. Fórmula Epley sobre otras alternativas (Brzycki, Lombardi).
2. Tope de 15 repeticiones, y por qué no 12.
3. PR definido por 1RM estimado y no por peso máximo levantado.
4. `is_warmup` excluido del modelo de datos.
5. Migración partida en dos migraciones SQL por no haber ambiente de desarrollo separado.
6. Tests solo sobre lógica pura, no sobre componentes.
