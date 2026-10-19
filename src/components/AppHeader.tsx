import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import StreakWidget from './StreakWidget'
import XpBar from './XpBar'

const LINKS = [
  { to: '/dashboard', label: 'Hoy' },
  { to: '/grupos', label: 'Grupos' },
  { to: '/estadisticas', label: 'Estadísticas' },
  { to: '/perfil', label: 'Perfil' },
]

export default function AppHeader() {
  const { profile, signOut } = useAuth()

  return (
    <header className="bg-surface border-b border-neutral-100 sticky top-0 z-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-md shadow-primary-600/20">
            <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" aria-hidden="true">
              <path d="M10 16l4 4 8-8" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-xl font-display font-bold text-neutral-900 hidden sm:block">Tiroteo</span>
        </div>

        <div className="flex items-center gap-3 flex-1 justify-end">
          <StreakWidget streak={profile?.streak_count ?? 0} />
          <XpBar xp={profile?.xp ?? 0} level={profile?.level ?? 1} />
          <button
            onClick={() => signOut()}
            className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors whitespace-nowrap"
          >
            Salir
          </button>
        </div>
      </div>
      <nav className="max-w-3xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto" aria-label="Secciones">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `px-3 py-2 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
