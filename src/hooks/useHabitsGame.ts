import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  type Habit,
  type HabitWithCompletion,
  type Category,
  type Difficulty,
  type Frequency,
  XP_BY_DIFFICULTY,
} from '../types'

interface LevelUpInfo {
  newLevel: number
}

export function useHabitsGame() {
  const { profile, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const [habits, setHabits] = useState<HabitWithCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [levelUp, setLevelUp] = useState<LevelUpInfo | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const todayDow = new Date().getDay()

  const isScheduledToday = (h: Habit): boolean => {
    if (h.frequency === 'Diario') return true
    if (!h.frequency_days || h.frequency_days.length === 0) return true
    return h.frequency_days.includes(todayDow)
  }

  const fetchHabits = useCallback(async () => {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    if (error) return
    const habitList = (data || []) as Habit[]

    const { data: completions } = await supabase
      .from('habit_completions')
      .select('habit_id')
      .eq('completed_date', today)

    const completedIds = new Set((completions || []).map((c) => c.habit_id))

    const withCompletion: HabitWithCompletion[] = habitList.map((h) => ({
      ...h,
      completed_today: completedIds.has(h.id),
    }))
    setHabits(withCompletion)
    setLoading(false)
  }, [today])

  useEffect(() => {
    fetchHabits()
  }, [fetchHabits])

  const createHabit = useCallback(
    async (
      name: string,
      category: Category,
      difficulty: Difficulty,
      frequency: Frequency,
      frequencyDays: number[] | null,
    ): Promise<boolean> => {
      const { error } = await supabase.from('habits').insert({
        name: name.trim(),
        category,
        difficulty,
        xp_reward: XP_BY_DIFFICULTY[difficulty],
        frequency,
        frequency_days: frequencyDays,
      })
      if (error) {
        showToast('Error al crear el hábito. Inténtalo de nuevo.', 'error')
        return false
      }
      await fetchHabits()
      showToast('¡Hábito creado!', 'success')
      return true
    },
    [fetchHabits, showToast],
  )

  const updateHabit = useCallback(
    async (
      id: string,
      name: string,
      category: Category,
      difficulty: Difficulty,
      frequency: Frequency,
      frequencyDays: number[] | null,
    ): Promise<boolean> => {
      const { error } = await supabase
        .from('habits')
        .update({
          name: name.trim(),
          category,
          difficulty,
          xp_reward: XP_BY_DIFFICULTY[difficulty],
          frequency,
          frequency_days: frequencyDays,
        })
        .eq('id', id)
      if (error) {
        showToast('Error al actualizar el hábito.', 'error')
        return false
      }
      await fetchHabits()
      showToast('Hábito actualizado.', 'success')
      return true
    },
    [fetchHabits, showToast],
  )

  const deleteHabit = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from('habits').update({ is_active: false }).eq('id', id)
      if (error) {
        showToast('Error al eliminar el hábito.', 'error')
        return false
      }
      setHabits((prev) => prev.filter((h) => h.id !== id))
      showToast('Hábito eliminado.', 'success')
      return true
    },
    [showToast],
  )

  const completeHabit = useCallback(
    async (habitId: string) => {
      const habit = habits.find((h) => h.id === habitId)
      if (!habit || habit.completed_today) {
        showToast('Solo puedes completar un hábito una vez por día.', 'info')
        return
      }

      // Insert completion
      const { error: completionError } = await supabase
        .from('habit_completions')
        .insert({ habit_id: habitId, completed_date: today })
      if (completionError) {
        if (completionError.code === '23505') {
          showToast('Solo puedes completar un hábito una vez por día.', 'info')
          setHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, completed_today: true } : h)))
        } else {
          showToast('Error al completar el hábito.', 'error')
        }
        return
      }

      // Add XP
      const newXp = (profile?.xp ?? 0) + habit.xp_reward
      const currentLevel = profile?.level ?? 1
      const xpRequired = currentLevel * 100
      let newLevel = currentLevel

      if (newXp >= xpRequired) {
        newLevel = currentLevel + 1
        setLevelUp({ newLevel })
      }

      // Check if all scheduled habits are now completed → update streak
      const updatedHabits = habits.map((h) =>
        h.id === habitId ? { ...h, completed_today: true } : h,
      )
      const scheduledToday = updatedHabits.filter((h) => isScheduledToday(h))
      const allCompleted = scheduledToday.length > 0 && scheduledToday.every((h) => h.completed_today)

      let newStreak = profile?.streak_count ?? 0
      let newLastStreakDate = profile?.last_streak_date ?? null

      if (allCompleted) {
        const lastDate = profile?.last_streak_date
        if (lastDate === today) {
          // already counted today
        } else {
          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          const yesterdayStr = yesterday.toISOString().slice(0, 10)
          if (lastDate === yesterdayStr) {
            newStreak = (profile?.streak_count ?? 0) + 1
          } else {
            newStreak = 1
          }
          newLastStreakDate = today
        }
      }

      await supabase
        .from('profiles')
        .update({ xp: newXp, level: newLevel, streak_count: newStreak, last_streak_date: newLastStreakDate })
        .eq('id', profile!.id)

      setHabits(updatedHabits)
      await refreshProfile()
    },
    [habits, profile, today, refreshProfile],
  )

  return {
    habits,
    loading,
    levelUp,
    setLevelUp,
    createHabit,
    updateHabit,
    deleteHabit,
    completeHabit,
    refreshHabits: fetchHabits,
    isScheduledToday,
  }
}
