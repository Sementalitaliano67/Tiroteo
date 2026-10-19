import { supabase } from './supabase'
import { addDays, localDateString } from './date'
import type { Category, Profile } from '../types'

export interface CompletionRow {
  completed_date: string
  xp_awarded: number
  category: Category | null
  group: boolean
}

export async function loadMyCompletions(userId: string, sinceDays = 90): Promise<CompletionRow[]> {
  const since = addDays(localDateString(), -sinceDays)
  const [personal, group] = await Promise.all([
    supabase
      .from('habit_completions')
      .select('completed_date, xp_awarded, habits(category)')
      .gte('completed_date', since),
    supabase
      .from('group_completions')
      .select('completed_date, xp_awarded')
      .eq('user_id', userId)
      .gte('completed_date', since),
  ])
  if (personal.error) throw personal.error
  const rows: CompletionRow[] = (personal.data || []).map((r) => {
    const habit = r.habits as unknown as { category: Category } | null
    return { completed_date: r.completed_date, xp_awarded: r.xp_awarded, category: habit?.category ?? null, group: false }
  })
  for (const r of group.data || []) rows.push({ ...r, category: null, group: true })
  return rows
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
}

export interface BadgeInput {
  profile: Profile
  totalCompletions: number
  groupsJoined: number
  groupsCreated: number
}

// Las insignias se calculan con datos que solo escribe el servidor.
export function computeBadges({ profile, totalCompletions, groupsJoined, groupsCreated }: BadgeInput): Badge[] {
  return [
    { id: 'primer-tiro', name: 'Primer tiro', description: 'Completá tu primer hábito.', icon: '🎯', unlocked: totalCompletions >= 1 },
    { id: 'semana', name: 'Semana perfecta', description: 'Llegá a una racha de 7 días.', icon: '🔥', unlocked: profile.best_streak >= 7 },
    { id: 'mes', name: 'Imparable', description: 'Llegá a una racha de 30 días.', icon: '🏆', unlocked: profile.best_streak >= 30 },
    { id: 'nivel-5', name: 'Nivel 5', description: 'Alcanzá el nivel 5.', icon: '⭐', unlocked: profile.level >= 5 },
    { id: 'cien', name: 'Centenario', description: 'Sumá 100 hábitos completados.', icon: '💯', unlocked: totalCompletions >= 100 },
    { id: 'equipo', name: 'En equipo', description: 'Participá en un grupo.', icon: '🤝', unlocked: groupsJoined >= 1 },
    { id: 'organizador', name: 'Organizador', description: 'Creá un grupo.', icon: '📣', unlocked: groupsCreated >= 1 },
  ]
}
