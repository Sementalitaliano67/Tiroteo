import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'

export default function SignUpPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const validateEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setEmailError(null)
    setPasswordError(null)

    let hasError = false

    if (!displayName.trim() || !email.trim() || !password) {
      setFormError('Todos los campos son obligatorios.')
      if (!displayName.trim()) { nameRef.current?.focus(); return }
      if (!email.trim()) { emailRef.current?.focus(); return }
      if (!password) { passwordRef.current?.focus(); return }
      return
    }

    if (displayName.trim().length < 2 || displayName.trim().length > 50) {
      setFormError('El nombre debe tener entre 2 y 50 caracteres.')
      nameRef.current?.focus()
      return
    }

    if (!validateEmail(email.trim())) {
      setEmailError('Ingresa un correo electrónico válido.')
      emailRef.current?.focus()
      hasError = true
    }

    if (password.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres.')
      passwordRef.current?.focus()
      hasError = true
    } else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setPasswordError('La contraseña debe contener al menos 1 letra y 1 número.')
      passwordRef.current?.focus()
      hasError = true
    }

    if (hasError) return

    setLoading(true)
    const { error: signUpError } = await signUp(email.trim(), password, displayName.trim())
    if (signUpError) {
      setFormError(signUpError)
      setLoading(false)
      return
    }
    navigate('/dashboard')
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Empieza tu viaje de hábitos hoy mismo."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/signin" className="text-primary-600 font-semibold hover:text-primary-700 transition-colors">
            Inicia sesión
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Nombre</label>
          <input
            ref={nameRef}
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="¿Cómo te llaman tus amigos?"
            className="input-field"
            autoComplete="name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Correo electrónico</label>
          <input
            ref={emailRef}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            className="input-field"
            autoComplete="email"
          />
          {emailError && <p className="mt-1.5 text-sm text-red-600">{emailError}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Contraseña</label>
          <input
            ref={passwordRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres, 1 letra y 1 número"
            className="input-field"
            autoComplete="new-password"
          />
          {passwordError && <p className="mt-1.5 text-sm text-red-600">{passwordError}</p>}
        </div>

        {formError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Creando cuenta…
            </>
          ) : (
            'Crear cuenta'
          )}
        </button>
      </form>
    </AuthLayout>
  )
}
