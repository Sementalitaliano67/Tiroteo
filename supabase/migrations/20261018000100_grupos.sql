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
