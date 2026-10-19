import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await requestPasswordReset(email.trim())
    setLoading(false)
    if (err) setError(err)
    else setSent(true)
  }

  return (
    <AuthLayout
      title="Recuperar contraseña"
      subtitle="Te mandamos un correo con un enlace para elegir una contraseña nueva."
      footer={<Link to="/signin" className="text-primary-600 font-semibold">Volver a iniciar sesión</Link>}
    >
      {sent ? (
        <div className="rounded-xl bg-primary-50 border border-primary-200 px-4 py-3 text-sm text-primary-800" role="status">
          Si <strong>{email}</strong> tiene una cuenta, en unos minutos te llega el correo. Revisá también la carpeta de spam.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5" htmlFor="fp-email">Correo electrónico</label>
            <input id="fp-email" type="email" required className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Enviando…' : 'Enviar correo'}</button>
        </form>
      )}
    </AuthLayout>
  )
}
