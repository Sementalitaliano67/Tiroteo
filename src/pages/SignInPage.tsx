import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'

export default function SignInPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: signInError } = await signIn(email.trim(), password)
    if (signInError) {
      setError(signInError)
      setPassword('')
      setLoading(false)
      return
    }
    navigate('/dashboard')
  }

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Bienvenido de vuelta. ¡Vamos a seguir con la racha!"
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/signup" className="text-primary-600 font-semibold hover:text-primary-700 transition-colors">
            Crea una
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Correo electrónico</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            required
            className="input-field"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            required
            className="input-field"
            autoComplete="current-password"
          />
        </div>

        <div className="text-right -mt-2">
          <Link to="/recuperar" className="text-sm text-primary-600 font-semibold hover:text-primary-700">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Entrando…
            </>
          ) : (
            'Iniciar sesión'
          )}
        </button>
      </form>
    </AuthLayout>
  )
}
