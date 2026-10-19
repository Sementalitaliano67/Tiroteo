-- ============================================================
-- Instalación completa de la base. Pegar TODO en Supabase → SQL Editor → Run.
-- Generado a partir de supabase/migrations/ y supabase/seed.sql.
-- Se puede correr una sola vez sobre un proyecto nuevo.
-- ============================================================

-- ───── 20260915151521_create_profiles_table.sql ─────
/*
# Create profiles table

## Summary
Creates a `profiles` table that extends Supabase's built-in `auth.users` with
application-specific user data (display name, avatar URL, XP, level, streak
count). A trigger automatically creates a profile row whenever a new auth
user signs up, so the frontend never needs to insert profiles manually.

## New Tables
- `profiles`
  - `id` (uuid, primary key, references `auth.users.id` ON DELETE CASCADE)
  - `display_name` (text, not null — the name shown in the app)
  - `avatar_url` (text, nullable — optional profile picture URL)
  - `xp` (integer, default 0 — experience points for the gamified habit system)
  - `level` (integer, default 1 — current level derived from XP)
  - `streak_count` (integer, default 0 — consecutive-day streak counter)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now(), auto-updated via trigger)

## Security
- RLS enabled on `profiles`.
- Four owner-scoped policies (SELECT, INSERT, UPDATE, DELETE) scoped to
  `authenticated` users, using `auth.uid() = id`.
- A trigger function `handle_new_user_profile()` creates a profile row on
  `auth.users` INSERT, so every new sign-up gets a profile automatically.

## Notes
1. The `DEFAULT auth.uid()` rule does not apply here because `id` is a FK to
   `auth.users` — the trigger supplies it explicitly.
2. The `updated_at` trigger keeps the column fresh without app code.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  avatar_url   text,
  xp           integer NOT NULL DEFAULT 0,
  level        integer NOT NULL DEFAULT 1,
  streak_count integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON public.profiles;
CREATE POLICY "delete_own_profile"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();


-- ───── 20260915152603_create_habits_and_completions.sql ─────
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


-- ───── 20261018000000_xp_y_racha_en_servidor.sql ─────
/*
# XP, nivel y racha calculados por el servidor (spec C1 a C4)

- El "hoy" de cada usuario se calcula con su zona horaria (por defecto Argentina).
- Completar un hábito se hace solo con la función `complete_habit`, que en una
  sola operación registra el cumplimiento, suma la XP, recalcula el nivel y la racha.
- El usuario ya no puede escribir xp, level, streak_count ni last_streak_date.
- La racha cuenta días seguidos en que se cumplió todo lo programado. Los días sin
  nada programado no cuentan ni cortan. Un hábito nuevo se exige desde el día siguiente.
- `sync_my_stats` revisa la racha al abrir la app.
- Perfil: zona horaria, horario de recordatorio, tema y mejor racha.
*/

-- ── profiles ──
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  ADD COLUMN IF NOT EXISTS reminder_time time,
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'claro',
  ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_theme_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_theme_check CHECK (theme IN ('claro', 'oscuro'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_display_name_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_name_check CHECK (char_length(display_name) <= 40);

CREATE OR REPLACE FUNCTION public.check_profile_timezone()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
    NEW.timezone := 'America/Argentina/Buenos_Aires';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_check_timezone ON public.profiles;
CREATE TRIGGER profiles_check_timezone
  BEFORE INSERT OR UPDATE OF timezone ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_profile_timezone();

-- El perfil lo crea el trigger de registro; el usuario solo edita lo suyo.
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "delete_own_profile" ON public.profiles;

REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (display_name, avatar_url, timezone, reminder_time, theme) ON public.profiles TO authenticated;

-- ── habits ──
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- La XP de un hábito personal sale siempre de su dificultad, la mande o no el navegador.
CREATE OR REPLACE FUNCTION public.set_habit_xp_reward()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.xp_reward := CASE NEW.difficulty WHEN 'Fácil' THEN 10 WHEN 'Medio' THEN 20 ELSE 30 END;
  IF NEW.frequency = 'Diario' THEN
    NEW.frequency_days := NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.is_active = false AND OLD.is_active = true THEN
    NEW.deleted_at := now();
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.user_id := OLD.user_id;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS habits_set_xp_reward ON public.habits;
CREATE TRIGGER habits_set_xp_reward
  BEFORE INSERT OR UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.set_habit_xp_reward();

-- Un hábito dado de baja no vuelve a activarse desde el navegador.
DROP POLICY IF EXISTS "update_own_habits" ON public.habits;
CREATE POLICY "update_own_habits"
  ON public.habits FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND is_active)
  WITH CHECK (auth.uid() = user_id);

-- Eliminar es una baja lógica, para conservar el historial de la racha.
DROP POLICY IF EXISTS "delete_own_habits" ON public.habits;
REVOKE DELETE ON public.habits FROM anon, authenticated;

-- ── habit_completions ──
ALTER TABLE public.habit_completions ADD COLUMN IF NOT EXISTS xp_awarded integer NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS "insert_own_completions" ON public.habit_completions;
DROP POLICY IF EXISTS "delete_own_completions" ON public.habit_completions;
REVOKE INSERT, UPDATE, DELETE ON public.habit_completions FROM anon, authenticated;

-- ── funciones auxiliares ──
CREATE OR REPLACE FUNCTION public.user_local_date(p_user uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (now() AT TIME ZONE COALESCE(
    (SELECT timezone FROM public.profiles WHERE id = p_user),
    'America/Argentina/Buenos_Aires'))::date;
$$;

CREATE OR REPLACE FUNCTION public.level_for_xp(p_xp integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT GREATEST(p_xp, 0) / 100 + 1;
$$;

-- ¿El hábito estaba programado (y ya se exigía) ese día?
CREATE OR REPLACE FUNCTION public.habit_required_on(h public.habits, p_day date, p_tz text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT (h.created_at AT TIME ZONE p_tz)::date < p_day
     AND (h.deleted_at IS NULL OR (h.deleted_at AT TIME ZONE p_tz)::date > p_day)
     AND (h.is_active OR h.deleted_at IS NOT NULL)
     AND (h.frequency = 'Diario'
          OR h.frequency_days IS NULL
          OR cardinality(h.frequency_days) = 0
          OR EXTRACT(DOW FROM p_day)::int = ANY (h.frequency_days));
$$;

-- Racha: días seguidos con todo lo programado cumplido, mirando hacia atrás desde hoy.
-- Hoy solo suma si ya está completo; si todavía falta algo, no corta.
CREATE OR REPLACE FUNCTION public.compute_streak(p_user uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tz text;
  v_today date;
  v_day date;
  v_required int;
  v_done int;
  v_streak int := 0;
  v_first date;
BEGIN
  SELECT timezone INTO v_tz FROM profiles WHERE id = p_user;
  v_tz := COALESCE(v_tz, 'America/Argentina/Buenos_Aires');
  v_today := (now() AT TIME ZONE v_tz)::date;
  SELECT MIN((created_at AT TIME ZONE v_tz)::date) INTO v_first FROM habits WHERE user_id = p_user;
  IF v_first IS NULL THEN
    RETURN 0;
  END IF;

  v_day := v_today;
  WHILE v_day >= v_first AND v_day > v_today - 400 LOOP
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM habit_completions c
             WHERE c.habit_id = h.id AND c.completed_date = v_day))
      INTO v_required, v_done
      FROM habits h
     WHERE h.user_id = p_user
       AND (habit_required_on(h, v_day, v_tz)
            -- Un hábito creado ese mismo día solo cuenta si se cumplió.
            OR ((h.created_at AT TIME ZONE v_tz)::date = v_day
                AND EXISTS (SELECT 1 FROM habit_completions c
                            WHERE c.habit_id = h.id AND c.completed_date = v_day)));

    IF v_required > 0 THEN
      IF v_done = v_required THEN
        v_streak := v_streak + 1;
      ELSIF v_day <> v_today THEN
        EXIT;
      END IF;
    END IF;
    v_day := v_day - 1;
  END LOOP;
  RETURN v_streak;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_my_stats()
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_streak int;
  v_row profiles;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Necesitás iniciar sesión.';
  END IF;
  v_streak := compute_streak(v_uid);
  UPDATE profiles
     SET streak_count = v_streak,
         best_streak = GREATEST(best_streak, v_streak),
         level = level_for_xp(xp),
         last_streak_date = CASE WHEN v_streak > 0 THEN user_local_date(v_uid) ELSE last_streak_date END
   WHERE id = v_uid
   RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_habit(p_habit_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_habit habits;
  v_profile profiles;
  v_today date;
  v_old_level int;
  v_new_xp int;
  v_streak int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Necesitás iniciar sesión.';
  END IF;

  -- Bloquea el perfil para que dos cumplimientos seguidos sumen ambos.
  SELECT * INTO v_profile FROM profiles WHERE id = v_uid FOR UPDATE;
  SELECT * INTO v_habit FROM habits WHERE id = p_habit_id AND user_id = v_uid AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El hábito no existe.';
  END IF;

  v_today := (now() AT TIME ZONE v_profile.timezone)::date;
  IF NOT (v_habit.frequency = 'Diario'
          OR v_habit.frequency_days IS NULL
          OR cardinality(v_habit.frequency_days) = 0
          OR EXTRACT(DOW FROM v_today)::int = ANY (v_habit.frequency_days)) THEN
    RAISE EXCEPTION 'Este hábito no está programado para hoy.';
  END IF;

  BEGIN
    INSERT INTO habit_completions (habit_id, user_id, completed_date, xp_awarded)
    VALUES (v_habit.id, v_uid, v_today, v_habit.xp_reward);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Solo podés completar un hábito una vez por día.' USING ERRCODE = '23505';
  END;

  v_old_level := level_for_xp(v_profile.xp);
  v_new_xp := v_profile.xp + v_habit.xp_reward;
  v_streak := compute_streak(v_uid);

  UPDATE profiles
     SET xp = v_new_xp,
         level = level_for_xp(v_new_xp),
         streak_count = v_streak,
         best_streak = GREATEST(best_streak, v_streak),
         last_streak_date = CASE WHEN v_streak > 0 THEN v_today ELSE last_streak_date END
   WHERE id = v_uid;

  RETURN jsonb_build_object(
    'xp_awarded', v_habit.xp_reward,
    'xp', v_new_xp,
    'level', level_for_xp(v_new_xp),
    'leveled_up', level_for_xp(v_new_xp) > v_old_level,
    'streak', v_streak);
END;
$$;

-- Hoy local del usuario, para que la pantalla use el mismo día que el servidor.
CREATE OR REPLACE FUNCTION public.my_today()
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_local_date(auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.compute_streak(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_local_date(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_habit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_my_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_today() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_habit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_my_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_today() TO authenticated;

-- Las cuentas existentes recalculan nivel y racha con las reglas nuevas.
UPDATE public.profiles SET level = public.level_for_xp(xp);
UPDATE public.profiles p SET streak_count = public.compute_streak(p.id), best_streak = GREATEST(p.best_streak, public.compute_streak(p.id));

-- Los cumplimientos anteriores registran la XP que otorgaron.
UPDATE public.habit_completions c SET xp_awarded = h.xp_reward
  FROM public.habits h WHERE h.id = c.habit_id AND c.xp_awarded = 0;


-- ───── 20261018000100_grupos.sql ─────
/*
# Grupos con ranking interno (SPEC_Tiroteo_Grupos.md)

- Un grupo tiene un creador fijo, un código de invitación y hábitos con XP fija (5 a 100).
- Toda escritura pasa por funciones del servidor; el navegador solo lee.
- Cada cumplimiento guarda la XP que otorgó; el ranking suma esos registros.
- La XP de grupo también suma al nivel personal, pero no a la racha.
- Límites: 50 participantes y 20 hábitos activos por grupo.
*/

CREATE TABLE IF NOT EXISTS public.groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 40),
  creator_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id  uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.group_habits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 50),
  frequency      text NOT NULL CHECK (frequency IN ('Diario', 'Días específicos')),
  frequency_days integer[],
  xp             integer NOT NULL CHECK (xp BETWEEN 5 AND 100),
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_completions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_habit_id uuid NOT NULL REFERENCES public.group_habits(id) ON DELETE CASCADE,
  group_id       uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_date date NOT NULL,
  xp_awarded     integer NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_habit_id, user_id, completed_date)
);

CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_group_habits_group ON public.group_habits (group_id);
CREATE INDEX IF NOT EXISTS idx_group_completions_group ON public.group_completions (group_id, user_id);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_completions ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.groups, public.group_members, public.group_habits, public.group_completions FROM anon, authenticated;
REVOKE SELECT ON public.groups, public.group_members, public.group_habits, public.group_completions FROM anon;

CREATE OR REPLACE FUNCTION public.is_group_member(p_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM group_members WHERE group_id = p_group AND user_id = auth.uid());
$$;

DROP POLICY IF EXISTS "members_read_groups" ON public.groups;
CREATE POLICY "members_read_groups" ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id));

DROP POLICY IF EXISTS "members_read_members" ON public.group_members;
CREATE POLICY "members_read_members" ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "members_read_group_habits" ON public.group_habits;
CREATE POLICY "members_read_group_habits" ON public.group_habits FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "members_read_group_completions" ON public.group_completions;
CREATE POLICY "members_read_group_completions" ON public.group_completions FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

-- Los participantes de un grupo ven el nombre de los demás.
DROP POLICY IF EXISTS "select_group_mates_profiles" ON public.profiles;
CREATE POLICY "select_group_mates_profiles" ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_members mine
    JOIN public.group_members theirs ON theirs.group_id = mine.group_id
    WHERE mine.user_id = auth.uid() AND theirs.user_id = profiles.id));

-- ── funciones ──

CREATE OR REPLACE FUNCTION public.require_uid()
RETURNS uuid LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Necesitás iniciar sesión.';
  END IF;
  RETURN auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.require_group_creator(p_group uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_group AND creator_id = auth.uid()) THEN
    RAISE EXCEPTION 'Solo el creador del grupo puede hacer esto.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_group(p_name text)
RETURNS public.groups LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := require_uid();
  v_code text;
  v_group groups;
BEGIN
  IF p_name IS NULL OR char_length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'El nombre del grupo es obligatorio.';
  END IF;
  LOOP
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    EXIT WHEN char_length(v_code) = 6 AND NOT EXISTS (SELECT 1 FROM groups WHERE invite_code = v_code);
  END LOOP;
  INSERT INTO groups (name, creator_id, invite_code) VALUES (trim(p_name), v_uid, v_code) RETURNING * INTO v_group;
  INSERT INTO group_members (group_id, user_id) VALUES (v_group.id, v_uid);
  RETURN v_group;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_group(p_code text)
RETURNS public.groups LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := require_uid();
  v_group groups;
BEGIN
  SELECT * INTO v_group FROM groups WHERE invite_code = upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El código no corresponde a ningún grupo.';
  END IF;
  IF EXISTS (SELECT 1 FROM group_members WHERE group_id = v_group.id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'Ya sos parte de este grupo.';
  END IF;
  IF (SELECT COUNT(*) FROM group_members WHERE group_id = v_group.id) >= 50 THEN
    RAISE EXCEPTION 'El grupo ya tiene 50 participantes.';
  END IF;
  INSERT INTO group_members (group_id, user_id) VALUES (v_group.id, v_uid);
  RETURN v_group;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_group_habit(p_group uuid, p_name text, p_frequency text, p_days integer[], p_xp integer)
RETURNS public.group_habits LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_habit group_habits;
BEGIN
  PERFORM require_uid();
  PERFORM require_group_creator(p_group);
  IF p_xp IS NULL OR p_xp < 5 OR p_xp > 100 THEN
    RAISE EXCEPTION 'La XP tiene que ser un número entero entre 5 y 100.';
  END IF;
  IF p_frequency = 'Días específicos' AND (p_days IS NULL OR cardinality(p_days) = 0) THEN
    RAISE EXCEPTION 'Elegí al menos un día.';
  END IF;
  IF (SELECT COUNT(*) FROM group_habits WHERE group_id = p_group AND is_active) >= 20 THEN
    RAISE EXCEPTION 'El grupo ya tiene 20 hábitos activos.';
  END IF;
  INSERT INTO group_habits (group_id, name, frequency, frequency_days, xp)
  VALUES (p_group, trim(p_name), p_frequency, CASE WHEN p_frequency = 'Diario' THEN NULL ELSE p_days END, p_xp)
  RETURNING * INTO v_habit;
  RETURN v_habit;
END;
$$;

-- Solo el nombre es editable; la XP y la frecuencia quedan fijas (regla 4, decisión 4).
CREATE OR REPLACE FUNCTION public.rename_group_habit(p_habit uuid, p_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_group uuid;
BEGIN
  PERFORM require_uid();
  SELECT group_id INTO v_group FROM group_habits WHERE id = p_habit AND is_active;
  IF v_group IS NULL THEN
    RAISE EXCEPTION 'El hábito no existe.';
  END IF;
  PERFORM require_group_creator(v_group);
  UPDATE group_habits SET name = trim(p_name) WHERE id = p_habit;
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_group_habit(p_habit uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_group uuid;
BEGIN
  PERFORM require_uid();
  SELECT group_id INTO v_group FROM group_habits WHERE id = p_habit;
  IF v_group IS NULL THEN
    RAISE EXCEPTION 'El hábito no existe.';
  END IF;
  PERFORM require_group_creator(v_group);
  UPDATE group_habits SET is_active = false WHERE id = p_habit;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_group_habit(p_habit uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := require_uid();
  v_habit group_habits;
  v_profile profiles;
  v_today date;
  v_old_level int;
  v_new_xp int;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = v_uid FOR UPDATE;
  SELECT * INTO v_habit FROM group_habits WHERE id = p_habit AND is_active;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = v_habit.group_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'El hábito no existe.';
  END IF;
  v_today := (now() AT TIME ZONE v_profile.timezone)::date;
  IF NOT (v_habit.frequency = 'Diario'
          OR v_habit.frequency_days IS NULL
          OR EXTRACT(DOW FROM v_today)::int = ANY (v_habit.frequency_days)) THEN
    RAISE EXCEPTION 'Este hábito no está programado para hoy.';
  END IF;
  BEGIN
    INSERT INTO group_completions (group_habit_id, group_id, user_id, completed_date, xp_awarded)
    VALUES (v_habit.id, v_habit.group_id, v_uid, v_today, v_habit.xp);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Solo podés completar un hábito una vez por día.' USING ERRCODE = '23505';
  END;
  v_old_level := level_for_xp(v_profile.xp);
  v_new_xp := v_profile.xp + v_habit.xp;
  UPDATE profiles SET xp = v_new_xp, level = level_for_xp(v_new_xp) WHERE id = v_uid;
  RETURN jsonb_build_object(
    'xp_awarded', v_habit.xp,
    'xp', v_new_xp,
    'level', level_for_xp(v_new_xp),
    'leveled_up', level_for_xp(v_new_xp) > v_old_level);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_group(p_group uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := require_uid();
BEGIN
  IF EXISTS (SELECT 1 FROM groups WHERE id = p_group AND creator_id = v_uid) THEN
    RAISE EXCEPTION 'El creador no puede salir del grupo; solo eliminarlo.';
  END IF;
  DELETE FROM group_members WHERE group_id = p_group AND user_id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_group_member(p_group uuid, p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_uid();
  PERFORM require_group_creator(p_group);
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'El creador no puede expulsarse a sí mismo.';
  END IF;
  DELETE FROM group_members WHERE group_id = p_group AND user_id = p_user;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_group(p_group uuid, p_confirm_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_uid();
  PERFORM require_group_creator(p_group);
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_group AND name = p_confirm_name) THEN
    RAISE EXCEPTION 'El nombre no coincide.';
  END IF;
  DELETE FROM groups WHERE id = p_group;
END;
$$;

-- Ranking: suma de la XP registrada en cada cumplimiento, solo de quienes siguen en el grupo.
-- Semanal: desde el lunes de la semana local de quien consulta. Empate: gana quien llegó primero.
CREATE OR REPLACE FUNCTION public.group_ranking(p_group uuid, p_period text DEFAULT 'total')
RETURNS TABLE (user_id uuid, display_name text, xp bigint, rank_position bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_since date;
BEGIN
  IF NOT is_group_member(p_group) THEN
    RAISE EXCEPTION 'No sos parte de este grupo.';
  END IF;
  IF p_period = 'semanal' THEN
    v_since := date_trunc('week', user_local_date(auth.uid()))::date;
  ELSE
    v_since := '-infinity'::date;
  END IF;
  RETURN QUERY
    SELECT m.user_id,
           COALESCE(NULLIF(p.display_name, ''), 'Participante') AS display_name,
           COALESCE(SUM(c.xp_awarded), 0)::bigint AS xp,
           ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.xp_awarded), 0) DESC,
                                       MAX(c.created_at) ASC NULLS LAST,
                                       m.joined_at ASC) AS rank_position
      FROM group_members m
      JOIN profiles p ON p.id = m.user_id
      LEFT JOIN group_completions c
             ON c.group_id = m.group_id AND c.user_id = m.user_id AND c.completed_date >= v_since
     WHERE m.group_id = p_group
     GROUP BY m.user_id, p.display_name, m.joined_at
     ORDER BY rank_position;
END;
$$;

-- Mis grupos con mi posición en el ranking total.
CREATE OR REPLACE FUNCTION public.my_groups()
RETURNS TABLE (id uuid, name text, creator_id uuid, invite_code text, members bigint, my_position bigint, my_xp bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.name, g.creator_id,
         g.invite_code,
         (SELECT COUNT(*) FROM group_members WHERE group_id = g.id),
         r.rank_position, r.xp
    FROM groups g
    JOIN group_members m ON m.group_id = g.id AND m.user_id = auth.uid()
    CROSS JOIN LATERAL (
      SELECT gr.rank_position, gr.xp FROM group_ranking(g.id, 'total') gr WHERE gr.user_id = auth.uid()
    ) r
   ORDER BY g.created_at;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'create_group(text)', 'join_group(text)',
    'add_group_habit(uuid,text,text,integer[],integer)', 'rename_group_habit(uuid,text)',
    'deactivate_group_habit(uuid)', 'complete_group_habit(uuid)', 'leave_group(uuid)',
    'remove_group_member(uuid,uuid)', 'delete_group(uuid,text)', 'group_ranking(uuid,text)',
    'my_groups()', 'is_group_member(uuid)', 'require_group_creator(uuid)']
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;


NOTIFY pgrst, 'reload schema';
