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

### Decisiones adicionales surgidas durante la ejecución (no previstas en el spec original)

- **Caso especial de 1 repetición en `estimar1RM` (2026-08-25).** La fórmula literal
  de Epley (`peso × (1 + reps/30)`) da 103.33 para (100kg, 1 rep), pero el propio test
  planificado esperaba exactamente 100. Se agregó `if (r === 1) return peso` antes de
  aplicar Epley: a 1 repetición el 1RM es exactamente el peso levantado, no una
  estimación. Documentado con comentario en el código explicando el porqué.
- **`gym_exercises.id` es `uuid`, no `bigint` (2026-08-25).** El roadmap original
  asumía `bigint` para la migración de `gym_sets` (Tarea 4); Supabase rechazó el
  `FOREIGN KEY` al correrlo porque el tipo no coincidía. Se corrigió `exercise_id` a
  `uuid` en la migración antes de aplicarla. Ningún código de la app asume IDs
  numéricos de ejercicio, así que no hubo impacto en cascada.
- **La Tarea 5 amplió su alcance para arreglar las vistas de "Hoy" e "Historial"
  (2026-08-25).** El plan original de la Tarea 5 solo tocaba las queries y el modal de
  carga de series, pero como `guardarEjercicio()` deja de escribir las columnas viejas
  de `gym_exercises`, no tocar esas vistas habría dejado todo ejercicio nuevo mostrando
  datos en blanco. Se consideró una consecuencia inevitable del cambio de modelo, no
  una funcionalidad extra fuera de spec.
- **Emparejamiento por índice en `cargarPlantilla` (Tarea 6, 2026-08-25).** El código
  siembra series emparejando `creados[i]` (resultado de un insert múltiple a Supabase)
  con `plantilla[i]` (array de origen) por índice, sin garantía formal de PostgREST de
  que el orden se preserve. Se aceptó el riesgo: en la práctica Postgres preserva el
  orden en un `INSERT ... VALUES ... RETURNING` simple de una sola consulta, y el costo
  de un desfase sería cosmético (una serie con el peso/reps por defecto equivocado,
  corregible al editar), no pérdida de datos.
- **Supabase en plan free, sin backups automáticos (2026-08-25/26).** La Tarea 4
  (migración aditiva) se corrió sin backup previo porque es reversible trivialmente
  (`DROP TABLE gym_sets`). La Tarea 10 (migración destructiva, `DROP COLUMN`) sí
  requirió backup manual (export CSV de `gym_exercises` y `gym_sets` desde el editor de
  Supabase) antes de ejecutarse, dado que no hay backups automáticos ni ambiente de
  desarrollo separado.
- **Gotcha de `auth.uid()` reapareció en la práctica durante la limpieza de datos de
  prueba (2026-08-26).** Al borrar manualmente sesiones de prueba
  (`DELETE FROM gym_logs WHERE user_id = auth.uid() AND ...`) desde el editor SQL de
  Supabase, la condición no matcheó ninguna fila porque `auth.uid()` da `NULL` en ese
  contexto (corre como `service_role`). Se corrigió quitando el filtro de `user_id`
  (app de un solo usuario). Refuerza la advertencia ya documentada en `CLAUDE.md`.

### Proceso de ejecución

Las 11 tareas del roadmap se ejecutaron con desarrollo dirigido por subagentes: un
agente implementador y un agente revisor de spec/calidad por tarea, con un loop de fix
cuando el revisor reportó findings "Important" no contemplados en el plan original. La
verificación no se limitó a los tests automatizados: las tareas de UI (5, 6, 7, 8, 9)
se validaron manualmente contra la base de producción real vía automatización de
navegador, y las migraciones (4, 10) se verificaron contra la base real de Supabase
antes y después de aplicarlas.

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

### Decisiones surgidas durante la ejecución del roadmap (2026-08-26)

- **`esEfectiva()` en `sugerirProximo` exige `reps > 0`, no solo `reps` finito (Tarea 2).** El código literal que traía el brief usaba `Number.isFinite(Number(serie.reps))`, pero con eso `Number(null) === 0` y `Number.isFinite(0) === true`, así que una serie `{weight_kg:80, reps:null, rir:2}` pasaría como efectiva y el propio test del brief ("trata una serie con peso y RIR pero sin reps como no efectiva") fallaría. Se corrigió a `reps > 0`. Como efecto secundario, una serie con `reps: 0` (que no debería poder cargarse desde la UI de todos modos) tampoco cuenta como efectiva.
- **Patrón recurrente: los comentarios de "por qué" del código de ejemplo en el roadmap no sobrevivieron a la primera pasada de implementación en varias tareas (2 y 4), y el reporte de esas tareas afirmó incorrectamente que sí se habían conservado.** Se corrigió en cada caso restaurando el comentario puntual señalado por la revisión (por qué RIR 0 ≠ RIR ausente en la Tarea 2; por qué se usa `pesoMaximo` y no 1RM estimado, por qué el redondeo es hacia abajo, por qué no se re-ofrece el deload en curso, y por qué el deload solo se calcula ante estancamiento, en la Tarea 4). Vale la pena tenerlo en cuenta para roadmaps futuros: verificar el diff real contra lo que el reporte afirma, no confiar en la narrativa del reporte.
- **Verificación visual manual en navegador no se pudo ejecutar durante las Tareas 5 a 8** porque el entorno de los implementadores no tenía herramientas de navegador disponibles. Los pasos de verificación manual del roadmap (recorrer pestañas, abrir el modal, probar los casos de RIR/estancamiento/deload con datos de sesiones pasadas, confirmar en SQL que `routine_templates` no cambió) quedaron pendientes para una pasada final antes de dar el spec por cerrado, en vez de ejecutarse tarea por tarea como preveía el roadmap original.

### Limitaciones conocidas encontradas en la revisión final (2026-08-26)

- **Las series sembradas por plantilla y nunca entrenadas contaminan el contador de estancamiento.** `cargarPlantilla()` escribe filas reales en `gym_sets` con `weight_kg`/`reps` (y `rir: null`). Si el usuario carga la plantilla mañana y no entrena ese día (o no borra la sesión), esas filas quedan indistinguibles de una sesión real: `mejorSerie()` les estima un 1RM y `detectarEstancamiento` las cuenta como sesión. Un usuario que carga la plantilla en 3 días de rutina sin entrenar puede ver el chip rojo "3 sesiones sin PR" y una oferta de deload calculada sobre pesos que nunca levantó. No es un bug del código — es una interacción no anticipada entre la Tarea 8 (siembra) y la Tarea 3 (contador) que no rompe ningún test existente. Documentado como limitación conocida, sin fix en este roadmap; una mitigación futura razonable sería que `detectarEstancamiento` ignore sesiones donde todas las series tienen `rir: null`.
- **Perder el RIR de una sesión hace que la siembra vuelva silenciosamente al default viejo de la plantilla.** Es el comportamiento que el propio spec pide (`accion: 'sin_rir'` con `weight_kg: null` → cae en defaults), no una desviación — pero el chip que se muestra ("cargá el RIR para recibir sugerencias") no le avisa al usuario que el peso sembrado retrocedió respecto de su progresión real. Documentado como limitación conocida y aceptada por diseño.

### Limpieza post-implementación (`/simplify`, 2026-08-26)

Revisión con 4 agentes en paralelo (reuse, simplification, efficiency, altitude) sobre el
diff completo de la sesión. Aplicado:

- **`BadgePR` reconstruido sobre `Chip`** en vez de reimplementar la misma píldora visual
  por separado. Se agregó un prop `weight` a `Chip` (default 600) para no perder el
  `fontWeight: 700` original de `BadgePR`.
- **`ChipsDeProgresion` extraído a `gym.jsx`** para eliminar la duplicación del bloque
  sugerencia+estancamiento entre la tarjeta mobile y la fila de tabla desktop, que además
  llamaba `progresionDeEj(ej)` cuatro veces por sitio en vez de una.
- **`pesoParaSembrar()` extraído a `progresion.js`**, con tests propios. La decisión de
  sembrar la sugerencia del motor o el default de la plantilla vivía como lógica de negocio
  dentro de `cargarPlantilla()` en `Gimnasio.jsx`, cruzando la frontera I/O-vs-reglas que el
  propio spec declara ("`Gimnasio.jsx` hace el I/O... el servicio puro tiene las reglas").

Evaluado y descartado, con motivo:

- **Micro-optimización del loop de RIR mínimo en `sugerirProximo`** (evitar llamar `rirDe`
  dos veces por comparación): impacto nulo sobre arrays de a lo sumo 6 series por sesión, no
  vale el costo de legibilidad.
- **Acotar `react-hooks/immutability: 'off'` por archivo/línea en vez de a nivel de
  proyecto**: se dejó global a propósito. El repo no usa React Compiler (el propósito único
  de esa regla), así que hoy no protege nada real, mientras que el patrón que marca —
  function declarations hoisted para los handlers de `useEffect`— es deliberado en toda la
  app. Desactivarla puntualmente en cada uno de los ~9 sitios habría sido más ruido sin
  beneficio.
- **Separar `gym.jsx` en primitivas de botón genéricas (`NavBtn`, `TinyGhostButton`, etc.) +
  componentes de dominio**: prematuro. CODESTYLE.md ya fija el criterio — compartir un
  componente entre páginas recién cuando se reusa en 3+ — y ninguno de los botones
  señalados llega a ese umbral todavía.

## Mantenimiento (2026-09-08)

- **Las sesiones sembradas por plantilla ya no cuentan para el estancamiento ni para el
  deload.** Era la limitación conocida que el Spec 2 dejó documentada sin fix. Una sesión
  se considera entrenada si al menos una de sus series tiene RIR cargado; `cargarPlantilla()`
  siembra con `rir: null`, así que una plantilla cargada y no entrenada ya no es evidencia
  de nada. Se filtra en `detectarEstancamiento` y también en `sugerirDeload`, porque el
  síntoma tenía dos mitades: el chip rojo de "3 sesiones sin PR" y un deload calculado
  sobre kilos que nadie levantó.
  - Se descartó filtrar en `sugerirProximo`: ahí ver la sesión sembrada es correcto y
    produce `accion: 'sin_rir'`, que es justo el aviso que corresponde.
  - El criterio es "alguna serie con RIR", no "ninguna serie con RIR": una sesión donde se
    entrenó parte de las series y se olvidó el RIR en el resto sigue contando.

- **El APK de CI se compilaba sin las variables de Supabase desde `f228f6e` (2026-06-15).**
  Ese commit sacó las claves hardcodeadas de `src/supabase.js` y las movió a
  `import.meta.env`, cargándolas en `.env` y en Vercel pero no en GitHub Actions. Como
  `createClient` lanza al importarse y `App.jsx` lo importa en el top-level, el APK quedó en
  pantalla blanca durante 42 commits sin que ningún build fallara ni la web se viera
  afectada. Se agregó la inyección desde repository secrets y, como red de seguridad, una
  pantalla que nombra las variables faltantes en vez de morir en silencio. Ver la tabla de
  los tres entornos en `CLAUDE.md`.

- **Actions actualizadas** (`checkout@v7`, `setup-node@v7`, `setup-java@v6`,
  `upload-artifact@v7`): venían en v3 y GitHub ya avisaba de la deprecación. Las versiones
  se verificaron contra la API de releases antes de fijarlas, no de memoria.

## Unificación de nombres de ejercicios (2026-09-08)

El reporte de cargas del Dashboard listaba el mismo ejercicio varias veces. Eran dos
problemas distintos con soluciones distintas.

**En el código** (`Dashboard.jsx`): el desplegable armaba la lista con `new Set()` sobre
el nombre crudo y el gráfico filtraba con `.eq('exercise_name', ...)`, que compara la
cadena exacta. Además de verse duplicado, cada grafía graficaba solo una parte del
historial. Ahora se agrupa con `normalizarNombre()` — la misma que `Gimnasio.jsx` ya
usaba para los PR, que el Dashboard nunca había adoptado — y el filtro pasó a memoria.
La etiqueta del desplegable es la grafía más frecuente y no la normalizada: "press
banca" en minúscula se lee como un error de la app.

- Se descartó filtrar server-side con `.ilike`: no colapsa espacios internos.
- Dos filas del mismo ejercicio en una misma sesión pasan a ser un punto de la curva y
  no dos. El caso ya era posible antes; el filtro por nombre normalizado lo hace más
  probable.

**En los datos**: había además nomenclatura vieja ("Press Pecho", "Remo", "Bíceps
(Barra)") de antes de la rutina actual, con 1-2 sesiones cada una. Se resolvió con un
`UPDATE` puntual, no con código.

- **Se descartó una tabla de alias o un catálogo de ejercicios**: complejidad permanente
  en el schema para una limpieza histórica de ~15 filas que se hace una sola vez. Si
  alguna vez se quiere autocompletado al cargar un ejercicio, eso es una feature con su
  propio spec.
- El criterio canónico salió de la rutina de gimnasio del usuario (30 ejercicios), no de
  parecido entre cadenas. Los mapeos ambiguos ("Pectorales", "Remo", "Abdominales") los
  resolvió él: `Pectorales` es la pectoral machine y NO el `Peck Deck`; `Crunch Inverso`
  y `Dragon flag asistido` son distintos; los press militares de barra, máquina y
  mancuerna son tres ejercicios.
- `Press Militar` a secas resultó ser el de mancuernas, que no existía en la base: fue un
  renombre a `Press militar con mancuernas`, no una fusión.
- Un segundo `UPDATE` normalizó los espacios sobrantes. Hacía falta porque el primero
  escribió literales limpios contra nombres existentes que tenían un espacio invisible,
  lo que creó un duplicado nuevo (`Crunch Abdominal`) además de los dos que ya estaban
  (`Chest Press Hammer`, `Pectorales`).
- Ambos `UPDATE` filtran por el `user_id` literal del usuario. La base tiene dos cuentas
  de prueba con una sesión cada una (2026-03-25 y 2026-06-01) que RLS ya aísla; el filtro
  evita tocarlas. Nada de `auth.uid()`, que da `null` en el editor de Supabase.
- Backup previo en la tabla `gym_exercises_backup_20260908`, dentro de la misma base.
  Borrarla cuando se dé el cambio por bueno.

**Efecto aceptado**: las sesiones renombradas entran al historial del ejercicio canónico,
así que pueden mover un PR y con él la carga que sugiere el motor de progresión. Son 1-2
sesiones por caso con cargas de otra época.

## Recuperación de sesiones sin marcar y criterio de sesión entrenada (2026-09-08)

Al preparar el Spec 3 apareció que 19 de las 44 sesiones de `gym_logs` tenían
`completed = false`, y que **ninguna de ellas tenía una sola serie con RIR cargado**. El
usuario aclaró que entrena sin cargar el RIR con frecuencia, porque suele completar todas
las repeticiones previstas de cada serie.

Se recuperaron 14 marcándolas `completed = true`: las 11 con ejercicios y series
efectivamente cargados, más 3 de cardio y futsal, que no tienen series por naturaleza y no
por falta de datos. Quedaron en `false` cinco: cuatro sesiones vacías (creadas y
abandonadas, sin un solo ejercicio) y una carga duplicada del 2026-08-07 — dos filas del
mismo día con 10 ejercicios y 33 series cada una. Se recuperó la que tiene `routine_type`
y se dejó la otra sin marcar, sin borrarla.

- El `UPDATE` se apoyó en `routine_type is not null and <> ''` para excluir la duplicada
  sin necesidad de apuntarle por id: era la única de la lista sin tipo.
- Backup previo en `gym_logs_backup_20260908`.
- Total tras el cambio: 39 sesiones válidas contra 25 antes.

**Consecuencia sobre el Spec 2, pendiente de resolver:** el fix del estancamiento del
2026-09-08 descarta las sesiones donde ninguna serie tiene RIR, asumiendo que son
plantillas sembradas y no entrenadas. Los datos muestran que esa inferencia es falsa para
este usuario: hay entrenamientos completos de 32 series sin un solo RIR. `detectarEstancamiento`
y `sugerirDeload` deberían pasar a usar `completed` —el mismo criterio que adopta el Spec 3—
en vez de inferir por RIR, lo que implica sumar `completed` a la query de `Gimnasio.jsx`.
