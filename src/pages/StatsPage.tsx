import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import AppHeader from '../components/AppHeader'
import BarChart from '../components/BarChart'
import { loadMyCompletions, type CompletionRow } from '../lib/stats'
import { addDays, localDateString, parseLocalDate } from '../lib/date'
import { CATEGORIES } from '../types'

function shortDate(d: string) {
  return parseLocalDate(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })
}

export default function StatsPage() {
  const { user, profile } = useAuth()
  const [rows, setRows] = useState<CompletionRow[] | null>(null)
  const [error, setError] = useState(false)

  const load = () => {
    if (!user) return
    setError(false)
    loadMyCompletions(user.id, 90).then(setRows).catch(() => setError(true))
  }

  useEffect(load, [user?.id])

  const stats = useMemo(() => {
    if (!rows) return null
    const today = localDateString()
    const byDay = new Map<string, number>()
    for (const r of rows) byDay.set(r.completed_date, (byDay.get(r.completed_date) || 0) + 1)
    const last30 = Array.from({ length: 30 }, (_, i) => {
      const d = addDays(today, i - 29)
      return { label: shortDate(d), value: byDay.get(d) || 0 }
    })
    // Semanas que empiezan el lunes.
    const monday = (() => {
      const t = parseLocalDate(today)
      const diff = (t.getDay() + 6) % 7
      return addDays(today, -diff)
    })()
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const start = addDays(monday, (i - 7) * 7)
      const end = addDays(start, 6)
      const xp = rows.filter((r) => r.completed_date >= start && r.completed_date <= end).reduce((s, r) => s + r.xp_awarded, 0)
      return { label: shortDate(start), value: xp }
    })
    const byCategory = CATEGORIES.map((c) => ({ category: c, count: rows.filter((r) => r.category === c).length }))
    const groupCount = rows.filter((r) => r.group).length
    const last7 = rows.filter((r) => r.completed_date > addDays(today, -7)).length
    const activeDays = new Set(rows.filter((r) => r.completed_date > addDays(today, -30)).map((r) => r.completed_date)).size
    return { last30, weeks, byCategory, groupCount, last7, activeDays, total: rows.length }
  }, [rows])

  return (
    <div className="min-h-screen bg-neutral-50">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-900">Estadísticas</h1>
          <p className="text-neutral-500 text-sm">Tus últimos 90 días.</p>
        </div>
        {error ? (
          <div className="card p-6 text-center" role="alert">
            <p className="text-neutral-600 mb-3">No pudimos cargar tus estadísticas.</p>
            <button className="btn-primary" onClick={load}>Reintentar</button>
          </div>
        ) : !stats || !profile ? (
          <p className="text-neutral-500">Cargando…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Racha actual', value: `${profile.streak_count} días` },
                { label: 'Mejor racha', value: `${profile.best_streak} días` },
                { label: 'Últimos 7 días', value: `${stats.last7} hábitos` },
                { label: 'Días activos (30)', value: `${stats.activeDays}` },
              ].map((s) => (
                <div key={s.label} className="card p-4">
                  <p className="text-xs text-neutral-500">{s.label}</p>
                  <p className="text-lg font-display font-bold text-neutral-900">{s.value}</p>
                </div>
              ))}
            </div>
            <div className="card p-5">
              <BarChart data={stats.last30} unit="hábitos" title="Hábitos completados por día (últimos 30 días)" />
            </div>
            <div className="card p-5">
              <BarChart data={stats.weeks} unit="XP" title="XP ganada por semana (últimas 8)" />
            </div>
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-neutral-700 mb-3">Por categoría</h2>
              <ul className="space-y-2">
                {stats.byCategory.map((c) => (
                  <li key={c.category} className="flex items-center gap-3">
                    <span className="w-28 text-sm text-neutral-600">{c.category}</span>
                    <div className="flex-1 h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500" style={{ width: `${stats.total ? (c.count / stats.total) * 100 : 0}%` }} />
                    </div>
                    <span className="w-10 text-right text-sm font-semibold text-neutral-700">{c.count}</span>
                  </li>
                ))}
                <li className="flex items-center gap-3">
                  <span className="w-28 text-sm text-neutral-600">De grupos</span>
                  <div className="flex-1 h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-accent-500" style={{ width: `${stats.total ? (stats.groupCount / stats.total) * 100 : 0}%` }} />
                  </div>
                  <span className="w-10 text-right text-sm font-semibold text-neutral-700">{stats.groupCount}</span>
                </li>
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
