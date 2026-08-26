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
