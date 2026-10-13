interface XpBarProps {
  xp: number
  level: number
}

export default function XpBar({ xp, level }: XpBarProps) {
  const xpRequired = level * 100
  const xpInLevel = xp % xpRequired
  const progress = Math.min((xpInLevel / xpRequired) * 100, 100)

  return (
    <div className="flex-1 min-w-[160px]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-neutral-500">Nivel {level}</span>
        <span className="text-xs font-medium text-neutral-500">{xpInLevel}/{xpRequired} XP</span>
      </div>
      <div className="h-2.5 bg-neutral-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
