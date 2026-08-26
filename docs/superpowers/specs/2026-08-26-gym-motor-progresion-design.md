# Spec 2 — Motor de progresión automática

**Fecha:** 2026-08-26
**Estado:** aprobado, pendiente de plan de implementación
**Depende de:** [Spec 1 — Series, 1RM y PR](2026-08-25-gym-series-1rm-pr-design.md) (implementado)
**Inspiración:** [openGym](https://gitea.com/DuarteSantos/openGym)

---

## Contexto

El Spec 1 dejó la app sabiendo **qué pasó**: series individuales en `gym_sets`, 1RM
estimado por serie y detección de PR. Lo que todavía no sabe es **qué hacer mañana**.
Hoy `cargarPlantilla()` siembra siempre los mismos `default_weight_kg` de
`routine_templates`, sin importar que la última vez hayas cerrado el ejercicio con tres
repeticiones en reserva.

Este spec construye encima del Spec 1 el motor que responde esa pregunta: cuánto peso
poner la próxima vez, cuándo un ejercicio dejó de progresar, y qué hacer al respecto.

### Glosario

Al de Spec 1 (PR, 1RM, RIR) se agregan:

- **Doble progresión**: esquema en el que se avanza en dos ejes alternados — primero se
  suman repeticiones al mismo peso, y solo cuando el margen de esfuerzo lo permite se
  sube el peso.
- **Deload**: sesión deliberadamente más liviana, usada para romper un estancamiento
  bajando la carga y volviendo a subir.
- **Serie efectiva**: para este spec, una serie con `weight_kg > 0` y `rir` no nulo. Son
  las únicas que el motor considera, porque son las únicas que informan sobre el
  esfuerzo real.

---

## Alcance

**Incluye:**

- Servicio puro `src/services/progresion.js` con la regla de sugerencia, la detección de
  estancamiento y el cálculo de deload.
- Tests de Vitest sobre esa lógica.
- Chips de progresión, estancamiento y deload en la lista de ejercicios del día.
- `cargarPlantilla()` sembrando el peso y las reps sugeridas.
- Extracción de los componentes de presentación de `Gimnasio.jsx` a
  `src/components/gym.jsx`.

**No incluye:**

- Cambios de base de datos. Toda la información necesaria ya existe.
- Heatmap anual de actividad y muscle mapping (Spec 3 — independiente).
- Catálogo de ejercicios importado (tipo ExerciseDB).
- Auto-actualización de `routine_templates` con el peso sugerido.
- Cualquier cambio en el Dashboard.
- Periodización por bloques, rest timer, import desde Strong / Hevy / FitNotes.

---

## Datos de entrada

**Spec 2 no toca el schema.** El motor se alimenta de `gym_sets` + `gym_exercises` +
`gym_logs.date`, que ya existen.

`cargarHistoricoPR()` en `Gimnasio.jsx` ya trae el histórico completo del usuario con sus
series. Se le agrega `gym_logs.date` al `select` y esa **única query alimenta las tres
derivaciones**:

| Derivación | Qué necesita del histórico |
|---|---|
| PR (ya existe) | el mejor 1RM de todas las sesiones |
| Sugerencia de peso | la última sesión de cada ejercicio |
| Estancamiento | las sesiones posteriores a la del récord |

El emparejamiento entre ejercicios es por nombre normalizado, reusando
`normalizarNombre` del Spec 1, con la misma limitación conocida: variantes de tipeo
(`"Press de banca"` vs `"Press banca"`) siguen siendo ejercicios distintos.

---

## Reglas del motor

### Sugerencia de peso — doble progresión por RIR

Se mira **la última sesión en que se hizo ese ejercicio**. De sus series se consideran
solo las efectivas, y de ellas se toma el **RIR mínimo**: la serie más dura de la sesión
es la que dice cuánto margen real quedó.

| RIR mínimo | Acción | Sugerencia |
|---|---|---|
| ≥ 2 | `subir` | peso + 2.5 kg, mismas reps |
| 1 | `sumar_reps` | mismo peso, reps + 1 |
| 0 | `mantener` | mismo peso, mismas reps |

Las reps de referencia son las de la serie que definió el RIR mínimo. La cantidad de
series la sigue definiendo `default_sets` de la plantilla — el motor no la toca.

**El RIR mínimo, no el de la última serie.** Con series `RIR 0, RIR 2, RIR 3` el mínimo
manda mantener y la última serie mandaría subir. El mínimo es la lectura conservadora, y
al prescribir carga equivocarse hacia abajo cuesta mucho menos que hacia arriba.

**RIR 0 no baja el peso.** Llegar al fallo es una sesión dura, no un estancamiento;
consolidar el mismo peso es la respuesta correcta. Bajar carga entra por una sola vía, el
deload, y siempre con confirmación.

### Cuándo no hay sugerencia

En estos casos el motor no sugiere nada y `cargarPlantilla()` siembra los defaults de
`routine_templates`, exactamente como hoy:

| Caso | Motivo |
|---|---|
| Ejercicio sin histórico | primera vez, no hay de qué partir |
| Ninguna serie previa con peso | futsal, cardio, peso corporal |
| Ninguna serie previa con RIR | falta la señal en la que se basa la regla |

El último caso es el único que se comunica explícitamente en la UI (*"cargá el RIR para
recibir sugerencias"*). Sin ese texto el motor callaría sin que se entienda por qué, y el
dato que falta es justamente el que el usuario puede aportar.

### Estancamiento

Se agrupa el histórico del ejercicio por sesión y se calcula el mejor 1RM de cada una,
reusando `mejorSerie` del Spec 1.

> **Estancado** = pasaron 3 o más sesiones desde aquella en que se alcanzó el mejor 1RM
> histórico.

Una sola definición, fácil de testear. Requiere al menos 4 sesiones del ejercicio: con
menos, nunca da estancado.

**Un empate no resetea el contador.** Se toma la *primera* sesión que alcanzó el máximo,
coherente con la decisión del Spec 1 de que empatar no es PR. Empatar no es progresar.

### Deload

```
peso_deload = redondearAbajo(pesoMaximo(series_última_sesión) × 0.9, 2.5)
```

La base es `pesoMaximo` del Spec 1 (el peso más alto levantado), no el peso de la mejor
serie por 1RM: el deload se razona en kilos sobre la barra, no en 1RM estimado.

`100 → 90`, `82.5 → 72.5`. El redondeo va hacia abajo para que el deload sea siempre un
alivio real y no un cambio cosmético.

**Nunca se siembra solo.** Es la única acción del motor que reduce carga, y aparece como
chip con botón *aplicar*. La regla del proyecto es que el motor sugiere y el usuario
decide; subir carga por defecto es aceptable porque es lo que se espera de un plan de
progresión, bajarla en silencio no.

**No se re-ofrece si ya está en curso.** Si `pesoMaximo` de la última sesión es menor que
el de la anterior, el deload ya se hizo: se sigue mostrando el aviso de
estancamiento, pero no la oferta de deload. Sin esto el chip reaparecería sesión tras
sesión hasta lograr un PR nuevo, y se volvería ruido que se aprende a ignorar.

---

## Servicio de cálculo

Archivo nuevo: `src/services/progresion.js`. Funciones puras, sin Supabase y sin React,
espejando el patrón de `oneRepMax.js`.

Se eligió un archivo nuevo y no extender `oneRepMax.js` porque son dos responsabilidades
con motivos de cambio distintos: una es aritmética de 1RM, la otra son reglas de
entrenamiento. `progresion.js` importa de `oneRepMax.js` (`mejorSerie`,
`normalizarNombre`), no al revés.

### API

```js
sesionesDeEjercicio(filas)      → [{ date, series, mejor }]  ordenadas por fecha desc
sugerirProximo(sesiones)        → { accion, weight_kg, reps, motivo } | null
detectarEstancamiento(sesiones) → { estancado, sesionesSinPR }
sugerirDeload(sesiones)         → { weight_kg } | null
progresionDe(filas)             → { sugerencia, estancamiento, deload }
```

`accion` es `'subir' | 'sumar_reps' | 'mantener'`. `motivo` es la razón legible que el
chip muestra al usuario: la sugerencia siempre viaja con su explicación, para que un
número raro se pueda detectar leyéndolo.

`progresionDe` es la única función que consume la UI; el resto queda expuesto para
testearse por separado.

### Constantes

```js
INCREMENTO_KG = 2.5
RIR_PARA_SUBIR = 2
SESIONES_PARA_ESTANCAMIENTO = 3
FACTOR_DELOAD = 0.9
```

Cada una vive en un solo lugar, así que ajustar cualquiera es una línea más sus tests.

### Casos borde

| Caso | Comportamiento |
|---|---|
| Sin histórico del ejercicio | `sugerirProximo` → `null` |
| Series sin peso (futsal, cardio) | ignoradas; si no queda ninguna → `null` |
| Series con peso pero sin RIR | ignoradas; si no queda ninguna → `null` |
| `rir = 0` | válido (fallo muscular), distinto de `rir` ausente |
| Menos de 4 sesiones del ejercicio | nunca estancado |
| Empate del récord | no resetea el contador de estancamiento |
| Última sesión más liviana que la anterior | `sugerirDeload` → `null` |

**`rir = 0` no es `rir` ausente.** El Spec 1 ya arrastró este bug una vez
(`Number(x) || null` convertía el fallo muscular en `null`, ver `DECISIONS.md`). Acá la
distinción es aún más cara: confundirlos hace que una sesión al fallo se lea como una
sesión sin datos.

---

## Cambios de UI

Todos con la convención del proyecto: estilos inline, tokens de `theme.js`, íconos de
`components/icons.jsx`, interacción vía `useInteractiveStyle`.

### Chips

Mismo lenguaje visual que el `BadgePR` existente: píldora chica, fondo `xxxDim`, borde
del color al 40%.

| Chip | Color | Texto de ejemplo |
|---|---|---|
| `subir` | `C.accent` | `↑ 82.5 kg · cerraste con RIR 2` |
| `sumar_reps` | `C.blue` | `→ 80 kg × 9 · RIR 1, sumá una rep` |
| `mantener` | `C.textMuted` | `= 80 kg × 8 · llegaste al fallo` |
| sin RIR | `C.textMuted` | `cargá el RIR para recibir sugerencias` |
| estancado | `C.red` | `⚠ 3 sesiones sin PR` |
| deload | `C.yellow` | `⬇ Probar deload: 90 kg [aplicar]` |

El chip de estancamiento convive con el de progresión: son dos señales distintas y pueden
aparecer juntas.

El de deload es el único con acción. `aplicar` reescribe el peso de todas las series del
ejercicio en el modal **sin guardar**: se puede seguir editando o cancelar.

### Siembra desde plantilla

`cargarPlantilla()` pasa a sembrar `sugerencia.weight_kg` / `sugerencia.reps` cuando hay
sugerencia, y a caer en `default_weight_kg` / `default_reps` cuando no la hay. La cantidad
de series la sigue definiendo `default_sets`. Es un cambio dentro del bucle que ya existe.

`routine_templates` **no se actualiza** con el peso sugerido: describe un plan, no un
registro — la misma decisión que en el Spec 1.

### Dónde se muestra

En la lista de ejercicios del día, en los dos layouts que ya existen (tarjetas en mobile,
tabla en desktop). **No** en el historial: el historial es lo que pasó, la sugerencia es
lo que viene.

### Extracción de componentes de presentación

`Gimnasio.jsx` tiene 580 líneas y nueve sub-componentes de presentación al final
(`TabButton`, `BadgePR`, `Pill`, `PrimarySmallButton`, `ActionButton`, `TinyGhostButton`,
`TinyDangerButton`, `ModalPrimaryButton`, `ModalSecondaryButton`). Sumarle los chips
nuevos lo empuja a ~700 líneas.

Se mueven esos componentes más los chips nuevos a `src/components/gym.jsx`, dejando
`Gimnasio.jsx` con la lógica de página. Es un movimiento mecánico sin cambio de
comportamiento, sobre el archivo que este spec toca de todas formas — no es refactor
oportunista.

---

## Testing

Vitest ya está instalado desde el Spec 1. Tests nuevos en `src/services/progresion.test.js`,
siguiendo la misma regla: se testea la lógica pura, no componentes React ni queries a
Supabase.

- **`sesionesDeEjercicio`**: agrupa por fecha, ordena descendente, ignora ejercicios sin
  series.
- **`sugerirProximo`**: los tres umbrales de RIR; toma el mínimo y no el de la última
  serie; ignora series sin peso; `null` sin histórico / sin peso / sin RIR; distingue
  `rir = 0` de `rir` ausente.
- **`detectarEstancamiento`**: 3 sesiones sin PR → estancado; un PR reciente resetea; un
  empate no resetea; menos de 4 sesiones nunca da estancado.
- **`sugerirDeload`**: redondeo hacia abajo a 2.5 (100 → 90, 82.5 → 72.5); `null` si la
  última sesión ya bajó el peso.

**Regla no negociable** (según `vibecoding-estructurado.md`): ningún bullet del roadmap se
marca completo sin correr su test, y la suite entera corre antes de cada commit.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El motor siembra un peso equivocado y se entrena con él | Todo campo sembrado sigue siendo editable, y el chip siempre dice el porqué: un número raro se detecta al leerlo |
| RIR cargado inconsistentemente → sugerencias erráticas | Sin RIR no hay sugerencia, y el chip lo explica; nunca se adivina |
| El chip de deload se vuelve ruido tras aplicarlo | No se re-ofrece si la última sesión ya bajó el peso |
| Nombres de ejercicio inconsistentes pierden el histórico | Limitación heredada del Spec 1; se resolvería con catálogo, fuera de alcance |
| `Gimnasio.jsx` sigue creciendo | Extracción de los componentes de presentación a `components/gym.jsx` |

Sin riesgo de migración: a diferencia del Spec 1, este spec no toca la base de datos.

---

## Decisiones a registrar en `DECISIONS.md`

1. Doble progresión por RIR sobre progresión lineal, por rango de reps o por % de 1RM.
2. RIR **mínimo** de la sesión, no el de la última serie.
3. RIR 0 mantiene el peso; bajar carga entra solo por la vía del deload.
4. Incremento fijo de 2.5 kg, sin configuración por ejercicio.
5. Estancamiento definido como 3 sesiones desde el récord; un empate no resetea.
6. El deload se ofrece pero nunca se siembra solo, y no se re-ofrece si ya está en curso.
7. `progresion.js` como archivo separado de `oneRepMax.js`.
8. Spec 2 sin cambios de schema: una sola query alimenta PR, sugerencia y estancamiento.
