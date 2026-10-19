export type Category = 'Salud' | 'Estudio' | 'Deporte' | 'Productividad'
export type Difficulty = 'Fácil' | 'Medio' | 'Difícil'
export type Frequency = 'Diario' | 'Días específicos'

export const CATEGORIES: Category[] = ['Salud', 'Estudio', 'Deporte', 'Productividad']
export const DIFFICULTIES: Difficulty[] = ['Fácil', 'Medio', 'Difícil']
export const FREQUENCIES: Frequency[] = ['Diario', 'Días específicos']

export const XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  'Fácil': 10,
  'Medio': 20,
  'Difícil': 30,
}

export const CATEGORY_ICONS: Record<Category, string> = {
  'Salud': '❤',
  'Estudio': '📚',
  'Deporte': '⚽',
  'Productividad': '⚡',
}

export const CATEGORY_COLORS: Record<Category, string> = {
  'Salud': 'bg-rose-100 text-rose-700',
  'Estudio': 'bg-blue-100 text-blue-700',
  'Deporte': 'bg-amber-100 text-amber-700',
  'Productividad': 'bg-violet-100 text-violet-700',
}

export interface Habit {
  id: string
  user_id: string
  name: string
  category: Category
  difficulty: Difficulty
  xp_reward: number
  frequency: Frequency
  frequency_days: number[] | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface HabitCompletion {
  id: string
  habit_id: string
  user_id: string
  completed_date: string
  created_at: string
}

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  xp: number
  level: number
  streak_count: number
  last_streak_date: string | null
  timezone: string
  reminder_time: string | null
  theme: 'claro' | 'oscuro'
  best_streak: number
}

export const PROFILE_COLUMNS =
  'id, display_name, avatar_url, xp, level, streak_count, last_streak_date, timezone, reminder_time, theme, best_streak'

export interface Group {
  id: string
  name: string
  creator_id: string
  invite_code: string
  created_at: string
}

export interface MyGroup {
  id: string
  name: string
  creator_id: string
  invite_code: string
  members: number
  my_position: number
  my_xp: number
}

export interface GroupHabit {
  id: string
  group_id: string
  name: string
  frequency: Frequency
  frequency_days: number[] | null
  xp: number
  is_active: boolean
  created_at: string
}

export interface GroupHabitWithCompletion extends GroupHabit {
  completed_today: boolean
}

export interface RankingRow {
  user_id: string
  display_name: string
  xp: number
  rank_position: number
}

export interface CompleteResult {
  xp_awarded: number
  xp: number
  level: number
  leveled_up: boolean
  streak?: number
}

export interface HabitWithCompletion extends Habit {
  completed_today: boolean
}

export const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
