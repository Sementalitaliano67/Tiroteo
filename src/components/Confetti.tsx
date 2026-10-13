import { useEffect, useState } from 'react'

const COLORS = ['#2d9a4a', '#f58400', '#4cb468', '#ffa617', '#7ccc91']

interface Piece {
  id: number
  left: number
  delay: number
  duration: number
  color: string
  rotation: number
}

export default function Confetti() {
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    const generated: Piece[] = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.3,
      duration: 1.5 + Math.random() * 1,
      color: COLORS[i % COLORS.length],
      rotation: Math.random() * 360,
    }))
    setPieces(generated)
    const timer = setTimeout(() => setPieces([]), 3000)
    return () => clearTimeout(timer)
  }, [])

  if (pieces.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute top-0 w-2.5 h-2.5 animate-confetti-fall"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  )
}
