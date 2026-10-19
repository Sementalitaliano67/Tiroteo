import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import AppHeader from '../components/AppHeader'
import { computeBadges, type Badge } from '../lib/stats'
import { PROFILE_COLUMNS, type MyGroup, type Profile } from '../types'

export default function ProfilePage() {
  const { user, profile, setProfile } = useAuth()
  const { showToast } = useToast()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [reminder, setReminder] = useState(profile?.reminder_time?.slice(0, 5) ?? '')
  const [saving, setSaving] = useState(false)
  const [badges, setBadges] = useState<Badge[]>([])
  const [permission, setPermission] = useState<NotificationPermission | 'no-soportado'>(
    typeof Notification === 'undefined' ? 'no-soportado' : Notification.permission,
  )

  useEffect(() => {
    if (!profile || !user) return
    ;(async () => {
      const [count, groups] = await Promise.all([
        supabase.from('habit_completions').select('id', { count: 'exact', head: true }),
        supabase.rpc('my_groups'),
      ])
      const myGroups = (groups.data || []) as MyGroup[]
      setBadges(
        computeBadges({
          profile,
          totalCompletions: count.count ?? 0,
          groupsJoined: myGroups.length,
          groupsCreated: myGroups.filter((g) => g.creator_id === user.id).length,
        }),
      )
    })()
  }, [profile, user])

  const save = async (fields: Partial<Pick<Profile, 'display_name' | 'reminder_time' | 'theme'>>, message: string) => {
    if (!profile) return
    setSaving(true)
    const { data, error } = await supabase.from('profiles').update(fields).eq('id', profile.id).select(PROFILE_COLUMNS).single()
    setSaving(false)
    if (error || !data) {
      showToast('No se pudieron guardar los cambios.', 'error')
      return
    }
    setProfile(data as Profile)
    showToast(message, 'success')
  }

  const saveName = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2 || trimmed.length > 40) {
      showToast('El nombre debe tener entre 2 y 40 caracteres.', 'error')
      return
    }
    save({ display_name: trimmed }, 'Nombre actualizado.')
  }

  const saveReminder = async (e: FormEvent) => {
    e.preventDefault()
    if (reminder && permission === 'default') {
      setPermission(await Notification.requestPermission())
    }
    save({ reminder_time: reminder || null }, reminder ? 'Recordatorio guardado.' : 'Recordatorio desactivado.')
  }

  if (!profile) return null

  return (
    <div className="min-h-screen bg-neutral-50">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <h1 className="text-2xl font-display font-bold text-neutral-900">Perfil</h1>

        <form onSubmit={saveName} className="card p-5 space-y-3">
          <h2 className="font-display font-bold text-neutral-900">Datos</h2>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="p-name">Nombre</label>
          <input id="p-name" className="input-field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <p className="text-xs text-neutral-500">Correo: {user?.email}</p>
          <button type="submit" className="btn-primary" disabled={saving}>Guardar</button>
        </form>

        <form onSubmit={saveReminder} className="card p-5 space-y-3">
          <h2 className="font-display font-bold text-neutral-900">Recordatorio diario</h2>
          <p className="text-sm text-neutral-500">
            A esta hora te avisamos si te quedan hábitos pendientes. El aviso llega solo si Tiroteo está abierto en alguna
            pestaña.
          </p>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="p-reminder">Hora</label>
          <input id="p-reminder" type="time" className="input-field max-w-[10rem]" value={reminder} onChange={(e) => setReminder(e.target.value)} />
          {permission === 'denied' && (
            <p className="text-xs text-amber-700">Bloqueaste las notificaciones del navegador: el aviso se verá solo dentro de la app.</p>
          )}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>Guardar</button>
            {profile.reminder_time && (
              <button type="button" className="btn-secondary" onClick={() => { setReminder(''); save({ reminder_time: null }, 'Recordatorio desactivado.') }}>
                Desactivar
              </button>
            )}
          </div>
        </form>

        <div className="card p-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-neutral-900">Modo oscuro</h2>
            <p className="text-sm text-neutral-500">Se aplica a toda la app.</p>
          </div>
          <button
            role="switch"
            aria-checked={profile.theme === 'oscuro'}
            aria-label="Modo oscuro"
            onClick={() => save({ theme: profile.theme === 'oscuro' ? 'claro' : 'oscuro' }, 'Tema actualizado.')}
            className={`relative w-14 h-8 rounded-full transition-colors ${profile.theme === 'oscuro' ? 'bg-primary-600' : 'bg-neutral-300'}`}
          >
            <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${profile.theme === 'oscuro' ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <section className="card p-5">
          <h2 className="font-display font-bold text-neutral-900 mb-3">Insignias</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {badges.map((b) => (
              <li
                key={b.id}
                className={`rounded-xl border p-3 ${b.unlocked ? 'border-primary-200 bg-primary-50' : 'border-neutral-200 opacity-60'}`}
              >
                <p className="text-2xl" aria-hidden="true">{b.unlocked ? b.icon : '🔒'}</p>
                <p className="font-semibold text-sm text-neutral-900">{b.name}</p>
                <p className="text-xs text-neutral-500">{b.description}</p>
                <p className="sr-only">{b.unlocked ? 'Desbloqueada' : 'Bloqueada'}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
