import { useEffect, useState } from 'react'

interface FloatingXpProps {
  xp: number
  x: number
  y: number
  onDone: () => void
}

export default function FloatingXp({ xp, x, y, onDone }: FloatingXpProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onDone()
    }, 1500)
    return () => clearTimeout(timer)
  }, [onDone])

  if (!visible) return null

  return (
    <div
      className="fixed z-50 pointer-events-none text-lg font-bold text-[#00C853] animate-float-up"
      style={{ left: x, top: y }}
    >
      +{xp} XP
    </div>
  )
}
