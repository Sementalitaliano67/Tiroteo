import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { browserTimezone } from '../lib/date'
import { PROFILE_COLUMNS, type Profile } from '../types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  recovering: boolean
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null; needsConfirmation: boolean }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  setProfile: (p: Profile) => void
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function applyTheme(theme: 'claro' | 'oscuro') {
  document.documentElement.classList.toggle('dark', theme === 'oscuro')
  try {
    localStorage.setItem('tiroteo-tema', theme)
  } catch {
    // Sin almacenamiento local el tema igual se aplica en esta visita.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfileState] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  const setProfile = useCallback((p: Profile) => {
    setProfileState(p)
    applyTheme(p.theme)
  }, [])

  // Al abrir la app el servidor revisa la racha (un día programado sin cumplir la deja en 0).
  const fetchProfile = useCallback(async () => {
    const { data, error } = await supabase.rpc('sync_my_stats')
    if (error || !data) {
      setProfileState(null)
      return
    }
    const p = data as Profile
    const tz = browserTimezone()
    if (p.timezone !== tz) {
      const { data: updated } = await supabase
        .from('profiles')
        .update({ timezone: tz })
        .eq('id', p.id)
        .select(PROFILE_COLUMNS)
        .single()
      if (updated) {
        setProfile(updated as Profile)
        return
      }
    }
    setProfile(p)
  }, [setProfile])

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) await fetchProfile()
  }, [session?.user?.id, fetchProfile])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(newSession)
      if (!newSession) {
        setProfileState(null)
        setLoading(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setProfileState(null)
      return
    }
    setLoading(true)
    ;(async () => {
      await fetchProfile()
      setLoading(false)
    })()
  }, [session?.user?.id, fetchProfile])

  const signUp = async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) return { error: translateError(error.message), needsConfirmation: false }
    return { error: null, needsConfirmation: !data.session }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: translateError(error.message) }
    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfileState(null)
  }

  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer`,
    })
    if (error) return { error: translateError(error.message) }
    return { error: null }
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: translateError(error.message) }
    setRecovering(false)
    return { error: null }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        recovering,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        setProfile,
        requestPasswordReset,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

function translateError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('already registered') || lower.includes('already been registered'))
    return 'El correo ingresado ya está asociado a una cuenta registrada.'
  if (lower.includes('invalid login') || lower.includes('invalid credentials'))
    return 'Correo o contraseña incorrectos.'
  if (lower.includes('email not confirmed'))
    return 'Todavía no confirmaste tu correo. Revisá tu bandeja de entrada.'
  if (lower.includes('rate limit') || lower.includes('security purposes'))
    return 'Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.'
  if (lower.includes('should be different'))
    return 'La contraseña nueva tiene que ser distinta de la anterior.'
  if (lower.includes('password') && (lower.includes('weak') || lower.includes('at least')))
    return 'La contraseña debe tener al menos 8 caracteres.'
  if (lower.includes('email'))
    return 'Ingresa un correo electrónico válido.'
  return message
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
