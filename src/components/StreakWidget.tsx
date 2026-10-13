interface StreakWidgetProps {
  streak: number
}

export default function StreakWidget({ streak }: StreakWidgetProps) {
  const active = streak > 0
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white border border-neutral-100 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${active ? 'bg-orange-50' : 'bg-neutral-100'}`}>
        <svg viewBox="0 0 24 24" className={`w-5 h-5 ${active ? 'text-orange-500' : 'text-neutral-400'}`} fill="currentColor">
          <path d="M12 2c1 3 4 5 4 9a4 4 0 11-8 0c0-2 1-3 2-4 0-2 1-4 2-5z" />
        </svg>
      </div>
      <div className="leading-tight">
        <span className="text-xl font-display font-bold text-neutral-900">{streak}</span>
        <span className="text-xs text-neutral-500 ml-1">Días en racha</span>
      </div>
    </div>
  )
}
