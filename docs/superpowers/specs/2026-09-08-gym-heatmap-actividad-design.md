# Spec 3 — Heatmap de actividad y mapa muscular

**Fecha:** 2026-09-08
**Estado:** borrador, pendiente de revisión del usuario
**Depende de:** [Spec 1 — Series, 1RM y PR](2026-08-25-gym-series-1rm-pr-design.md) (implementado)
**Independiente de:** [Spec 2 — Motor de progresión](2026-08-26-gym-motor-progresion-design.md)

---

## Contexto

Los Specs 1 y 2 miran **un ejercicio a la vez**: su 1RM, su PR, su próxima carga. Ninguno
responde preguntas sobre el entrenamiento como conjunto. Hoy el Dashboard tiene tres
reportes —adherencia de comidas, viandas y evolución de carga por ejercicio— y ninguno
dice si entrenaste con constancia ni qué parte del cuerpo estás descuidando.

Este spec agrega una cuarta vista de reportes que responde dos preguntas:

1. **¿Estoy siendo constante?** — un calendario de actividad al estilo del heatmap de
   contribuciones de GitHub.
2. **¿Estoy equilibrado?** — cuánto volumen recibió cada grupo muscular en el período.

### Glosario

| Término | Definición |
|---|---|
| **Sesión válida** | Fila de `gym_logs` con `completed = true`. Es la unidad del calendario. |
| **Volumen** | Cantidad de series (filas de `gym_sets`). No pondera peso ni repeticiones. |
| **Grupo** | Uno de los 9 valores de `GRUPOS`. Siete son musculares; `Cardio` y `Sin clasificar` no. |
| **Grupo primario** | El único grupo al que un ejercicio aporta su volumen. No hay secundarios. |
| **Dominante** | El grupo con más series en un día. Define el color de la celda. |
| **Intensidad** | Nivel 0-4 derivado del volumen del día, relativo al período visible. |

---

## Alcance

**Entra:**

- Vista `Actividad` en `Dashboard → Reportes`, junto a Adherencia, Viandas y Cargas.
- Tira anual de 12 meses móviles, monocroma, con la intensidad de cada día.
- Calendario mensual navegable, con color por grupo dominante e intensidad por volumen.
- Barras de volumen por grupo del período.
- Racha actual y racha máxima.
- Panel de detalle al tocar un día.
- Mapa ejercicio → grupo muscular como constante en el código.
- Extensión de `design.md` con una paleta categórica.

**No entra:**

- Músculo secundario o ponderado. Cada serie se cuenta una vez, en un solo grupo.
- Silueta corporal dibujada.
- Catálogo de ejercicios en Supabase, o UI para asignar grupos.
- Comparación contra períodos anteriores.
- Exportar esta vista a Excel.
- Cualquier cambio de schema. Este spec no toca la base.

---

## Datos de entrada

Todo sale de tablas existentes. Dos queries, ambas **filtradas por rango de fechas en el
servidor**:

```
gym_logs      -> id, date, routine_type, completed   (completed = true)
gym_exercises -> exercise_name, log_id, gym_sets(id)
```

De `gym_sets` solo interesa **cuántas filas hay**, no su contenido: el volumen es el
conteo de series.

### Por qué el filtro de fechas va en el servidor

PostgREST corta las respuestas en 1000 filas sin devolver error. Con ~30 ejercicios por
semana, la tabla llega a ese techo en poco más de un año, y el síntoma sería un
calendario al que le faltan días en silencio. La tira anual pide 12 meses; el detalle
mensual pide un mes.

### Por qué `completed = true`

`cargarPlantilla()` escribe series reales en `gym_sets` con `rir: null`. Sin este filtro,
cargar la plantilla y no entrenar pintaría el día como entrenado e inflaría la racha —
el mismo agujero que el Spec 2 tuvo con el estancamiento (ver `DECISIONS.md`,
mantenimiento del 2026-09-08).

Se prefiere `completed` sobre "tiene alguna serie con RIR" porque es una afirmación
explícita del usuario y no una inferencia. **Contrapartida aceptada:** una sesión
entrenada pero sin marcar el toggle no aparece en el calendario.

---

## Grupos musculares

```js
export const GRUPOS = [
  'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Core',
  'Cardio', 'Sin clasificar',
]
```

El orden es normativo: fija el desempate del dominante y el orden de la leyenda.

`Bíceps` y `Tríceps` van separados y no fusionados en "Brazos" porque la rutina del
usuario los trabaja en días distintos (tríceps el lunes, bíceps el miércoles) y juntarlos
borraría justo esa distinción.

`Cardio` (futsal, caminata, movilidad) y `Sin clasificar` no son músculos: aparecen en el
calendario y en las barras, pero se pintan en tonos neutros para no competir con los
grupos reales.

### El mapa

`MAPA` es una constante en `src/services/musculos.js` con el **nombre normalizado** como
clave, resuelto con `normalizarNombre()` de `oneRepMax.js`. Así `Press Banca` y
`press banca` caen en el mismo grupo sin trabajo extra.

Los 30 ejercicios de la rutina actual del usuario se mapean desde su día correspondiente
(lunes pecho/tríceps/core, miércoles espalda/bíceps/core, viernes hombros/espalda/core/
piernas). Los ~18 restantes son historial de otras épocas y se mapean uno por uno.

Un nombre ausente del mapa devuelve `Sin clasificar`. **No es un error**: es la señal
visible de que hay volumen sin asignar y de que conviene actualizar el mapa.

### Por qué el mapa vive en el código

Se descartó una tabla en Supabase con UI de asignación: son ~48 entradas que cambian
pocas veces al año, y esa alternativa arrastra migración, políticas RLS, una pantalla de
edición y un flujo nuevo al guardar un ejercicio. Complejidad permanente para una lista
que se edita en una línea. Si algún día el usuario carga ejercicios nuevos seguido, esa
es una feature con su propio spec.

---

## Reglas de agregación

### Volumen

El volumen de un día para un grupo es la cantidad de filas de `gym_sets` de los
ejercicios de ese día que mapean a ese grupo. Sin ponderar peso ni repeticiones: la
métrica tiene que ser verificable contando filas.

Un día de `Cardio` o `Partido Futsal` normalmente no tiene ejercicios ni series. Su
volumen es 0 y **aun así aparece en el calendario**, porque la sesión existe en
`gym_logs`. Sin esto, los días de futsal serían indistinguibles de los días sin entrenar.

### Dominante

El grupo con más series del día. Ante empate gana el que aparece primero en `GRUPOS`:
arbitrario pero determinista, igual que el criterio de `mejorSerie()` del Spec 1.

Un día sin series toma su grupo del `routine_type` y no del volumen, con este mapa
explícito en `musculos.js`:

| `routine_type` | Grupo |
|---|---|
| `Partido Futsal`, `Cardio` | `Cardio` |
| `Otra`, o vacío | `Sin clasificar` |
| Los tres tipos de rutina de gimnasio | nunca llegan acá: tienen series |

Si un día de rutina de gimnasio quedara sin ninguna serie, cae en `Sin clasificar`, que
es la señal correcta: la sesión se marcó completada pero no se cargó nada.

### Intensidad

Nivel de 0 a 4, calculado **relativo al período visible** y no con umbrales absolutos:

- Nivel 0: sin sesión válida.
- Niveles 1-4: cuartiles del volumen de los días con actividad del período.
- Un día con sesión válida y volumen 0 (futsal, cardio) toma un nivel fijo intermedio.
  "Jugué al futsal" no tiene grados, y dejarlo en el nivel más bajo lo haría parecer un
  día flojo.

Con umbrales absolutos, un mes de bajo volumen se vería uniformemente pálido y no se
podría distinguir "entrené poco" de "la escala está mal calibrada".

### Rachas

Las rachas se miden en **semanas, no en días**. Con una rutina de 3 días, una racha de
días calendario consecutivos se cortaría cada martes y no significaría nada.

Una semana **cumple** si tiene al menos `dias_entreno` sesiones válidas, tomando ese
número de `user_profile` en vez de hardcodear 3: el usuario ya lo configura en Perfil y
puede cambiarlo.

- **Racha actual:** semanas consecutivas cumplidas hasta la semana pasada.
- **Racha máxima:** la más larga del historial completo, no solo del período visible.

**La semana en curso nunca corta la racha actual**, esté o no cumplida: es martes y
todavía faltan días. Se cuenta recién cuando termina.

Las semanas arrancan el lunes, igual que `week_start` en `meal_plans`.

---

## Servicios

Dos archivos nuevos, siguiendo la regla de una responsabilidad por archivo
(`CODESTYLE.md`): uno sabe de músculos, el otro de tiempo. La dependencia va en una sola
dirección — `actividad.js` importa `grupoDe()` de `musculos.js`, nunca al revés — igual
que `progresion.js` importa de `oneRepMax.js`.

### `src/services/musculos.js`

```js
GRUPOS                     // lista ordenada, normativa
MAPA                       // nombre normalizado -> grupo
grupoDe(nombre)            // -> grupo | 'Sin clasificar'
```

### `src/services/actividad.js`

```js
actividadPorDia(logs, ejercicios)
// -> [{ date, totalSeries, porGrupo, dominante, tipo }]

volumenPorGrupo(dias)
// -> [{ grupo, series, porcentaje }] ordenado desc, 'Sin clasificar' ultimo

nivelDeIntensidad(series, referencia)   // -> 0..4

rachas(dias)                            // -> { actual, maxima }
```

`actividadPorDia` recibe las dos colecciones porque un día de futsal existe en `gym_logs`
pero no tiene ejercicios: derivarlo solo de los ejercicios lo haría desaparecer.

`Dashboard.jsx` hace el I/O y le pasa datos ya cargados a estas funciones puras, igual
que ya hace con `progresionDe()`.

---

## Cambios de UI

### Ubicación

Cuarta pestaña `Actividad` en `Dashboard → Reportes`. No se toca el nav, ni las rutas, ni
ninguna otra pantalla.

### Bloques, de arriba abajo

1. **Resumen** — sesiones del período, racha actual, racha máxima. Como stats
   tipográficos (número grande, label chico, regla fina), que es el tratamiento nº 2 de
   `design.md`. No como tarjetas con borde.
2. **Tira anual** — 53×7, 12 meses móviles, monocroma en el verde de marca con 5 niveles
   de intensidad. Tocar un mes lo selecciona abajo.
3. **Mes en detalle** — grilla 7×6 con celdas grandes, color por grupo dominante e
   intensidad por volumen, con flechas de navegación mensual (el patrón que ya usa el
   selector de semana de Reportes).
4. **Barras por grupo** — volumen del período visible, orden descendente.

### Color

Dos usos separados, deliberadamente:

- **Tira anual:** verde de marca (`C.accent`) en 5 niveles. Es la vista de constancia y
  el verde ya significa "hecho" en toda la app.
- **Mes:** paleta categórica nueva de 9 tonos, con luminosidad pareja para que ninguno
  domine, y fuera de los significados existentes — **ningún grupo usa rojo (error) ni
  amarillo (pendiente)**. `Cardio` en un neutro frío, `Sin clasificar` en gris.

Requiere extender `design.md` con una sección de color categórico. El documento lo
contempla: se extiende cuando el sistema necesita crecer.

### El color nunca es el único portador de información

- Cada celda del mes muestra el número del día.
- La leyenda de grupos está siempre visible, no en un tooltip.
- Al tocar un día se abre un **panel debajo del calendario** con el desglose escrito:
  tipo de rutina, ejercicios y series por grupo.

Se elige panel y no modal para no tapar el calendario y perder el contexto del día
tocado.

Nueve colores en celdas chicas no son distinguibles con certeza para nadie, y menos con
daltonismo.

### Mobile (`< 640px`)

- El mes entra sin problema: 7 columnas de ~44px.
- La tira anual no entra: 53 columnas darían ~6px por celda. Va dentro de un contenedor
  con **scroll horizontal propio** — el `body` nunca scrollea de costado — posicionado
  al abrir en la semana actual, que es la que interesa.

---

## Testing

Vitest sobre la lógica pura, junto a cada servicio. Cada regla con valor de corte trae su
caso de borde:

**`musculos.js`**
- Un nombre no mapeado devuelve `Sin clasificar`.
- Dos grafías del mismo ejercicio devuelven el mismo grupo.

**`actividad.js`**
- Un día de futsal, sin ejercicios ni series, aparece con volumen 0.
- El dominante ante empate es el primero de `GRUPOS`.
- `nivelDeIntensidad`: 0 series → 0; el máximo del período → 4.
- Un día con sesión válida y volumen 0 toma el nivel fijo, no el 0.
- Racha cortada por un solo día.
- La racha actual no se corta porque hoy todavía no se entrenó.
- `volumenPorGrupo` deja `Sin clasificar` último aunque tenga más series que otros.

Los componentes React no se testean, por la razón ya registrada en `CODESTYLE.md`. La
vista se verifica con pasos manuales concretos contra la base real.

---

## Riesgos y limitaciones conocidas

1. **Una sesión entrenada sin marcar `completed` no aparece.** Es la contrapartida
   aceptada de usar un dato explícito en vez de inferir. Si al usarlo aparecen huecos
   raros en el calendario, la causa más probable es esa y no un bug.
2. **El mapa vive en el código:** un ejercicio nuevo requiere editarlo. Mitigado por
   `Sin clasificar`, que hace visible el volumen sin asignar.
3. **El dominante simplifica.** Un lunes con 12 series de pecho y 11 de tríceps se pinta
   entero de pecho. Es el precio de un color por día; las barras cuentan la verdad.
4. **El volumen no pondera carga.** Tres series de 8 kg pesan lo mismo que tres de 80 kg.
   Es deliberado: la métrica tiene que ser verificable contando filas.
5. **Nueve categorías son muchas para distinguir por color.** Por eso el color nunca es
   el único portador de información.

---

## Decisiones a registrar en `DECISIONS.md`

- Grupo primario únicamente, sin secundarios ponderados: con ~44 sesiones repartidas en
  20 músculos finos las diferencias serían ruido estadístico, y el factor de ponderación
  de un secundario ("¿el tríceps en press banca cuenta media serie?") no lo puede validar
  nadie. Agregar secundarios más adelante es aditivo.
- `completed` sobre inferencia por RIR: dato explícito del usuario.
- Mapa en código y no en Supabase.
- Intensidad relativa al período y no absoluta.
- Paleta categórica separada de los colores de estado.
