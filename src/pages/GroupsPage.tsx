import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import AppHeader from '../components/AppHeader'
import type { Group, MyGroup } from '../types'

export default function GroupsPage() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [groups, setGroups] = useState<MyGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [newName, setNewName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(false)
    const { data, error } = await supabase.rpc('my_groups')
    if (error) setLoadError(true)
    else setGroups((data || []) as MyGroup[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setBusy(true)
    const { data, error } = await supabase.rpc('create_group', { p_name: newName.trim() })
    setBusy(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast('Grupo creado.', 'success')
    navigate(`/grupos/${(data as Group).id}`)
  }

  const join = async (e: FormEvent) => {
    e.preventDefault()
    setJoinError(null)
    if (!code.trim()) return
    setBusy(true)
    const { data, error } = await supabase.rpc('join_group', { p_code: code.trim() })
    setBusy(false)
    if (error) {
      setJoinError(error.message)
      return
    }
    showToast('Te uniste al grupo.', 'success')
    navigate(`/grupos/${(data as Group).id}`)
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-900">Grupos</h1>
          <p className="text-neutral-500 text-sm">
            Compitan con los mismos hábitos y la misma XP. Cada grupo tiene su propio ranking.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <form onSubmit={create} className="card p-5 space-y-3">
            <h2 className="font-display font-bold text-neutral-900">Crear un grupo</h2>
            <label className="block text-sm font-medium text-neutral-700" htmlFor="group-name">Nombre</label>
            <input
              id="group-name"
              className="input-field"
              value={newName}
              maxLength={40}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej.: 5to B"
              required
            />
            <button type="submit" className="btn-primary w-full" disabled={busy || !newName.trim()}>
              Crear
            </button>
          </form>

          <form onSubmit={join} className="card p-5 space-y-3">
            <h2 className="font-display font-bold text-neutral-900">Unirme con un código</h2>
            <label className="block text-sm font-medium text-neutral-700" htmlFor="group-code">Código de invitación</label>
            <input
              id="group-code"
              className="input-field uppercase tracking-widest"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABC123"
              required
            />
            {joinError && <p className="text-sm text-red-600" role="alert">{joinError}</p>}
            <button type="submit" className="btn-secondary w-full" disabled={busy || !code.trim()}>
              Unirme
            </button>
          </form>
        </div>

        <section>
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Mis grupos</h2>
          {loading ? (
            <p className="text-neutral-500">Cargando…</p>
          ) : loadError ? (
            <div className="card p-6 text-center" role="alert">
              <p className="text-neutral-600 mb-3">No pudimos cargar tus grupos.</p>
              <button className="btn-primary" onClick={() => { setLoading(true); load() }}>Reintentar</button>
            </div>
          ) : groups.length === 0 ? (
            <p className="text-neutral-500">Todavía no participás en ningún grupo.</p>
          ) : (
            <ul className="space-y-3">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link to={`/grupos/${g.id}`} className="card p-4 flex items-center justify-between hover:border-primary-300 transition-colors">
                    <div>
                      <p className="font-semibold text-neutral-900">{g.name}</p>
                      <p className="text-xs text-neutral-500">{g.members} participantes</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-display font-bold text-primary-700">#{g.my_position}</p>
                      <p className="text-xs text-neutral-500">{g.my_xp} XP</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
