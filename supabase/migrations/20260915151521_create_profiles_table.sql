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
