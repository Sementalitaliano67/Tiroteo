import { XP_PER_LEVEL } from '../lib/date'

interface XpBarProps {
  xp: number
  level: number
}

// 100 XP por nivel: el nivel 2 empieza en 100, el 3 en 200, etc.
export default function XpBar({ xp, level }: XpBarProps) {
  const xpInLevel = Math.max(xp - (level - 1) * XP_PER_LEVEL, 0)
  const progress = Math.min((xpInLevel / XP_PER_LEVEL) * 100, 100)

  return (
    <div className="flex-1 min-w-[140px]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-neutral-500">Nivel {level}</span>
        <span className="text-xs font-medium text-neutral-500">{xpInLevel}/{XP_PER_LEVEL} XP</span>
      </div>
      <div
        className="h-2.5 bg-neutral-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={XP_PER_LEVEL}
        aria-valuenow={xpInLevel}
        aria-label={`Progreso del nivel ${level}`}
      >
        <div
          className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
