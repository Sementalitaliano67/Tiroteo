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
