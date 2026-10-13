interface EmptyStateProps {
  onCreate: () => void
}

export default function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-24 h-24 bg-primary-50 rounded-3xl flex items-center justify-center mb-6">
        <svg viewBox="0 0 24 24" className="w-12 h-12 text-primary-400" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2h-4M9 11V7a3 3 0 116 0v4M9 11h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="text-lg font-display font-bold text-neutral-900 mb-2">
        Aún no tienes hábitos registrados
      </h3>
      <p className="text-neutral-500 mb-6 max-w-sm">
        Crea tu primer hábito y empieza a ganar XP, mantener rachas y subir de nivel.
      </p>
      <button onClick={onCreate} className="btn-primary flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        Crear mi primer hábito
      </button>
    </div>
  )
}
