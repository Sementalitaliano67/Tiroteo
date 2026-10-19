import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'

// Destino del enlace del correo de recuperación: Supabase abre una sesión temporal y acá se elige la contraseña nueva.
export default function ResetPasswordPage() {
  const { session, loading: authLoading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('La contraseña debe tener al menos 8 caracteres, con 1 letra y 1 número.')
      return
    }
    setLoading(true)
    const { error: err } = await updatePassword(password)
    setLoading(false)
    if (err) setError(err)
    else navigate('/dashboard')
  }

  return (
    <AuthLayout
      title="Elegí una contraseña nueva"
      subtitle="Después vas a entrar directo a tus hábitos."
      footer={<Link to="/signin" className="text-primary-600 font-semibold">Volver a iniciar sesión</Link>}
    >
      {authLoading ? (
        <p className="text-neutral-500">Verificando el enlace…</p>
      ) : !session ? (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">
          El enlace venció o ya se usó. <Link to="/recuperar" className="font-semibold underline">Pedí uno nuevo</Link>.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5" htmlFor="rp-pass">Contraseña nueva</label>
            <input id="rp-pass" type="password" required className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Guardando…' : 'Guardar contraseña'}</button>
        </form>
      )}
    </AuthLayout>
  )
}
