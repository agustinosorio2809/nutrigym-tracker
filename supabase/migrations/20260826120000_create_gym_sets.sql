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
