-- Documents the RLS policies for all user-data tables.
-- NOTE: these policies already existed in the Supabase dashboard before this file
-- was created. This file serves as documentation of the schema; the DROP/CREATE
-- block below is NOT needed if the dashboard policies are already in place.
--
-- Tables with a direct user_id column:
--   meal_plans, viandas, gym_logs, user_profile, routine_templates
--
-- Tables that derive ownership through a parent (no direct user_id):
--   planned_meals  → meal_plans.user_id  (via plan_id)
--   meal_logs      → meal_plans.user_id  (via planned_meal_id → plan_id)
--   gym_exercises  → gym_logs.user_id    (via log_id)

-- ── meal_plans ────────────────────────────────────────────────────────────────

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_plans: select own"
  ON meal_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "meal_plans: insert own"
  ON meal_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meal_plans: update own"
  ON meal_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "meal_plans: delete own"
  ON meal_plans FOR DELETE
  USING (auth.uid() = user_id);

-- ── planned_meals ─────────────────────────────────────────────────────────────
-- No direct user_id: ownership is verified through meal_plans.

ALTER TABLE planned_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planned_meals: select own"
  ON planned_meals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = planned_meals.plan_id
        AND meal_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "planned_meals: insert own"
  ON planned_meals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = planned_meals.plan_id
        AND meal_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "planned_meals: update own"
  ON planned_meals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = planned_meals.plan_id
        AND meal_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "planned_meals: delete own"
  ON planned_meals FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = planned_meals.plan_id
        AND meal_plans.user_id = auth.uid()
    )
  );

-- ── meal_logs ─────────────────────────────────────────────────────────────────
-- No direct user_id: ownership is verified through planned_meals → meal_plans.

ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_logs: select own"
  ON meal_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM planned_meals
      JOIN meal_plans ON meal_plans.id = planned_meals.plan_id
      WHERE planned_meals.id = meal_logs.planned_meal_id
        AND meal_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "meal_logs: insert own"
  ON meal_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM planned_meals
      JOIN meal_plans ON meal_plans.id = planned_meals.plan_id
      WHERE planned_meals.id = meal_logs.planned_meal_id
        AND meal_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "meal_logs: update own"
  ON meal_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM planned_meals
      JOIN meal_plans ON meal_plans.id = planned_meals.plan_id
      WHERE planned_meals.id = meal_logs.planned_meal_id
        AND meal_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "meal_logs: delete own"
  ON meal_logs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM planned_meals
      JOIN meal_plans ON meal_plans.id = planned_meals.plan_id
      WHERE planned_meals.id = meal_logs.planned_meal_id
        AND meal_plans.user_id = auth.uid()
    )
  );

-- ── viandas ───────────────────────────────────────────────────────────────────

ALTER TABLE viandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viandas: select own"
  ON viandas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "viandas: insert own"
  ON viandas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "viandas: update own"
  ON viandas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "viandas: delete own"
  ON viandas FOR DELETE
  USING (auth.uid() = user_id);

-- ── gym_logs ──────────────────────────────────────────────────────────────────

ALTER TABLE gym_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gym_logs: select own"
  ON gym_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "gym_logs: insert own"
  ON gym_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gym_logs: update own"
  ON gym_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "gym_logs: delete own"
  ON gym_logs FOR DELETE
  USING (auth.uid() = user_id);

-- ── gym_exercises ─────────────────────────────────────────────────────────────
-- No direct user_id: ownership is verified through gym_logs.

ALTER TABLE gym_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gym_exercises: select own"
  ON gym_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM gym_logs
      WHERE gym_logs.id = gym_exercises.log_id
        AND gym_logs.user_id = auth.uid()
    )
  );

CREATE POLICY "gym_exercises: insert own"
  ON gym_exercises FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gym_logs
      WHERE gym_logs.id = gym_exercises.log_id
        AND gym_logs.user_id = auth.uid()
    )
  );

CREATE POLICY "gym_exercises: update own"
  ON gym_exercises FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM gym_logs
      WHERE gym_logs.id = gym_exercises.log_id
        AND gym_logs.user_id = auth.uid()
    )
  );

CREATE POLICY "gym_exercises: delete own"
  ON gym_exercises FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM gym_logs
      WHERE gym_logs.id = gym_exercises.log_id
        AND gym_logs.user_id = auth.uid()
    )
  );

-- ── user_profile ──────────────────────────────────────────────────────────────

ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profile: select own"
  ON user_profile FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_profile: insert own"
  ON user_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_profile: update own"
  ON user_profile FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "user_profile: delete own"
  ON user_profile FOR DELETE
  USING (auth.uid() = user_id);

-- ── routine_templates ─────────────────────────────────────────────────────────

ALTER TABLE routine_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "routine_templates: select own"
  ON routine_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "routine_templates: insert own"
  ON routine_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "routine_templates: update own"
  ON routine_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "routine_templates: delete own"
  ON routine_templates FOR DELETE
  USING (auth.uid() = user_id);
