import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { localDateString } from '../lib/date'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { isScheduledOn } from '../hooks/useHabitsGame'
import AppHeader from '../components/AppHeader'
import LevelUpModal from '../components/LevelUpModal'
import {
  DAY_LABELS,
  FREQUENCIES,
  type CompleteResult,
  type Frequency,
  type Group,
  type GroupHabitWithCompletion,
  type GroupHabit,
  type RankingRow,
} from '../types'

type Period = 'semanal' | 'total'

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [group, setGroup] = useState<Group | null>(null)
  const [habits, setHabits] = useState<GroupHabitWithCompletion[]>([])
  const [ranking, setRanking] = useState<RankingRow[]>([])
  const [period, setPeriod] = useState<Period>('semanal')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [levelUp, setLevelUp] = useState<number | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [habitName, setHabitName] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('Diario')
  const [days, setDays] = useState<number[]>([])
  const [xp, setXp] = useState('20')
  const [formError, setFormError] = useState<string | null>(null)

  const [confirm, setConfirm] = useState<
    | { kind: 'habit'; habit: GroupHabit }
    | { kind: 'leave' }
    | { kind: 'delete' }
    | { kind: 'kick'; userId: string; name: string }
    | null
  >(null)
  const [confirmName, setConfirmName] = useState('')

  const isCreator = group?.creator_id === user?.id
  const today = localDateString()
  const todayDow = new Date().getDay()

  const loadRanking = useCallback(async (p: Period) => {
    if (!id) return
    const { data } = await supabase.rpc('group_ranking', { p_group: id, p_period: p })
    setRanking((data || []) as RankingRow[])
  }, [id])

  const load = useCallback(async () => {
    if (!id) return
    setLoadError(false)
    const [g, h, c] = await Promise.all([
      supabase.from('groups').select('*').eq('id', id).maybeSingle(),
      supabase.from('group_habits').select('*').eq('group_id', id).eq('is_active', true).order('created_at'),
      supabase.from('group_completions').select('group_habit_id').eq('group_id', id).eq('user_id', user?.id ?? '').eq('completed_date', today),
    ])
    if (g.error || h.error || c.error) {
      setLoadError(true)
      setLoading(false)
      return
    }
    if (!g.data) {
      showToast('No sos parte de ese grupo.', 'info')
      navigate('/grupos')
      return
    }
    const done = new Set((c.data || []).map((x) => x.group_habit_id))
    setGroup(g.data as Group)
    setHabits(((h.data || []) as GroupHabit[]).map((x) => ({ ...x, completed_today: done.has(x.id) })))
    setLoading(false)
  }, [id, user?.id, today, navigate, showToast])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadRanking(period)
  }, [period, loadRanking])

  const complete = async (habit: GroupHabitWithCompletion) => {
    setHabits((prev) => prev.map((x) => (x.id === habit.id ? { ...x, completed_today: true } : x)))
    const { data, error } = await supabase.rpc('complete_group_habit', { p_habit: habit.id })
    if (error) {
      if (error.code !== '23505') {
        setHabits((prev) => prev.map((x) => (x.id === habit.id ? { ...x, completed_today: false } : x)))
      }
      showToast(error.message, error.code === '23505' ? 'info' : 'error')
      return
    }
    const result = data as CompleteResult
    showToast(`+${result.xp_awarded} XP en el grupo`, 'success')
    if (result.leveled_up) setLevelUp(result.level)
    await Promise.all([loadRanking(period), refreshProfile()])
  }

  const addHabit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const xpNumber = Number(xp)
    if (!Number.isInteger(xpNumber) || xpNumber < 5 || xpNumber > 100) {
      setFormError('La XP tiene que ser un número entero entre 5 y 100.')
      return
    }
    if (frequency === 'Días específicos' && days.length === 0) {
      setFormError('Elegí al menos un día.')
      return
    }
    const { error } = await supabase.rpc('add_group_habit', {
      p_group: id,
      p_name: habitName.trim(),
      p_frequency: frequency,
      p_days: frequency === 'Diario' ? null : days,
      p_xp: xpNumber,
    })
    if (error) {
      setFormError(error.message)
      return
    }
    setHabitName('')
    setXp('20')
    setDays([])
    setFrequency('Diario')
    setShowForm(false)
    showToast('Hábito agregado al grupo.', 'success')
    load()
  }

  const rename = async (habit: GroupHabit) => {
    const name = window.prompt('Nuevo nombre del hábito', habit.name)
    if (!name || !name.trim() || name.trim() === habit.name) return
    const { error } = await supabase.rpc('rename_group_habit', { p_habit: habit.id, p_name: name.trim() })
    if (error) showToast(error.message, 'error')
    else load()
  }

  const runConfirm = async () => {
    if (!confirm || !id) return
    let error = null
    if (confirm.kind === 'habit') {
      ;({ error } = await supabase.rpc('deactivate_group_habit', { p_habit: confirm.habit.id }))
    } else if (confirm.kind === 'leave') {
      ;({ error } = await supabase.rpc('leave_group', { p_group: id }))
    } else if (confirm.kind === 'delete') {
      ;({ error } = await supabase.rpc('delete_group', { p_group: id, p_confirm_name: confirmName }))
    } else if (confirm.kind === 'kick') {
      ;({ error } = await supabase.rpc('remove_group_member', { p_group: id, p_user: confirm.userId }))
    }
    if (error) {
      showToast(error.message, 'error')
      return
    }
    const kind = confirm.kind
    setConfirm(null)
    setConfirmName('')
    if (kind === 'leave' || kind === 'delete') {
      showToast(kind === 'leave' ? 'Saliste del grupo.' : 'Grupo eliminado.', 'success')
      navigate('/grupos')
      return
    }
    load()
    loadRanking(period)
  }

  const copyCode = async () => {
    if (!group) return
    try {
      await navigator.clipboard.writeText(group.invite_code)
      showToast('Código copiado.', 'success')
    } catch {
      showToast(`Código: ${group.invite_code}`, 'info')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <AppHeader />
        <p className="max-w-3xl mx-auto px-6 py-8 text-neutral-500">Cargando…</p>
      </div>
    )
  }

  if (loadError || !group) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <AppHeader />
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="card p-6 text-center" role="alert">
            <p className="text-neutral-600 mb-3">No pudimos cargar el grupo.</p>
            <button className="btn-primary" onClick={() => { setLoading(true); load() }}>Reintentar</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-neutral-900">{group.name}</h1>
            <p className="text-sm text-neutral-500">{isCreator ? 'Sos el creador de este grupo.' : 'Participás en este grupo.'}</p>
          </div>
          <button onClick={copyCode} className="btn-secondary text-sm" aria-label={`Copiar código de invitación ${group.invite_code}`}>
            Código: <span className="font-mono tracking-widest">{group.invite_code}</span>
          </button>
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">Hábitos del grupo</h2>
            {isCreator && (
              <button className="text-sm font-semibold text-primary-700" onClick={() => setShowForm((v) => !v)}>
                {showForm ? 'Cancelar' : '+ Agregar hábito'}
              </button>
            )}
          </div>

          {showForm && isCreator && (
            <form onSubmit={addHabit} className="card p-5 space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="gh-name">Nombre</label>
                <input id="gh-name" className="input-field" value={habitName} maxLength={50} required onChange={(e) => setHabitName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="gh-freq">Frecuencia</label>
                  <select id="gh-freq" className="input-field" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                    {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="gh-xp">XP (5 a 100)</label>
                  <input id="gh-xp" type="number" min={5} max={100} step={1} className="input-field" value={xp} onChange={(e) => setXp(e.target.value)} />
                </div>
              </div>
              {frequency === 'Días específicos' && (
                <fieldset className="flex flex-wrap gap-2">
                  <legend className="text-sm font-medium text-neutral-700 mb-1">Días</legend>
                  {DAY_LABELS.map((label, i) => (
                    <button
                      type="button"
                      key={label}
                      aria-pressed={days.includes(i)}
                      onClick={() => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${days.includes(i) ? 'bg-primary-600 text-white border-primary-600' : 'border-neutral-200 text-neutral-600'}`}
                    >
                      {label}
                    </button>
                  ))}
                </fieldset>
              )}
              <p className="text-xs text-neutral-500">La XP no se podrá cambiar después. Para cambiarla hay que dar de baja el hábito y crear otro.</p>
              {formError && <p className="text-sm text-red-600" role="alert">{formError}</p>}
              <button type="submit" className="btn-primary w-full" disabled={!habitName.trim()}>Agregar</button>
            </form>
          )}

          {habits.length === 0 ? (
            <p className="text-neutral-500">
              {isCreator ? 'Agregá el primer hábito del grupo.' : 'El creador todavía no agregó hábitos.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {habits.map((h) => {
                const scheduled = isScheduledOn(h, todayDow)
                return (
                  <li key={h.id} className={`card p-4 flex items-center gap-4 ${h.completed_today ? 'opacity-60' : ''}`}>
                    <button
                      onClick={() => complete(h)}
                      disabled={h.completed_today || !scheduled}
                      aria-label={`Completar ${h.name}`}
                      className={`flex-shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center ${
                        h.completed_today ? 'bg-primary-600 border-primary-600' : scheduled ? 'border-neutral-300 hover:border-primary-500' : 'border-neutral-200 bg-neutral-50 cursor-not-allowed'
                      }`}
                    >
                      {h.completed_today && (
                        <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-neutral-900 truncate ${h.completed_today ? 'line-through' : ''}`}>{h.name}</p>
                      <p className="text-xs text-neutral-500">
                        <span className="text-primary-600 font-semibold">+{h.xp} XP</span> ·{' '}
                        {h.frequency === 'Diario' ? 'Diario' : (h.frequency_days || []).map((d) => DAY_LABELS[d]).join(', ')}
                        {!scheduled && ' · No programado hoy'}
                      </p>
                    </div>
                    {isCreator && (
                      <div className="flex gap-1">
                        <button onClick={() => rename(h)} className="text-xs px-2 py-1 rounded-lg text-neutral-500 hover:bg-neutral-100" aria-label={`Renombrar ${h.name}`}>Renombrar</button>
                        <button onClick={() => setConfirm({ kind: 'habit', habit: h })} className="text-xs px-2 py-1 rounded-lg text-red-600 hover:bg-red-50" aria-label={`Dar de baja ${h.name}`}>Dar de baja</button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">Ranking</h2>
            <div className="flex gap-1 bg-neutral-100 rounded-lg p-1" role="tablist">
              {(['semanal', 'total'] as Period[]).map((p) => (
                <button
                  key={p}
                  role="tab"
                  aria-selected={period === p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-sm rounded-md font-medium ${period === p ? 'bg-surface text-neutral-900 shadow-sm' : 'text-neutral-500'}`}
                >
                  {p === 'semanal' ? 'Esta semana' : 'Total'}
                </button>
              ))}
            </div>
          </div>
          {period === 'semanal' && <p className="text-xs text-neutral-500 mb-2">El ranking semanal empieza de cero cada lunes.</p>}
          <ol className="card divide-y divide-neutral-100">
            {ranking.map((r) => {
              const me = r.user_id === user?.id
              return (
                <li key={r.user_id} className={`flex items-center gap-3 px-4 py-3 ${me ? 'bg-primary-50' : ''}`}>
                  <span className="w-8 text-center font-display font-bold text-neutral-500">#{r.rank_position}</span>
                  <span className={`flex-1 truncate ${me ? 'font-bold text-primary-800' : 'text-neutral-900'}`}>
                    {r.display_name}{me && ' (vos)'}{r.user_id === group.creator_id && ' · creador'}
                  </span>
                  <span className="font-semibold text-neutral-700">{r.xp} XP</span>
                  {isCreator && !me && (
                    <button
                      onClick={() => setConfirm({ kind: 'kick', userId: r.user_id, name: r.display_name })}
                      className="text-xs text-red-600 hover:underline"
                      aria-label={`Expulsar a ${r.display_name}`}
                    >
                      Expulsar
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        </section>

        <div className="pt-4 border-t border-neutral-200">
          {isCreator ? (
            <button className="text-sm font-semibold text-red-600" onClick={() => setConfirm({ kind: 'delete' })}>Eliminar grupo</button>
          ) : (
            <button className="text-sm font-semibold text-red-600" onClick={() => setConfirm({ kind: 'leave' })}>Salir del grupo</button>
          )}
        </div>
      </main>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirm(null)}>
          <div className="card p-6 w-full max-w-sm mx-4" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-display font-bold text-neutral-900 mb-2">
              {confirm.kind === 'habit' && '¿Dar de baja este hábito?'}
              {confirm.kind === 'leave' && '¿Salir del grupo?'}
              {confirm.kind === 'delete' && '¿Eliminar el grupo?'}
              {confirm.kind === 'kick' && `¿Expulsar a ${confirm.name}?`}
            </h3>
            <p className="text-sm text-neutral-500 mb-4">
              {confirm.kind === 'habit' && 'Deja de aparecer para todos. La XP que ya ganaron se conserva.'}
              {confirm.kind === 'leave' && 'Dejás de aparecer en el ranking. Si volvés a entrar, recuperás tu XP.'}
              {confirm.kind === 'delete' && `Se elimina para todos los participantes. Escribí "${group.name}" para confirmar.`}
              {confirm.kind === 'kick' && 'Deja de aparecer en el ranking. Podría volver a entrar con el código.'}
            </p>
            {confirm.kind === 'delete' && (
              <input className="input-field mb-4" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} aria-label="Nombre del grupo" />
            )}
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={runConfirm}
                disabled={confirm.kind === 'delete' && confirmName !== group.name}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl px-4 py-3 disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {levelUp && <LevelUpModal level={levelUp} onContinue={() => setLevelUp(null)} />}
    </div>
  )
}
