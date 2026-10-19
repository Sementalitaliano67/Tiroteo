import type { ReactNode } from 'react'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}

export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left brand panel */}
      <div className="lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 flex flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute top-10 left-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute bottom-20 right-10 w-56 h-56 bg-accent-400/10 rounded-full blur-3xl" />
        <div className="relative z-10 max-w-md text-center lg:text-left">
          <div className="flex items-center gap-3 justify-center lg:justify-start mb-8">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
                <path d="M10 16l4 4 8-8" stroke="#2d9a4a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-3xl font-display font-bold text-white">Tiroteo</h1>
          </div>
          <p className="text-primary-100 text-lg leading-relaxed">
            Convierte tus hábitos en un juego. Gana XP, mantén rachas, desbloquea insignias y compite en grupos.
          </p>
          <div className="mt-10 flex flex-wrap gap-4 justify-center lg:justify-start">
            <div className="flex items-center gap-2 text-primary-100">
              <span className="w-2 h-2 bg-accent-400 rounded-full" />
              <span className="text-sm font-medium">Rachas diarias</span>
            </div>
            <div className="flex items-center gap-2 text-primary-100">
              <span className="w-2 h-2 bg-accent-400 rounded-full" />
              <span className="text-sm font-medium">Niveles y XP</span>
            </div>
            <div className="flex items-center gap-2 text-primary-100">
              <span className="w-2 h-2 bg-accent-400 rounded-full" />
              <span className="text-sm font-medium">Ranking por grupo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 sm:p-12 bg-neutral-50">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-display font-bold text-neutral-900 mb-2">{title}</h2>
          <p className="text-neutral-500 mb-8">{subtitle}</p>
          {children}
          <div className="mt-6 text-center text-sm text-neutral-500">{footer}</div>
        </div>
      </div>
    </div>
  )
}
