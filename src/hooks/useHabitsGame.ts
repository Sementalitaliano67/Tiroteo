import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { localDateString } from '../lib/date'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  type Habit,
  type HabitWithCompletion,
  type Category,
  type Difficulty,
  type Frequency,
  type CompleteResult,
} from '../types'

interface LevelUpInfo {
  newLevel: number
}

export function isScheduledOn(h: Pick<Habit, 'frequency' | 'frequency_days'>, dow: number): boolean {
  if (h.frequency === 'Diario') return true
  if (!h.frequency_days || h.frequency_days.length === 0) return true
  return h.frequency_days.includes(dow)
}

export function useHabitsGame() {
  const { refreshProfile } = useAuth()
  const { showToast } = useToast()
  const [habits, setHabits] = useState<HabitWithCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [levelUp, setLevelUp] = useState<LevelUpInfo | null>(null)

  // Día local: a las 22:00 de Argentina sigue siendo el mismo día.
  const today = localDateString()
  const todayDow = new Date().getDay()

  const isScheduledToday = (h: Habit): boolean => isScheduledOn(h, todayDow)

  const fetchHabits = useCallback(async () => {
    setLoadError(false)
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    if (error) {
      setLoadError(true)
      setLoading(false)
      return
    }
    const habitList = (data || []) as Habit[]

    const { data: completions, error: completionsError } = await supabase
      .from('habit_completions')
      .select('habit_id')
      .eq('completed_date', today)
    if (completionsError) {
      setLoadError(true)
      setLoading(false)
      return
    }

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

  const retry = useCallback(() => {
    setLoading(true)
    fetchHabits()
  }, [fetchHabits])

  // La XP de un hábito personal la fija la base según la dificultad.
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
      await refreshProfile()
      return true
    },
    [showToast, refreshProfile],
  )

  // XP, nivel y racha los calcula el servidor en una sola operación.
  const completeHabit = useCallback(
    async (habitId: string): Promise<boolean> => {
      const habit = habits.find((h) => h.id === habitId)
      if (!habit || habit.completed_today) {
        showToast('Solo puedes completar un hábito una vez por día.', 'info')
        return false
      }

      setHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, completed_today: true } : h)))
      const { data, error } = await supabase.rpc('complete_habit', { p_habit_id: habitId })
      if (error) {
        if (error.code === '23505') {
          showToast('Solo puedes completar un hábito una vez por día.', 'info')
        } else {
          setHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, completed_today: false } : h)))
          showToast(error.message || 'Error al completar el hábito.', 'error')
        }
        return false
      }

      const result = data as CompleteResult
      if (result.leveled_up) setLevelUp({ newLevel: result.level })
      await refreshProfile()
      return true
    },
    [habits, refreshProfile, showToast],
  )

  return {
    habits,
    loading,
    loadError,
    retry,
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
