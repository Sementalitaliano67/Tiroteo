/*
# Create habits and habit_completions tables

## Summary
Adds the core gamification tables: `habits` (user-created habits with
category, difficulty, frequency, and XP reward) and `habit_completions`
(one row per habit per day when marked complete). Also adds
`last_streak_date` to `profiles` for streak tracking.

## New Tables
- `habits`
  - `id` (uuid PK)
  - `user_id` (uuid FK → auth.users, defaults to auth.uid())
  - `name` (text 1-50 chars, not null)
  - `category` (text: 'Salud' | 'Estudio' | 'Deporte' | 'Productividad')
  - `difficulty` (text: 'Fácil' | 'Medio' | 'Difícil')
  - `xp_reward` (integer: 10/20/30, derived from difficulty)
  - `frequency` (text: 'Diario' | 'Días específicos')
  - `frequency_days` (integer[]: days of week 0=Sun..6=Sat; null if Diario)
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz, auto-updated)
- `habit_completions`
  - `id` (uuid PK)
  - `habit_id` (uuid FK → habits ON DELETE CASCADE)
  - `user_id` (uuid FK → auth.users, defaults to auth.uid())
  - `completed_date` (date, not null — the day the habit was completed)
  - `created_at` (timestamptz)
  - UNIQUE(habit_id, completed_date) — one completion per habit per day

## Modified Tables
- `profiles`: added `last_streak_date` (date, nullable) — tracks the last
  day the user completed all habits, for streak calculation.

## Security
- RLS enabled on both new tables.
- `habits`: owner-scoped CRUD (auth.uid() = user_id).
- `habit_completions`: owner-scoped CRUD (auth.uid() = user_id).
- All policies scoped TO authenticated.

## Notes
1. `xp_reward` is stored at creation time based on difficulty so later
   difficulty changes don't retroactively affect past completions.
2. `habit_completions` has a UNIQUE constraint on (habit_id, completed_date)
   to enforce the "one completion per day" rule at the database level.
3. The `updated_at` trigger from the previous migration also applies to
   `habits` via a new trigger.
*/

-- ── profiles: add last_streak_date ──
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_streak_date date;

-- ── habits table ──
CREATE TABLE IF NOT EXISTS public.habits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 50),
  category       text NOT NULL CHECK (category IN ('Salud','Estudio','Deporte','Productividad')),
  difficulty     text NOT NULL CHECK (difficulty IN ('Fácil','Medio','Difícil')),
  xp_reward      integer NOT NULL DEFAULT 10 CHECK (xp_reward IN (10, 20, 30)),
  frequency      text NOT NULL CHECK (frequency IN ('Diario','Días específicos')),
  frequency_days integer[] DEFAULT NULL,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_habits" ON public.habits;
CREATE POLICY "select_own_habits"
  ON public.habits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_habits" ON public.habits;
CREATE POLICY "insert_own_habits"
  ON public.habits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_habits" ON public.habits;
CREATE POLICY "update_own_habits"
  ON public.habits FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_habits" ON public.habits;
CREATE POLICY "delete_own_habits"
  ON public.habits FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- updated_at trigger for habits
DROP TRIGGER IF EXISTS habits_updated_at ON public.habits;
CREATE TRIGGER habits_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── habit_completions table ──
CREATE TABLE IF NOT EXISTS public.habit_completions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id      uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, completed_date)
);

ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_completions" ON public.habit_completions;
CREATE POLICY "select_own_completions"
  ON public.habit_completions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_completions" ON public.habit_completions;
CREATE POLICY "insert_own_completions"
  ON public.habit_completions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_completions" ON public.habit_completions;
CREATE POLICY "delete_own_completions"
  ON public.habit_completions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_date
  ON public.habit_completions (user_id, completed_date);
CREATE INDEX IF NOT EXISTS idx_habits_user ON public.habits (user_id);
