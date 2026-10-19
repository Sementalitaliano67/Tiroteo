import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { localDateString } from '../lib/date'
import { isScheduledOn } from './useHabitsGame'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { Habit } from '../types'

// Recordatorio diario: mientras la app esté abierta, a la hora elegida avisa si quedan hábitos pendientes.
export function useReminder() {
  const { profile } = useAuth()
  const { showToast } = useToast()

  useEffect(() => {
    if (!profile?.reminder_time) return
    const [hh, mm] = profile.reminder_time.split(':').map(Number)

    const check = async () => {
      const now = new Date()
      const today = localDateString(now)
      const key = `tiroteo-recordatorio-${profile.id}`
      let last: string | null = null
      try {
        last = localStorage.getItem(key)
      } catch {
        // sin almacenamiento local se puede repetir el aviso; no es grave
      }
      if (last === today) return
      if (now.getHours() * 60 + now.getMinutes() < hh * 60 + mm) return

      const [{ data: habits }, { data: done }] = await Promise.all([
        supabase.from('habits').select('id, frequency, frequency_days').eq('is_active', true),
        supabase.from('habit_completions').select('habit_id').eq('completed_date', today),
      ])
      const doneIds = new Set((done || []).map((d) => d.habit_id))
      const pending = ((habits || []) as Pick<Habit, 'id' | 'frequency' | 'frequency_days'>[]).filter(
        (h) => isScheduledOn(h, now.getDay()) && !doneIds.has(h.id),
      ).length
      try {
        localStorage.setItem(key, today)
      } catch {
        // idem
      }
      if (pending === 0) return
      const message = `Te ${pending === 1 ? 'queda 1 hábito' : `quedan ${pending} hábitos`} por completar hoy.`
      showToast(message, 'info')
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Tiroteo', { body: message, icon: '/favicon.svg' })
      }
    }

    check()
    const timer = window.setInterval(check, 60_000)
    return () => window.clearInterval(timer)
  }, [profile?.id, profile?.reminder_time, showToast])
}
