-- Elimina las columnas escalares de gym_exercises, reemplazadas por gym_sets.
-- Correr SOLO después de verificar que todo ejercicio tiene sus series
-- (ver ROADMAP.md, tarea 10, paso 2). gym_exercises queda como
-- (id, log_id, exercise_name, notes).

ALTER TABLE gym_exercises
  DROP COLUMN IF EXISTS sets,
  DROP COLUMN IF EXISTS reps,
  DROP COLUMN IF EXISTS weight_kg,
  DROP COLUMN IF EXISTS rir;
