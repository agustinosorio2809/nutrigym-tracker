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
